import { defineConfig } from "blume";

/**
 * Blume configuration for the researchPapers knowledge base.
 *
 * Source of truth: the Markdown files under `docs/` (and the root canonical
 * docs README.md / DEPLOY.md / PROJECT_STATUS.md / STATUS.md / AGENTS.md).
 * Blume is the presentation and search layer ONLY — never edit generated
 * Blume output directly. See docs/index.md → "Maintenance rules".
 *
 * The Blume site renders the `docs/` tree. The root canonical docs are
 * GitHub-first and are referenced via relative links from `docs/`; they are
 * intentionally NOT duplicated into the Blume content root.
 *
 * Local dev:   `npx blume dev`      (needs Node.js >= 22.12)
 * Build:       `npx blume build`    → static output (git-ignored)
 * Validate:    `./scripts/check-docs.sh`  (link + structure check, CI-enforced)
 */
export default defineConfig({
  // Site
  title: "researchPapers",
  description:
    "Knowledge base for researchPapers — a ClickHouse-backed academic-paper intelligence platform.",

  // Content — only the docs/ tree is rendered. Root canonical docs
  // (README.md, DEPLOY.md, PROJECT_STATUS.md, STATUS.md, AGENTS.md) are
  // linked from docs/ but not duplicated here.
  content: {
    root: "docs",
  },

  // Theme — neutral, matches the product's geometric brand.
  theme: {
    accent: "teal",
    radius: "md",
    mode: "system",
  },

  // Local search (no hosted index).
  search: {
    provider: "orama",
  },

  // AI surfaces — llms.txt and raw-Markdown URLs so agents can read the docs.
  ai: {
    llmsTxt: true,
  },

  // SEO — sitemap + structured data on. OG images on by default.
  seo: {
    og: { enabled: true },
    sitemap: true,
    robots: true,
    structuredData: true,
  },

  // Deployment — static output. Set `site` when publishing to a custom domain.
  deployment: {
    output: "static",
    // site: "https://docs.papers.highsignal.app",
  },
});
