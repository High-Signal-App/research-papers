import type { APIRoute } from "astro";

import { readingPaths } from "@/data/reading-paths";
import { markdownResponse } from "@/lib/markdown-response";

export const prerender = true;

export const GET: APIRoute = () =>
  markdownResponse(`---
title: "Research Papers reading paths"
description: "Ordered research reading paths with source notes and citation-manager exports."
canonical: "https://papers.highsignal.app/paths"
last_updated: "2026-08-27"
---

# Research Papers reading paths

Ordered, copyright-safe research paths built from bibliographic metadata,
source links, and original notes. The catalog does not host PDFs or copy
abstracts.

${readingPaths
  .map(
    (path) => `## ${path.title}

${path.subtitle}

- Audience: ${path.audience}
- Difficulty: ${path.difficulty}
- Estimate: ${path.estimate}
- Outcome: ${path.outcome}
- Provenance: ${path.sourceNote}
- Trust note: ${path.trustNote}

${path.papers
  .map(
    (paper, index) => `${index + 1}. [${paper.title}](${paper.url}): ${paper.relation}
   - ${paper.brief}
   - Read for: ${paper.focus}`,
  )
  .join("\n")}`,
  )
  .join("\n\n")}`);
