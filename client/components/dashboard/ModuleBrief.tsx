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

export function ModuleBrief({ section, title = "Weekly brief", lead, columns }: ModuleBriefProps) {
  const theme = sectionThemes[section];
  const visibleColumns = columns.filter((c) => c.items.length > 0);

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{lead}</p>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {visibleColumns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No major changes to report this week.</p>
        ) : (
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {visibleColumns.map((column) => (
              <div key={column.title} className="space-y-2.5">
                <h3
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.18em]",
                    theme.text,
                  )}
                >
                  {column.title}
                </h3>
                <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                  {column.items.map((item, index) => (
                    <li key={`${column.title}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
