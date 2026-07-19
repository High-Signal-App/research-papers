# Foundry snapshot sanitization

Contract for what researchPapers may emit to Foundry (the shared fleet
PostHog project). Satisfies the `data-research-toolbox-automation` "Search
activation evidence" and "Bounded Toolbox marketing" requirements.

## Rule

researchPapers emits **only** aggregate, privacy-safe counters to Foundry.
It never sends:

- raw query text from `/search`, `/semantic-search`, or `/rag/query`
- paper IDs, arXiv IDs, DOIs, or titles
- user identifiers, session IDs, or IP addresses
- corpus content (abstracts, full text, notes)

## Events

| Event | When | Properties |
| --- | --- | --- |
| `search_outcome` | every `/search`, `/semantic-search`, `/rag/query` completes | `project_id`, `surface` (`keyword`/`semantic`/`rag`), `result_count_bucket` (`zero`/`1-5`/`6-20`/`21+`) |
| `result_inspection` | a requested paper detail is found | `project_id`, `surface` (`paper_detail`) |
| `saved_action` | a user exports or organizes a path/paper | `project_id`, `action` (coarse verb: `export_json`, `export_bibtex`, `path_add`, ...) |
| `experiment_exposure` | a bounded Toolbox experiment exposes a variant | `project_id`, `experiment_id`, `variant`, `destination` (canonical URL), `attribution` |

## Implementation

- Server-side emission: [`src/researchpapers/activation.py`](../../src/researchpapers/activation.py)
- The project key must be configured with `FOUNDRY_POSTHOG_KEY` on the API or
  `PUBLIC_POSTHOG_KEY` in the web build; there is no embedded fallback key.
- Server emission uses a bounded in-memory queue and a daemon delivery worker,
  so network I/O never runs in the request path. Delivery remains best effort.

## Verification

A future audit task (deferred — not blocking this capability) should grep
all `track_*` and `_emit` call sites to confirm no PII / query text / paper
ID is passed. The current call sites are limited to
[`api.py`](../../src/researchpapers/api.py) `/search`, `/semantic-search`,
`/papers/{paper_id}` and the Pages Function activation shim.
