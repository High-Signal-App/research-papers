import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface BaseProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export function DrilldownDialog({ open, onOpenChange, title, children }: BaseProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-3">{children}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function DrillRow({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border/40 pb-3 last:border-0">{children}</div>;
}

export function DrillPillRow({ label, items, render }: { label: string; items: any[]; render: (i: any) => string }) {
  return (
    <DrillRow>
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.length > 0 ? items.map((it, i) => (
          <Badge key={i} variant="secondary" className="font-mono text-[11px]">{render(it)}</Badge>
        )) : <span className="text-xs text-muted-foreground italic">(none)</span>}
      </div>
    </DrillRow>
  );
}
