import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/utils";

type Row = {
  id: number;
  size: number;
  labels: string[];
  anchor_arxiv_id: string;
  anchor_title: string;
};

export function AbstractClustersTable({ data }: { data: Row[] }) {
  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
    },
    {
      accessorKey: "size",
      header: "size",
      cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span>,
    },
    {
      accessorKey: "labels",
      header: "labels",
      enableSorting: false,
      cell: ({ getValue }) => (
        <div className="flex flex-wrap gap-1">
          {(getValue<string[]>() ?? []).slice(0, 6).map((l, i) => (
            <Badge key={i} variant="secondary" className="font-mono text-[10px]">{l}</Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "anchor_title",
      header: "anchor paper",
      cell: ({ row }) => (
        <a href={`https://arxiv.org/abs/${row.original.anchor_arxiv_id}`} target="_blank" rel="noopener" className="text-sm hover:text-primary">
          {row.original.anchor_title}
        </a>
      ),
    },
  ], []);

  return <DataTable columns={columns} data={data} searchPlaceholder="Filter clusters..." initialSort={[{ id: "size", desc: true }]} />;
}
