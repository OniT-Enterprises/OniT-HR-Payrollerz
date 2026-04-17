import React from "react";
import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardMetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  toneClass?: string;
  onClick?: () => void;
  badge?: ReactNode;
}

export function DashboardMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  toneClass = "bg-primary/10 text-primary",
  onClick,
  badge,
}: DashboardMetricCardProps) {
  const interactive = Boolean(onClick);

  return (
    <Card
      className={cn(
        "dashboard-panel-glow border-border/70 transition-all",
        interactive ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "",
      )}
      onClick={onClick}
    >
      <CardContent className="pt-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
          </div>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", toneClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <p className="text-sm text-muted-foreground">{hint}</p>
          {badge}
        </div>
      </CardContent>
    </Card>
  );
}
