import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/utils";

type Row = {
  venue: string;
  n_reviews: number;
  n_papers: number;
  avg_rating: number;
  avg_confidence: number;
  oral_accepts: number;
  poster_accepts: number;
  rejects: number;
};

export function ReviewVenuesTable({ data }: { data: Row[] }) {
  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      accessorKey: "venue",
      header: "venue",
      cell: ({ getValue }) => <Badge variant="secondary" className="font-mono">{getValue<string>()}</Badge>,
    },
    {
      accessorKey: "n_papers",
      header: "papers",
      cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span>,
    },
    {
      accessorKey: "n_reviews",
      header: "reviews",
      cell: ({ getValue }) => <span className="tabular-nums text-primary">{fmt.format(getValue<number>())}</span>,
    },
    {
      accessorKey: "avg_rating",
      header: "avg rating",
      cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "avg_confidence",
      header: "avg confidence",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue<number>().toFixed(2)}</span>,
    },
    {
      accessorKey: "oral_accepts",
      header: "oral",
      cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span>,
    },
    {
      accessorKey: "poster_accepts",
      header: "poster",
      cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span>,
    },
    {
      accessorKey: "rejects",
      header: "rejects",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{fmt.format(getValue<number>())}</span>,
    },
  ], []);

  return <DataTable columns={columns} data={data} initialSort={[{ id: "n_reviews", desc: true }]} pageSize={10} />;
}
