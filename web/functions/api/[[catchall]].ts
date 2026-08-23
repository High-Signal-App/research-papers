/**
 * Catch-all for unknown /api/* paths.
 * Returns a JSON 404 instead of the default HTML 404 page.
 */
export function onRequest(context: { request: Request }) {
  const url = new URL(context.request.url);
  return Response.json(
    {
      error: "not_found",
      message: `No API endpoint exists at ${url.pathname}.`,
      path: url.pathname,
      docs: `${url.origin}/api/ai`,
    },
    {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
