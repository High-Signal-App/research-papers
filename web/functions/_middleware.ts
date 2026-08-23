/**
 * Middleware: post-process responses for agent-friendliness.
 *
 * - 404 responses with Accept: text/markdown get a markdown body.
 * - 404 responses on /api/* paths get a JSON error body (backup for the
 *   catch-all function, which handles paths that don't match a static file).
 */

interface PagesContext {
  request: Request;
  env: Record<string, unknown>;
  next: () => Promise<Response>;
}

function wantsMarkdown(request: Request): boolean {
  const accept = (request.headers.get("accept") || "").toLowerCase();
  if (!accept.includes("text/markdown")) return false;
  if (!accept.includes("text/html")) return true;
  return accept.indexOf("text/markdown") < accept.indexOf("text/html");
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const response = await context.next();
  const url = new URL(context.request.url);

  if (response.status !== 404) return response;

  // JSON error for /api/* 404s
  if (url.pathname.startsWith("/api/")) {
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

  // Agent-friendly 404 with markdown body
  if (wantsMarkdown(context.request)) {
    return new Response(
      `# Not found\n\nThe page at \`${url.pathname}\` does not exist on researchPapers.\n\n## Available surfaces\n\n- [Agent catalog](${url.origin}/api/ai)\n- [LLM index](${url.origin}/llms.txt)\n- [OpenAPI spec](${url.origin}/openapi.json)\n- [Home](${url.origin}/)\n`,
      {
        status: 404,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          Vary: "Accept",
        },
      },
    );
  }

  return response;
}
