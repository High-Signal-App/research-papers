import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fmt } from "@/lib/utils";

type Sample = {
  avg_rating: number;
  title: string;
  paper_id: string;
  venue: string;
};

type Row = {
  tag: string;
  mean_rating: number;
  n_papers: number;
  p90_rating: number;
  samples: Sample[];
};

function TagDrilldown({ row }: { row: Row }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="font-mono text-left hover:text-primary">
          <Badge variant="secondary" className="font-mono cursor-pointer">{row.tag}</Badge>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{row.tag}</DialogTitle>
          <DialogDescription>
            mean rating <span className="text-primary font-semibold">{row.mean_rating.toFixed(2)}</span>{" "}
            across {fmt.format(row.n_papers)} reviewed papers · p90 rating {row.p90_rating.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Top-rated papers in this tag</div>
          {row.samples.map((s) => (
            <a
              key={s.paper_id}
              href={`https://openreview.net/forum?id=${s.paper_id.replace(/^openreview:/, "")}`}
              target="_blank"
              rel="noopener"
              className="block p-2 rounded-md hover:bg-muted text-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="tabular-nums text-primary font-semibold">{s.avg_rating.toFixed(2)}</span>
                <Badge variant="outline" className="font-mono text-[10px]">{s.venue}</Badge>
              </div>
              <div className="text-foreground/80">{s.title || s.paper_id}</div>
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TagRatingTable({ data }: { data: Row[] }) {
  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
    },
    {
      accessorKey: "tag",
      header: "tag",
      cell: ({ row }) => <TagDrilldown row={row.original} />,
    },
    {
      accessorKey: "mean_rating",
      header: "mean rating",
      cell: ({ getValue }) => (
        <span className="tabular-nums text-primary font-semibold">
          {getValue<number>().toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "p90_rating",
      header: "p90 rating",
      cell: ({ getValue }) => (
        <span className="tabular-nums text-muted-foreground">
          {getValue<number>().toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "n_papers",
      header: "papers",
      cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span>,
    },
  ], []);

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Filter tags..."
      initialSort={[{ id: "mean_rating", desc: true }]}
      pageSize={20}
    />
  );
}
