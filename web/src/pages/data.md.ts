import type { APIRoute } from "astro";
import { downloadableFiles } from "@/data/downloadable-files";
import { markdownResponse } from "@/lib/markdown-response";
import chSources from "../../public/data/ch_sources_summary.json";
import summary from "../../public/data/summary.json";

export const prerender = true;

export const GET: APIRoute = () =>
  markdownResponse(`---
title: "Research Papers public analytics snapshot"
description: "Statistics, provenance, and downloadable JSON for the public research snapshot."
canonical: "https://papers.highsignal.app/data"
last_updated: "2026-09-01"
---

# Research Papers public analytics snapshot

The public snapshot describes ${summary.papers_total.toLocaleString("en-US")} papers,
${summary.paper_edges.toLocaleString("en-US")} citation edges, and the static analytics
exports generated from the operator-side ClickHouse corpus.

## Sources

${chSources.map((source) => `- ${source.source}: ${Number(source.n).toLocaleString("en-US")} papers`).join("\n")}

## Downloadable JSON

${downloadableFiles
  .map((file) => `- [${file.name}](https://papers.highsignal.app/data/${file.name}): ${file.desc}`)
  .join("\n")}

## Provenance

The corpus combines arXiv, OpenReview, bioRxiv, and medRxiv metadata. Citation
analytics, semantic communities, reviewer signals, and static exports are built
from the repository's documented ingestion and ClickHouse pipelines. JSON
exports are data resources and are intentionally separate from the HTML sitemap.

## Public-site analytics

PostHog measures bounded product events and Microsoft Clarity measures aggregate
usage and session replay on this public, no-account research library. The
semantic-search and cited-answer sections are explicitly masked, so their query
text and rendered results are not uploaded to Clarity.
`);
