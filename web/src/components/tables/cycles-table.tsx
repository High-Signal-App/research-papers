import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, RotateCw } from "lucide-react";

import { DataTable } from "@/components/data-table";

type Row = { length: number; arxiv_ids: string[] };

export function CyclesTable({ data }: { data: Row[] }) {
  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
    },
    { accessorKey: "length", header: "length", cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    {
      accessorKey: "arxiv_ids",
      header: "cycle",
      enableSorting: false,
      cell: ({ getValue }) => {
        const ids = getValue<string[]>() ?? [];
        return (
          <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
            {ids.map((id, i) => (
              <React.Fragment key={i}>
                <a href={`https://arxiv.org/abs/${id}`} target="_blank" rel="noopener" className="text-primary hover:underline">{id}</a>
                {i < ids.length - 1 ? <ArrowRight className="h-3 w-3 opacity-50" /> : <RotateCw className="h-3 w-3 opacity-50" />}
              </React.Fragment>
            ))}
          </div>
        );
      },
    },
  ], []);

  return <DataTable columns={columns} data={data} searchPlaceholder="Filter cycles by arxiv id..." initialSort={[{ id: "length", desc: false }]} pageSize={20} />;
}
