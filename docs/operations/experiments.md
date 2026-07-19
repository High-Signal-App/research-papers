# Bounded Toolbox marketing experiments

Quiet, expiring discoverability experiments for researchPapers. Satisfies
the `data-research-toolbox-automation` "Bounded Toolbox marketing"
requirement.

## Rule

Experiments MUST:

- declare a canonical destination URL (no broad funnel drift)
- declare an attribution source (`utm_source`, `utm_medium`, `utm_campaign`)
- use only approved claims (see `approved_claims` below)
- declare an expiry timestamp; expired experiments stop exposing
- declare a stop rule (metric threshold or date after which the variant is
  withdrawn even if the expiry has not passed)
- record exposure via the `experiment_exposure` Foundry event (see
  [`foundry.md`](foundry.md))

Experiments MUST NOT:

- trigger corpus expansion, ranking redesign, or new paid data sources
- alter the search index, PageRank, or tag pipeline
- promote researchPapers into "My Work" or any commercial roadmap surface
- run without an explicit `experiment_id` and `expiry`

## Manifest

`data/experiments-manifest.json` (gitignored — operator-local state). Schema:

```json
{
  "experiments": [
    {
      "id": "2026-07-paths-landing-cta",
      "hypothesis": "A reading-paths CTA on the dashboard increases /paths visits.",
      "destination": "https://papers.highsignal.app/paths",
      "attribution": {"utm_source": "dashboard", "utm_medium": "internal", "utm_campaign": "paths-cta"},
      "approved_claims": ["Curated reading paths for agentic LLMs, transformers, alignment."],
      "starts_at": "2026-07-20T00:00:00Z",
      "expires_at": "2026-08-20T00:00:00Z",
      "stop_rule": "Withdraw if /paths visits fall below 5/day for 7 consecutive days.",
      "status": "draft",
      "notes": "Launch nothing until status=active is set by the operator."
    }
  ]
}
```

## Approved claims

The set of product claims experiments may use. Update this list when the
shipped feature set changes; do not let experiments make claims the product
does not deliver.

- "Curated reading paths for agentic LLMs, transformers, alignment, retrieval/RAG, diffusion, and compression."
- "Semantic search across ~488k arXiv, OpenReview, bioRxiv, and medRxiv papers."
- "Citation-graph PageRank and sleeper/hot paper signals."
- "Research Answer API with cited responses over a curated Computer Science domain."

## Current state

No experiments are active. The manifest schema and this doc are the
controls; launching an experiment is a separate, operator-approved step
that does not happen automatically from this capability work.
