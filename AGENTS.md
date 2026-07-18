# AGENTS.md — researchPapers

Concise agent bootloader. Read this first, then follow the links for depth.

## Purpose

researchPapers is a ClickHouse-backed academic-paper intelligence platform
(~488k papers across arXiv, OpenReview, bioRxiv, medRxiv) with semantic search,
citation-graph PageRank, MLX/spaCy auto-tagging, and an Astro + React dashboard.
Public production is `https://papers.highsignal.app` on Cloudflare Pages.
Operator-side ClickHouse + FastAPI exist only to refresh static exports and run
overlay jobs.

Full product identity: [`PROJECT_STATUS.md`](PROJECT_STATUS.md).
Live operating state: [`STATUS.md`](STATUS.md).
Knowledge base: [`docs/`](docs/index.md).

## Stack

ClickHouse 24.10 (Docker) · FastAPI · Typer CLI (`uv run papers …`) ·
sentence-transformers (MiniLM-L6-v2, 384-d) · MLX (Qwen2.5-3B-4bit) · spaCy v2 ·
Astro 5 + React + Tailwind + shadcn/ui in `web/` · scipy.sparse PageRank ·
optional Postgres for legacy CLI paths only.

## Essential commands

```bash
docker compose up -d clickhouse                     # CH on :8123
uv sync                                             # install Python deps
uv run papers api-serve --host 0.0.0.0 --port 8000  # FastAPI (operator-only)
cd web && pnpm install && pnpm dev                  # Astro on :4321
uv run pytest                                       # hermetic tests (skips golden)
uv run pytest -m golden                             # live RAG regression (GOLDEN_RAG_URL)
./scripts/deploy.sh /path/to/researchpapers_data_*.tar.gz  # warm restore (preferred)
./scripts/check-docs.sh                             # validate docs/ links
```

Full CLI reference: [`docs/development/commands.md`](docs/development/commands.md).
Quickstart (warm + cold): [`README.md`](README.md) → Quickstart.
Deployment shapes: [`DEPLOY.md`](DEPLOY.md) and
[`docs/operations/`](docs/operations/index.md).

## Critical constraints

- **Do not** run full corpus re-ingest or destructive ClickHouse ops without
  explicit approval.
- **Do not** edit secrets, `.env`, SSH keys, cloud credentials, kube configs, or
  production configs.
- **Do not** modify agent skills, plugins, or profile directories
  (`.codex/skills/`, `.claude/`, etc.) — leave tooling definitions as-is.
- **Do not** push, deploy, release, run migrations, or open PRs without
  explicit user approval. Leave changes staged/committed for human review.
- Cloudflare Pages is the sole production target (operating decision
  2026-07-10). Do not treat local ClickHouse/FastAPI as a public runtime
  dependency.
- `ReplacingMergeTree` overlay tables require `FINAL` on every read — forgetting
  it causes inflated counts and duplicate rows. See
  [`docs/knowledge/learnings.md`](docs/knowledge/learnings.md).
- UDFs (`effective_year`, `effective_date`) live in ClickHouse system state, not
  the data volume — `deploy.sh` re-applies them after a warm restore.

## Documentation navigation

| Need | Go to |
| --- | --- |
| Product overview, users, surfaces | [`docs/product/overview.md`](docs/product/overview.md) |
| System architecture, data flow | [`docs/architecture/overview.md`](docs/architecture/overview.md) |
| Decision records (ADRs) | [`docs/architecture/decisions/index.md`](docs/architecture/decisions/index.md) |
| Dev loop, commands, tests, CI | [`docs/development/`](docs/development/index.md) |
| Deploy, host setup, jobs, runbooks | [`docs/operations/`](docs/operations/index.md) |
| Durable learnings, gotchas, external refs | [`docs/knowledge/`](docs/knowledge/index.md) |
| Failed/rejected approaches | [`docs/knowledge/failed-approaches/index.md`](docs/knowledge/failed-approaches/index.md) |
| Shipped-changes timeline | [`docs/current/timeline.md`](docs/current/timeline.md) |
| Retrospectives (archive) | [`docs/archive/retros/`](docs/archive/retros/) |

Root canonical docs (not duplicated in `docs/`): [`README.md`](README.md),
[`DEPLOY.md`](DEPLOY.md), [`PROJECT_STATUS.md`](PROJECT_STATUS.md),
[`STATUS.md`](STATUS.md).

## Documentation maintenance rules

1. **Markdown is the source of truth.** Blume (configured in `blume.config.ts`)
   is the presentation and search layer only — never edit generated Blume
   output directly.
2. **No two homes for the same fact.** If a fact lives in `README.md`,
   `DEPLOY.md`, or `PROJECT_STATUS.md`, link to it from `docs/` instead of
   restating it. If a fact moves, update or archive the old location.
3. **Short, focused pages** (150–300 lines). Split catch-all docs by topic;
   cross-link with relative paths.
4. **ADRs are append-only.** Supersede with a new numbered ADR that references
   the old; do not rewrite history.
5. **Learnings cite code** (file/line or commit). Unresolved questions are
   marked "TBD" explicitly — never invent information.
6. **Validate before committing.** Run `./scripts/check-docs.sh`. CI enforces
   the same check via `.github/workflows/docs.yml`.
7. When code changes, update the matching doc in the same diff. See
   [`docs/development/workflow.md`](docs/development/workflow.md) for the
   code-change → doc-update map.

## Shared fleet standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`.
Treat this repository as owned product code: protect production stability, keep
changes scoped, verify work, and record durable follow-up tasks when something
remains incomplete or blocked.
