# ADR-009 — Remove the KeyBERT reference path

**Date:** 2026-07-31  
**Status:** Accepted; supersedes ADR-005

## Context

ADR-005 rejected KeyBERT for production tagging but kept its Postgres-only
implementation and dependency as a reference. Migration 012 later dropped the
KeyBERT and other experimental tag columns. The retained `keybert-tag` and
`eval-taggers` commands therefore targeted schema that no longer exists and
could not participate in the ClickHouse cold-restore pipeline.

## Decision

Remove the KeyBERT implementation, its direct dependency, and the obsolete
tagger-evaluation command. Preserve the experiment and rejection rationale in
ADR-005 and the failed-approach note.

## Rationale

- A broken CLI is not a useful reference implementation.
- Git history and the ADR preserve the experiment without installing KeyBERT
  and its transitive runtime on every `uv sync`.
- The supported taggers remain the ClickHouse-backed spaCy v2 and MLX paths.

## Trade-offs

Re-running the historical KeyBERT comparison now requires restoring the old
implementation and schema from git history. That is preferable to presenting a
nonfunctional command as supported.

## References

- [ADR-005 — KeyBERT not adopted](005-keybert-not-used.md)
- [KeyBERT failed approach](../../knowledge/failed-approaches/keybert.md)
- `migrations/012_storage_cuts.sql`
