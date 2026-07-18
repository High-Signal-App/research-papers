# Architecture Decision Records

Decisions made during the researchPapers platform build. Dates derived from git
history. Each ADR is a short, self-contained file in this directory.

| # | Decision | Status | Date |
| --- | --- | --- | --- |
| [001](001-clickhouse-runtime.md) | ClickHouse as the runtime database | Accepted | 2026-05-30 |
| [002](002-minilm-embeddings.md) | all-MiniLM-L6-v2 for paper embeddings (384-dim) | Accepted | 2026-05-30 |
| [003](003-mlx-qwen-tagging.md) | MLX (Qwen2.5-3B-4bit) for premium tagging | Accepted | 2026-05-30 |
| [004](004-spacy-pos-only.md) | spaCy v2 with parser disabled (POS-only noun-chunk tagger) | Accepted | 2026-05-30 |
| [005](005-keybert-not-used.md) | KeyBERT (not used in production pipeline) | Deprecated | 2026-05-30 |
| [006](006-scipy-pagerank.md) | scipy.sparse power iteration for full-corpus PageRank | Accepted | 2026-05-31 |
| [007](007-fastapi.md) | FastAPI over alternatives | Accepted | 2026-05-30 |
| [008](008-astro-react-islands.md) | Astro 5 + React islands + static JSON exports | Accepted | 2026-05-30 |

## How to add a new ADR

1. Copy `008-astro-react-islands.md` as a template.
2. Number sequentially (next would be `009-...`).
3. Keep it to Context / Decision / Rationale / Alternatives / Trade-offs /
   References — link to [learnings](../../knowledge/learnings.md) and
   [failed-approaches](../../knowledge/failed-approaches/index.md) rather than
   duplicating rationale.
4. Add a row to the table above.

See [failed-approaches/](../../knowledge/failed-approaches/index.md) for
evaluated-but-rejected alternatives that warrant their own write-up.
