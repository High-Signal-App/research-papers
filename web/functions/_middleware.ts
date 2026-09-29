import { type AppHealthClient, createAppHealthClient } from "@saas-maker/app-health";
import { type PagesFunctionContext, withPagesFunctionHealth } from "@saas-maker/app-health/pages";

/**
 * Middleware: post-process responses for agent-friendliness.
 *
 * - 404 responses with Accept: text/markdown get a markdown body.
 * - 404 responses on /api/* paths get a JSON error body (backup for the
 *   catch-all function, which handles paths that don't match a static file).
 */

interface PagesEnv extends Record<string, unknown> {
  APP_HEALTH_INGEST_KEY?: string;
  APP_HEALTH_ENVIRONMENT?: string;
}

interface PagesContext extends PagesFunctionContext<PagesEnv> {
  request: Request;
  env: PagesEnv;
  next: () => Promise<Response>;
}

const TELEMETRY_ROUTES = new Map<string, string>([
  ["GET /api/health", "/api/health"],
  ["GET /api/rag/status", "/api/rag/status"],
  ["POST /api/rag/query", "/api/rag/query"],
  ["GET /api/ai", "/api/ai"],
  ["HEAD /api/ai", "/api/ai"],
]);

function telemetryRoute(request: Request): string | null {
  const pathname = new URL(request.url).pathname;
  return TELEMETRY_ROUTES.get(`${request.method} ${pathname}`) ?? null;
}

function telemetryClient(env: PagesEnv): AppHealthClient | null {
  const key = env.APP_HEALTH_INGEST_KEY;
  if (typeof key !== "string" || key.length === 0) return null;
  return createAppHealthClient({
    key,
    ...(typeof env.APP_HEALTH_ENVIRONMENT === "string"
      ? { environment: env.APP_HEALTH_ENVIRONMENT }
      : {}),
    endpoint: "https://ingest.sassmaker.com/v1/ingest",
    runtime: "worker",
    disableTimer: true,
    requestTimeoutMs: 1_500,
    maxRetries: 0,
  });
}

function wantsMarkdown(request: Request): boolean {
  const accept = (request.headers.get("accept") || "").toLowerCase();
  if (!accept.includes("text/markdown")) return false;
  if (!accept.includes("text/html")) return true;
  return accept.indexOf("text/markdown") < accept.indexOf("text/html");
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const route = telemetryRoute(context.request);
  let response: Response;
  if (route) {
    const instrumented = withPagesFunctionHealth<
      PagesEnv,
      string,
      Record<string, unknown>,
      Response
    >(
      {
        route,
        client: (pagesContext) => telemetryClient(pagesContext.env),
      },
      () => context.next(),
    );
    response = await instrumented(context);
  } else {
    response = await context.next();
  }
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
