# Design

## Data

Extend the static `readingPaths` catalog with researcher/source-attributed paths. The list remains hand-curated TypeScript data so exports stay deterministic and the static build does not need backend ingestion.

Each path's provenance and trust notes should distinguish direct recommendations, public mirrors, and researcher-authored agendas. For the Sutskever/Carmack list, the UI must not overstate attribution because public mirrors describe it as unconfirmed and commonly list 27 items even when the shorthand says about 30.

## Navigation

Add a shared Astro navigation component with a semantic `nav > ul` structure. Use grouped dropdowns for dense sections:

- Research: dashboard anchors such as Search, RAG, Hot, Sleepers, Analytics.
- Reading: Digest and Reading paths.
- About: status/source links.

Dropdowns use native `details` elements for keyboard accessibility and mobile behavior without client JavaScript.

## Copyright Safety

The catalog stores bibliographic metadata, source links, and original short notes. It must not copy paper abstracts, source-page summaries, or long quotes. Export files should contain the same original metadata and notes only.
