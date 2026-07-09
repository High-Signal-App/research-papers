# curated-reading-paths

## ADDED Requirements

### Requirement: Ordered Reading Paths

The product MUST provide a public reading-path page that presents curated, ordered lists of papers for specific learning goals.

#### Scenario: Visitor opens reading paths

- **WHEN** a visitor opens `/paths`
- **THEN** they see multiple reading paths with clear titles, audiences, estimates, and ordered papers
- **AND** the page must be usable without a live FastAPI or ClickHouse connection.

### Requirement: Paper Briefs And Provenance

Each paper in a reading path MUST include enough context for a reader to decide whether and how to read it.

#### Scenario: Visitor inspects a paper in a path

- **WHEN** a reader views a paper item
- **THEN** they see title, authors, year, source/venue context, a source link, why the paper appears there, and what to focus on while reading.

### Requirement: Exportable Paths

Each path MUST provide a lightweight export for external reading tools.

#### Scenario: Visitor exports a path

- **WHEN** a reader activates the JSON or BibTeX export for a path
- **THEN** the browser downloads a file representing the same path and paper records rendered on the page
- **AND** the export must not require a server request.

### Requirement: Discoverability

The reading-path page MUST be discoverable from existing public surfaces.

#### Scenario: Visitor navigates from existing pages

- **WHEN** a reader visits the dashboard or digest
- **THEN** they can navigate to the reading paths page from the top navigation.
