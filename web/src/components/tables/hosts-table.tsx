import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { DrilldownDialog, DrillRow } from "@/components/drilldown-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/utils";

type Row = {
  host: string;
  papers: number;
  edges: number;
  pr_weight: number;
  category: string;
};

const CAT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  code: "default",
  "datasets/models": "secondary",
  academic: "secondary",
  reference: "outline",
  vendor: "outline",
  media: "outline",
  other: "outline",
};

export function HostsTable({ data }: { data: Row[] }) {
  const [drill, setDrill] = React.useState<string | null>(null);
  const [drillData, setDrillData] = React.useState<any>(null);

  React.useEffect(() => {
    if (!drill) return;
    fetch("/data/host_drilldowns.json").then((r) => r.json()).then((d) => setDrillData(d[drill] ?? null));
  }, [drill]);

  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
      enableSorting: false,
    },
    {
      accessorKey: "host",
      header: "host",
      cell: ({ row }) => (
        <a
          href={`https://${row.original.host}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 font-mono text-[13px] hover:text-primary transition-colors"
        >
          {row.original.host}
          <ExternalLink className="h-3 w-3 opacity-50" />
        </a>
      ),
    },
    {
      accessorKey: "category",
      header: "category",
      cell: ({ row }) => (
        <Badge variant={CAT_VARIANT[row.original.category] ?? "outline"} className="text-[10px]">
          {row.original.category}
        </Badge>
      ),
    },
    {
      accessorKey: "papers",
      header: "papers",
      cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span>,
    },
    {
      accessorKey: "edges",
      header: "edges",
      cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span>,
    },
    {
      accessorKey: "pr_weight",
      header: "PR-weight",
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{(getValue<number>() ?? 0).toFixed(2)}</span>,
    },
    {
      id: "drill",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setDrill(row.original.host)}>
          drill
        </Button>
      ),
    },
  ], []);

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Filter hosts..."
        initialSort={[{ id: "papers", desc: true }]}
      />
      <DrilldownDialog open={!!drill} onOpenChange={(v) => !v && setDrill(null)} title={`Papers citing ${drill ?? ""}`}>
        {!drillData ? (
          <div className="text-sm text-muted-foreground">No drilldown for this host (only top 30 pre-rendered).</div>
        ) : (
          drillData.citations.map((c: any, i: number) => (
            <DrillRow key={i}>
              <a href={c.url_canonical} target="_blank" rel="noopener" className="text-xs font-mono text-primary break-all hover:underline">
                {c.url_canonical}
              </a>
              <div className="text-sm mt-1">{c.title || ""}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                <a href={`https://arxiv.org/abs/${c.citing_arxiv_id}`} target="_blank" rel="noopener" className="hover:underline">
                  arxiv:{c.citing_arxiv_id}
                </a>
                {c.citation_count != null && <> · {c.citation_count.toLocaleString()} citations</>}
              </div>
              {c.context && <div className="text-xs text-muted-foreground/80 italic mt-1">"…{c.context}…"</div>}
            </DrillRow>
          ))
        )}
      </DrilldownDialog>
    </>
  );
}
