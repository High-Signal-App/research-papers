# researchPapers — knowledge system

This directory is the canonical, agent- and human-readable knowledge base for
the `research-papers` repository. Markdown here is the source of truth;
[Blume](https://useblume.dev/) (configured in `blume.config.ts` at the repo
root) is only the presentation and search layer.

For the agent bootloader, see [`../AGENTS.md`](../AGENTS.md). For the live
operating state, see [`../STATUS.md`](../STATUS.md). For the fleet-facing
product identity (Why/What/Dependencies/Products/Features), see
[`../PROJECT_STATUS.md`](../PROJECT_STATUS.md).

## Map

| Area | Path | What lives there |
| --- | --- | --- |
| **Product** | [`product/`](product/index.md) | What the product is, who uses it, the public surfaces. |
| **Architecture** | [`architecture/`](architecture/index.md) | System overview, data flow, and [ADR records](architecture/decisions/index.md). |
| **Development** | [`development/`](development/index.md) | Local dev loop, commands, testing, CI. |
| **Operations** | [`operations/`](operations/index.md) | Deploy shapes, host setup, scheduled jobs, runbooks. |
| **Knowledge** | [`knowledge/`](knowledge/index.md) | Durable learnings, gotchas, external references, and failed approaches. |
| **Current** | [`current/`](current/index.md) | Timeline of shipped changes; live state lives in `STATUS.md`. |
| **Archive** | [`archive/`](archive/index.md) | Retros and superseded material kept for git history. |

## Root canonical docs (not duplicated here)

These root files are the canonical entry points and are referenced from `docs/`
rather than copied:

- [`README.md`](../README.md) — product overview, quickstart, repo layout, known issues.
- [`DEPLOY.md`](../DEPLOY.md) — the three deployment shapes (host / LAN / CDN).
- [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) — fleet-facing product identity and timeline.
- [`STATUS.md`](../STATUS.md) — short live operating view.
- [`AGENTS.md`](../AGENTS.md) — agent bootloader.

## Maintenance rules

1. **Markdown is the source of truth.** Blume is presentation only; never edit
   generated Blume output directly.
2. **No two homes for the same fact.** If a fact lives in `README.md` or
   `DEPLOY.md`, link to it from `docs/` instead of restating it. If a fact
   moves, update or archive the old location.
3. **Short, focused pages.** Target 150–300 lines per file. Split catch-all
   docs by topic; cross-link with relative paths.
4. **ADRs are append-only.** Supersede an ADR with a new numbered ADR that
   references the old one; do not rewrite history.
5. **Learnings cite code.** A learning entry should point to the file/line or
   commit that grounds it. See [`knowledge/learnings.md`](knowledge/learnings.md).
6. **Mark unresolved questions explicitly** with "TBD" or an "Open questions"
   section — do not invent information.
7. **Validate before committing.** Run `./scripts/check-docs.sh` to catch
   broken links and orphaned files. CI runs the same check on every push.
