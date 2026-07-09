# curated-reading-paths

## MODIFIED Requirements

### Requirement: Ordered Reading Paths

The product MUST provide a public reading-path page that presents curated, ordered lists of papers for specific learning goals.

#### Scenario: Visitor opens reading paths

- **WHEN** a visitor opens `/paths`
- **THEN** they see multiple reading paths with clear titles, audiences, difficulty, outcomes, estimates, and ordered papers
- **AND** the page must be usable without a live FastAPI or ClickHouse connection.

### Requirement: Exportable Paths

Each path MUST provide lightweight exports for external reading tools.

#### Scenario: Visitor exports a path

- **WHEN** a reader activates an export for a path
- **THEN** the browser can download JSON, BibTeX, RIS, or Markdown files representing the same path and paper records rendered on the page
- **AND** the export must not require a server request.

## ADDED Requirements

### Requirement: Interactive Path Discovery

The reading-path page MUST let users narrow the catalog before choosing a path.

#### Scenario: Visitor filters paths

- **WHEN** a reader enters a search query or selects topic/difficulty filters
- **THEN** the visible path list updates client-side
- **AND** the filter must match path metadata and paper titles.
