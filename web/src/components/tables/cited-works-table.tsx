import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { fmt } from "@/lib/utils";
import { useJsonData } from "@/lib/use-json-data";

type Row = {
  title: string;
  publication_year: number | null;
  in_corpus_citations: number;
  global_citations: number | null;
  arxiv_id: string | null;
  doi: string | null;
  primary_topic: string | null;
};

export function CitedWorksTable({ data, src }: { data?: Row[]; src?: string }) {
  const rows = useJsonData(data, src);
  const columns: ColumnDef<Row>[] = React.useMemo(
    () => [
      {
        id: "rank",
        header: "#",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>
        ),
      },
      {
        accessorKey: "title",
        header: "title",
        cell: ({ row }) => {
          const r = row.original;
          const href = r.arxiv_id ? `https://arxiv.org/abs/${r.arxiv_id}` : (r.doi ?? null);
          return href ? (
            <a href={href} target="_blank" rel="noopener" className="hover:text-primary">
              {r.title}
            </a>
          ) : (
            r.title
          );
        },
      },
      {
        accessorKey: "publication_year",
        header: "year",
        cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>() ?? ""}</span>,
      },
      {
        accessorKey: "in_corpus_citations",
        header: "in corpus",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-primary">{fmt.format(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: "global_citations",
        header: "global",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {getValue<number>() != null ? fmt.format(getValue<number>()) : ""}
          </span>
        ),
      },
      {
        accessorKey: "primary_topic",
        header: "topic",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue<string>() ?? ""}</span>
        ),
      },
    ],
    [],
  );

  if (rows.loading)
    return <p className="text-sm text-muted-foreground">Loading cited foundations...</p>;
  if (rows.error)
    return (
      <p className="text-sm text-destructive">Cited foundations are unavailable: {rows.error}</p>
    );

  return (
    <DataTable
      columns={columns}
      data={rows.data}
      searchPlaceholder="Filter cited works..."
      initialSort={[{ id: "in_corpus_citations", desc: true }]}
      pageSize={20}
    />
  );
}
