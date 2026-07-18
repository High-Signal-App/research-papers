# KeyBERT — evaluated, not adopted

**Status:** Deprecated. Reference implementation only.
**Code:** `src/researchpapers/keybert_tag.py`
**Dependency:** `keybert>=0.9.0` in `pyproject.toml` (kept for the reference path)

## What was tried

KeyBERT extracts keywords by embedding a document and candidate phrases with the
same sentence-transformer model, then ranking candidates by cosine similarity
with MMR diversity to avoid near-duplicates. It reuses `all-MiniLM-L6-v2`, so
there is no extra model download.

## Why it was rejected

- `keybert_tag.py` writes exclusively to Postgres (`UPDATE papers SET
  keybert_tags_json = %s`, lines 72–78) and never imports `ch_db` — it was
  never ported to the ClickHouse `paper_tags` write path.
- Loading the sentence-transformer in addition to spaCy doubles the resident
  model footprint during a full-corpus tagging run on a 16 GB host.
- spaCy POS-only noun-chunk tagging (ADR-004) is 3–5× faster and produces
  acceptable tags for the tag-cloud/drill-down use case at 478k scale.

## What we learned

- Reusing the embedder model is cheap, but the write-path integration cost
  (porting to ClickHouse + overlay semantics) dominated the decision, not the
  model cost.
- The dependency remains in `pyproject.toml` as a deliberate reference; do not
  remove it without checking `keybert_tag.py` is no longer needed for cold
  restores or experiments.

## References

- [ADR-005 — KeyBERT (not used in production pipeline)](../../architecture/decisions/005-keybert-not-used.md)
- [ADR-004 — spaCy POS-only tagger (adopted alternative)](../../architecture/decisions/004-spacy-pos-only.md)
- [Gotchas — KeyBERT dead branch](../gotchas.md#keybert--evaluated-but-not-in-production-pipeline)
