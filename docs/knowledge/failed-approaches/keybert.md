# KeyBERT — evaluated, not adopted

**Status:** Removed on 2026-07-31 after the reference path became nonfunctional.
The experiment remains available in git history.

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
- Migration 012 dropped the experimental KeyBERT columns, proving the retained
  Postgres-only command was no longer usable for cold restores or experiments.
- ADR-009 removed the broken command and dependency while preserving this
  decision record.

## References

- [ADR-005 — KeyBERT (not used in production pipeline)](../../architecture/decisions/005-keybert-not-used.md)
- [ADR-009 — Remove the KeyBERT reference path](../../architecture/decisions/009-remove-keybert-reference.md)
- [ADR-004 — spaCy POS-only tagger (adopted alternative)](../../architecture/decisions/004-spacy-pos-only.md)
- [Gotchas — KeyBERT dead branch](../gotchas.md#keybert--evaluated-but-not-in-production-pipeline)
