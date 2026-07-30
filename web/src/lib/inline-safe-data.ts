/**
 * Keeps source text intact while preventing user-controlled strings in Astro
 * island props from resembling unrendered JavaScript template placeholders.
 */
export function makeInlineSafe<T>(value: T): T {
  if (typeof value === "string") {
    return value.replaceAll("${", "$\u200B{") as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => makeInlineSafe(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, makeInlineSafe(item)]),
    ) as T;
  }

  return value;
}
