# Architecture

How the researchPapers system is built. For the canonical architecture diagram
and repo layout, see [`README.md`](../../README.md) → "Architecture" and "Repo
layout". This folder holds the synthesized system narrative and the ADR record.

## Pages

- [`overview.md`](overview.md) — system narrative: ingest → store → overlays →
  API → frontend, and the constraints that shaped each layer.
- [`decisions/`](decisions/index.md) — Architecture Decision Records (ADRs),
  one per file.

## Where the facts live

| Fact | Canonical home |
| --- | --- |
| Architecture diagram | [`README.md`](../../README.md) → Architecture |
| Repo layout (file-by-file) | [`README.md`](../../README.md) → Repo layout |
| Schema (papers, overlays, UDFs) | `clickhouse/init/01_schema.sql`, `02_functions.sql`, `03_overlays.sql`, `04_indexes.sql` |
| Migrations (legacy Postgres) | `migrations/001_init.sql` … `010_more_tag_columns.sql` |
| Decision rationale | [`decisions/`](decisions/index.md) |

## Principles

- **ClickHouse is the only runtime database.** Postgres is legacy ingest
  staging only. See [ADR-001](decisions/001-clickhouse-runtime.md).
- **Overlays, not in-place mutations.** Correction layers
  (`paper_scores_v2`, `paper_metadata_v2`, `citation_overlay_v2`,
  `abstract_overlay_v2`, `authors_v2`) are `ReplacingMergeTree` tables read
  with `FINAL`. See [ADR-001](decisions/001-clickhouse-runtime.md) and
  [learnings](../knowledge/learnings.md#clickhouse-ingest-pitfalls).
- **Static-first frontend.** The dashboard is a static Astro build hydrated
  from `web/public/data/*.json`; live endpoints are the exception. See
  [ADR-008](decisions/008-astro-react-islands.md).
- **RAM-aware pipeline.** Every heavy job consults `ram.py` before allocating
  workers or batches. See [ADR-003](decisions/003-mlx-qwen-tagging.md) and the
  [RAM-aware retro](../archive/retros/2026-06-13-ram-aware-pipeline.md).
