import React from "react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { sectionThemes, type SectionId } from "@/lib/sectionTheme";

interface ModuleBriefColumn {
  title: string;
  items: ReactNode[];
}

interface ModuleBriefProps {
  section: SectionId;
  title?: string;
  lead: ReactNode;
  columns: ModuleBriefColumn[];
}

export function ModuleBrief({ section, title = "Weekly Module Brief", lead, columns }: ModuleBriefProps) {
  const theme = sectionThemes[section];

  return (
    <Card className={cn("dashboard-report-band overflow-hidden border-border/70", theme.borderLeft)}>
      <CardHeader className="border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Narrative Summary
            </p>
            <CardTitle className="mt-1 text-xl">{title}</CardTitle>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{lead}</p>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-5 lg:grid-cols-5">
          {columns.map((column) => (
            <div key={column.title} className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight">{column.title}</h3>
              <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                {column.items.length > 0 ? (
                  column.items.map((item, index) => (
                    <div key={`${column.title}-${index}`} className="flex gap-2">
                      <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", theme.bg, theme.border)} />
                      <div>{item}</div>
                    </div>
                  ))
                ) : (
                  <p>No major changes to report this week.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
