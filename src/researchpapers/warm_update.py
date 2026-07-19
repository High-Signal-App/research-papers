"""One-command overlay refresh for memory-constrained hosts.

Runs enrichment jobs sequentially with RAM waits between steps so a 16 GB M1
can refresh citations, abstracts, author graph, and static exports without
peaking multiple model loads at once.
"""

from __future__ import annotations

import json
import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from researchpapers import refresh_manifest
from researchpapers.ch_db import ping as ch_ping
from researchpapers.config import PROJECT_ROOT, load_settings
from researchpapers.ram import m1_16gb_profile, wait_for_ram

log = logging.getLogger("researchpapers.warm_update")


@dataclass(frozen=True)
class _StepOutcome:
    output_count: int
    source_watermark: str | None = None
    verified_steady_state_noop: bool = False


def _counter(result: dict[str, Any], key: str) -> int:
    value = result.get(key)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"step result counter {key!r} must be a non-negative integer")
    return value


def _optional_counter(result: dict[str, Any], key: str) -> int | None:
    if key not in result:
        return None
    return _counter(result, key)


def _step_outcome(step: str, value: object) -> _StepOutcome:
    """Extract the documented count and explicit no-op evidence for one step."""
    if not isinstance(value, dict):
        raise ValueError(f"warm-update step {step} returned an invalid result")

    watermark = value.get("source_watermark")
    if watermark is not None and (not isinstance(watermark, str) or not watermark.strip()):
        raise ValueError(f"warm-update step {step} returned an invalid source watermark")

    if step == "enrich_citations":
        enriched = _counter(value, "enriched")
        skipped = _optional_counter(value, "skipped")
        failed = _optional_counter(value, "failed")
        verified_noop = enriched == 0 and skipped == 0 and failed == 0
        return _StepOutcome(enriched, watermark, verified_noop)

    if step == "refresh_abstracts":
        detected = _counter(value, "detected")
        refreshed = _counter(value, "refreshed")
        unchanged = _optional_counter(value, "unchanged")
        failed = _optional_counter(value, "failed")
        verified_noop = (
            refreshed == 0
            and failed == 0
            and unchanged is not None
            and (detected == 0 or unchanged == detected)
        )
        return _StepOutcome(refreshed, watermark, verified_noop)

    if step == "build_author_graph":
        _counter(value, "authorships")
        authors = _counter(value, "authors")
        _counter(value, "inferred")
        return _StepOutcome(authors, watermark)

    raise ValueError(f"warm-update has no result contract for step {step}")


def _validate_exports(paths: list[Path], out_dir: Path) -> list[Path]:
    """Require every reported export to be a non-empty, valid JSON asset."""
    if not paths:
        raise ValueError("exporters produced no JSON files")

    root = out_dir.resolve()
    validated: list[Path] = []
    for path in paths:
        if not isinstance(path, Path):
            raise ValueError(f"exporter returned a non-path value: {path!r}")
        resolved = path.resolve()
        if not resolved.is_relative_to(root):
            raise ValueError(f"export escaped the static data directory: {path}")
        if not resolved.is_file() or resolved.stat().st_size == 0:
            raise ValueError(f"export is missing or empty: {path}")
        try:
            payload = json.loads(resolved.read_text())
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError(f"export is not valid JSON: {path}") from exc
        if not isinstance(payload, (dict, list)) or not payload:
            raise ValueError(f"export contains no data: {path}")
        validated.append(path)
    return validated


