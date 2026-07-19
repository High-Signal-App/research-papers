"""Focused correctness tests for warm-update result and export validation."""

import json

import pytest

from researchpapers import ch_exports, exporter, refresh_manifest, warm_update


def test_step_outcomes_use_step_specific_counts():
    enrich = warm_update._step_outcome(
        "enrich_citations",
        {"enriched": 7, "skipped": 2, "failed": 0},
    )
    abstracts = warm_update._step_outcome(
        "refresh_abstracts",
        {"detected": 8, "refreshed": 3, "unchanged": 5, "failed": 0},
    )
    graph = warm_update._step_outcome(
        "build_author_graph",
        {"authorships": 120, "authors": 45, "inferred": 12},
    )

    assert enrich.output_count == 7
    assert abstracts.output_count == 3
    assert graph.output_count == 45


def test_only_complete_zero_counters_verify_steady_state_noop():
    verified = warm_update._step_outcome(
        "enrich_citations",
        {"enriched": 0, "skipped": 0, "failed": 0},
    )
    unchecked = warm_update._step_outcome("enrich_citations", {"enriched": 0})
    unchanged = warm_update._step_outcome(
        "refresh_abstracts",
        {"detected": 4, "refreshed": 0, "unchanged": 4, "failed": 0},
    )

    assert verified.verified_steady_state_noop is True
    assert unchecked.verified_steady_state_noop is False
    assert unchanged.verified_steady_state_noop is True


@pytest.mark.parametrize("payload", ["", "not-json", "[]", "{}", "null", '"not-a-bundle"'])
def test_export_validation_rejects_empty_or_invalid_json(tmp_path, payload):
    export = tmp_path / "top_papers.json"
    export.write_text(payload)

    with pytest.raises(ValueError):
        warm_update._validate_exports([export], tmp_path)


def test_export_validation_accepts_nonempty_json(tmp_path):
    export = tmp_path / "top_papers.json"
    export.write_text(json.dumps([{"paper_id": "arxiv:1"}]))

    assert warm_update._validate_exports([export], tmp_path) == [export]


def test_run_warm_update_fails_and_records_empty_exports(tmp_path, monkeypatch):
    monkeypatch.setattr(warm_update, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(warm_update, "ch_ping", lambda: True)
    monkeypatch.setattr(warm_update, "load_settings", object)
    monkeypatch.setattr(warm_update, "wait_for_ram", lambda _minimum: None)
    monkeypatch.setattr(ch_exports, "export_review_data", lambda _out_dir: [])
    monkeypatch.setattr(exporter, "export_all", lambda _settings, _out_dir: [])
    monkeypatch.setattr(refresh_manifest, "MANIFEST_PATH", tmp_path / "refresh-manifest.json")

    with pytest.raises(RuntimeError, match="exports failed validation"):
        warm_update.run_warm_update(
            skip_enrich=True,
            skip_abstracts=True,
            skip_author_graph=True,
            profile={"min_free_mb": 0},
        )

    manifest = refresh_manifest.read_manifest()
    assert manifest["last_failure"]["step"] == "export_ch"
    assert manifest["runs"]["export_ch"]["output_count"] == 0
