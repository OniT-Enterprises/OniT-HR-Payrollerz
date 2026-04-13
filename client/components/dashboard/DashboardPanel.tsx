import React from "react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardPanelProps {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DashboardPanel({
  title,
  eyebrow,
  actions,
  children,
  className,
  contentClassName,
}: DashboardPanelProps) {
  return (
    <Card className={cn("dashboard-panel-glow border-border/70 shadow-sm", className)}>
      {(title || eyebrow || actions) && (
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              {eyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {eyebrow}
                </p>
              ) : null}
              {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
            </div>
            {actions}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
