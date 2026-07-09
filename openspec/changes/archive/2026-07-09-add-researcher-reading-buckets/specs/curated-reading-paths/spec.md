## ADDED Requirements

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
