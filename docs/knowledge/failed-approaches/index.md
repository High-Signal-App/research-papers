# Failed approaches

Evaluated-but-rejected alternatives with their own write-up. Each entry captures
what was tried, why it was rejected, and what we learned — so the same path is
not retried without new information.

| Approach | Status | Why rejected |
| --- | --- | --- |
| [KeyBERT tagging](keybert.md) | Deprecated | Never ported to ClickHouse write path; spaCy POS-only is 3–5× faster. |
| Postgres as runtime DB | Superseded | See [Retro: Postgres → ClickHouse migration](../../archive/retros/2026-05-30-postgres-to-clickhouse.md) and [ADR-001](../../architecture/decisions/001-clickhouse-runtime.md). |
| NetworkX `nx.pagerank` at full-corpus scale | Superseded | See [ADR-006](../../architecture/decisions/006-scipy-pagerank.md) — scipy.sparse power iteration is 10–50× faster. |
| Same-host FastAPI as public runtime | Retired | 2026-07-10 operating decision: Cloudflare Pages is the sole production target. See [STATUS.md](../../../STATUS.md). |

## Conventions

- A failed approach gets its own file when there is a non-obvious reason it
  failed that future agents would otherwise rediscover.
- Link to the ADR that adopted the alternative, and to any
  [learning](../learnings.md) or [retro](../../archive/retros/) that captures
  the surrounding context.
- Do not delete the code that implemented the approach if it still exists —
  note its location so it can be safely removed later if confirmed unused.
