import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { DrilldownDialog, DrillRow, DrillPillRow } from "@/components/drilldown-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/utils";

type Row = {
  id: number;
  size: number;
  labels: string[];
  anchor_arxiv_id: string;
  anchor_title: string;
  year_range: [number, number] | null;
  top_hosts: string[];
};

export function CommunitiesTable({ data }: { data: Row[] }) {
  const [drill, setDrill] = React.useState<number | null>(null);
  const [drillData, setDrillData] = React.useState<any>(null);

  React.useEffect(() => {
    if (drill == null) return;
    fetch("/data/community_drilldowns.json").then((r) => r.json()).then((d) => setDrillData(d[String(drill)] ?? null));
  }, [drill]);

  const columns: ColumnDef<Row>[] = React.useMemo(() => [
    {
      id: "rank",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
    },
    { accessorKey: "size", header: "size", cell: ({ getValue }) => <span className="tabular-nums">{fmt.format(getValue<number>())}</span> },
    {
      accessorKey: "labels",
      header: "labels",
      enableSorting: false,
      cell: ({ getValue }) => (
        <div className="flex flex-wrap gap-1">
          {(getValue<string[]>() ?? []).slice(0, 5).map((l, i) => (
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
    {
      accessorKey: "year_range",
      header: "years",
      cell: ({ getValue }) => {
        const yr = getValue<[number, number] | null>();
        return yr ? <span className="tabular-nums text-xs text-muted-foreground">{yr[0]}–{yr[1]}</span> : null;
      },
    },
    {
      accessorKey: "top_hosts",
      header: "top hosts cited",
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground font-mono">
          {(getValue<string[]>() ?? []).slice(0, 3).join(", ")}
        </span>
      ),
    },
    {
      id: "drill",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setDrill(row.original.id)}>drill</Button>
      ),
    },
  ], []);

  return (
    <>
      <DataTable columns={columns} data={data} searchPlaceholder="Filter communities..." initialSort={[{ id: "size", desc: true }]} pageSize={25} />
      <DrilldownDialog open={drill != null} onOpenChange={(v) => !v && setDrill(null)} title={`Community ${drill ?? ""}`}>
        {!drillData ? (
          <div className="text-sm text-muted-foreground">No drilldown for this community (only top 30 pre-rendered).</div>
        ) : (
          <>
            <DrillPillRow label="Top hosts cited by this community:" items={drillData.top_hosts || []} render={(h) => `${h.host} (${h.n})`} />
            <DrillPillRow label="Most prolific authors:" items={drillData.top_authors || []} render={(a) => `${a.author} (${a.n})`} />
            <DrillRow>
              <div className="text-xs text-muted-foreground">
                Year range: {drillData.years?.[0]?.year}–{drillData.years?.[drillData.years.length - 1]?.year} ({drillData.years?.length || 0} years active)
              </div>
            </DrillRow>
            <DrillRow>
              <div className="text-xs text-muted-foreground mb-2">Top papers (by PageRank):</div>
              {drillData.papers.map((p: any, i: number) => (
                <div key={i} className="py-1.5 border-b border-border/30 last:border-0">
                  <div className="text-sm">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    <a href={`https://arxiv.org/abs/${p.arxiv_id}`} target="_blank" rel="noopener" className="font-mono hover:text-primary">{p.arxiv_id}</a>
                    {p.citation_count != null && <> · {p.citation_count.toLocaleString()} citations</>}
                    {p.pagerank_score != null && <> · PR {p.pagerank_score.toFixed(6)}</>}
                    {p.submitted_date && <> · {p.submitted_date.slice(0, 7)}</>}
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
