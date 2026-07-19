# Refresh manifest

Schema and quality gate for `data/refresh-manifest.json`, the structured
record of overlay/refresh job outcomes. Source of truth for the
`data-research-toolbox-automation` "Refresh lifecycle and quality"
requirement.

## Location

`data/refresh-manifest.json` (gitignored — operator-local state). Written by
[`refresh_manifest.py`](../../src/researchpapers/refresh_manifest.py) on every
`papers warm-update` run and read by `/healthz` and the Pages `/api/health`
operator link.

## Schema

```json
{
  "runs": {
    "enrich_citations": {
      "step": "enrich_citations",
      "source_watermark": "2026-07-18T03:00:00Z | cursor-abc | null",
      "bounds": {"enrich_limit": 500},
      "timeout_s": 1800,
      "idempotency": "ReplacingMergeTree citation_overlay_v2 + FINAL reads",
      "retries": {"max_attempts": 3, "backoff_base_ms": 2000, "used": 0},
      "output_count": 412,
      "quality_signal": {"expected_min_output": 1},
      "quality_failed": false,
      "error": null,
      "freshness": {
        "wall_clock": "2026-07-18T06:12:31Z",
        "delta_s_from_prior": 86412
      }
    }
  },
  "last_failure": null
}
```

## Quality gate

A step that exits successfully with `output_count < expected_min_output` is
marked `quality_failed: true` and **does not advance freshness**
(`freshness.wall_clock` retains the prior successful run's value). This
catches the "green job writes empty/poor output" failure mode that an exit
code alone would miss.

`last_failure` records the most recent unresolved failure (step, time,
error message). It is cleared when the failing step next succeeds.

## Steps tracked

| Step | Source | Idempotency | Expected min output |
| --- | --- | --- | --- |
| `enrich_citations` | Semantic Scholar (top-N) | `citation_overlay_v2` ReplacingMergeTree | 1 |
| `refresh_abstracts` | arXiv API | `abstract_overlay_v2` ReplacingMergeTree | 1 |
| `build_author_graph` | `papers` metadata | `authors_v2` / `paper_authorships_v2` ReplacingMergeTree | 1 |
| `export_ch` | Current CH state | Overwrite `web/public/data/*.json` | 1 |
| `web_build` | `web/` source | `npm run build` overwrites `dist/` | 1 |

## Activation counters

Search activation evidence is emitted by
[`activation.py`](../../src/researchpapers/activation.py) as aggregate
PostHog events — `search_outcome` (per search request, with surface +
result-count bucket), `result_inspection` (per paper-detail open from
search), `saved_action` (per export/organize action). **No raw query text,
paper IDs, or user identifiers are sent.** See
[`foundry.md`](foundry.md) for the sanitization contract.
