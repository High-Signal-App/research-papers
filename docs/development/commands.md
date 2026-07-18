# Commands

The `papers` Typer CLI (`uv run papers …`) is the single entrypoint for
ingestion, analytics, overlays, export, and serving. The full cold-rebuild
sequence lives in [`README.md`](../../README.md) → Quickstart (cold); this page
is a quick reference grouped by purpose.

## Local dev

| Command | Purpose |
| --- | --- |
| `docker compose up -d clickhouse` | Start ClickHouse on :8123 |
| `uv sync` | Install Python deps |
| `uv run papers api-serve --host 0.0.0.0 --port 8000` | FastAPI server |
| `cd web && pnpm install && pnpm dev` | Astro dev on :4321 |
| `cd web && pnpm build` | Frontend build → `web/dist/` |

## Ingestion (cold rebuild — hours)

Run in this order; see [`README.md`](../../README.md) for the canonical sequence.

| Command | Writes |
| --- | --- |
| `papers select-top --n 400000` | OpenAlex top-N CS metadata → `papers` |
| `papers ingest-openreview` | NeurIPS/ICLR + reviews |
| `papers ingest-biorxiv` | bioRxiv + medRxiv |
| `papers backfill-references` | paper→paper edges → `references_paper` |
| `papers refresh-metadata` | arXiv API fixups → `paper_metadata_v2` |
| `papers pagerank-full` | scipy.sparse PageRank → `paper_scores_v2` |
| `papers embed` | MiniLM-L6-v2 → `paper_embeddings` |
| `papers cluster-embeddings` | MiniBatchKMeans → `paper_clusters` |
| `papers spacy-tag-v2` | noun-chunk tags → `paper_tags` |
| `papers mlx-tag-v3 --shards 3` | premium MLX tags → `paper_tags` |
| `papers export-ch` | `web/public/data/*.json` |

## Overlay maintenance (warm)

| Command | Purpose |
| --- | --- |
| `papers warm-update` / `--build-web` | Run overlay jobs sequentially without peaking RAM |
| `papers enrich-citations` | Semantic Scholar → `citation_overlay_v2` |
| `papers refresh-abstracts` / `--reembed` | arXiv abstracts → `abstract_overlay_v2` (and re-embed corrected papers) |
| `papers build-author-graph` | `authors_v2`, `paper_authorships_v2` |
| `papers refresh-web` | Refresh web exports |

## Deploy

| Command | Purpose |
| --- | --- |
| `./scripts/deploy.sh /path/to/researchpapers_data_*.tar.gz` | Warm restore (preferred — minutes) |
| `./scripts/dump_data.sh` | Produce a dump for transport |
| `./scripts/manual-deploy.mjs deploy.yml ci.yml` | Local deploy helper |
| `npm run deploy` (repo root) | Wrapper around `manual-deploy.mjs` |

See [`DEPLOY.md`](../../DEPLOY.md) and [`operations/`](../operations/index.md)
for the three deployment shapes.

## Tests

| Command | Purpose |
| --- | --- |
| `uv run pytest` | Hermetic unit tests (skips `golden`) |
| `uv run pytest -m golden` | Live RAG regression (needs `GOLDEN_RAG_URL`) |
| `uv run ruff check` | Lint |
| `./scripts/check-docs.sh` | Validate `docs/` links and structure |

See [`testing.md`](testing.md) for the test layout and golden suite contract.
