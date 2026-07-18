# Knowledge

Durable, reusable knowledge that survives a single feature cycle. Concepts
with authoritative external sources are linked, not re-explained.

## Pages

- [`learnings.md`](learnings.md) — concrete engineering lessons grounded in
  code and git history, grouped by subsystem.
- [`gotchas.md`](gotchas.md) — gotcha-focused stubs for novel tech encountered
  in this project, each pointing to the code location and the external
  reference.
- [`external-references.md`](external-references.md) — one-line "what / why it
  matters here / link" for each technology in the stack.
- [`failed-approaches/`](failed-approaches/index.md) — evaluated-but-rejected
  alternatives with their own write-up.

## How this differs from ADRs

[ADRs](../architecture/decisions/index.md) capture *why a decision was made*.
Learnings capture *how the system behaves in practice* — the operational
gotchas, performance characteristics, and failure modes that an agent or new
contributor needs to know but that aren't obvious from reading the code.

## Maintenance

- A learning entry must cite the file/line or commit that grounds it. If you
  cannot point to code, it belongs in `gotchas.md` as a stub with a "TBD" until
  grounded.
- Mark unresolved questions explicitly. Do not invent information.
- When a learning is superseded, move it to
  [`failed-approaches/`](failed-approaches/index.md) or
  [`archive/`](../archive/index.md) rather than deleting it.
