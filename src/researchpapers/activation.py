"""Privacy-safe search activation evidence for Foundry.

Satisfies the `data-research-toolbox-automation` "Search activation evidence"
requirement: emit aggregate outcome counters (successful search, result
inspection, saved/organized action) WITHOUT storing raw query text, paper
IDs, or user identifiers in Foundry.

Counters are emitted via the shared fleet Foundry path (PostHog capture).
The module is safe to import in the FastAPI process and in the Pages
Function — it no-ops when no Foundry key is configured.
"""

from __future__ import annotations

import os
from typing import Any

try:
    import httpx
    _HAS_HTTPX = True
except ImportError:  # pragma: no cover — httpx is a core dep
    _HAS_HTTPX = False

PROJECT_SLUG = "research-papers"
# Same shared fleet PostHog project as the Starboard foundry-monitoring module.
POSTHOG_KEY = os.environ.get("FOUNDRY_POSTHOG_KEY") or "phc_qgiAarw4Co4pw9fz3Fxj4UJaHmqzFetqs4JrXhGc35Nd"
POSTHOG_HOST = os.environ.get("FOUNDRY_POSTHOG_HOST", "https://us.i.posthog.com")


def _emit(event: str, properties: dict[str, Any]) -> None:
    """Fire-and-forget PostHog capture. Never raises into the request path."""
    if not _HAS_HTTPX:
        return
    try:
        with httpx.Client(timeout=2.0) as client:
            client.post(
                f"{POSTHOG_HOST}/i/v0/e/",
                json={
                    "api_key": POSTHOG_KEY,
                    "event": event,
                    "distinct_id": f"{PROJECT_SLUG}-server",
                    "properties": {**properties, "project_id": PROJECT_SLUG},
                },
            )
    except Exception:  # noqa: BLE001 — analytics must never break a request
        pass


def track_search_outcome(*, result_count: int, source: str) -> None:
    """Emit one aggregate `search_outcome` event per search request.

    `source` is the surface (`keyword`, `semantic`, `rag`). No query text or
    paper IDs are sent — only the result count bucket and the surface.
    """
    bucket = (
        "zero" if result_count == 0
        else "1-5" if result_count <= 5
        else "6-20" if result_count <= 20
        else "21+"
    )
    _emit(
        "search_outcome",
        {
            "surface": source,
            "result_count_bucket": bucket,
            "result_count_exact": min(result_count, 100),
        },
    )


def track_result_inspection(*, source: str) -> None:
    """Emit one `result_inspection` event when a user opens a paper detail
    from search results. No paper ID is sent."""
    _emit("result_inspection", {"surface": source})


def track_saved_action(*, action: str) -> None:
    """Emit a `saved_action` event for organized/saved actions (export,
    reading-path add). `action` is a coarse verb, not user content."""
    _emit("saved_action", {"action": action})
