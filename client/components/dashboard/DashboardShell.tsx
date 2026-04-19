import React from "react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { sectionThemes, type SectionId } from "@/lib/sectionTheme";

interface DashboardShellProps {
  section: SectionId;
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  /** @deprecated action buttons no longer render in the dashboard hero. Retained for source compatibility. */
  actions?: ReactNode;
  /** @deprecated badges/pills are no longer rendered. Retained for source compatibility. */
  badges?: ReactNode;
  guidance?: ReactNode;
  main: ReactNode;
  rail: ReactNode;
  children?: ReactNode;
  brief: ReactNode;
}

function AmbientOrbs() {
  // Glow removed per design request.
  return null;
}

export default function DashboardShell({
  section,
  title,
  subtitle,
  icon: Icon,
  guidance,
  main,
  rail,
  children,
  brief,
}: DashboardShellProps) {
  const theme = sectionThemes[section];
  // Dashboard pages own their own hero header — don't register with the TopBar's
  // page-label slot. Sub-pages still do, via their own PageHeader components.

  return (
    <div className="min-h-screen bg-background">
      <div className={cn("relative border-b", theme.bgSubtle)}>
        <AmbientOrbs />
        <div className="relative mx-auto max-w-screen-2xl px-6 py-6">
          <div className="min-w-0 flex items-start gap-4">
            <div
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white",
                theme.gradient,
              )}
            >
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        {guidance ? <div className="mb-6 animate-fade-up stagger-1">{guidance}</div> : null}

        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">{main}</div>
          <aside className="space-y-6 xl:col-span-4">{rail}</aside>
        </div>

        {children ? <div className="mt-6 space-y-6">{children}</div> : null}

        <div className="mt-8 min-h-[18vh] animate-fade-up stagger-5">{brief}</div>
      </div>
    </div>
  );
}
