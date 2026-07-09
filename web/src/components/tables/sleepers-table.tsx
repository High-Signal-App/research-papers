import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

type Row = {
  paper_id: string;
  title: string;
  avg_rating: number;
  n_reviews: number;
  venue: string;
  decision: string | null;
  submitted_date: string | null;
};

function decisionLabel(value: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("oral")) return "Accepted oral";
  if (normalized.includes("poster")) return "Accepted poster";
  if (normalized.includes("accept")) return "Accepted";
  if (normalized.includes("reject")) return "Rejected";
  return value;
}

export function SleepersTable({ data }: { data: Row[] }) {
  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
    },
    {
      accessorKey: "title",
      header: "paper",
      cell: ({ row }) => {
        const oid = row.original.paper_id.replace(/^openreview:/, "");
        return (
          <a
            href={`https://openreview.net/forum?id=${oid}`}
            target="_blank"
            rel="noopener"
            className="text-sm hover:text-primary"
          >
            {row.original.title}
          </a>
        );
      },
    },
    {
      accessorKey: "venue",
      header: "venue",
      cell: ({ getValue }) => <Badge variant="outline" className="font-mono text-[11px]">{getValue<string>()}</Badge>,
    },
    {
      accessorKey: "avg_rating",
      header: "rating",
      cell: ({ getValue }) => <span className="tabular-nums text-emerald-500 font-semibold">{getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "n_reviews",
      header: "n reviews",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue<number>()}</span>,
    },
    {
      accessorKey: "decision",
      header: "venue outcome",
      cell: ({ getValue }) => {
        const d = getValue<string | null>();
        const label = decisionLabel(d);
        if (!label) return null;
        const lc = d.toLowerCase();
        if (lc.includes("oral")) return <Badge variant="default" className="whitespace-nowrap">{label}</Badge>;
        if (lc.includes("accept")) return <Badge variant="secondary" className="whitespace-nowrap">{label}</Badge>;
        return <Badge variant="outline" className="whitespace-nowrap">{label}</Badge>;
      },
    },
  ], []);

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Filter titles..."
      initialSort={[{ id: "avg_rating", desc: true }]}
      pageSize={20}
    />
  );
}
