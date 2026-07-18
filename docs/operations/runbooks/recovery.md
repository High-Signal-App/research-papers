# Recovery runbooks

Step-by-step procedures for common failure modes. The compact recovery table
also lives in [`host-setup.md`](../host-setup.md) → "Recovery runbook"; this
page expands the non-obvious cases.

## API 502s via Cloudflare Tunnel

1. Check the API process: `launchctl list | grep researchpapers`.
2. Restart it:
   `launchctl kickstart -k gui/$(id -u)/com.researchpapers.api`.
3. Verify: `curl http://127.0.0.1:8000/healthz` should 200.
4. If still 502, check the tunnel (next runbook).

## Tunnel offline

1. `sudo launchctl print system/com.cloudflare.cloudflared`.
2. `sudo launchctl kickstart -k system/com.cloudflare.cloudflared`.
3. Verify from cellular: `curl https://api.<your-domain>/healthz`.

## ClickHouse unreachable

1. `docker ps` — is the container up?
2. If `docker ps` itself errors (OrbStack on macOS 26):
   `~/.orbstack/bin/orb start` from the CLI (the GUI doesn't always re-spawn
   the backend). Linux Docker daemons don't have this issue.
3. `docker compose up -d clickhouse`.
4. Verify: `curl http://localhost:8123/ping`.

## Disk full

1. `df -h`.
2. `docker system prune -a` (removes unused images/containers — confirm before
   running on a shared host).
3. Rotate `~/Library/Logs/researchpapers-*` logs.
4. If `chdata` volume is the consumer, run `dump_data.sh`, then prune old
   ClickHouse parts after confirming the dump is good.

## Cold-restore from R2 backup

1. `rclone copy r2:researchpapers-backup/researchpapers_data_<ts>.tar.gz /tmp/`
2. `./scripts/deploy.sh /tmp/researchpapers_data_<ts>.tar.gz`
3. `deploy.sh` re-applies the `effective_year` / `effective_date` UDFs
   automatically (they live in ClickHouse system state, not the data volume).
4. Verify: `curl http://127.0.0.1:8000/healthz` and check a year-based chart
   for sane values.

## Warm restore on a fresh machine

See [`DEPLOY.md`](../../../DEPLOY.md) §1 and
[`deploy.md`](../deploy.md#warm-restore-preferred). Prereqs: Docker + `uv` +
~1.5 GB free disk.

## UDFs missing after restore

Symptom: year-based filters and charts return wrong results after a warm
restore. Cause: `effective_year` / `effective_date` are `CREATE OR REPLACE
FUNCTION` in ClickHouse system state, not the data volume; on a pre-existing
data volume the init script is skipped.

Fix: `deploy.sh` re-applies them manually. If you restored outside
`deploy.sh`, run the SQL in `clickhouse/init/02_functions.sql` by hand. See
[learnings — UDFs must be re-applied after container restores](../../knowledge/learnings.md#udfs-must-be-re-applied-after-container-restores).

## ReplacingMergeTree duplicate rows

Symptom: inflated counts, duplicate rows in API responses. Cause: a read from
a `ReplacingMergeTree` overlay table forgot `FINAL`. Fix: add `FINAL` to the
query. See [learnings — ReplacingMergeTree requires FINAL on every read](../../knowledge/learnings.md#replacingmergetree-requires-final-on-every-read).
