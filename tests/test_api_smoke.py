"""Smoke tests for the FastAPI app.

These exercise the app object without hitting ClickHouse. Only the
DB-free endpoints (e.g. /healthz) are covered here so the suite stays
hermetic and fast.
"""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from researchpapers import activation, api, refresh_manifest
from researchpapers.api import app

client = TestClient(app)


def test_healthz_returns_structured_evidence():
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    # Structured health evidence (data-research-toolbox-automation "Public and
    # API health"). Without ClickHouse running, ok=False but the endpoint
    # still returns 200 with structured fields.
    assert set(body) >= {"ok", "build", "live", "revision", "errors", "latency_ms", "indexing"}
    assert body["build"]["name"] == "researchPapers API"
    assert body["live"] is True
    assert isinstance(body["latency_ms"], int)
    assert "clickhouse" in body["errors"]
    assert "clickhouse_reachable" in body["indexing"]
    assert "tracked_steps" in body["indexing"]


def test_healthz_separates_source_watermark_from_completion_time(monkeypatch):
    monkeypatch.setattr("researchpapers.ch_db.ping", lambda: True)
    monkeypatch.setattr(
        refresh_manifest,
        "read_manifest",
        lambda: {
            "last_failure": None,
            "runs": {
                "enrich_citations": {
                    "source_watermark": "cursor-42",
                    "output_count": 12,
                    "quality_failed": False,
                    "error": None,
                    "freshness": {"wall_clock": "2026-07-19T04:00:00+00:00"},
                }
            },
        },
    )

    body = client.get("/healthz").json()
    evidence = body["indexing"]["refresh_evidence"]["enrich_citations"]
    assert evidence["source_watermark"] == "cursor-42"
    assert evidence["last_success_at"] == "2026-07-19T04:00:00+00:00"
    assert body["indexing"]["last_successful_refresh_at"] == "2026-07-19T04:00:00+00:00"
    assert "last_refresh_watermark" not in body["indexing"]


class _QueryResult:
    def __init__(self, rows):
        self.result_rows = rows


class _PaperConnection:
    def __init__(self, paper_rows):
        self._responses = iter([paper_rows, [], []])

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def query(self, *_args, **_kwargs):
        return _QueryResult(next(self._responses))


def test_paper_inspection_is_not_recorded_for_missing_paper(monkeypatch):
    inspections = []
    monkeypatch.setattr(api, "ch_connect", lambda: _PaperConnection([]))
    monkeypatch.setattr(
        activation,
        "track_result_inspection",
        lambda **properties: inspections.append(properties),
    )

    with pytest.raises(HTTPException) as exc_info:
        api.get_paper("arxiv:missing")

    assert exc_info.value.status_code == 404
    assert inspections == []


def test_paper_inspection_is_recorded_after_found_paper(monkeypatch):
    inspections = []
    paper = [
        "arxiv:1",
        "arxiv",
        "Title",
        "Abstract",
        None,
        4,
        "base",
        "base",
        None,
        "1",
        [],
        None,
    ]
    monkeypatch.setattr(api, "ch_connect", lambda: _PaperConnection([paper]))
    monkeypatch.setattr(
        activation,
        "track_result_inspection",
        lambda **properties: inspections.append(properties),
    )

    result = api.get_paper("arxiv:1")

    assert result["paper_id"] == "arxiv:1"
    assert inspections == [{"source": "paper_detail"}]


def test_app_metadata_is_set():
    assert app.title == "researchPapers API"
    assert app.version == "0.1.0"


def test_unknown_route_returns_404():
    resp = client.get("/this-route-does-not-exist")
    assert resp.status_code == 404


def test_invalid_sources_query_returns_400():
    # /search requires a `q` param; an unknown `sources` value is rejected
    # before any DB call, so this stays hermetic.
    resp = client.get("/search", params={"q": "transformer", "sources": "bogus"})
    assert resp.status_code == 400


def test_rag_status_does_not_expose_secret(monkeypatch):
    monkeypatch.setenv("RAG_SERVICE_KEY", "secret-test-key")
    resp = client.get("/rag/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is True
    assert "secret-test-key" not in str(body)


def test_rag_query_requires_server_key(monkeypatch):
    monkeypatch.delenv("RAG_SERVICE_KEY", raising=False)
    resp = client.post("/rag/query", json={"question": "what is hot in LLM research?"})
    assert resp.status_code == 503
