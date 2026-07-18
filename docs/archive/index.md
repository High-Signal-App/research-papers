# Archive

Superseded material kept for git history and retroactive context. Prefer
linking here over deletion; prefer `archive/` over rewriting history.

## Pages

- [`retros/`](retros/) — retrospectives:
  - [`2026-05-30-postgres-to-clickhouse.md`](retros/2026-05-30-postgres-to-clickhouse.md) — runtime DB migration.
  - [`2026-06-13-ram-aware-pipeline.md`](retros/2026-06-13-ram-aware-pipeline.md) — RAM-aware pipeline + lean API mode.

## What moved here

- `docs/archive/decisions.md` — split into per-ADR files under
  [`../architecture/decisions/`](../architecture/decisions/index.md). The
  original monolith was removed; git history preserves it.
- `docs/retros/` → `docs/archive/retros/`.

## What does NOT live here

- Failed approaches (evaluated-but-rejected alternatives) live in
  [`../knowledge/failed-approaches/`](../knowledge/failed-approaches/index.md),
  not here. Archive is for superseded *narratives* (retros, old plans);
  failed-approaches is for *technical dead ends* that should not be retried.
