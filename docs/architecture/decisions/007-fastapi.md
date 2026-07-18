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
- `--lean` mode: the API defaults to spawning a one-shot subprocess for query
  encoding (`encode_query.py`) rather than keeping the SentenceTransformer
  loaded. This saves ~400 MB RSS on the API process at the cost of ~0.5s
  latency per semantic-search request.

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
