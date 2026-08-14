import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { onRequestGet } from "../web/functions/api/health.ts";

const request = new Request("https://papers.example/api/health");
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "web");

test("Pages health checks real required assets using bounded byte ranges", async () => {
  const checked = [];
  const response = await onRequestGet({
    request,
    env: {
      CF_PAGES_COMMIT_SHA: "abc123",
      ASSETS: {
        async fetch(assetRequest) {
          checked.push(assetRequest);
          return new Response("{", {
            status: 206,
            headers: {
              "content-length": "1",
              "content-range": "bytes 0-0/100",
            },
          });
        },
      },
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.revision, "abc123");
  assert.equal(checked.length, 4);
  assert.ok(checked.every((assetRequest) => assetRequest.headers.get("range") === "bytes=0-0"));
});

test("Pages health returns 503 when a required search asset is unavailable", async () => {
  const response = await onRequestGet({
    request,
    env: {
      ASSETS: {
        async fetch(assetRequest) {
          return new URL(assetRequest.url).pathname.endsWith("/hot.json")
            ? new Response(null, { status: 404 })
            : new Response("{", {
                status: 206,
                headers: {
                  "content-length": "1",
                  "content-range": "bytes 0-0/100",
                },
              });
        },
      },
    },
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  assert.equal(body.surfaces.search, "unavailable");
  assert.match(body.errors.search_bundle, /hot\.json/);
});

test("Pages health never exposes asset binding errors", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await onRequestGet({
      request,
      env: {
        ASSETS: {
          async fetch() {
            throw new Error("private origin token=operator-secret");
          },
        },
      },
    });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    assert.equal(response.status, 503);
    assert.doesNotMatch(serialized, /operator-secret/);
    assert.ok(
      body.indexing.required_search_assets.every(
        (asset) => asset.error === "asset check failed"
      )
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("sitemap URLs are final direct routes with no redirect hops (#32)", async () => {
  const sitemap = await readFile(join(webRoot, "public/sitemap.xml"), "utf8");
  const routes = [
    ...sitemap.matchAll(/<loc>https:\/\/papers\.highsignal\.app([^<]*)<\/loc>/g),
  ].map((match) => match[1]);

  assert.ok(routes.length > 0, "sitemap.xml must list at least one URL");
  // Home is the only route allowed to keep its trailing slash; every other
  // form (trailing slash or `.html` suffix) 308-redirects to the canonical
  // no-slash route on Cloudflare Pages, wasting a crawl hop.
  const hopping = routes.filter(
    (route) => route !== "/" && (route.endsWith("/") || route.endsWith(".html"))
  );
  assert.deepEqual(
    hopping,
    [],
    `sitemap URLs would redirect instead of resolving directly: ${hopping.join(", ")}`
  );
});

test("astro build uses file format so route.html is served directly (#32)", async () => {
  const astroConfig = await readFile(join(webRoot, "astro.config.mjs"), "utf8");
  // `build.format: "file"` emits `route.html`, which Cloudflare Pages serves
  // at `/route` with a 200. Directory output would 308-redirect every
  // non-home sitemap URL to `/route/`.
  assert.match(
    astroConfig,
    /build:\s*\{[^}]*format:\s*"file"/s,
    'astro.config.mjs must set build.format to "file" to avoid sitemap redirect hops'
  );
});
