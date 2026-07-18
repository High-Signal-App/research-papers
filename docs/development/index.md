# Development

Local dev loop, commands, testing, and CI for the researchPapers repository.

## Pages

- [`commands.md`](commands.md) — the `papers` Typer CLI command reference and
  common dev invocations.
- [`testing.md`](testing.md) — test layout, the golden RAG regression suite,
  and how to run checks locally.
- [`workflow.md`](workflow.md) — branch conventions, commit style, and how
  spec-driven changes are proposed.

## Quick reference

```bash
docker compose up -d clickhouse        # CH on :8123
uv sync                                # install Python deps
uv run papers api-serve --port 8000    # FastAPI on :8000
cd web && pnpm install && pnpm dev      # Astro on :4321
uv run pytest                          # hermetic tests (skips golden)
uv run pytest -m golden                # live RAG regression (needs GOLDEN_RAG_URL)
./scripts/check-docs.sh                # validate docs/ links
```

## Where the facts live

| Fact | Canonical home |
| --- | --- |
| Quickstart (warm + cold) | [`README.md`](../../README.md) → Quickstart |
| Cold rebuild pipeline order | [`README.md`](../../README.md) and [`PROJECT_STATUS.md`](../../PROJECT_STATUS.md) → Stack & commands |
| RAM efficiency defaults | [`README.md`](../../README.md) → RAM efficiency |
| Environment variables | [`.env.example`](../../.env.example) |
| CI workflows | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` |
