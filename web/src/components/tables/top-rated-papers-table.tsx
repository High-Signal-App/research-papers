import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

type Row = {
  paper_id: string;
  title: string;
  venue: string;
  avg_rating: number;
  avg_confidence: number;
  n_reviews: number;
  decision: string | null;
};

const decisionLabel = (d: string | null) => {
  if (!d) return null;
  const lc = d.toLowerCase();
  if (lc.includes("oral")) return "Accepted oral";
  if (lc.includes("poster")) return "Accepted poster";
  if (lc.includes("accept")) return "Accepted";
  if (lc.includes("reject")) return "Rejected";
  return d;
};

const decisionBadge = (d: string | null) => {
  const label = decisionLabel(d);
  if (!label || !d) return null;
  const lc = d.toLowerCase();
  if (lc.includes("oral")) return <Badge variant="default" className="whitespace-nowrap">{label}</Badge>;
  if (lc.includes("accept")) return <Badge variant="secondary" className="whitespace-nowrap">{label}</Badge>;
  if (lc.includes("reject")) return <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">{label}</Badge>;
  return <Badge variant="outline" className="whitespace-nowrap">{label}</Badge>;
};

export function TopRatedPapersTable({ data }: { data: Row[] }) {
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
            {row.original.title || row.original.paper_id}
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
      cell: ({ getValue }) => <span className="tabular-nums text-primary font-semibold">{getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "avg_confidence",
      header: "confidence",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "n_reviews",
      header: "n reviews",
      cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span>,
    },
    {
      accessorKey: "decision",
      header: "venue outcome",
      cell: ({ getValue }) => decisionBadge(getValue<string | null>()),
    },
  ], []);

  return <DataTable columns={columns} data={data} searchPlaceholder="Filter titles..." initialSort={[{ id: "avg_rating", desc: true }]} pageSize={20} />;
}
