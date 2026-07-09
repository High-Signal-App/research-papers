import { Download, ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ReadingPath, ReadingPathDifficulty } from "@/data/reading-paths";

type Props = {
  paths: ReadingPath[];
  tracks: string[];
  difficulties: ReadingPathDifficulty[];
};

type ExportFormat = "json" | "bibtex" | "ris" | "markdown";

const difficultyLabels: Record<ReadingPathDifficulty, string> = {
  starter: "Starter",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function titleCase(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("")
    .toLowerCase();
}

function bibEscape(value: unknown) {
  return String(value ?? "").replace(/[{}]/g, "");
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toBibtex(path: ReadingPath) {
  return path.papers
    .map((paper) => {
      const firstAuthor = paper.authors[0]?.split(/\s+/).at(-1) || "paper";
      const key = `${cleanKey(firstAuthor)}${paper.year}${cleanKey(paper.title)}`;
      const fields = [
        ["title", paper.title],
        ["author", paper.authors.join(" and ")],
        ["year", paper.year],
        ["journal", paper.venue],
        ["url", paper.url],
        ["doi", paper.doi],
        ["eprint", paper.arxivId],
        ["note", `${path.title}: ${paper.relation}`],
      ].filter(([, value]) => value != null && value !== "");

      return `@article{${key},\n${fields
        .map(([name, value]) => `  ${name} = {${bibEscape(value)}},`)
        .join("\n")}\n}`;
    })
    .join("\n\n");
}

function toRis(path: ReadingPath) {
  return path.papers
    .map((paper) => {
      const rows = [
        "TY  - JOUR",
        `TI  - ${paper.title}`,
        ...paper.authors.map((author) => `AU  - ${author}`),
        `PY  - ${paper.year}`,
        `T2  - ${paper.venue}`,
        `UR  - ${paper.url}`,
        paper.doi ? `DO  - ${paper.doi}` : "",
        paper.arxivId ? `N1  - arXiv:${paper.arxivId}` : "",
        `N1  - ${path.title}: ${paper.relation}. ${paper.focus}`,
        "ER  -",
      ].filter(Boolean);
      return rows.join("\n");
    })
    .join("\n\n");
}

function toMarkdown(path: ReadingPath) {
  const papers = path.papers
    .map((paper, index) => {
      return [
        `## ${index + 1}. ${paper.title}`,
        "",
        `- Authors: ${paper.authors.join(", ")}`,
        `- Year: ${paper.year}`,
        `- Venue/source: ${paper.venue}`,
        `- URL: ${paper.url}`,
        `- Role: ${paper.relation}`,
        `- Why it is here: ${paper.brief}`,
        `- Read for: ${paper.focus}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    `# ${path.title}`,
    "",
    path.subtitle,
    "",
    `Audience: ${path.audience}`,
    `Difficulty: ${difficultyLabels[path.difficulty]}`,
    `Estimate: ${path.estimate}`,
    `Outcome: ${path.outcome}`,
    "",
    `Provenance: ${path.sourceNote}`,
    `Trust note: ${path.trustNote}`,
    "Copyright note: metadata, links, and original notes only; no copied abstracts, full text, or long excerpts.",
    ...(path.sourceUrls?.length
      ? ["", "Source references:", ...path.sourceUrls.map((source) => `- ${source.label}: ${source.url}`)]
      : []),
    "",
    papers,
  ].join("\n");
}

function exportPath(path: ReadingPath, format: ExportFormat) {
  if (format === "bibtex") {
    downloadText(`${path.id}.bib`, toBibtex(path), "application/x-bibtex;charset=utf-8");
    return;
  }
  if (format === "ris") {
    downloadText(`${path.id}.ris`, toRis(path), "application/x-research-info-systems;charset=utf-8");
    return;
  }
  if (format === "markdown") {
    downloadText(`${path.id}.md`, toMarkdown(path), "text/markdown;charset=utf-8");
    return;
  }
  downloadText(`${path.id}.json`, JSON.stringify(path, null, 2), "application/json;charset=utf-8");
}

function pathMatches(path: ReadingPath, query: string, track: string, difficulty: string) {
  if (track !== "all" && !path.tracks.includes(track)) return false;
  if (difficulty !== "all" && path.difficulty !== difficulty) return false;
  if (!query) return true;

  const haystack = [
    path.title,
    path.subtitle,
    path.audience,
    path.outcome,
    ...path.tags,
    ...path.tracks,
    ...path.papers.flatMap((paper) => [paper.title, paper.relation, paper.brief, ...paper.authors]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function ReadingPathCatalog({ paths, tracks, difficulties }: Props) {
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [selectedPathId, setSelectedPathId] = useState(paths[0]?.id ?? "");

  const normalizedQuery = normalize(query);
  const visiblePaths = useMemo(
    () => paths.filter((path) => pathMatches(path, normalizedQuery, track, difficulty)),
    [difficulty, normalizedQuery, paths, track],
  );

  const totalPapers = paths.reduce((total, path) => total + path.papers.length, 0);
  const visiblePapers = visiblePaths.reduce((total, path) => total + path.papers.length, 0);
  const hasFilters = query || track !== "all" || difficulty !== "all";
  const selectedPath = visiblePaths.find((path) => path.id === selectedPathId) ?? visiblePaths[0];
  const selectedPathIndex = selectedPath ? visiblePaths.findIndex((path) => path.id === selectedPath.id) : -1;

  useEffect(() => {
    const hashPathId = window.location.hash.replace(/^#/, "");
    if (hashPathId && paths.some((path) => path.id === hashPathId)) {
      setSelectedPathId(hashPathId);
    }
  }, [paths]);

  useEffect(() => {
    if (!visiblePaths.length) {
      setSelectedPathId("");
      return;
    }
    if (!visiblePaths.some((path) => path.id === selectedPathId)) {
      setSelectedPathId(visiblePaths[0].id);
    }
  }, [selectedPathId, visiblePaths]);

  function selectPath(path: ReadingPath) {
    setSelectedPathId(path.id);
    window.history.replaceState(null, "", `#${path.id}`);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm text-foreground outline-none ring-primary/40 placeholder:text-muted-foreground focus:ring-2"
                placeholder="Search paths, tags, papers, authors"
              />
            </label>
            <select
              value={track}
              onChange={(event) => setTrack(event.target.value)}
              className="h-11 rounded-md border bg-background px-3 text-sm text-foreground outline-none ring-primary/40 focus:ring-2"
              aria-label="Track"
            >
              <option value="all">All tracks</option>
              {tracks.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              className="h-11 rounded-md border bg-background px-3 text-sm text-foreground outline-none ring-primary/40 focus:ring-2"
              aria-label="Difficulty"
            >
              <option value="all">All levels</option>
              {difficulties.map((item) => (
                <option key={item} value={item}>
                  {difficultyLabels[item]}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setTrack("all");
                  setDifficulty("all");
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted/60"
              >
                <X className="h-4 w-4" />
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-2xl font-bold tabular-nums text-primary">{visiblePaths.length}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">paths</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-2xl font-bold tabular-nums text-emerald-400">{visiblePapers}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">papers</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-2xl font-bold tabular-nums text-amber-300">{totalPapers}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">catalog</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visiblePaths.map((path) => (
          <button
            key={path.id}
            type="button"
            onClick={() => selectPath(path)}
            className={[
              "rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40",
              selectedPath?.id === path.id ? "border-primary/60 bg-accent/45" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{path.status}</span>
              <span className="rounded-md bg-primary/15 px-2 py-1 text-xs text-primary">{difficultyLabels[path.difficulty]}</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">{path.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{path.subtitle}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{path.papers.length} readings</span>
              <span>{path.estimate}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {path.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-md border border-border/70 bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </section>

      {visiblePaths.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No reading paths match the current filters.
        </div>
      )}

      {selectedPath && (
        <section id={selectedPath.id} className="scroll-mt-24 border-t pt-8">
          <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
            <aside className="lg:sticky lg:top-32 lg:self-start">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Path {selectedPathIndex + 1} of {visiblePaths.length}
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">{selectedPath.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{selectedPath.subtitle}</p>
              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Audience</dt>
                  <dd className="mt-1 text-foreground/85">{selectedPath.audience}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Outcome</dt>
                  <dd className="mt-1 text-foreground/85">{selectedPath.outcome}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Estimate</dt>
                  <dd className="mt-1 text-foreground/85">{selectedPath.estimate}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Provenance</dt>
                  <dd className="mt-1 text-foreground/85">{selectedPath.sourceNote}</dd>
                </div>
                {selectedPath.sourceUrls?.length ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Source refs</dt>
                    <dd className="mt-1 space-y-1">
                      {selectedPath.sourceUrls.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener"
                          className="block text-foreground/85 hover:text-primary"
                        >
                          {source.label}
                        </a>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {(["json", "bibtex", "ris", "markdown"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => exportPath(selectedPath, format)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-2 text-xs font-semibold text-foreground hover:bg-muted/60"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-amber-200/90">{selectedPath.trustNote}</p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Copyright-safe: metadata, links, and original notes only. No abstracts, PDFs, or long excerpts are redistributed.
              </p>
            </aside>

            <div className="space-y-3">
              {selectedPath.papers.map((paper, index) => (
                <details key={paper.id} className="group rounded-lg border bg-card p-4">
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-primary tabular-nums">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-emerald-300">
                            {paper.relation}
                          </span>
                          <span className="text-muted-foreground">
                            {paper.year} · {paper.venue}
                          </span>
                        </div>
                        <h3 className="mt-3 text-base font-semibold leading-6 tracking-tight group-open:text-primary">
                          {paper.title}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">{paper.authors.join(", ")}</p>
                      </div>
                      <span className="shrink-0 rounded-md border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground group-open:text-foreground">
                        Details
                      </span>
                    </div>
                  </summary>
                  <div className="mt-4 border-t pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Why it is here</div>
                        <p className="mt-2 text-sm leading-6 text-foreground/85">{paper.brief}</p>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Read for</div>
                        <p className="mt-2 text-sm leading-6 text-foreground/85">{paper.focus}</p>
                      </div>
                    </div>
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener"
                      className="mt-4 inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted/60"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Source
                    </a>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
