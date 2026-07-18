# Scheduled jobs

Scheduled ingestion and export jobs run via macOS `launchd`
`StartCalendarInterval` (cron is ignored when the user isn't logged in). The
full host-setup including launchd plists lives in
[`host-setup.md`](host-setup.md) §6; this page is the canonical cadence table.

## Cadence

Tune to your source rate limits. Suggested:

| Job | When | Command |
| --- | --- | --- |
| arXiv daily delta | 03:00 daily | `papers fetch --category cs.AI --days 1` |
| OpenReview refresh | 04:00 daily | `papers ingest-openreview` |
| Citation graph rebuild | 05:00 weekly | `papers backfill-references && papers pagerank-full` |
| Overlay + web export | 06:00 daily | `papers warm-update --build-web` |

## Loading a job

One plist per job at
`~/Library/LaunchAgents/com.researchpapers.<job>.plist`. See
[`host-setup.md`](host-setup.md) §6 for the plist template.

```bash
launchctl load ~/Library/LaunchAgents/com.researchpapers.<job>.plist
launchctl list | grep researchpapers     # should show a PID
```

Tail logs at `~/Library/Logs/researchpapers-<job>.log`.

## Refreshing the Pages build after export

The JSON files in `web/public/data/` are baked at build time. After the daily
export job, hit the Cloudflare Pages Deploy Hook to rebuild the edge bundle:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/<HOOK-ID>"
```

Pages rebuilds in ~30s. See [`host-setup.md`](host-setup.md) §5.

## Constraints

- Do not run full corpus re-ingest or destructive ClickHouse ops without
  explicit approval (fleet safety constraint).
- Overlay jobs (`warm-update`, `enrich-citations`, `refresh-abstracts`,
  `build-author-graph`) should run via `papers warm-update` to avoid peaking
  multiple model loads on a 16 GB host. See
  [ADR-003](../architecture/decisions/003-mlx-qwen-tagging.md) and the
  [RAM-aware retro](../archive/retros/2026-06-13-ram-aware-pipeline.md).