def run_warm_update(
    *,
    build_web: bool = False,
    skip_enrich: bool = False,
    skip_abstracts: bool = False,
    skip_author_graph: bool = False,
    profile: dict[str, int] | None = None,
) -> dict[str, object]:
    """Sequential overlay refresh tuned for 16 GB RAM.

    Each step records a structured entry in `data/refresh-manifest.json`
    (source watermark, bounds, retries, output count, quality signal,
    freshness, failure state). A step that returns zero output where
    non-zero is expected fails quality verification and does not advance
    freshness.
    """
    if not ch_ping():
        raise RuntimeError(
            "ClickHouse is not reachable on localhost:8123 — start with: "
            "docker compose up -d clickhouse"
        )

    settings = load_settings()
    p = profile or m1_16gb_profile()
    results: dict[str, object] = {"profile": p}

    def _step(
        name: str,
        fn,
        *,
        bounds: dict[str, int],
        timeout_s: int,
        idempotency: str,
        expected_min_output: int,
    ) -> None:
        wait_for_ram(p["min_free_mb"])
        log.info("=== %s ===", name)

        def run() -> tuple[int, str | None, bool]:
            out = fn()
            outcome = _step_outcome(name, out)
            return (
                outcome.output_count,
                outcome.source_watermark,
                outcome.verified_steady_state_noop,
            )

        record = refresh_manifest.with_retry(
            name,
            run,
            source_watermark=None,
            bounds=bounds,
            timeout_s=timeout_s,
            idempotency=idempotency,
            expected_min_output=expected_min_output,
        )
        results[name] = record
        if record.get("error") or record.get("quality_failed"):
            raise RuntimeError(
                f"warm-update step {name} failed: "
                f"{record.get('error') or 'quality_failed (zero output)'}"
            )

    if not skip_enrich:
        from researchpapers import semantic_scholar_enrichment

        def enrich():
            return semantic_scholar_enrichment.enrich_top_papers(
                limit=p["enrich_limit"],
                settings=settings,
            )

        _step(
            "enrich_citations",
            enrich,
            bounds={"enrich_limit": p["enrich_limit"]},
            timeout_s=1800,
            idempotency="ReplacingMergeTree citation_overlay_v2 + FINAL reads",
            expected_min_output=1,
        )

    if not skip_abstracts:
        from researchpapers import arxiv_abstract_refresh

        def refresh():
            return arxiv_abstract_refresh.refresh_suspect_abstracts(
                detect_limit=p["abstract_detect_limit"],
                reembed=True,
            )

        _step(
            "refresh_abstracts",
            refresh,
            bounds={"abstract_detect_limit": p["abstract_detect_limit"]},
            timeout_s=1800,
            idempotency="ReplacingMergeTree abstract_overlay_v2 + FINAL reads",
            expected_min_output=1,
        )

    if not skip_author_graph:
        from researchpapers import author_graph

        def graph():
            return author_graph.build_author_graph(expand_metadata_limit=p["metadata_limit"])

        _step(
            "build_author_graph",
            graph,
            bounds={"metadata_limit": p["metadata_limit"]},
            timeout_s=1800,
            idempotency="ReplacingMergeTree authors_v2 / paper_authorships_v2 + FINAL reads",
            expected_min_output=1,
        )

    wait_for_ram(p["min_free_mb"])

    from researchpapers import ch_exports, exporter

    out_dir = PROJECT_ROOT / "web" / "public" / "data"
    try:
        ch_paths = ch_exports.export_review_data(out_dir)
        json_paths = exporter.export_all(settings, out_dir)
        export_paths = _validate_exports(ch_paths + json_paths, out_dir)
    except Exception as exc:
        refresh_manifest.record_step(
            "export_ch",
            source_watermark=None,
            bounds={},
            timeout_s=600,
            idempotency="overwrite web/public/data/*.json from current CH state",
            output_count=0,
            quality_signal={"expected_min_output": 1},
            error=f"{type(exc).__name__}: {exc}",
        )
        raise RuntimeError(f"warm-update exports failed validation: {exc}") from exc

    results["exports"] = [str(x) for x in export_paths]
    log.info("exported %d valid JSON files", len(export_paths))

    refresh_manifest.record_step(
        "export_ch",
        source_watermark=None,
        bounds={"json_files": len(export_paths)},
        timeout_s=600,
        idempotency="overwrite web/public/data/*.json from current CH state",
        output_count=len(export_paths),
        quality_signal={"expected_min_output": 1},
    )

    if build_web:
        wait_for_ram(p["min_free_mb"])
        web_dir = PROJECT_ROOT / "web"
        log.info("building Astro site...")
        r = subprocess.run(
            ["npm", "run", "build"],
            cwd=str(web_dir),
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            log.error("npm build failed:\n%s", r.stderr)
            refresh_manifest.record_step(
                "web_build",
                source_watermark=None,
                bounds={},
                timeout_s=900,
                idempotency="npm run build (overwrite dist/)",
                output_count=0,
                quality_signal={"expected_min_output": 1},
                error=f"npm build exited {r.returncode}",
            )
            raise RuntimeError("web build failed")
        results["web_dist"] = str(web_dir / "dist")
        refresh_manifest.record_step(
            "web_build",
            source_watermark=None,
            bounds={},
            timeout_s=900,
            idempotency="npm run build (overwrite dist/)",
            output_count=1,
            quality_signal={"expected_min_output": 1},
        )

    return results
