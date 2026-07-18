# Timeline

Chronological log of shipped changes. The canonical source is
[`PROJECT_STATUS.md`](../../PROJECT_STATUS.md) → Timeline; this page mirrors it
so the docs site surfaces it. Update both together when adding an entry.

- **Corpus build:** ~488k papers across arXiv, OpenReview, bioRxiv, medRxiv with
  ~1.05M paper→paper edges; full-corpus PageRank → `paper_scores_v2`; MiniLM
  embeddings (384-d) for all papers; 64 semantic clusters; spaCy noun-chunk
  tags + MLX premium tagging subset.
- **Overlay enrichment shipped:** Semantic Scholar enrichment →
  `citation_overlay_v2`; ArXiv abstract refresh → `abstract_overlay_v2`;
  author graph → `authors_v2`, `paper_authorships_v2`.
- **2026-06-24:** Cloudflare Pages demo deployed at
  `https://papers.highsignal.app`; frontend no longer defaults to localhost
  APIs; Research Answer API panel ships a same-origin RAG proxy path.
  `RAG_SERVICE_KEY` is configured on Pages production and the clean
  `research-papers-cs-cited1000-all` Knowledgebase domain is seeded from OpenAlex
  primary-CS works over 999 citations, using local BGE-base embeddings uploaded
  through vector ingest. The bundled-data fallback remains for resilience.
- **2026-06-24:** Pages demo performance hardening shipped: Chart.js loads
  lazily, below-fold React islands hydrate on visibility, static assets use
  immutable caching, and Lighthouse production checks reached desktop
  100/100/100/100/100 plus mobile 99 performance and 100s elsewhere.
- **2026-06-24:** Research Answer API quality hardening shipped: paper-intent
  questions route to the curated paper-signal layer for sleepers, ratings,
  clusters, recent signals, and RAG reading lists; generic questions still use
  live Knowledgebase vector retrieval. Production smoke passed 5/5
  representative paper-RAG questions with p50 122 ms and max 349 ms.
- **2026-07-03:** Golden-question regression suite shipped for the Research
  Answer API (`tests/test_rag_golden.py`): 17 reference questions across all
  paper-signal intents plus general live-retrieval topics. Wired into CI as a
  dedicated `golden-rag-regression` job that probes the deployed Pages Function
  and skips loudly when unreachable; hermetic `uv run pytest` stays green by
  default (`-m "not golden"`).
- **2026-07-09:** Curated reading paths shipped at `/paths`: interactive
  ordered paths for agentic LLMs, transformer foundations, alignment/RLHF,
  retrieval/RAG, diffusion/generative vision, and compression/generalization,
  with search/filtering, paper briefs, provenance notes, source links, and
  client-side JSON/BibTeX/RIS/Markdown exports.
- **2026-07-09:** Researcher/source buckets added to `/paths`: the public
  Sutskever/Carmack mirror, Karpathy-style LLM systems, LeCun world-model work,
  and CHAI/Russell-aligned safety reading. Site navigation was reworked into a
  compact list with dropdown groups, and the catalog explicitly avoids copying
  abstracts, PDFs, or long excerpts.
- **2026-07-09:** Public dashboard cut down to the core product surface:
  semantic search, research answer API, hot papers, reviewer-loved early work,
  reviewer topic signals, one research map, top papers, and cited foundations.
  Removed older ingest/progress, URL, raw OpenReview, duplicate clustering,
  temporal, author, community, and citation-cycle diagnostics from the main
  page.
- **2026-07-10:** Operating decision — Cloudflare-only. Pages plus Pages
  Functions is the sole production target. The FastAPI server and local
  ClickHouse are operator-side only.

## Open questions

See [`STATUS.md`](../../STATUS.md) → Unresolved questions for the live list.
