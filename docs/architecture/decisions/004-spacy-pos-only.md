# ADR-004 — spaCy v2 with parser disabled (POS-only noun-chunk tagger)

**Date:** 2026-05-30
**Status:** Accepted

## Context

Need to tag all 478k papers with noun-phrase tags at low cost. Full spaCy NLP
pipeline (tokenizer + tok2vec + tagger + parser + NER + lemmatizer) is slow and
the dependency parse is not needed for noun-phrase extraction.

## Decision

Load `en_core_web_sm` with `disable=["parser", "ner", "lemmatizer"]`.
Extract noun-phrase candidates via a hand-written POS pattern
`(ADJ|NOUN|PROPN)+` ending with NOUN or PROPN. Single PROPNs kept only for
acronyms (all-caps 2–8 chars) or CamelCase/digit names (ImageNet, GPT4, Llama2).

## Rationale

- The parser accounts for 60-70% of spaCy CPU time (documented in
  `noun_tag_v2.py` module docstring). Disabling it gives 3-5× throughput on the
  same hardware.
- The POS pattern covers "deep convolutional neural networks", "Adam optimizer",
  "stochastic gradient descent" without needing parsed dependency arcs.
- `scispacy` (`scispacy>=0.6.2` in `pyproject.toml`) is installed for biomedical
  entity recognition on bioRxiv/medRxiv papers, but the primary tagger for the
  full corpus is `en_core_web_sm` (lightweight, fast).

## Alternatives considered

- Full spaCy pipeline with dep-parse: too slow for 478k papers on a single host.
- KeyBERT: better semantic quality but requires loading the MiniLM model in
  addition to spaCy, and wrote to Postgres only (not ported to the CH pipeline).
  See `keybert_tag.py` — still reads from and writes to Postgres, not
  ClickHouse; effectively deprecated. See [ADR-005](005-keybert-not-used.md).
- OpenAI API extraction: cost-prohibitive at 478k scale.

## Trade-offs

- POS-only chunking produces some false positives ("the proposed", "our model")
  that are filtered via a blacklist in `noun_tag.py`. Precision is lower than
  parsed noun phrases but acceptable for tag-cloud/drill-down use cases.
- scispaCy model size on disk is significant (~500 MB for the large model); the
  project uses the `en_core_web_sm` model for the main corpus to save disk.

## References

- [Learnings — spaCy tagging](../../knowledge/learnings.md#spacy-tagging)
