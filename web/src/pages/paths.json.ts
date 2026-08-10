import type { APIRoute } from "astro";

import { readingPaths } from "../data/reading-paths";

export const prerender = true;

export const GET: APIRoute = () => {
  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      items: readingPaths,
      total: readingPaths.length,
    },
    {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
};
