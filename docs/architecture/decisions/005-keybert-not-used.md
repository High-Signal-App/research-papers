# ADR-005 — KeyBERT (not used in production pipeline)

**Date:** 2026-05-30
**Status:** Superseded by [ADR-009](009-remove-keybert-reference.md)

## Context

KeyBERT appeared in `pyproject.toml` and `keybert_tag.py`, but its CLI wrote to
Postgres only. It was evaluated early as an alternative to spaCy noun-chunk
tags.

## Decision

Do not use KeyBERT in the ClickHouse pipeline. The original decision retained
`keybert_tag.py` as a Postgres reference implementation; ADR-009 later removed
that broken path and its dependency.

## Rationale

- KeyBERT used the same MiniLM-L6-v2 model as the embedder. The MMR diversity
  parameter avoided near-duplicate tags.
- However, it requires loading the sentence-transformer model in addition to the
  Postgres connection, and was not ported to the CH `paper_tags` write path.

## Trade-offs

- The rationale remains as a failed-approach record. See
  [failed-approaches/keybert.md](../../knowledge/failed-approaches/keybert.md).

## References

- [ADR-004 — spaCy POS-only tagger (adopted alternative)](004-spacy-pos-only.md)
