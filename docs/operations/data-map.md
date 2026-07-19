# Data map and reconstruction

Canonical inventory of stored data, ownership, backup/export/reconstruction
treatment, and refresh-lifecycle controls. Source of truth for the
`data-research-toolbox-automation` capability requirements: authoritative vs
derived classification, reconstruction evidence, and refresh quality bounds.

Live refresh state (watermark, last run, output counts, failure state) lives
in `data/refresh-manifest.json` — see
[`refresh-manifest.md`](refresh-manifest.md) and
[`jobs.md`](jobs.md).

## Classification legend

| Class | Meaning | Backup treatment |
| --- | --- | --- |
| **authoritative-source** | Pulled from an external upstream we do not own | Not backed up — re-fetchable from upstream |
| **derived** | Reconstructable from authoritative sources + code | Not backed up — bounded rebuild path documented |
| **cache** | Performance/edge cache; safe to drop | Not backed up — rebuilt on demand |
| **irreplaceable-user** | User-generated state we cannot reconstruct | Must be exported; no current user state in this product |

researchPapers has no user-generated state — it is a read-only corpus product.
All stored data is `authoritative-source` or `derived`.

## Inventory

| Store | Class | Owner | Reconstruction | Expected cost | Last verified |
| --- | --- | --- | --- | --- | --- |
| ClickHouse `papers` (arxiv/openreview/biorxiv/medrxiv metadata) | authoritative-source | `papers ingest-*` CLI | Re-run ingest from upstream APIs | hours (rate-limited) | 2026-07-18 |
| ClickHouse `paper_references` | derived | `papers backfill-references` | Re-fetch from Semantic Scholar + OpenAlex | ~hours | 2026-07-18 |
| ClickHouse `paper_scores_v2` (PageRank) | derived | `papers pagerank-full` | Recompute from `paper_references` | ~minutes (scipy sparse) | 2026-07-18 |
| ClickHouse `paper_embeddings` (MiniLM 384-d) | derived | `papers embed` | Re-encode from `papers` text | ~minutes on M1 GPU | 2026-07-18 |
| ClickHouse `paper_clusters` (64 semantic) | derived | `papers cluster-embeddings` | Re-cluster from embeddings | ~minutes | 2026-07-18 |
| ClickHouse `paper_tags` (spaCy noun-chunks) | derived | `papers spacy-tag-v2` | Re-tag from `papers` text | ~minutes | 2026-07-18 |
| ClickHouse `paper_tags_mlx` (Qwen2.5-3B-4bit) | derived | `papers mlx-tag-v3 --shards 3` | Re-tag from `papers` text | ~hours (RAM-bound) | 2026-07-18 |
| ClickHouse `citation_overlay_v2` (S2 enrichment) | derived | `papers enrich-citations` | Re-fetch from Semantic Scholar | ~minutes (top-N) | 2026-07-18 |
| ClickHouse `abstract_overlay_v2` (arXiv refresh) | derived | `papers refresh-abstracts` | Re-fetch from arXiv | ~minutes | 2026-07-18 |
| ClickHouse `authors_v2`, `paper_authorships_v2` | derived | `papers build-author-graph` | Rebuild from `papers` metadata | ~minutes | 2026-07-18 |
| ClickHouse UDFs `effective_year`, `effective_date` | derived | `clickhouse/init/02_functions.sql` (re-applied by `deploy.sh`) | Re-apply SQL | seconds | 2026-07-18 |
| `web/public/data/*.json` (static export) | derived (cache of CH) | `papers export-ch` | Re-export from CH | ~seconds | 2026-07-18 |
| Cloudflare Pages `dist/` (deployed bundle) | cache | Pages deploy hook / `pnpm build` | Rebuild + redeploy | ~30s rebuild + deploy | 2026-07-18 |
| R2 `researchpapers-backup/` dump tarballs | authoritative-source (warm-restore copy of CH) | `scripts/dump_data.sh` + rclone | Warm restore via `deploy.sh` | ~minutes (warm) | 2026-07-18 |
| Knowledgebase domain `research-papers-cs-cited1000-all` | derived (RAG index) | `scripts/seed_openalex_cs_rag.py` | Re-seed from OpenAlex filter + local embeddings | ~minutes | 2026-07-18 |

