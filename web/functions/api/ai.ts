interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS?: AssetFetcher;
}

type PagesContext = {
  env: Env;
  request: Request;
};

/**
 * Agent catalog at the fleet-standard `/api/ai` address.
 *
 * The catalog itself is the generated static asset `/api-ai.json`; this route
 * only re-serves it. It exists because Pages Functions are matched before
 * `_redirects`, so the `/api/ai -> /api-ai.json` rule in `public/_redirects`
 * never ran — `functions/api/[[catchall]].ts` claimed the path first and
 * answered a JSON 404. A named route outranks the catch-all and restores the
 * documented address without duplicating the catalog.
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  if (!context.env.ASSETS) {
    return Response.json(
      {
        error: "unavailable",
        message: "Agent catalog is served from static assets, which are not bound.",
        path: "/api/ai",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const catalogUrl = new URL("/api-ai.json", context.request.url);
  const response = await context.env.ASSETS.fetch(
    new Request(catalogUrl, { method: "GET", headers: { Accept: "application/json" } }),
  );

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, { status: response.status, headers });
}
