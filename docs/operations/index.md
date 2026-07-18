# Operations

How researchPapers is deployed, kept alive, and operated. The canonical
deployment instructions live in [`DEPLOY.md`](../../DEPLOY.md); this folder
holds the operational context around it (host setup, scheduled jobs, runbooks).

## Pages

- [`deploy.md`](deploy.md) — pointer to the three deployment shapes and the
  operator-only vs production split.
- [`host-setup.md`](host-setup.md) — fresh M1 Pro host setup: always-on mode,
  launchd services, Cloudflare Tunnel, R2 backups, health monitoring.
- [`jobs.md`](jobs.md) — scheduled ingestion and export jobs.
- [`runbooks/recovery.md`](runbooks/recovery.md) — recovery procedures for
  common failure modes.

## Where the facts live

| Fact | Canonical home |
| --- | --- |
| Three deployment shapes | [`DEPLOY.md`](../../DEPLOY.md) |
| Warm restore / cold rebuild | [`DEPLOY.md`](../../DEPLOY.md) and [`README.md`](../../README.md) → Quickstart |
| Cloudflare Pages config | [`DEPLOY.md`](../../DEPLOY.md) §3 and `.github/workflows/deploy.yml` |
| RAG service env vars | [`DEPLOY.md`](../../DEPLOY.md) §3 |
| Docker Compose services | `docker-compose.yml` |
| ClickHouse init SQL | `clickhouse/init/01_schema.sql` … `04_indexes.sql` |

## Operating decision (2026-07-10)

Cloudflare Pages plus Pages Functions is the sole production target. The
FastAPI server and local ClickHouse are operator-side only — used to refresh
static exports, not as a public runtime dependency. See
[STATUS.md](../../STATUS.md).
