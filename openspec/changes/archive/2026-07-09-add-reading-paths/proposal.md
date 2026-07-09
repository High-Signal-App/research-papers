## Why

The project already has strong corpus-scale search and analytics, but readers still need help deciding what to read first, why each paper matters, and how to export a usable list. Recent HN feedback on paper-list products points at the same gap: provenance, reading order, annotations, accessibility, and Zotero-friendly export matter more than another raw list.

## What Changes

- Add a curated reading-path surface for high-value paper sequences.
- Ship initial paths for agentic LLMs, transformer foundations, and compression/intelligence.
- Include compact paper briefs with reading rationale, provenance, source links, and prerequisite/follow-up context.
- Add lightweight JSON and BibTeX export affordances for each path.
- Link the new surface from the existing dashboard and digest navigation.

No breaking changes. No ingestion, schema, dependency, or API changes.

## Capabilities

### New Capabilities

- `curated-reading-paths`: Public static reading paths that provide ordered paper sequences, annotations, provenance, and export controls.

### Modified Capabilities

- None.

## Impact

- Affected frontend files under `web/src/` and static Astro pages.
- OpenSpec artifacts under `openspec/changes/add-reading-paths/`.
- `PROJECT_STATUS.md` and README are updated after the feature ships.
- No ClickHouse, FastAPI, corpus rebuild, deployment config, or production dependency impact.
