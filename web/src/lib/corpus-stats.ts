import chSources from "../../public/data/ch_sources_summary.json";

/**
 * Canonical corpus size, summed at build time from the ClickHouse per-source
 * summary export. Every page that shows the operator-corpus count must import
 * this instead of hardcoding a number.
 */
export const totalPapers: number = (chSources as Array<{ n?: number | string }>).reduce(
  (sum, row) => sum + Number(row.n || 0),
  0,
);

export const totalPapersLabel = new Intl.NumberFormat("en-US").format(totalPapers);

/** Compact form for titles/meta, e.g. "511k". */
export const totalPapersShort = `${Math.floor(totalPapers / 1000)}k`;
