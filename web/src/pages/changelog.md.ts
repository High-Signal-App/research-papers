import type { APIRoute } from "astro";

import { changelogEntries } from "@/data/changelog";
import { markdownResponse } from "@/lib/markdown-response";

export const prerender = true;

export const GET: APIRoute = () =>
  markdownResponse(`---
title: "Research Papers changelog"
description: "Verified improvements available on the public Research Papers site."
canonical: "https://papers.highsignal.app/changelog"
last_updated: "2026-08-27"
---

# Research Papers changelog

Verified improvements to the public research experience, newest first.

- [Roadmap](https://github.com/High-Signal-App/research-papers/issues)
- [Source](https://github.com/High-Signal-App/research-papers)

${changelogEntries
  .map(
    (entry) => `## ${entry.date}: ${entry.title}

${entry.outcomes.map((outcome) => `- ${outcome}`).join("\n")}`,
  )
  .join("\n\n")}`);
