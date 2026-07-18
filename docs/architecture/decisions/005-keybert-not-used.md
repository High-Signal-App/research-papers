# ADR-005 — KeyBERT (not used in production pipeline)

**Date:** 2026-05-30
**Status:** Deprecated — evaluated, not adopted

## Context

KeyBERT appears in `pyproject.toml` and `keybert_tag.py` but the CLI for KeyBERT
writes to Postgres only. It was likely evaluated early as an alternative to
spaCy noun-chunk tags.

## Decision

Not used in the current ClickHouse pipeline. `keybert_tag.py` remains as a
reference implementation targeting Postgres.

## Rationale

- KeyBERT uses the same MiniLM-L6-v2 model as the embedder, so there is no extra
  download. The MMR diversity parameter avoids near-duplicate tags.
- However, it requires loading the sentence-transformer model in addition to the
  Postgres connection, and was not ported to the CH `paper_tags` write path.

## Trade-offs

- This is a failed approach kept as a reference. See
  [failed-approaches/keybert.md](../../knowledge/failed-approaches/keybert.md).

## References

- [ADR-004 — spaCy POS-only tagger (adopted alternative)](004-spacy-pos-only.md)
