# Product overview

**Product URL:** [papers.highsignal.app](https://papers.highsignal.app)
**GitHub:** [High-Signal-App/research-papers](https://github.com/High-Signal-App/research-papers)

researchPapers is a ClickHouse-backed academic-paper intelligence platform. It
indexes ~488k papers from arXiv, OpenReview, bioRxiv, and medRxiv, exposes
FastAPI search and insight endpoints, and serves an Astro + React dashboard for
semantic search, citation graph analysis, tags, reviews, hot papers, sleepers,
similar papers, and HighSignal-style research digests.

## Users

- **Researchers** browsing and searching the corpus.
- **Demo viewers** evaluating paid answer APIs over curated data.
- **Operators** running ingest and overlay jobs.
- **Frontend readers** of static JSON exports and the live Research Answer API.

## Public surfaces

| Surface | URL / port | Notes |
| --- | --- | --- |
| Public production | `https://papers.highsignal.app` | Cloudflare Pages (static + Pages Functions). |
| Curated reading paths | `/paths` | Static Astro + React; multi-format export. |
| Research Answer API | `/api/rag/query` | Pages Function; live Knowledgebase RAG with bundled-data fallback. |
| FastAPI (operator-only) | `http://0.0.0.0:8000` via `uv run papers api-serve` | Not a public runtime dependency. |
| Astro dev | `http://127.0.0.1:4321` | `cd web && npm run dev`. |

## In scope

~488k paper corpus, FastAPI search/insights, overlay enrichment jobs, Astro
dashboard, static JSON export path, Cloudflare Pages demo, paid-answer/RAG demo
path, warm-restore deploy script.

## Out of scope

Confirmed public CDN launch beyond Cloudflare Pages, legacy Postgres pipeline
(except optional old CLI paths), full-corpus Semantic Scholar backfill, manual
author curation at scale.

## Canonical production runtime

**Cloudflare Pages is the sole production target** (operating decision
2026-07-10). The public product is static Astro plus Pages Functions;
ClickHouse is an operator-side source used to refresh exports, not a production
service dependency. Do not maintain a same-host API deployment or treat local
ClickHouse as a public runtime dependency. See
[STATUS.md](../../STATUS.md) for the live operating state.

## References

- [`PROJECT_STATUS.md`](../../PROJECT_STATUS.md) — full product identity, dependencies, features, timeline.
- [`README.md`](../../README.md) — quickstart, architecture diagram, repo layout.
- [`architecture/`](../architecture/index.md) — how the system is built.
- [`operations/`](../operations/index.md) — how it is deployed and run.
