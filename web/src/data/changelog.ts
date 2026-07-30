export const changelogEntries = [
  {
    date: "2026-07-09",
    title: "Curated reading paths made the corpus easier to enter",
    outcomes: [
      "Researchers can follow ordered paths for agentic LLMs, transformer foundations, alignment, retrieval, diffusion, and compression instead of starting from an undifferentiated search result.",
      "Every path includes original briefs, provenance notes, source links, and JSON, BibTeX, RIS, and Markdown exports without copying abstracts or hosting papers.",
    ],
  },
  {
    date: "2026-07-03",
    title: "Research answers gained a durable quality gate",
    outcomes: [
      "A 17-question golden regression suite now checks answer structure, citations, real index resolution, and routing across sleepers, ratings, clusters, recent work, and general retrieval.",
      "The gate avoids brittle prose matching while still failing when cited research evidence silently degrades.",
    ],
  },
  {
    date: "2026-06-24",
    title: "The public research dashboard launched",
    outcomes: [
      "The Cloudflare Pages site shipped semantic search, citation analysis, hot and sleeper papers, reviewer signals, and a same-origin research-answer path over the curated corpus.",
      "Performance work brought the production dashboard to a 100 desktop Lighthouse score and 99 mobile performance in the recorded verification run.",
      "Five representative live research-answer questions passed with cited responses in the production smoke test.",
    ],
  },
] as const;
