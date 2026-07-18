# ADR-006 — scipy.sparse power iteration for full-corpus PageRank

**Date:** 2026-05-31
**Status:** Accepted

## Context

The citation graph has ~1.05M edges over ~488k nodes. The original
implementation in `graph.py` used `networkx.pagerank()` over a Postgres-backed
in-memory DiGraph loaded all at once. At 1M+ edges this was slow and
memory-intensive.

## Decision

Custom power-iteration in `pagerank_full.py` using `scipy.sparse.csr_matrix`.
Edges are streamed from ClickHouse in 250k-row chunks to avoid materialising
the full edge list before matrix construction.

## Rationale

- `scipy.sparse` matrix-vector multiply is 10–50× faster than NetworkX's
  pure-Python iteration for large graphs.
- Streaming edge reads stay within the 16 GB memory budget; the full COO
  triplet list for 1M edges fits in ~24 MB as `float32` arrays before
  conversion to CSR.
- Dangling-node mass redistribution is handled explicitly (teleport term for
  zero-outdegree nodes) to avoid score leakage.
- Results written to `paper_scores_v2` (ReplacingMergeTree) in 10k-row batches,
  not in-place on `papers`, because `ALTER UPDATE` on the year-partitioned
  table is expensive.

## Alternatives considered

- NetworkX `nx.pagerank()` (kept in `graph.py` for the legacy Postgres
  subgraph): fine for smaller in-corpus subgraphs, impractical at full-corpus
  scale.
- DB-side graph computation (ClickHouse `arrayJoin` + iterative SQL): ClickHouse
  has no native graph engine; iterative SQL PageRank is cumbersome at this edge
  count.
- GraphX / Apache Spark: overkill for a single-machine workload.

## Trade-offs

- Power iteration with `max_iter=50, tol=1e-6` converges in practice within
  20–30 iterations on a sparse academic citation graph.
- The implementation resolves edges via `openalex_id` join — papers without
  `openalex_id` are excluded from the graph (no edges in or out). This is the
  majority-case for bioRxiv/medRxiv.

## References

- [Learnings — PageRank on a sparse citation graph](../../knowledge/learnings.md#pagerank-on-a-sparse-citation-graph)
