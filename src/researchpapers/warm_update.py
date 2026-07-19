"""One-command overlay refresh for memory-constrained hosts.

Runs enrichment jobs sequentially with RAM waits between steps so a 16 GB M1
can refresh citations, abstracts, author graph, and static exports without
peaking multiple model loads at once.
"""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from researchpapers.ch_db import ping as ch_ping
from researchpapers.config import PROJECT_ROOT, load_settings
from researchpapers import refresh_manifest
from researchpapers.ram import m1_16gb_profile, wait_for_ram

log = logging.getLogger("researchpapers.warm_update")


def _coerce_count(value: object) -> int:
    """Best-effort extraction of an integer output count from a step result."""
    if isinstance(value, int):
        return value
    if isinstance(value, dict):
        for key in ("enriched", "refreshed", "built", "exported", "count", "rows"):
            v = value.get(key)
            if isinstance(v, int):
                return v
        # Fallback: number of files exported.
        exports = value.get("exports")
        if isinstance(exports, list):
            return len(exports)
    return 0


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
        raise RuntimeError("ClickHouse is not reachable on localhost:8123 — start with: docker compose up -d clickhouse")

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

        def run() -> tuple[int, str | None]:
            out = fn()
            return _coerce_count(out), None

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
    ch_paths = ch_exports.export_review_data(out_dir)
    json_paths = exporter.export_all(settings, out_dir)
    results["exports"] = [str(x) for x in ch_paths + json_paths]
    log.info("exported %d JSON files", len(results["exports"]))

    refresh_manifest.record_step(
        "export_ch",
        source_watermark=None,
        bounds={"json_files": len(results["exports"])},
        timeout_s=600,
        idempotency="overwrite web/public/data/*.json from current CH state",
        output_count=len(results["exports"]),
        quality_signal={"expected_min_output": 1},
    )

    if build_web:
        wait_for_ram(p["min_free_mb"])
        web_dir = PROJECT_ROOT / "web"
        log.info("building Astro site...")
        r = subprocess.run(["npm", "run", "build"], cwd=str(web_dir), capture_output=True, text=True)
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
