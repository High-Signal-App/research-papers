# ADR-002 — all-MiniLM-L6-v2 for paper embeddings (384-dim)

**Date:** 2026-05-30
**Status:** Accepted

## Context

Need to embed ~478k title+abstract pairs for semantic search and clustering.
Running on an M1 Pro 16 GB machine. Embedding must fit in a ClickHouse
`Array(Float32)` column and support cosine distance queries without a separate
vector index.

## Decision

`sentence-transformers/all-MiniLM-L6-v2`, 384-dim L2-normalised vectors.

## Rationale

- 384 dims is small enough to store inline in ClickHouse (`Array(Float32)` per
  row ≈ 1.5 KB), avoiding an external vector DB.
- Model is small enough to run on CPU with manageable RAM; batch size clamped to
  64 on 16 GB hosts (down from a default of 256) via `ram.clamp_batch_size`.
- Already used for KeyBERT tagging (same model, reused), so no extra download
  cost.
- Normalised vectors make `cosineDistance` equivalent to dot-product —
  ClickHouse can compute this without a specialised ANN index.

## Alternatives considered

- `all-mpnet-base-v2` (768-dim): better quality but 2× storage and slower on CPU.
- OpenAI `text-embedding-ada-002`: high quality, but recurring API cost and
  data-privacy risk for a self-hosted corpus.

## Trade-offs

- No ANN index (HNSW, IVF) in ClickHouse — cosine search is a full scan over
  478k vectors. Acceptable at this scale; would need an index or a separate
  store at 10M+ papers. (An experimental `vector_similarity` index was added in
  `clickhouse/init/04_indexes.sql` — see [gotchas](../../knowledge/gotchas.md).)
- 384-dim captures topic-level similarity well but may miss fine-grained
  methodological nuance.

## References

- [Learnings — Embedding pipeline](../../knowledge/learnings.md#embedding-pipeline)
