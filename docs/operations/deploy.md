# Deployment

The canonical deployment instructions are in [`DEPLOY.md`](../../DEPLOY.md).
This page is a navigation aid — do not duplicate `DEPLOY.md` content here.

## Three shapes (see DEPLOY.md)

1. **Backend on another machine** — `dump_data.sh` → `scp` → `deploy.sh` on the
   target. Dump size ≈ on-disk CH size (~700 MB compressed for 488k papers).
2. **Frontend on the same machine as the backend** — `cd web && pnpm build &&
   pnpm preview` (or `pnpm dev`). Edit `web/public/api-config.js` to point at a
   non-default API host.
3. **Frontend on Cloudflare Pages or Vercel** — build with
   `PUBLIC_API_URL=https://api.your-host.com pnpm build` and upload `dist/`.

## Production target

Cloudflare Pages is the sole production target (operating decision 2026-07-10).
The deploy workflow is `.github/workflows/deploy.yml` (`workflow_dispatch`-only,
manual). It runs `pnpm build` in `web/` and deploys `dist/` via
`cloudflare/wrangler-action@v3` to project `research-papers`, then smoke-tests
`https://papers.highsignal.app/`.

`PUBLIC_API_URL` is left unset in CI so the browser calls the same-origin Pages
Function at `/api/rag/query`. `RAG_SERVICE_URL`, `RAG_DOMAIN`, and
`RAG_SERVICE_KEY` are Pages **runtime** vars set in the Cloudflare dashboard,
not CI secrets.

## API URL priority (frontend)

React islands resolve the API base URL in this order:

1. `PUBLIC_API_URL` — build-time env var (CF Pages / Vercel).
2. `window.__API_BASE__` — runtime override from `/api-config.js`.
3. `http://127.0.0.1:8000` — local dev default.

## Warm restore (preferred)

`./scripts/deploy.sh /path/to/researchpapers_data_*.tar.gz` brings up
ClickHouse, restores the dump, re-applies the `effective_year` / `effective_date`
UDFs (they live in system state, not the data volume), and starts FastAPI.
Minutes, not hours. See [`DEPLOY.md`](../../DEPLOY.md) §1 and the
[recovery runbook](runbooks/recovery.md).

## Notes from DEPLOY.md

- `clickhouse/init/02_functions.sql` auto-creates the UDFs on a fresh CH boot;
  on a pre-existing data volume the init script is skipped and `deploy.sh`
  re-applies them manually.
- `paper_metadata_v2` and `paper_scores_v2` overlays are included in the dump,
  so corrected titles + full-corpus PageRank survive transport.
- OrbStack 2.1.3 on macOS 26 can have VM-backend instability — run
  `~/.orbstack/bin/orb start` from the CLI if `docker ps` randomly fails. Linux
  Docker daemons don't have this issue.

For fresh-host setup (always-on mode, launchd, tunnel, R2 backups), see
[`host-setup.md`](host-setup.md).