## Reconstruction paths

### Warm restore (preferred)

`./scripts/deploy.sh /path/to/researchpapers_data_*.tar.gz` — restores the CH
data volume + re-applies UDFs. Dump size ~700 MB compressed for 488k papers.
See [`DEPLOY.md`](../../DEPLOY.md) §1 and
[`runbooks/recovery.md`](runbooks/recovery.md#cold-restore-from-r2-backup).

### Cold rebuild (bounded, expensive)

Sequential CLI pipeline. Total runtime is hours on a 16 GB M1; RAM-aware
sequencing via `papers warm-update` avoids peaking multiple model loads.

```bash
uv run papers select-top --n 400000
uv run papers ingest-openreview
uv run papers ingest-biorxiv
uv run papers backfill-references
uv run papers refresh-metadata
uv run papers pagerank-full
uv run papers embed
uv run papers cluster-embeddings
uv run papers spacy-tag-v2
uv run papers mlx-tag-v3 --shards 3
uv run papers export-ch
```

### Static export refresh (cheap, daily)

`uv run papers export-ch` regenerates `web/public/data/*.json` from current
CH state. Then trigger the Pages deploy hook to rebuild the edge bundle. See
[`jobs.md`](jobs.md) §"Refreshing the Pages build after export".

## Refresh lifecycle controls

Every overlay/refresh job (`warm-update`, `enrich-citations`,
`refresh-abstracts`, `build-author-graph`, `export-ch`) records a structured
manifest at `data/refresh-manifest.json` with:

- `source_watermark` — upstream cursor/timestamp the run consumed
- `bounds` — declared input limit / page cap / time cap
- `timeout` — per-step wall-clock limit
- `idempotency` — `ReplacingMergeTree` overlay + `FINAL` reads (see
  [`knowledge/learnings.md`](../knowledge/learnings.md#replacingmergetree-requires-final-on-every-read))
- `retries` — per-step retry policy
- `output_counts` — rows written / files exported
- `quality_signal` — non-zero output check + freshness delta vs prior run
- `freshness` — wall-clock of the run + delta from previous success
- `failure_state` — durable record of the last unresolved failure (or `null`)

A run that exits successfully with zero output where the declared expectation
is non-zero fails quality verification and does **not** advance freshness.
See [`refresh-manifest.md`](refresh-manifest.md) for the schema and the
quality gate implementation.

## Public and API health

| Surface | Health endpoint | Evidence |
| --- | --- | --- |
| FastAPI (operator-only) | `GET /healthz` | build, live, revision, errors, latency, CH reachability, per-step source watermark and completion evidence |
| Cloudflare Pages (public) | `GET /api/health` (Pages Function) | build metadata from `context.env` plus bounded checks of required static search assets; returns 503 when unavailable |
| Search API (Pages RAG) | `GET /api/rag/status` | RAG configured flag, domain, service URL (no key) |

Landing availability and search availability are reported independently — a
live index page with a broken search API must not report global health. See
[`api.py`](../../src/researchpapers/api.py) `/healthz` and the Pages
`/api/health` Function.

## Search activation evidence

Privacy-safe aggregate activation counters are emitted to Foundry (PostHog)
on successful search result inspection and saved/organized actions. No raw
query text, paper IDs, or user identifiers are sent. See
[`refresh-manifest.md`](refresh-manifest.md) §"Activation counters" and
[`foundry.md`](foundry.md).

## Bounded Toolbox marketing experiments

Quiet discoverability experiments are recorded in
`data/experiments-manifest.json` with canonical destination, attribution,
approved claims, expiry, and stop rules. No experiment triggers corpus
expansion, ranking redesign, or autonomous product work. See
[`experiments.md`](experiments.md).
