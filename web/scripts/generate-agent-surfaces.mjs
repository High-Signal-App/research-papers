import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(scriptDir, "..");
const publicDir = join(webRoot, "public");
const origin = "https://papers.highsignal.app";
const topPapers = JSON.parse(await readFile(join(publicDir, "data/top_papers.json"), "utf8"));
const publicSurfaceUpdated = "2026-08-27";

const topLevel = [
  {
    id: "home",
    path: "/",
    md: "/index.md",
    kind: "static",
    description: "Search, citation analytics, reviewer signals, and cited research answers",
  },
  {
    id: "changelog",
    path: "/changelog",
    md: "/changelog.md",
    kind: "static",
    description: "Verified product releases and public outcomes",
  },
  {
    id: "data",
    path: "/data",
    md: "/data.md",
    kind: "dataset",
    description: "Corpus statistics, provenance, and downloadable data exports",
  },
  {
    id: "digest",
    path: "/digest",
    md: "/digest.md",
    kind: "collection",
    description: "Hot papers, reviewer-loved early work, and topic signals",
  },
  {
    id: "paths",
    path: "/paths",
    md: "/paths.md",
    kind: "collection",
    description: "Curated research reading paths with source notes",
  },
];

const paperIds = topPapers.map((paper) => String(paper.arxiv_id));
if (new Set(paperIds).size !== paperIds.length) {
  throw new Error("top_papers.json contains duplicate arXiv IDs");
}
if (paperIds.some((id) => !/^[a-z0-9./-]+$/i.test(id))) {
  throw new Error("top_papers.json contains an unsafe arXiv route ID");
}

const sitemapEntries = [
  ...topLevel.map((surface) => ({ path: surface.path, lastmod: publicSurfaceUpdated })),
  ...topPapers.map((paper) => ({
    path: `/paper/${String(paper.arxiv_id)}`,
    lastmod: String(paper.submitted_date || publicSurfaceUpdated),
  })),
];
const htmlPaths = sitemapEntries.map((entry) => entry.path);

// Cloudflare Pages serves `route.html` (Astro `build.format: "file"`) directly at
// `/route` with a 200. A trailing slash or `.html` suffix would 308-redirect to
// the canonical no-slash route, so every non-home sitemap URL must be the final
// direct form. Reject any future entry that would reintroduce a redirect hop.
const redirectHops = htmlPaths.filter(
  (path) => path !== "/" && (path.endsWith("/") || path.endsWith(".html")),
);
if (redirectHops.length) {
  throw new Error(`Sitemap URLs would redirect (not direct): ${redirectHops.join(", ")}`);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((entry) => `  <url><loc>${origin}${entry.path}</loc><lastmod>${entry.lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;

const dataResources = (await readdir(join(publicDir, "data")))
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => ({
    id: name.slice(0, -5),
    url: `${origin}/data/${name}`,
    kind: "data",
  }));

const catalog = {
  name: "researchPapers",
  version: "2",
  url: origin,
  llms: `${origin}/llms.txt`,
  llmsFull: `${origin}/llms-full.txt`,
  sitemap: `${origin}/sitemap.xml`,
  robots: `${origin}/robots.txt`,
  markdown: { suffix: ".md", negotiation: false },
  surfaces: topLevel.map((surface) => ({
    id: surface.id,
    url: `${origin}${surface.path}`,
    md: `${origin}${surface.md}`,
    kind: surface.kind,
    description: surface.description,
  })),
  collections: [
    {
      id: "papers",
      count: paperIds.length,
      urlTemplate: `${origin}/paper/{arxiv_id}`,
      mdTemplate: `${origin}/paper/{arxiv_id}.md`,
      source: `${origin}/data/top_papers.json`,
    },
  ],
  dataResources,
  auth: {
    public: true,
    notes:
      "Listed HTML and Markdown surfaces are public. Research-answer APIs may require Turnstile validation.",
  },
};

await Promise.all([
  writeFile(join(publicDir, "sitemap.xml"), sitemap, "utf8"),
  writeFile(join(publicDir, "api-ai.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8"),
]);

console.log(
  `Generated ${htmlPaths.length} HTML sitemap routes, ${paperIds.length} paper Markdown routes, and ${dataResources.length} data resources.`,
);
