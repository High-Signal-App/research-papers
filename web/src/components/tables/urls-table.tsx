import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { fmt } from "@/lib/utils";

type Row = { url_canonical: string; host: string; papers: number };

export function UrlsTable({ data }: { data: Row[] }) {
  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
    },
    {
      accessorKey: "url_canonical",
      header: "URL",
      cell: ({ row }) => (
        <a href={row.original.url_canonical} target="_blank" rel="noopener"
           className="font-mono text-xs hover:text-primary break-all line-clamp-2">
          {row.original.url_canonical}
        </a>
      ),
    },
    {
      accessorKey: "host",
      header: "host",
      cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue<string>()}</span>,
    },
    {
      accessorKey: "papers",
      header: "papers",
      cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span>,
    },
  ], []);

  return <DataTable columns={columns} data={data} searchPlaceholder="Filter URLs..." initialSort={[{ id: "papers", desc: true }]} />;
}
