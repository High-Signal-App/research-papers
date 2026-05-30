import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { DrilldownDialog, DrillRow, DrillPillRow } from "@/components/drilldown-dialog";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/utils";

type Row = {
  author: string;
  n_papers: number;
  sum_citations: number;
  sum_pr: number;
  top_arxiv_ids: string[];
};

export function AuthorsTable({ data }: { data: Row[] }) {
  const [drill, setDrill] = React.useState<string | null>(null);
  const [drillData, setDrillData] = React.useState<any>(null);

  React.useEffect(() => {
    if (!drill) return;
    fetch("/data/author_drilldowns.json").then((r) => r.json()).then((d) => setDrillData(d[drill] ?? null));
  }, [drill]);

  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
    },
    { accessorKey: "author", header: "author", cell: ({ getValue }) => <span className="text-sm">{getValue<string>()}</span> },
    { accessorKey: "n_papers", header: "papers", cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span> },
    { accessorKey: "sum_citations", header: "sum citations", cell: ({ getValue }) => <span className="tabular-nums text-primary">{fmt.format(getValue<number>())}</span> },
    { accessorKey: "sum_pr", header: "sum PR ×1000", cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{(getValue<number>() ?? 0).toFixed(3)}</span> },
    {
      accessorKey: "top_arxiv_ids",
      header: "top papers",
      enableSorting: false,
      cell: ({ getValue }) => (
        <div className="flex gap-2 text-xs font-mono">
          {(getValue<string[]>() ?? []).slice(0, 3).map((id, i) => (
            <a key={i} href={`https://arxiv.org/abs/${id}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-primary">{id}</a>
          ))}
        </div>
      ),
    },
    {
      id: "drill",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setDrill(row.original.author)}>drill</Button>
      ),
    },
  ], []);

  return (
    <>
      <DataTable columns={columns} data={data} searchPlaceholder="Filter authors..." initialSort={[{ id: "sum_citations", desc: true }]} pageSize={25} />
      <DrilldownDialog open={!!drill} onOpenChange={(v) => !v && setDrill(null)} title={drill ?? ""}>
        {!drillData ? (
          <div className="text-sm text-muted-foreground">No drilldown for this author (only top 50 pre-rendered).</div>
        ) : (
          <>
            <DrillPillRow label="Top hosts cited across this author's papers:" items={drillData.top_hosts || []} render={(h) => `${h.host} (${h.n})`} />
            <DrillPillRow label="Citation-graph communities this author appears in:" items={drillData.communities || []} render={(c) => `community ${c.community_id} (${c.n})`} />
            <DrillRow>
              <div className="text-xs text-muted-foreground mb-2">Papers ({drillData.papers.length}):</div>
              {drillData.papers.map((p: any, i: number) => (
                <div key={i} className="py-1.5 border-b border-border/30 last:border-0">
                  <div className="text-sm">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    <a href={`https://arxiv.org/abs/${p.arxiv_id}`} target="_blank" rel="noopener" className="font-mono hover:text-primary">{p.arxiv_id}</a>
                    {p.citation_count != null && <> · {p.citation_count.toLocaleString()} citations</>}
                    {p.submitted_date && <> · {p.submitted_date.slice(0, 7)}</>}
                    {p.community_id != null && <> · community {p.community_id}</>}
                  </div>
                </div>
              ))}
            </DrillRow>
          </>
        )}
      </DrilldownDialog>
    </>
  );
}
