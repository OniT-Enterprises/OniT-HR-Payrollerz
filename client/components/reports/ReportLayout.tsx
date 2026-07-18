import type { ComponentType, ReactNode } from "react";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { reportsNavConfig, type ModuleNavConfig } from "@/lib/moduleNav";
import { cn } from "@/lib/utils";

type ReportWidth = "lg" | "xl" | "2xl";

const WIDTH_CLASS: Record<ReportWidth, string> = {
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
};

interface ReportPageProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  cardIcon?: string;
  iconColor?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: ReportWidth;
  navigation?: ModuleNavConfig | false;
}

/** Shared shell for pages reached from the Reports module. */
export function ReportPage({
  title,
  subtitle,
  icon,
  cardIcon,
  iconColor = "text-violet-500",
  actions,
  children,
  maxWidth = "2xl",
  navigation = reportsNavConfig,
}: ReportPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      {navigation && <ModuleSectionNav config={navigation} />}
      <div
        className={cn(
          "mx-auto px-4 py-5 sm:px-6 sm:py-6",
          WIDTH_CLASS[maxWidth],
        )}
      >
        <PageHeader
          title={title}
          subtitle={subtitle}
          icon={icon}
          cardIcon={cardIcon}
          iconColor={iconColor}
          actions={actions}
          titleClassName="break-words whitespace-normal text-2xl"
        />
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}

interface ReportPageSkeletonProps {
  sections?: number;
  maxWidth?: ReportWidth;
}

export function ReportPageSkeleton({
  sections = 2,
  maxWidth = "2xl",
}: ReportPageSkeletonProps) {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <ModuleSectionNav config={reportsNavConfig} />
      <div
        className={cn(
          "mx-auto space-y-6 px-4 py-5 sm:px-6 sm:py-6",
          WIDTH_CLASS[maxWidth],
        )}
      >
        <div className="space-y-2 border-b border-border/70 pb-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        {Array.from({ length: sections }).map((_, index) => (
          <Skeleton key={index} className="h-56 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

interface ReportToolbarProps {
  children: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

/** Compact controls placed below the title so localized labels fit on phones. */
export function ReportToolbar({
  children,
  hint,
  actions,
  ariaLabel,
  className,
}: ReportToolbarProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {children}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        )}
      </div>
      {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface ReportSectionProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function ReportSection({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
}: ReportSectionProps) {
  return (
    <Card className={cn("border-border/70 shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {Icon && (
                <Icon className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
              )}
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          )}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export interface ReportSummaryItem {
  label: ReactNode;
  value: ReactNode;
  tone?: string;
}

interface ReportSummaryProps {
  title: ReactNode;
  description?: ReactNode;
  items: ReportSummaryItem[];
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}

/** One report card with label:value rows; avoids dashboard-style KPI tiles. */
export function ReportSummary({
  title,
  description,
  items,
  icon,
  className,
}: ReportSummaryProps) {
  return (
    <ReportSection
      title={title}
      description={description}
      icon={icon}
      className={className}
    >
      <dl className="grid gap-x-8 sm:grid-cols-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex min-w-0 items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
          >
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                item.tone,
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </ReportSection>
  );
}

interface ReportEmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function ReportEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: ReportEmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
