## Why

The first `/paths` page proves the surface, but the complete version should behave like a practical reading workflow: choose a goal, inspect the sequence, and export it to external reading and citation tools.

## What Changes

- Expand the curated catalog beyond three starter paths.
- Add interactive filtering by topic, difficulty, and query on `/paths`.
- Add route anchors and richer path metadata: difficulty, outcome, paper count, and recommended next action.
- Add Markdown and RIS exports in addition to JSON and BibTeX.
- Update docs/status and archive the expanded OpenSpec requirements.

No backend, ClickHouse, ingestion, or cross-repo code changes are included.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `curated-reading-paths`: Expand the reading-path page from a static starter list into an interactive path catalog with fuller exports.

## Impact

- Frontend files under `web/src/`.
- Existing OpenSpec capability `curated-reading-paths`.
- README and `PROJECT_STATUS.md`.
- No production dependency changes.
