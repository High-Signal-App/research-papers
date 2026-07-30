export function markdownResponse(value: string) {
  return new Response(`${value.trimEnd()}\n`, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
