# ADR-007 — FastAPI over alternatives

**Date:** 2026-05-30
**Status:** Accepted (operator-only runtime; production is Cloudflare Pages —
see [operations/host-setup.md](../../operations/host-setup.md))

## Context

Need a lightweight HTTP API over ClickHouse. Endpoints are read-only; no
mutations. The semantic-search endpoint needs to invoke a Python ML model
(SentenceTransformer) synchronously.

## Decision

FastAPI with `uvicorn`.

## Rationale

- FastAPI's automatic OpenAPI docs reduce endpoint documentation burden.
- Async-friendly: ClickHouse queries via `clickhouse-connect` can be offloaded
  without blocking the event loop.
- Lean mode (`PAPERS_LEAN_API=1`, the default): the API starts with no ML
  model resident and loads the SentenceTransformer encoder lazily in-process
  on the first semantic-search request, keeping it resident thereafter. This
  saves ~400 MB RSS versus eager loading; the first request pays a ~1s model
  load, subsequent requests are ~10–50 ms. (An earlier design spawned a
  one-shot `encode_query.py` subprocess per request; that was replaced by
  lazy in-process loading. `encode_query.py` survives as the standalone
  `papers encode-query` CLI helper.)

## Alternatives considered

- Flask: synchronous, heavier setup for type-annotated request/response models.
- Django: too heavy for a read-only analytics API.

## Trade-offs

- CORS is wide-open (`allow_origins=["*"]`) — acceptable for a private
  self-hosted deployment, not for a public API without authentication.
- Per the 2026-07-10 operating decision, the FastAPI server is operator-only;
  the public product is the static Astro build on Cloudflare Pages plus Pages
  Functions. See [STATUS.md](../../../STATUS.md).

## References

- [Learnings — FastAPI lean mode](../../knowledge/learnings.md#fastapi-lean-mode)
