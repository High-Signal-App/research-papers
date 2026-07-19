import assert from "node:assert/strict";
import test from "node:test";

import { onRequestGet } from "../web/functions/api/health.ts";

const request = new Request("https://papers.example/api/health");

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
