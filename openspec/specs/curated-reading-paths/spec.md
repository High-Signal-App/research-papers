# curated-reading-paths Specification

## Purpose
Define the static `/paths` reading-path catalog: ordered paper buckets, provenance, source links, exports, copyright-safe notes, and compact navigation.
## Requirements
### Requirement: Ordered Reading Paths

The product MUST provide a public reading-path page that presents curated, ordered lists of papers for specific learning goals.

#### Scenario: Visitor opens reading paths

- **WHEN** a visitor opens `/paths`
- **THEN** they see multiple reading paths with clear titles, audiences, difficulty, outcomes, estimates, and ordered papers
- **AND** the page must be usable without a live FastAPI or ClickHouse connection.

### Requirement: Paper Briefs And Provenance

Each paper in a reading path MUST include enough context for a reader to decide whether and how to read it.

#### Scenario: Visitor inspects a paper in a path

- **WHEN** a reader views a paper item
- **THEN** they see title, authors, year, source/venue context, a source link, why the paper appears there, and what to focus on while reading.

### Requirement: Exportable Paths

Each path MUST provide lightweight exports for external reading tools.

#### Scenario: Visitor exports a path

- **WHEN** a reader activates an export for a path
- **THEN** the browser can download JSON, BibTeX, RIS, or Markdown files representing the same path and paper records rendered on the page
- **AND** the export must not require a server request.

### Requirement: Discoverability

The reading-path page MUST be discoverable from existing public surfaces.

#### Scenario: Visitor navigates from existing pages

- **WHEN** a reader visits the dashboard or digest
- **THEN** they can navigate to the reading paths page from the top navigation.

### Requirement: Interactive Path Discovery

The reading-path page MUST let users narrow the catalog before choosing a path.

#### Scenario: Visitor filters paths

- **WHEN** a reader enters a search query or selects topic/difficulty filters
- **THEN** the visible path list updates client-side
- **AND** the filter must match path metadata and paper titles.

### Requirement: Researcher Source Buckets

The product MUST support source-attributed reading buckets based on public researcher recommendations, curricula, bibliographies, or researcher-authored agendas.

#### Scenario: Visitor compares researcher buckets

- **WHEN** a reader opens `/paths`
- **THEN** they can identify ordered buckets such as the Sutskever/Carmack list, LLM systems, world models, and safety/alignment
- **AND** each bucket distinguishes direct recommendations from public mirrors or inferred agenda paths.

### Requirement: Copyright-Safe Catalog Notes

The reading-path catalog MUST avoid redistributing copyrighted source content.

#### Scenario: Visitor reads or exports a bucket

- **WHEN** a reader views or exports a path
- **THEN** they receive bibliographic metadata, links, and original short notes
- **AND** the page does not copy paper abstracts, paywalled text, or long source excerpts.

### Requirement: Compact Navigation

The public pages MUST use a compact top navigation that can scale beyond a few sections.

#### Scenario: Visitor opens the dashboard, digest, or paths page

- **WHEN** the top navigation renders
- **THEN** it appears as a list of stable top-level items
- **AND** dense destinations are grouped into dropdowns instead of wrapping across the viewport.
