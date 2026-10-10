import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { onRequest as pagesMiddleware } from "../web/functions/_middleware.ts";
import { onRequestGet } from "../web/functions/api/health.ts";
import { onRequestPost as ragQuery } from "../web/functions/api/rag/query.ts";

const request = new Request("https://papers.example/api/health");
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "web");

test("RAG stage timing reports only fixed props and stages that ran", async () => {
  const originalFetch = globalThis.fetch;
  const batches = [];
  globalThis.fetch = async (input, init) => {
    if (input === "https://ingest.sassmaker.com/v1/logs") {
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer test-only-key");
      batches.push(JSON.parse(init.body));
      return new Response(null, { status: 202 });
    }
    if (String(input).includes("siteverify")) {
      return Response.json({ success: false });
    }
    if (String(input).endsWith("/v1/kb/query")) {
      return new Response("upstream-private", { status: 503 });
    }
    return Response.json([]);
  };
  try {
    const cases = [
      { env: {}, stages: ["static_ms"], status: 200 },
      {
        env: { RAG_SERVICE_KEY: "private-key", TURNSTILE_SECRET: "private-secret", TURNSTILE_HOSTNAMES: "papers.example" },
        stages: ["turnstile_ms"],
        status: 403,
      },
      {
        env: { RAG_SERVICE_KEY: "private-key", GOLDEN_CI_BYPASS_TOKEN: "private-bypass" },
        stages: ["ext_rag_ms", "static_ms"],
        status: 200,
      },
    ];
    for (const [index, scenario] of cases.entries()) {
      const pending = [];
      const request = new Request("https://papers.example/api/rag/query?session=private-session", {
        method: "POST",
        headers: { "X-Golden-CI-Token": "private-bypass" },
        body: JSON.stringify({ question: "private-question", turnstileToken: "private-token" }),
      });
      Object.defineProperty(request, "cf", { value: { colo: index === 0 ? "BOM" : "private-colo" } });
      const response = await ragQuery({
        request,
        env: {
          APP_HEALTH_INGEST_KEY: "test-only-key",
          APP_HEALTH_ENVIRONMENT: " staging ",
          APP_HEALTH_STAGE_SAMPLE_RATE: "1",
          ...scenario.env,
        },
        waitUntil: (delivery) => pending.push(delivery),
      });
      await Promise.all(pending);
      assert.equal(response.status, scenario.status);
      const batch = batches[index];
      assert.deepEqual(Object.keys(batch).sort(), ["batch_id", "environment", "logs", "schema_version"]);
      assert.equal(batch.schema_version, "v1");
      assert.equal(batch.environment, "staging");
      assert.match(batch.batch_id, /^[0-9a-f-]{36}$/);
      assert.equal(batch.logs.length, 1);
      const log = batch.logs[0];
      assert.deepEqual(Object.keys(log).sort(), ["event", "level", "log_id", "props", "timestamp"]);
      assert.equal(log.event, "api.stage_timing");
      assert.equal(log.level, "debug");
      assert.match(log.log_id, /^[0-9a-f-]{36}$/);
      assert.ok(Number.isInteger(log.timestamp));
      assert.deepEqual(Object.keys(log.props).sort(), [
        "route", "status", "total_ms", "edge_cache", "inner_cache", "colo", "cold", ...scenario.stages,
      ].sort());
      assert.equal(log.props.route, "/api/rag/query");
      assert.equal(log.props.status, response.status);
      assert.equal(log.props.edge_cache, "NONE");
      assert.equal(log.props.inner_cache, "NONE");
      assert.equal(log.props.colo, index === 0 ? "BOM" : "unknown");
      assert.equal(log.props.cold, index === 0 ? 1 : 0);
      for (const name of ["total_ms", ...scenario.stages]) {
        assert.match(name, /^[a-z][a-z0-9_]{0,31}_ms$/);
        assert.ok(Number.isInteger(log.props[name]));
        assert.ok(log.props[name] >= 0 && log.props[name] <= 600000);
      }
      assert.doesNotMatch(JSON.stringify(batch), /private-|test-only-key/);
    }
    assert.equal(batches.length, cases.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RAG stage timing sends nothing at rate zero or without an ingest key", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("unexpected fetch");
  };
  try {
    for (const env of [
      { APP_HEALTH_INGEST_KEY: "test-only-key", APP_HEALTH_STAGE_SAMPLE_RATE: "0" },
      { APP_HEALTH_STAGE_SAMPLE_RATE: "1" },
      { APP_HEALTH_INGEST_KEY: "", APP_HEALTH_STAGE_SAMPLE_RATE: "1" },
    ]) {
      const pending = [];
      const response = await ragQuery({
        request: new Request("https://papers.example/api/rag/query", { method: "POST", body: "invalid JSON" }),
        env,
        waitUntil: (delivery) => pending.push(delivery),
      });
      assert.equal(response.status, 400);
      assert.equal(pending.length, 0);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RAG telemetry failure does not change or delay the response", async () => {
  const originalFetch = globalThis.fetch;
  let rejectDelivery;
  globalThis.fetch = () => new Promise((_, reject) => { rejectDelivery = reject; });
  try {
    const pending = [];
    const response = await ragQuery({
      request: new Request("https://papers.example/api/rag/query", { method: "POST", body: "{}" }),
      env: { APP_HEALTH_INGEST_KEY: "test-only-key", APP_HEALTH_STAGE_SAMPLE_RATE: "1" },
      waitUntil: (delivery) => pending.push(delivery),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "question must be at least 3 characters" });
    rejectDelivery(new Error("ingest unavailable"));
    await Promise.all(pending);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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
          const pathname = new URL(assetRequest.url).pathname;
          if (pathname.endsWith("/hot.json")) return new Response(null, { status: 404 });
          if (pathname.endsWith("/sleepers.json")) return new Response("", { status: 200 });
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

  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  assert.equal(body.surfaces.search, "unavailable");
  assert.match(body.errors.search_bundle, /hot\.json/);
  assert.match(body.errors.search_bundle, /sleepers\.json/);
});

test("Pages health accepts nonempty asset bodies without range or length headers", async () => {
  let cancelledBodies = 0;
  const response = await onRequestGet({
    request,
    env: {
      ASSETS: {
        async fetch(assetRequest) {
          assert.equal(assetRequest.headers.get("range"), "bytes=0-0");
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("["));
              },
              cancel() {
                cancelledBodies += 1;
              },
            }),
            { status: 200 },
          );
        },
      },
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(cancelledBodies, 4);
  assert.ok(
    body.indexing.required_search_assets.every((asset) => asset.available && asset.status === 200),
  );
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

test("Pages App Health telemetry sends only a matched route summary", async () => {
  const originalFetch = globalThis.fetch;
  const ingestCalls = [];
  globalThis.fetch = async (input, init) => {
    ingestCalls.push({ input, init });
    return new Response(null, { status: 202 });
  };
  try {
    const sensitive = [
      "session-private",
      "query-private",
      "paper-private",
      "turnstile-private",
      "ip-private",
      "response-private",
      "test-only-ingest-key",
    ];
    const request = new Request(
      `https://papers.example/api/rag/query?session=${sensitive[0]}&query=${sensitive[1]}&paper=${sensitive[2]}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": sensitive[4],
        },
        body: JSON.stringify({ question: sensitive[1], turnstileToken: sensitive[3] }),
      },
    );
    const responseBody = JSON.stringify({ answer: sensitive[5] });
    const response = new Response(responseBody, { status: 200 });
    const pending = [];
    const result = await pagesMiddleware({
      request,
      env: {
        APP_HEALTH_INGEST_KEY: sensitive[6],
        APP_HEALTH_ENVIRONMENT: "staging",
      },
      params: {},
      data: {},
      next: async () => response,
      waitUntil: (delivery) => pending.push(delivery),
    });
    await Promise.all(pending);

    assert.equal(result, response);
    assert.equal(result.status, 200);
    assert.equal(await result.text(), responseBody);
    assert.equal(ingestCalls.length, 1);
    const batch = JSON.parse(ingestCalls[0].init.body);
    assert.deepEqual(
      {
        schema_version: batch.schema_version,
        runtime: batch.runtime,
        environment: batch.environment,
      },
      { schema_version: "v1", runtime: "worker", environment: "staging" },
    );
    assert.equal(batch.events.length, 1);
    assert.deepEqual(
      Object.keys(batch.events[0]).sort(),
      ["duration_ms", "event_id", "method", "route", "status_code", "timestamp"],
    );
    assert.equal(batch.events[0].method, "POST");
    assert.equal(batch.events[0].route, "/api/rag/query");
    assert.equal(batch.events[0].status_code, 200);
    assert.ok(Number.isInteger(batch.events[0].duration_ms));
    const serialized = JSON.stringify(batch);
    for (const value of sensitive) assert.ok(!serialized.includes(value));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Pages App Health telemetry is disabled without a key and ignores unknown routes", async () => {
  const originalFetch = globalThis.fetch;
  let ingestCount = 0;
  globalThis.fetch = async () => {
    ingestCount += 1;
    return new Response(null, { status: 202 });
  };
  try {
    const pending = [];
    const request = new Request("https://papers.example/api/rag/query?query=private", {
      method: "POST",
      body: JSON.stringify({ question: "private question" }),
    });
    const response = new Response("same response", { status: 201 });
    const noKey = await pagesMiddleware({
      request,
      env: {},
      params: {},
      data: {},
      next: async () => response,
      waitUntil: (delivery) => pending.push(delivery),
    });
    assert.equal(noKey, response);
    assert.equal(pending.length, 0);

    const unknown = await pagesMiddleware({
      request: new Request("https://papers.example/api/papers/private-id"),
      env: { APP_HEALTH_INGEST_KEY: "test-only-ingest-key" },
      params: {},
      data: {},
      next: async () => new Response(null, { status: 404 }),
      waitUntil: (delivery) => pending.push(delivery),
    });
    assert.equal(unknown.status, 404);
    assert.equal(pending.length, 0);
    assert.equal(ingestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
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
