import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(scriptDir, "..");
const publicDir = join(webRoot, "public");
const origin = "https://papers.highsignal.app";
const topPapers = JSON.parse(await readFile(join(publicDir, "data/top_papers.json"), "utf8"));

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

const htmlPaths = [...topLevel.map((surface) => surface.path), ...paperIds.map((id) => `/paper/${id}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${htmlPaths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n")}
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
