# STATUS — researchPapers

Short, live operating view. Updated when the objective, active work, blockers,
or next steps change. For durable product identity (Why/What, Dependencies,
Products, Features, Timeline), see [`PROJECT_STATUS.md`](PROJECT_STATUS.md).
For the full knowledge base, see [`docs/`](docs/index.md).

Last updated: 2026-07-18

## Current objective

Keep `https://papers.highsignal.app` (Cloudflare Pages) as the sole production
surface, with fresh static JSON exports and a healthy Research Answer API
(`/api/rag/query`). Operator-side ClickHouse + FastAPI exist only to refresh
exports and run overlay jobs.

## Active work

- Documentation consolidation: building a local-first `docs/` knowledge system
  with Blume as the presentation layer (this branch: `docs/knowledge-system`).
- Keeping the golden-question regression suite green as new paper-signal intents
  or RAG domains ship.

## Blockers

- (none)

## Unresolved questions

- Backup retention on R2 — 7 days is the default in
  [`docs/operations/host-setup.md`](docs/operations/host-setup.md) §7; increase?
- Cloudflare Access policy in front of the operator API — gate behind owner
  email, or leave open while it's operator-only? See
  [`docs/operations/host-setup.md`](docs/operations/host-setup.md) §4.
- ADR-005 KeyBERT: confirm `keybert_tag.py` and the `keybert` dependency are
  safe to remove, or keep as a permanent reference. See
  [`docs/knowledge/failed-approaches/keybert.md`](docs/knowledge/failed-approaches/keybert.md).

## Next steps

1. Keep Cloudflare static JSON exports fresh after ingestion/retagging:
   `uv run papers export-ch` + frontend rebuild + manual Pages deploy.
2. Run overlay jobs on production corpus after deploy:
   `uv run papers warm-update`.
3. Expand the golden-question regression suite as new paper-signal intents or
   RAG domains ship.
4. Review and merge the `docs/knowledge-system` branch.

## Deferred

- Same-host FastAPI deployment is retired; keep the local API only for operator
  workflows and development.
- Legacy Postgres pipeline unless needed for cold restore or old commands.
- OrbStack/macOS VM instability — environment issue, not product regression
  without repro on stable Docker.
- Full-corpus Semantic Scholar backfill and manual author curation.
- Static JSON exports drift from the operator ClickHouse snapshot until
  `export-ch` + frontend rebuild rerun.
- Cold rebuild remains hours-long; warm restore from dump is the practical path.

## Operating decision

- **Cloudflare-only (2026-07-10):** Pages plus Pages Functions is the sole
  production target. Do not maintain a same-host API deployment or treat local
  ClickHouse as a public runtime dependency.
