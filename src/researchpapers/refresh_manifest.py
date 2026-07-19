"""Structured refresh-lifecycle manifest for researchPapers overlay jobs.

Satisfies the `data-research-toolbox-automation` capability requirement
"Refresh lifecycle and quality": every import/refresh exposes source
watermark, bounds, timeout, idempotency/dedup, retries, output counts/quality
signal, freshness, and durable failure state.

The manifest is a single JSON file at `data/refresh-manifest.json` that is
overwritten on every run. A run that exits successfully with zero output
where the declared expectation is non-zero fails quality verification and
does NOT advance freshness.
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from researchpapers.config import PROJECT_ROOT

MANIFEST_PATH = PROJECT_ROOT / "data" / "refresh-manifest.json"

# Per-step retry policy. Overlay jobs hit external APIs (S2, arXiv) that
# transiently fail; bounded retries with exponential backoff keep a single
# 503 from failing the whole run.
DEFAULT_RETRIES = {"max_attempts": 3, "backoff_base_ms": 2000}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _load() -> dict[str, Any]:
    if not MANIFEST_PATH.exists():
        return {"runs": {}, "last_failure": None}
    try:
        return json.loads(MANIFEST_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {"runs": {}, "last_failure": None}


def _save(state: dict[str, Any]) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(state, indent=2, sort_keys=True))


def record_step(
    step: str,
    *,
    source_watermark: str | None,
    bounds: dict[str, Any],
    timeout_s: int,
    idempotency: str,
    output_count: int,
    quality_signal: dict[str, Any] | None,
    error: str | None = None,
    retries_used: int = 0,
) -> dict[str, Any]:
    """Record one step's outcome into the manifest and return the step record.

    `quality_signal` must include at least `expected_min_output`. If
    `output_count < expected_min_output` and `error is None`, the step is
    marked `quality_failed` and does not advance freshness unless the caller
    supplied explicit evidence for a verified steady-state no-op.
    """
    state = _load()
    runs = state.setdefault("runs", {})
    prior = runs.get(step, {})
    prior_freshness = prior.get("freshness", {}).get("wall_clock") if prior else None

    expected_min = (quality_signal or {}).get("expected_min_output", 0)
    verified_noop = bool((quality_signal or {}).get("verified_steady_state_noop", False))
    quality_failed = error is None and output_count < expected_min and not verified_noop
    succeeded = error is None and not quality_failed

    record: dict[str, Any] = {
        "step": step,
        "source_watermark": source_watermark,
        "bounds": bounds,
        "timeout_s": timeout_s,
        "idempotency": idempotency,
        "retries": {**DEFAULT_RETRIES, "used": retries_used},
        "output_count": output_count,
        "quality_signal": quality_signal,
        "quality_failed": quality_failed,
        "error": error,
        "freshness": {
            "wall_clock": _now_iso() if succeeded else prior_freshness,
            "delta_s_from_prior": (
                int(time.time() - _parse_iso(prior_freshness))
                if succeeded and prior_freshness
                else None
            ),
        },
    }
    runs[step] = record

    if error is not None or quality_failed:
        state["last_failure"] = {
            "step": step,
            "at": _now_iso(),
            "error": error or "quality_failed: zero output where non-zero expected",
            "unresolved": True,
        }
    elif (state.get("last_failure") or {}).get("step") == step:
        # This step recovered — clear its unresolved failure.
        state["last_failure"] = None

    _save(state)
    return record


def with_retry(
    step: str,
    fn: Callable[[], tuple[int, str | None] | tuple[int, str | None, bool]],
    *,
    source_watermark: str | None,
    bounds: dict[str, Any],
    timeout_s: int,
    idempotency: str,
    expected_min_output: int,
) -> dict[str, Any]:
    """Run `fn`, retry transient failures, record the manifest entry.

    `fn` returns `(output_count, source_watermark_or_none)` and may add a third
    boolean only when it has verified a steady-state no-op. If it raises, the
    exception message is recorded as the step error.
    """
    max_attempts = DEFAULT_RETRIES["max_attempts"]
    base_ms = DEFAULT_RETRIES["backoff_base_ms"]
    last_error: str | None = None
    retries_used = 0
    output_count = 0
    wm = source_watermark
    verified_noop = False

    for attempt in range(1, max_attempts + 1):
        try:
            outcome = fn()
            if len(outcome) == 2:
                output_count, wm_override = outcome
                verified_noop = False
            else:
                output_count, wm_override, verified_noop = outcome
            if wm_override is not None:
                wm = wm_override
            last_error = None
            break
        except Exception as exc:  # noqa: BLE001 — record and retry
            last_error = f"{type(exc).__name__}: {exc}"
            retries_used = attempt
            if attempt >= max_attempts:
                break
            time.sleep((base_ms * 2 ** (attempt - 1)) / 1000.0)

    return record_step(
        step,
        source_watermark=wm,
        bounds=bounds,
        timeout_s=timeout_s,
        idempotency=idempotency,
        output_count=output_count,
        quality_signal={
            "expected_min_output": expected_min_output,
            "verified_steady_state_noop": verified_noop,
        },
        error=last_error,
        retries_used=retries_used,
    )


def read_manifest() -> dict[str, Any]:
    """Return the current manifest state (for health endpoints)."""
    return _load()


def last_failure() -> dict[str, Any] | None:
    return _load().get("last_failure")


def _parse_iso(s: str | None) -> float:
    if not s:
        return 0.0
    try:
        return datetime.fromisoformat(s).timestamp()
    except ValueError:
        return 0.0
