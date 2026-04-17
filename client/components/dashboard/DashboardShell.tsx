import React, { useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
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
      <div className="dashboard-grid-mask absolute inset-0 opacity-40" />
      <div className={cn("dashboard-orb left-[8%] top-6 h-32 w-32 opacity-60", theme.bgSubtle)} />
      <div className={cn("dashboard-orb right-[10%] bottom-[-3rem] h-40 w-40 opacity-60", theme.bgSubtle)} />
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "dashboard-panel-glow flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md",
                    theme.gradient,
                  )}
                >
                  <Icon className="h-7 w-7" />
                </div>
                <div className="min-w-0 space-y-2">
                  {badges ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {badges}
                    </div>
                  ) : null}
                  <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {subtitle}
                  </p>
                </div>
              </div>
            </div>

            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2 animate-fade-up stagger-2">
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
