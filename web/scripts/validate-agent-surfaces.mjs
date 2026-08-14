import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(scriptDir, "..");
const origin = "https://papers.highsignal.app";
const sitemap = await readFile(join(webRoot, "public/sitemap.xml"), "utf8");
const paths = [
  ...sitemap.matchAll(/<loc>https:\/\/papers\.highsignal\.app([^<]*)<\/loc>/g),
].map((match) => match[1]);

const failures = [];

// Regression guard for issue #32: every non-home sitemap URL must be the final
// direct route (no trailing slash, no `.html` suffix). Cloudflare Pages serves
// `route.html` (Astro `build.format: "file"`) at `/route` with a 200; any other
// form 308-redirects to the canonical route, wasting a crawl hop.
for (const route of paths) {
  if (route === "/") continue;
  if (route.endsWith("/")) {
    failures.push(`${route}: trailing slash would 308-redirect to the direct route`);
  }
  if (route.endsWith(".html")) {
    failures.push(`${route}: .html suffix would 308-redirect to the direct route`);
  }
}

// The build must use `format: "file"` so `route.html` is served directly at
// `/route`. Switching back to "directory" would reintroduce 308 hops for every
// non-home sitemap URL.
const astroConfig = await readFile(join(webRoot, "astro.config.mjs"), "utf8");
if (!/build:\s*\{[^}]*format:\s*"file"/s.test(astroConfig)) {
  failures.push("astro.config.mjs build.format is not \"file\" — sitemap URLs would 308-redirect");
}

function outputPath(route, extension) {
  if (route === "/") return join(webRoot, "dist", `index.${extension}`);
  return join(webRoot, "dist", `${route.slice(1)}.${extension}`);
}

for (const route of paths) {
  const htmlPath = outputPath(route, "html");
  const markdownPath =
    route === "/"
      ? join(webRoot, "dist/index.md")
      : join(webRoot, "dist", `${route.slice(1)}.md`);
  try {
    await stat(htmlPath);
    const markdown = await readFile(markdownPath, "utf8");
    if (!markdown.startsWith("# ")) failures.push(`${route}: Markdown has no H1`);
    const html = await readFile(htmlPath, "utf8");
    const expectedCanonical = `${origin}${route}`;
    if (!html.includes(`<link rel="canonical" href="${expectedCanonical}">`)) {
      failures.push(`${route}: canonical does not match the direct sitemap URL`);
    }
    if (!/property="og:image"/i.test(html)) failures.push(`${route}: missing og:image`);
    const visibleHtml = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, "")
      .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, "");
    if (/\$\{|{{|<%=/.test(visibleHtml)) failures.push(`${route}: visible template leak`);
  } catch (error) {
    failures.push(`${route}: ${error.message}`);
  }
}

const catalog = JSON.parse(await readFile(join(webRoot, "public/api-ai.json"), "utf8"));
for (const surface of catalog.surfaces) {
  const markdown = new URL(surface.md);
  if (new URL(surface.url).origin !== origin || markdown.origin !== origin) {
    failures.push(`${surface.id}: catalog surface is not same-origin`);
    continue;
  }
  try {
    await stat(join(webRoot, "dist", markdown.pathname.slice(1)));
  } catch {
    failures.push(`${surface.id}: catalog Markdown missing`);
  }
}

if (failures.length) {
  throw new Error(`Agent surface validation failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  `Validated ${paths.length}/${paths.length} HTML routes with Markdown, OG images, and no visible template leaks; ${catalog.surfaces.length}/${catalog.surfaces.length} catalog surfaces valid.`,
);
