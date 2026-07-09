## Overview

Add a frontend-first `/paths` page backed by repo-local TypeScript data. The first implementation is intentionally static so it can ship with the current Cloudflare Pages/static export path and avoid new backend, ClickHouse, or Knowledgebase dependencies.

## User Experience

- The page leads with the problem: move from bookmarking to an ordered reading plan.
- Each path shows audience, time estimate, trust/provenance, and the ordered paper list.
- Each paper item includes why it is in the sequence, what to pay attention to, and a source link.
- Export controls generate JSON and BibTeX client-side from the same data rendered on the page.
- Visual design follows the existing dashboard/digest style: dense, readable, low-motion, no decorative animation.

## Data Model

`web/src/data/reading-paths.ts` exports:

- `ReadingPath`: metadata, tags, trust note, source note, and `papers`.
- `ReadingPathPaper`: title, authors, year, venue, URL, DOI/arXiv ID when available, brief, reading note, and optional relation label.

This keeps the first version reviewable and lets later work replace or augment the data from ClickHouse/RAG without changing the page contract.

## Export

The page embeds the path payload in a JSON script tag. A small browser script:

- Finds the selected path by id.
- Downloads a `.json` export with path metadata and papers.
- Generates a minimal BibTeX file using title, author, year, venue, URL, DOI, and arXiv ID.

The export is deliberately simple and dependency-free. Zotero users can import BibTeX now; richer CSL/RIS export can be a follow-up.

## Non-Goals

- No full paper rendering or PDF mirroring.
- No user accounts, saved collections, or personalization.
- No ingestion/data-pipeline changes.
- No generated AI summaries shipped as fact without human curation.

## Verification

- Build the Astro frontend with `cd web && npm run build`.
- Inspect generated route presence and TypeScript/Astro compile output.
