"""Tests for the refresh-lifecycle manifest quality gate.

Covers the `data-research-toolbox-automation` requirement: a refresh that
exits successfully with zero output where non-zero is expected fails
quality verification rather than advancing freshness.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from researchpapers import refresh_manifest


@pytest.fixture
def isolated_manifest(tmp_path, monkeypatch):
    """Point the manifest at a temp path so tests don't touch real state."""
    monkeypatch.setattr(refresh_manifest, "MANIFEST_PATH", tmp_path / "refresh-manifest.json")
    return refresh_manifest.MANIFEST_PATH


def test_zero_output_fails_quality_and_does_not_advance_freshness(isolated_manifest):
    # First, a healthy run to establish a baseline freshness.
    refresh_manifest.record_step(
        "enrich_citations",
        source_watermark="2026-07-18T03:00:00Z",
        bounds={"enrich_limit": 500},
        timeout_s=1800,
        idempotency="ReplacingMergeTree",
        output_count=412,
        quality_signal={"expected_min_output": 1},
    )
    first = json.loads(isolated_manifest.read_text())["runs"]["enrich_citations"]
    assert first["quality_failed"] is False
    first_wall = first["freshness"]["wall_clock"]
    assert first_wall is not None

    # Now a "successful" run that writes zero rows.
    refresh_manifest.record_step(
        "enrich_citations",
        source_watermark="2026-07-19T03:00:00Z",
        bounds={"enrich_limit": 500},
        timeout_s=1800,
        idempotency="ReplacingMergeTree",
        output_count=0,
        quality_signal={"expected_min_output": 1},
    )
    second = json.loads(isolated_manifest.read_text())["runs"]["enrich_citations"]
    assert second["quality_failed"] is True
    # Freshness must NOT advance on a quality-failed run.
    assert second["freshness"]["wall_clock"] == first_wall

    # And last_failure must record the unresolved quality failure.
    failure = json.loads(isolated_manifest.read_text())["last_failure"]
    assert failure["step"] == "enrich_citations"
    assert failure["unresolved"] is True
    assert "quality_failed" in failure["error"]


def test_step_recovers_clears_last_failure(isolated_manifest):
    refresh_manifest.record_step(
        "refresh_abstracts",
        source_watermark=None,
        bounds={},
        timeout_s=600,
        idempotency="ReplacingMergeTree",
        output_count=0,
        quality_signal={"expected_min_output": 1},
    )
    state = json.loads(isolated_manifest.read_text())
    assert state["last_failure"]["step"] == "refresh_abstracts"

    # Next run succeeds with non-zero output.
    refresh_manifest.record_step(
        "refresh_abstracts",
        source_watermark=None,
        bounds={},
        timeout_s=600,
        idempotency="ReplacingMergeTree",
        output_count=37,
        quality_signal={"expected_min_output": 1},
    )
    state = json.loads(isolated_manifest.read_text())
    assert state["last_failure"] is None
    assert state["runs"]["refresh_abstracts"]["quality_failed"] is False


def test_with_retry_records_error_after_exhausting_attempts(isolated_manifest):
    def boom():
        raise RuntimeError("upstream 503")

    record = refresh_manifest.with_retry(
        "build_author_graph",
        boom,
        source_watermark=None,
        bounds={},
        timeout_s=60,
        idempotency="ReplacingMergeTree",
        expected_min_output=1,
    )
    assert record["error"] is not None
    assert "upstream 503" in record["error"]
    assert record["retries"]["used"] == refresh_manifest.DEFAULT_RETRIES["max_attempts"]
    assert record["quality_failed"] is False  # error path, not quality path

    state = json.loads(isolated_manifest.read_text())
    assert state["last_failure"]["step"] == "build_author_graph"


def test_read_manifest_returns_state(isolated_manifest):
    refresh_manifest.record_step(
        "export_ch",
        source_watermark=None,
        bounds={"json_files": 12},
        timeout_s=600,
        idempotency="overwrite",
        output_count=12,
        quality_signal={"expected_min_output": 1},
    )
    state = refresh_manifest.read_manifest()
    assert "export_ch" in state["runs"]
    assert state["last_failure"] is None
