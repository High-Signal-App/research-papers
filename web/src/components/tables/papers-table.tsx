import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/utils";

type Row = {
  arxiv_id: string;
  title: string;
  citation_count: number | null;
  in_corpus_degree: number | null;
  pagerank_score: number | null;
  katz_score: number | null;
  n_urls: number;
  topic_tags?: string[];
  top_keywords?: string[];
};

export function PapersTable({ data }: { data: Row[] }) {
  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
    },
    {
      accessorKey: "arxiv_id",
      header: "arxiv id",
      cell: ({ getValue }) => (
        <a href={`https://arxiv.org/abs/${getValue<string>()}`} target="_blank" rel="noopener"
           className="font-mono text-xs text-primary hover:underline">
          {getValue<string>()}
        </a>
      ),
    },
    {
      accessorKey: "title",
      header: "title",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="text-sm">{row.original.title}</div>
          {(row.original.topic_tags ?? []).slice(0, 3).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.original.topic_tags!.slice(0, 3).map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "citation_count",
      header: "global",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue<number>() != null ? fmt.format(getValue<number>()) : ""}</span>,
    },
    {
      accessorKey: "in_corpus_degree",
      header: "in-corpus",
      cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>() != null ? fmt.format(getValue<number>()) : ""}</span>,
    },
    {
      accessorKey: "pagerank_score",
      header: "PageRank",
      cell: ({ getValue }) => <span className="tabular-nums text-primary">{getValue<number>() != null ? getValue<number>().toFixed(6) : ""}</span>,
    },
    {
      accessorKey: "katz_score",
      header: "Katz",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue<number>() != null ? getValue<number>().toFixed(4) : ""}</span>,
    },
    {
      accessorKey: "n_urls",
      header: "URLs",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{fmt.format(getValue<number>())}</span>,
    },
  ], []);

  return <DataTable columns={columns} data={data} searchPlaceholder="Filter papers..." initialSort={[{ id: "pagerank_score", desc: true }]} pageSize={20} />;
}
