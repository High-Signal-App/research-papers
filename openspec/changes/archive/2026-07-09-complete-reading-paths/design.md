## Overview

Keep researchPapers as the source of curated paper paths. The complete surface remains self-contained and avoids cross-app assumptions.

## Interactive Catalog

Convert the path page from mostly static HTML into a small React island:

- Search by path title, subtitle, tags, and paper title.
- Filter by topic and difficulty.
- Show catalog summary metrics.
- Preserve hash anchors for direct links to each path.
- Keep export generation client-side and dependency-free.

## Data Model

Extend `ReadingPath` with:

- `difficulty`
- `outcome`
- `tracks`

Keep `ReadingPathPaper` source fields stable and add optional `kind`.

## Exports

Client-side export formats:

- JSON: raw path object.
- BibTeX: citation manager import.
- RIS: Zotero/EndNote import.
- Markdown: readable plan.

## Verification

- `cd web && npm run build`
- route probe for `/paths`
- Playwright desktop/mobile overflow and content checks
