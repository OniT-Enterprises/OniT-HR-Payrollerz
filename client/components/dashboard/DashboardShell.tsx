import React, { useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { cn } from "@/lib/utils";
import { sectionThemes, type SectionId } from "@/lib/sectionTheme";
import { useLayoutOptional } from "@/contexts/LayoutContext";

interface DashboardShellProps {
  section: SectionId;
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  badges?: ReactNode;
  guidance?: ReactNode;
  main: ReactNode;
  rail: ReactNode;
  children?: ReactNode;
  brief: ReactNode;
}

function AmbientOrbs({ section }: { section: SectionId }) {
  const theme = sectionThemes[section];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="dashboard-grid-mask absolute inset-0 opacity-70" />
      <div className={cn("dashboard-orb left-[6%] top-8 h-36 w-36", theme.bg)} />
      <div className={cn("dashboard-orb right-[12%] top-10 h-28 w-28", theme.bgSubtle)} />
      <div className={cn("dashboard-orb bottom-[-3rem] left-[32%] h-44 w-44", theme.bg)} />
      <div className={cn("dashboard-orb bottom-[-4rem] right-[26%] h-56 w-56", theme.bgSubtle)} />
    </div>
  );
}

export default function DashboardShell({
  section,
  title,
  subtitle,
  icon: Icon,
  actions,
  badges,
  guidance,
  main,
  rail,
  children,
  brief,
}: DashboardShellProps) {
  const theme = sectionThemes[section];
  const layout = useLayoutOptional();
  const setPageHeader = layout?.setPageHeader;
  const clearPageHeader = layout?.clearPageHeader;

  useEffect(() => {
    if (!setPageHeader) return;

    setPageHeader({
      title,
      subtitle,
      icon: Icon,
      iconColor: theme.text,
    });

    return () => {
      clearPageHeader?.();
    };
  }, [setPageHeader, clearPageHeader, title, subtitle, Icon, theme.text]);

  return (
    <div className="min-h-screen bg-background">
      <div className={cn("relative border-b overflow-hidden", theme.bgSubtle)}>
        <AmbientOrbs section={section} />
        <div className="relative mx-auto max-w-screen-2xl px-6 py-6">
          <AutoBreadcrumb className="mb-4 animate-fade-up" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "dashboard-panel-glow flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-gradient-to-br text-white shadow-xl",
                    theme.gradient,
                  )}
                >
                  <Icon className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    <span>Module Overview</span>
                    {badges}
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                    {subtitle}
                  </p>
                </div>
              </div>
            </div>

            {actions ? (
              <div className="flex flex-wrap items-center gap-2 animate-fade-up stagger-2">
                {actions}
              </div>
            ) : null}
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
