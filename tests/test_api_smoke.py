"""Smoke tests for the FastAPI app.

These exercise the app object without hitting ClickHouse. Only the
DB-free endpoints (e.g. /healthz) are covered here so the suite stays
hermetic and fast.
"""

from fastapi.testclient import TestClient

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
