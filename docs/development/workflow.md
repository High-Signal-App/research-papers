# Development workflow

## Branches and commits

- Work on a feature branch off `main`. Small, reviewable diffs.
- Commit messages follow the existing style: `type: summary` (e.g.
  `feat:`, `fix:`, `docs:`, `ci:`, `chore:`, `refactor:`, `test:`).
- Do not push, deploy, or open PRs without explicit user approval (fleet safety
  constraint). Leave changes staged/committed for human review.

## Spec-driven changes

Track work in GitHub Issues. For a large or cross-cutting change, write the
proposal, design notes, requirements and task checklist in one tracking issue
using the fleet `spec-driven` skill. Skip that for bug fixes, cleanup, copy
edits and small tweaks. There is no repo-local spec directory or CLI; durable
shipped truth goes in `PROJECT_STATUS.md`.

## Documentation maintenance

When you change code, update the matching doc in the same diff:

| Code change | Doc to update |
| --- | --- |
| ClickHouse schema | `clickhouse/init/*.sql` is the source; note non-obvious constraints in [`knowledge/learnings.md`](../knowledge/learnings.md) |
| New ADR-worthy decision | Add `docs/architecture/decisions/00N-*.md` and a row in [`decisions/index.md`](../architecture/decisions/index.md) |
| New CLI command | [`commands.md`](commands.md) and `README.md` quickstart |
| New scheduled job | [`operations/jobs.md`](../operations/jobs.md) |
| New failed approach | [`knowledge/failed-approaches/`](../knowledge/failed-approaches/index.md) |
| Shipped feature / status change | [`STATUS.md`](../../STATUS.md) and `PROJECT_STATUS.md` timeline |

Run `./scripts/check-docs.sh` before committing. The check is also enforced in
CI via `.github/workflows/docs.yml`.

## Safety constraints

From [`AGENTS.md`](../../AGENTS.md) and the fleet standard:

- Do not run full corpus re-ingest or destructive ClickHouse ops without
  explicit approval.
- Do not edit secrets, `.env`, SSH keys, cloud credentials, kube configs, or
  production configs.
- Do not modify agent skills, plugins, or profile directories
  (`.codex/skills/`, `.claude/`, etc.).
- Preserve unrelated in-progress work.
