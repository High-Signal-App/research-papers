"""Golden-question regression checks for the Research Answer API.

These call a *live* Research Answer API endpoint (the Cloudflare Pages
Function at ``/api/rag/query`` — production or a local ``wrangler pages
dev`` / LAN deploy) with a fixed set of reference questions grounded in
the indexed corpus, and assert structural quality invariants that are
robust to model nondeterminism:

- answer is non-empty and above a minimum length,
- a minimum number of citations is returned,
- every citation resolves to a real record in the index
  (paper-signal citations against the deployed ``/data/*.json`` exports;
  live Knowledgebase citations against the seeded OpenAlex CS
  ``cited_by_count > 999`` slice invariants),
- intent classification matches the expected paper-signal intent.

No prose string-matching: expected *answers* are never asserted, only
verifiable structure, so retrieval/model drift that keeps quality intact
stays green while silent degradation (empty answers, missing citations,
dangling paper ids, broken intent routing) fails loudly.

Run selectively (marker: ``golden``):

    GOLDEN_RAG_URL=https://papers.highsignal.app/api/rag/query \
        uv run pytest -m golden

Without ``GOLDEN_RAG_URL`` the whole module skips with this notice, so the
default ``uv run pytest`` stays hermetic. CI runs this as the separate
``golden-rag-regression`` job (see ``.github/workflows/ci.yml``), which
skips loudly when the endpoint is unreachable from the runner.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import pytest

GOLDEN_RAG_URL = os.environ.get("GOLDEN_RAG_URL", "").strip()

SKIP_REASON = (
    "GOLDEN_RAG_URL is not set — golden-question regression checks need a live "
    "Research Answer API endpoint. Run: "
    "GOLDEN_RAG_URL=https://papers.highsignal.app/api/rag/query uv run pytest -m golden"
)

pytestmark = [
    pytest.mark.golden,
    pytest.mark.skipif(not GOLDEN_RAG_URL, reason=SKIP_REASON),
]


@dataclass(frozen=True)
class GoldenQuestion:
    """One reference question with structural quality thresholds."""

    id: str
    question: str
    # Expected paper-signal intent (asserted via confidence.intent).
    # None => general question expected to route to live retrieval.
    expected_intent: str | None
    min_citations: int
    min_answer_chars: int = 200


# Reference questions grounded in what the corpus actually indexes:
# 488k papers (arxiv / openreview / biorxiv / medrxiv) behind the
# paper-signal analytics layer, and the live Knowledgebase domain seeded
# from the OpenAlex Computer Science cited_by_count>999 slice.
GOLDEN_QUESTIONS = [
    # --- Paper-signal intents (route to the curated analytics layer) ---
    GoldenQuestion(
        id="sleepers",
        question="Which sleeper papers are most underrated right now?",
        expected_intent="sleepers",
        min_citations=3,
    ),
    GoldenQuestion(
        id="sleepers-accepted",
        question="Which accepted NeurIPS papers look underrated despite strong reviews?",
        expected_intent="sleepers",
        min_citations=3,
    ),
    GoldenQuestion(
        id="ratings",
        question="Which research areas get the highest reviewer ratings on OpenReview?",
        expected_intent="ratings",
        min_citations=3,
    ),
    GoldenQuestion(
        id="ratings-peer-review",
        question="Which topics get the best peer-review scores on OpenReview?",
        expected_intent="ratings",
        min_citations=3,
    ),
    GoldenQuestion(
        id="clusters",
        question="What are the main semantic clusters in the paper corpus?",
        expected_intent="clusters",
        min_citations=3,
    ),
    GoldenQuestion(
        id="clusters-communities",
        question="What research communities exist around reinforcement learning topics?",
        expected_intent="clusters",
        min_citations=3,
    ),
    GoldenQuestion(
        id="recent",
        question="Which hot recent papers are gaining citations fastest?",
        expected_intent="recent",
        min_citations=3,
    ),
    GoldenQuestion(
        id="recent-trends",
        question="What are the latest trends in efficient LLM inference?",
        expected_intent="recent",
        min_citations=3,
    ),
    GoldenQuestion(
        id="rag-reading-list",
        question="What should I read to understand retrieval-augmented generation?",
        expected_intent="rag",
        min_citations=2,
    ),
    GoldenQuestion(
        id="rag-grounded",
        question="Which papers grounded retrieval-augmented generation in practice?",
        expected_intent="rag",
        min_citations=2,
    ),
    # --- General intents (route to live Knowledgebase retrieval) ---
    GoldenQuestion(
        id="general-gnn",
        question="What are the most influential approaches to graph neural networks?",
        expected_intent=None,
        min_citations=3,
    ),
    GoldenQuestion(
        id="general-attention",
        question="How does attention enable transformers to handle long sequences?",
        expected_intent=None,
        min_citations=3,
    ),
    GoldenQuestion(
        id="general-diffusion",
        question="Which papers established diffusion models for image generation?",
        expected_intent=None,
        min_citations=3,
    ),
    GoldenQuestion(
        id="general-rlhf",
        question="What are the foundations of reinforcement learning from human feedback?",
        expected_intent=None,
        min_citations=3,
    ),
    GoldenQuestion(
        id="general-codegen",
        question="How do large language models generate code from natural language?",
        expected_intent=None,
        min_citations=3,
    ),
    GoldenQuestion(
        id="general-federated",
        question="What is federated learning and why does it matter for privacy?",
        expected_intent=None,
        min_citations=3,
    ),
    GoldenQuestion(
        id="general-multimodal",
        question="Which papers introduced multimodal vision-language models?",
        expected_intent=None,
        min_citations=3,
    ),
]

# Paper-signal citations carry real corpus paper ids as chunk_id.
PAPER_ID_PREFIXES = ("arxiv:", "openreview:", "biorxiv:", "medrxiv:", "chemrxiv:")

# Static exports the paper-signal router draws its evidence from.
PAPER_DATA_FILES = ("hot.json", "sleepers.json", "review_top_papers.json", "top_papers.json")

# Seed filter of the live Knowledgebase domain (OpenAlex cited_by_count > 999).
LIVE_MIN_CITATION_COUNT = 1000

_REPO_DATA_DIR = Path(__file__).resolve().parents[1] / "web" / "public" / "data"


@pytest.fixture(scope="session")
def client() -> httpx.Client:
    with httpx.Client(timeout=httpx.Timeout(90.0, connect=15.0)) as c:
        yield c


def _load_data_json(client: httpx.Client, origin: str, name: str) -> list:
    """Load a static export from the deployed origin, falling back to the repo copy."""
    try:
        resp = client.get(f"{origin}/data/{name}")
        if resp.status_code == 200:
            return resp.json()
    except httpx.HTTPError:
        pass
    return json.loads((_REPO_DATA_DIR / name).read_text())


@pytest.fixture(scope="session")
def data_index(client: httpx.Client) -> dict[str, set[str]]:
    """Ids of real records in the index the paper-signal answers cite from."""
    origin = "{0.scheme}://{0.netloc}".format(urlsplit(GOLDEN_RAG_URL))
    paper_ids: set[str] = set()
    for name in PAPER_DATA_FILES:
        for paper in _load_data_json(client, origin, name):
            pid = paper.get("paper_id") or (
                f"arxiv:{paper['arxiv_id']}" if paper.get("arxiv_id") else None
            )
            if pid:
                paper_ids.add(pid)
    clusters = _load_data_json(client, origin, "embedding_clusters.json")
    tags = _load_data_json(client, origin, "tag_rating.json")
    return {
        "paper_ids": paper_ids,
        "cluster_ids": {str(c["id"]) for c in clusters},
        "tags": {t["tag"] for t in tags},
    }


def _ask(client: httpx.Client, question: str) -> httpx.Response:
    """POST the question; retry once on transient network/5xx failures."""
    last = ""
    for _ in range(2):
        try:
            resp = client.post(GOLDEN_RAG_URL, json={"question": question})
        except httpx.HTTPError as exc:
            last = repr(exc)
            continue
        if resp.status_code < 500:
            return resp
        last = f"HTTP {resp.status_code}: {resp.text[:300]}"
    pytest.fail(f"Research Answer API at {GOLDEN_RAG_URL} failed after retries: {last}")


def _assert_citation_resolves(citation: dict, data_index: dict[str, set[str]]) -> None:
    chunk_id = str(citation.get("chunk_id") or "")
    document_id = str(citation.get("document_id") or "")
    metadata = citation.get("metadata") or {}

    if chunk_id.startswith(PAPER_ID_PREFIXES):
        # Paper-signal citation: must be a real paper in the deployed exports.
        assert chunk_id in data_index["paper_ids"], (
            f"citation {chunk_id!r} does not resolve to a paper in the deployed data exports"
        )
    elif chunk_id.startswith("cluster:"):
        assert chunk_id.removeprefix("cluster:") in data_index["cluster_ids"], (
            f"citation {chunk_id!r} does not resolve to a real semantic cluster"
        )
    elif chunk_id.startswith("tag:"):
        assert chunk_id.removeprefix("tag:") in data_index["tags"], (
            f"citation {chunk_id!r} does not resolve to a real tag-rating entry"
        )
    else:
        # Live Knowledgebase citation over the seeded OpenAlex CS slice.
        assert document_id or chunk_id, f"citation has no id: {citation}"
        title = str(metadata.get("title") or "").strip()
        assert len(title) >= 5, f"live citation {document_id or chunk_id!r} has no usable title"
        citation_count = metadata.get("citation_count")
        if isinstance(citation_count, int | float):
            assert citation_count >= LIVE_MIN_CITATION_COUNT, (
                f"live citation {document_id!r} has citation_count={citation_count}, "
                f"below the seeded-domain floor of {LIVE_MIN_CITATION_COUNT}"
            )
        year = metadata.get("publication_year")
        if isinstance(year, int | float):
            assert 1900 <= year <= 2100, f"implausible publication_year {year} in {document_id!r}"


@pytest.mark.parametrize("gq", GOLDEN_QUESTIONS, ids=[g.id for g in GOLDEN_QUESTIONS])
def test_golden_question(
    gq: GoldenQuestion, client: httpx.Client, data_index: dict[str, set[str]]
) -> None:
    resp = _ask(client, gq.question)
    assert resp.status_code == 200, f"[{gq.id}] HTTP {resp.status_code}: {resp.text[:300]}"
    body = resp.json()

    answer = str(body.get("answer") or "").strip()
    assert len(answer) >= gq.min_answer_chars, (
        f"[{gq.id}] answer too short ({len(answer)} < {gq.min_answer_chars}): {answer[:200]!r}"
    )

    citations = body.get("citations") or []
    assert isinstance(citations, list), f"[{gq.id}] citations is not a list"
    assert len(citations) >= gq.min_citations, (
        f"[{gq.id}] expected >= {gq.min_citations} citations, got {len(citations)}"
    )

    intent = (body.get("confidence") or {}).get("intent")
    if gq.expected_intent is not None:
        assert body.get("route") == "paper_signals", (
            f"[{gq.id}] expected paper_signals route, got {body.get('route')!r}"
        )
        assert intent == gq.expected_intent, (
            f"[{gq.id}] intent classified as {intent!r}, expected {gq.expected_intent!r}"
        )
    elif intent is not None:
        # General questions normally route live (no intent field); if the
        # bundled-data fallback answered, it must still classify as general.
        assert intent == "general", f"[{gq.id}] fallback intent {intent!r}, expected 'general'"

    for citation in citations:
        _assert_citation_resolves(citation, data_index)
