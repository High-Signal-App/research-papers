import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/utils";

type Row = {
  paper_id: string;
  source: string;
  title: string;
  citation_count: number;
  submitted_date: string | null;
  cites_per_year: number;
  avg_rating: number | null;
  pagerank: number;
  hotness: number;
};

function paperUrl(paper_id: string): string {
  if (paper_id.startsWith("arxiv:")) {
    return `https://arxiv.org/abs/${paper_id.replace("arxiv:", "")}`;
  }
  if (paper_id.startsWith("openreview:")) {
    return `https://openreview.net/forum?id=${paper_id.replace("openreview:", "")}`;
  }
  return "#";
}

export function HotTable({ data }: { data: Row[] }) {
  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
    },
    {
      accessorKey: "hotness",
      header: "hotness",
      cell: ({ getValue }) => <span className="tabular-nums font-semibold text-orange-400">{getValue<number>().toFixed(3)}</span>,
    },
    {
      accessorKey: "title",
      header: "paper",
      cell: ({ row }) => (
        <a
          href={paperUrl(row.original.paper_id)}
          target="_blank"
          rel="noopener"
          className="text-sm hover:text-primary"
        >
          {row.original.title}
        </a>
      ),
    },
    {
      accessorKey: "source",
      header: "source",
      cell: ({ getValue }) => <Badge variant="outline" className="font-mono text-[10px]">{getValue<string>()}</Badge>,
    },
    {
      accessorKey: "cites_per_year",
      header: "cites/yr",
      cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(Math.round(getValue<number>()))}</span>,
    },
    {
      accessorKey: "citation_count",
      header: "total cites",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{fmt.format(getValue<number>())}</span>,
    },
    {
      accessorKey: "avg_rating",
      header: "rating",
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return v ? <span className="tabular-nums text-emerald-500">{v.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: "submitted_date",
      header: "year",
      cell: ({ getValue }) => {
        const d = getValue<string | null>();
        return d ? <span className="tabular-nums text-muted-foreground">{d.slice(0, 4)}</span> : null;
      },
    },
  ], []);

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Filter titles..."
      initialSort={[{ id: "hotness", desc: true }]}
      pageSize={20}
    />
  );
}
