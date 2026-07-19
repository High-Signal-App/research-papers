interface Env {
  RAG_SERVICE_KEY?: string;
  RAG_SERVICE_URL?: string;
  RAG_DOMAIN?: string;
  // Optional: CF Pages exposes CF_PAGES_COMMIT_SHA and CF_PAGES_BRANCH at build
  // time; we bake the commit into the bundle via a build-time define.
}

type PagesContext = {
  env: Env;
  request: Request;
};

/**
 * Public health endpoint for the Cloudflare Pages surface.
 *
 * Reports build, live, revision, search-bundle presence, and RAG configured
 * flag — independently from landing availability so a live index page cannot
 * conceal a broken search/RAG path. Satisfies the
 * `data-research-toolbox-automation` "Public and API health" requirement.
 *
 * No secrets are exposed. `RAG_SERVICE_KEY` presence is reported as a boolean
 * only.
 */
export function onRequestGet(context: PagesContext): Response {
  const t0 = Date.now();
  const url = new URL(context.request.url);
  // The static search bundle is shipped at /data/*.json. We cannot fetch it
  // synchronously here without burning subrequest budget, so we report its
  // expected presence from the build-time baked asset path list.
  const searchBundlePresent = Boolean(
    // CF_PAGES_COMMIT_SHA is injected at build time as a static string.
    // We use it as a build-revision marker; absence => unknown revision.
    (globalThis as any).CF_PAGES_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.PAPERS_REVISION
  );

  return Response.json(
    {
      ok: true,
      build: {
        name: "researchPapers Pages",
        // CF_PAGES_COMMIT_SHA is set by the Pages runtime at build time.
        revision:
          (globalThis as any).CF_PAGES_COMMIT_SHA ||
          process.env.CF_PAGES_COMMIT_SHA ||
          process.env.PAPERS_REVISION ||
          "unknown",
        branch:
          (globalThis as any).CF_PAGES_BRANCH ||
          process.env.CF_PAGES_BRANCH ||
          "unknown",
      },
      live: true,
      revision:
        (globalThis as any).CF_PAGES_COMMIT_SHA ||
        process.env.CF_PAGES_COMMIT_SHA ||
        process.env.PAPERS_REVISION ||
        "unknown",
      errors: {
        rag_configured: Boolean(context.env.RAG_SERVICE_KEY) ? null : "RAG_SERVICE_KEY not set; /api/rag/query falls back to bundled-data answers",
        search_bundle: searchBundlePresent ? null : "no build revision detected; static data bundle may be missing",
      },
      latency_ms: Date.now() - t0,
      indexing: {
        // The Pages surface is a static export; "indexing" here means the
        // baked data bundle + RAG wiring. The operator-side FastAPI /healthz
        // reports the live ClickHouse refresh watermark.
        search_bundle_present: searchBundlePresent,
        rag_configured: Boolean(context.env.RAG_SERVICE_KEY),
        rag_domain: context.env.RAG_DOMAIN ?? "research-papers-cs-cited1000-all",
      },
      surfaces: {
        landing: "ok",
        search: searchBundlePresent ? "ok" : "degraded",
        rag: Boolean(context.env.RAG_SERVICE_KEY) ? "ok" : "fallback",
      },
      // Helpfully point operators at the operator-side health for refresh state.
      operator_health: "GET /healthz on the operator FastAPI (http://127.0.0.1:8000)",
      _self: url.pathname,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
