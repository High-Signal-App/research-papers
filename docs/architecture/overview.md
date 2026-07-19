# Architecture overview

For the canonical architecture diagram and file-by-file repo layout, see
[`README.md`](../../README.md) → "Architecture" and "Repo layout". This page is
the synthesized narrative that explains *why* the layers are shaped the way
they are. Decision rationale lives in [ADRs](decisions/index.md); concrete
gotchas live in [knowledge/learnings.md](../knowledge/learnings.md).

## Layers

### 1. Ingest (Typer CLI → ClickHouse)

`uv run papers …` is the single entrypoint. Sources are ingested by dedicated
modules and written append-only into ClickHouse:

- `openalex.py` — OpenAlex top-N CS metadata selection (`select-top`).
- `arxiv.py` / `arxiv_abstract_refresh.py` — arXiv metadata + abstract fixups.
- `openreview_ingest.py` — NeurIPS/ICLR papers + peer reviews.
- `biorxiv_ingest.py` — bioRxiv + medRxiv + chemRxiv.
- `semantic_scholar_enrichment.py` — S2 citation counts → `citation_overlay_v2`.
- `refresh_metadata.py` — arXiv API + OpenAlex → `paper_metadata_v2`.

The CLI is the only supported way to mutate corpus state. There is no
write-path HTTP API.

### 2. Storage (ClickHouse 24.10)

`papers` (`ReplacingMergeTree(updated_at)`, partitioned by
`toYear(coalesce(submitted_date, ...))`, ordered by `(source, source_id)`) is
the base table. Everything that changes after the initial insert lives in a
separate `ReplacingMergeTree` overlay read with `FINAL`:

- `paper_scores_v2` — full-corpus PageRank from `pagerank_full.py`.
- `paper_metadata_v2` — corrected titles/years.
- `citation_overlay_v2` — Semantic Scholar citation counts.
- `abstract_overlay_v2` — arXiv-authoritative abstracts for cross-contaminated
  OpenAlex records.
- `authors_v2`, `paper_authorships_v2` — disambiguated author graph.

UDFs `effective_year` and `effective_date` (defined in
`clickhouse/init/02_functions.sql`) correct OpenAlex's revision-date bug for
arXiv papers. They live in ClickHouse system state, not the data volume, so
`deploy.sh` re-applies them after a warm restore.

See [ADR-001](decisions/001-clickhouse-runtime.md) for why ClickHouse, and
[learnings — ClickHouse ingest pitfalls](../knowledge/learnings.md#clickhouse-ingest-pitfalls)
for the operational gotchas.

### 3. Analytics (CPU + Apple Silicon)

- **Embeddings** — `embed.py` writes 384-dim MiniLM-L6-v2 vectors into
  `paper_embeddings` (`Array(Float32)`). Cosine search uses ClickHouse's
  `cosineDistance` full-scan, with an experimental `vector_similarity` index
  available (see [gotchas](../knowledge/gotchas.md)). [ADR-002](decisions/002-minilm-embeddings.md).
- **Clustering** — `cluster_embeddings.py` runs `MiniBatchKMeans` (64 clusters)
  with `partial_fit` chunking to stay within RAM. Writes `paper_clusters`.
- **PageRank** — `pagerank_full.py` builds a `scipy.sparse` CSR transition
  matrix from ~1.05M edges and runs power iteration with explicit dangling-node
  mass redistribution. [ADR-006](decisions/006-scipy-pagerank.md).
- **Tagging** — `noun_tag_v2.py` (spaCy POS-only, parser disabled) for the full
  corpus; `mlx_tag_v3.py` (Qwen2.5-3B-4bit, grouped prompting) for the premium
  subset. [ADR-004](decisions/004-spacy-pos-only.md),
  [ADR-003](decisions/003-mlx-qwen-tagging.md).

All heavy jobs consult `ram.py` (`wait_for_ram`, `clamp_batch_size`,
`pick_n_process`, `m1_16gb_profile`) before allocating resources. See the
[RAM-aware retro](../archive/retros/2026-06-13-ram-aware-pipeline.md).

### 4. API (FastAPI, operator-only)

`api.py` exposes read-only endpoints over ClickHouse: search, paper detail,
semantic search, sleepers, hot papers, similar papers, tags, authors, reviews,
and `/rag/query`. Defaults to `PAPERS_LEAN_API=1`, which keeps no ML model
resident at startup and instead loads the MiniLM encoder lazily in-process on
the first semantic-search request (kept resident thereafter), saving ~400 MB
RSS versus eager loading. [ADR-007](decisions/007-fastapi.md).

Per the 2026-07-10 operating decision, this server is operator-only. The
public product does not depend on it.

### 5. Frontend (Astro 5 + React islands, static-first)

`web/` is a static Astro build. Data-heavy tables are React islands hydrated
from `web/public/data/*.json` (produced by `papers export-ch`). Live search and
semantic-search components call FastAPI when `PUBLIC_API_URL` or
`window.__API_BASE__` is set; otherwise the Pages Function at `/api/rag/query`
serves the Research Answer API with a bundled-data fallback.
[ADR-008](decisions/008-astro-react-islands.md).

Production runs on Cloudflare Pages. See [operations/](../operations/index.md)
and [`DEPLOY.md`](../../DEPLOY.md).

## Data freshness

Static JSON exports drift from the operator ClickHouse snapshot until
`papers export-ch` + frontend rebuild rerun. This is a known, accepted
trade-off of the static-first design — the dashboard remains usable when the
API is down, at the cost of a manual refresh step after ingestion. See
[STATUS.md](../../STATUS.md) → Deferred.
