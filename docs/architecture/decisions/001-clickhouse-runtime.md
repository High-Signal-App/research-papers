# ADR-001 — ClickHouse as the runtime database

**Date:** 2026-05-30
**Status:** Accepted

## Context

The corpus is 488k papers, 1.05M citation edges, 478k 384-dim embedding vectors,
and several append-only overlay tables. The workload is analytical: GROUP BY
source, ORDER BY pagerank/citation_count over full-corpus scans,
nearest-neighbour cosine over `paper_embeddings`, and time-series aggregations on
`citation_history`. Postgres was the original ingest store and remains available
for the few legacy CLI paths.

## Decision

ClickHouse is the sole runtime database for the API, frontend, and all pipeline
reads. Postgres is demoted to an optional ingest staging store.

## Rationale

- MergeTree columnar storage compresses repeated values (source, tagger,
  cluster_id) far better than Postgres row storage for a mostly-read workload at
  this scale.
- `LowCardinality(String)` on `cited_openalex_id` (see schema comment: "HUGE for
  storage") and `source` shrinks the 1M-row references table significantly.
- `ReplacingMergeTree` provides idempotent upsert semantics for overlay tables
  without needing `ON CONFLICT` logic.
- ClickHouse's built-in `cosineDistance` function over `Array(Float32)` is used
  for semantic search over all 478k embeddings without a separate vector DB.

## Alternatives considered

- Postgres with pgvector for embeddings, BRIN/GIN indexes for analytics.
- SQLite for simplicity (single binary).

## Trade-offs

- ClickHouse `ALTER TABLE ... UPDATE` is asynchronous and partition-bound;
  that's why PageRank scores live in a separate `paper_scores_v2` overlay
  (ReplacingMergeTree on `paper_id`) rather than in-place on the `papers` table
  (partitioned by year, makes mutations expensive).
- `FINAL` modifier required on all reads from ReplacingMergeTree tables to get
  deduplicated rows; the team uses it consistently in all queries.
- Postgres migrations (001–012) are preserved for cold restore / legacy CLI path.

## References

- [Learnings — ClickHouse ingest pitfalls](../../knowledge/learnings.md#clickhouse-ingest-pitfalls)
- [Retro: Postgres → ClickHouse migration](../../archive/retros/2026-05-30-postgres-to-clickhouse.md)
