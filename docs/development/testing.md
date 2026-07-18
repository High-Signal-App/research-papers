# Testing

## Layout

Tests live in `tests/` and are run with `uv run pytest`. `pyproject.toml`
configures `asyncio_mode = "auto"`, `pythonpath = ["src"]`, and the `golden`
marker.

| File | What it checks |
| --- | --- |
| `tests/test_api_smoke.py` | FastAPI endpoint smoke tests |
| `tests/test_arxiv_parse.py` | arXiv metadata parsing |
| `tests/test_openalex_seed.py` | OpenAlex CS seed script (the largest suite, 217 lines) |
| `tests/test_rag_golden.py` | Golden-question regression for the Research Answer API |
| `tests/test_url_extract.py` | URL extraction from paper text |

## Two test tiers

### Hermetic unit tests (default)

`uv run pytest` runs everything **except** `golden`. These tests must not
require network or a live ClickHouse instance. CI runs this tier on every push
and PR via `.github/workflows/ci.yml` → `test` job.

### Golden RAG regression (opt-in)

`uv run pytest -m golden tests/test_rag_golden.py` calls the deployed Pages
Function at `https://papers.highsignal.app/api/rag/query` with 17 fixed
reference questions spanning all paper-signal intents (sleepers, ratings,
clusters, recent, RAG) plus general live-retrieval topics (GNNs, attention,
diffusion, RLHF, codegen, federated, multimodal).

The suite checks **structural quality** — answer length, citation count,
citations resolve to real index records, intent routing — without prose
string-matching, so model nondeterminism stays green while silent degradation
fails loudly.

Set `GOLDEN_RAG_URL` to point at a different endpoint (e.g. a preview deploy).

## CI

`.github/workflows/ci.yml` defines two jobs:

1. **`test`** — installs the package, runs `pytest -q -m "not golden"`. Runs on
   push/PR/dispatch.
2. **`golden-rag-regression`** — probes `GOLDEN_RAG_URL` reachability, then runs
   `pytest -m golden tests/test_rag_golden.py` only if reachable. Skips loudly
   with a warning + `$GITHUB_STEP_SUMMARY` notice when unreachable, so a
   silent skip is visible.

`.github/workflows/deploy.yml` is `workflow_dispatch`-only (manual production
deploy to Cloudflare Pages). See [`operations/`](../operations/index.md).

## Docs validation

`./scripts/check-docs.sh` validates `docs/` links and structure. CI runs the
same check via `.github/workflows/docs.yml`. See
[`workflow.md`](workflow.md) and the script header for details.
