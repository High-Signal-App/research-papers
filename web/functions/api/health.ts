interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS?: AssetFetcher;
  CF_PAGES_COMMIT_SHA?: string;
  CF_PAGES_BRANCH?: string;
  PAPERS_REVISION?: string;
  RAG_SERVICE_KEY?: string;
  RAG_SERVICE_URL?: string;
  RAG_DOMAIN?: string;
}

type PagesContext = {
  env: Env;
  request: Request;
};

type AssetEvidence = {
  path: string;
  available: boolean;
  status: number | null;
  error: string | null;
};

const REQUIRED_SEARCH_ASSETS = [
  "/data/top_papers.json",
  "/data/hot.json",
  "/data/sleepers.json",
  "/data/review_top_papers.json",
] as const;
const ASSET_CHECK_TIMEOUT_MS = 1500;

async function checkAsset(context: PagesContext, path: string): Promise<AssetEvidence> {
  if (!context.env.ASSETS) {
    return { path, available: false, status: null, error: "ASSETS binding unavailable" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSET_CHECK_TIMEOUT_MS);
  try {
    const assetUrl = new URL(path, context.request.url);
    const response = await context.env.ASSETS.fetch(
      new Request(assetUrl, {
        method: "GET",
        headers: { Range: "bytes=0-0", Accept: "application/json" },
        signal: controller.signal,
      })
    );
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    const contentRange = response.headers.get("content-range") ?? "";
    const rangeTotal = Number(contentRange.match(/\/(\d+)$/)?.[1] ?? "0");
    const available =
      (response.status === 206 && rangeTotal > 0) ||
      (response.ok && Number.isFinite(contentLength) && contentLength > 0);
    return {
      path,
      available,
      status: response.status,
      error: available ? null : "asset response was missing or empty",
    };
  } catch (error) {
    console.error(`Research Papers asset health check failed for ${path}`, error);
    return {
      path,
      available: false,
      status: null,
      error: "asset check failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Public health endpoint for the Cloudflare Pages surface.
 *
 * Uses the Pages environment for revision/config evidence and performs a
 * bounded byte-range fetch for each static JSON asset required by search.
 * Missing search data is a 503 even when the landing page itself is live.
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const t0 = Date.now();
  const url = new URL(context.request.url);
  const assetEvidence = await Promise.all(
    REQUIRED_SEARCH_ASSETS.map((path) => checkAsset(context, path))
  );
  const missingAssets = assetEvidence.filter((asset) => !asset.available);
  const searchBundlePresent = missingAssets.length === 0;
  const revision =
    context.env.CF_PAGES_COMMIT_SHA ?? context.env.PAPERS_REVISION ?? "unknown";
  const ragConfigured = Boolean(context.env.RAG_SERVICE_KEY);

  return Response.json(
    {
      ok: searchBundlePresent,
      build: {
        name: "researchPapers Pages",
        revision,
        branch: context.env.CF_PAGES_BRANCH ?? "unknown",
      },
      live: true,
      revision,
      errors: {
        rag_configured: ragConfigured
          ? null
          : "RAG_SERVICE_KEY not set; /api/rag/query falls back to bundled-data answers",
        search_bundle: searchBundlePresent
          ? null
          : `required search assets unavailable: ${missingAssets.map((asset) => asset.path).join(", ")}`,
      },
      latency_ms: Date.now() - t0,
      indexing: {
        search_bundle_present: searchBundlePresent,
        required_search_assets: assetEvidence,
        rag_configured: ragConfigured,
        rag_domain: context.env.RAG_DOMAIN ?? "research-papers-cs-cited1000-all",
      },
      surfaces: {
        landing: "ok",
        search: searchBundlePresent ? "ok" : "unavailable",
        rag: ragConfigured ? "ok" : "fallback",
      },
      operator_health: "GET /healthz on the operator FastAPI (http://127.0.0.1:8000)",
      _self: url.pathname,
    },
    {
      status: searchBundlePresent ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
