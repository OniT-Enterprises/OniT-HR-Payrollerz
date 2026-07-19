import type { ComponentType, ReactNode } from "react";
import { ArrowRight, Download } from "lucide-react";
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

/**
 * Per-card accent for report cards. Module colors identify destinations
 * (STYLE_GUIDE.md): People blue, Time & Leave cyan, Payroll primary green,
 * Money indigo, Accounting orange, Reports violet.
 */
export type ReportAccent =
  | "violet"
  | "blue"
  | "cyan"
  | "primary"
  | "indigo"
  | "orange"
  | "amber";

const ACCENT: Record<ReportAccent, { badge: string; button: string }> = {
  violet: {
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    button:
      "border-violet-500/30 text-violet-700 hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-300",
  },
  blue: {
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    button:
      "border-blue-500/30 text-blue-700 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300",
  },
  cyan: {
    badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    button:
      "border-cyan-500/30 text-cyan-700 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-300",
  },
  primary: {
    badge: "bg-primary/10 text-primary",
    button:
      "border-primary/30 text-primary hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
  },
  indigo: {
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    button:
      "border-indigo-500/30 text-indigo-700 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-300",
  },
  orange: {
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    button:
      "border-orange-500/30 text-orange-700 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-300",
  },
  amber: {
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    button:
      "border-amber-500/30 text-amber-700 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300",
  },
};

/** Value-pill tone for a ReportExportCard row. */
export type ReportRowTone =
  | "default"
  | "muted"
  | "positive"
  | "attention"
  | "critical"
  | "plain";

const ROW_TONE: Record<Exclude<ReportRowTone, "plain">, string> = {
  default: "bg-muted text-foreground",
  muted: "bg-muted text-muted-foreground",
  positive:
    "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  attention:
    "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  critical: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

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
  toolbarFields?: number;
  rowsPerSection?: number;
  showToolbar?: boolean;
  showHeaderAction?: boolean;
}

export function ReportPageSkeleton({
  sections = 2,
  maxWidth = "2xl",
  toolbarFields = 4,
  rowsPerSection = 5,
  showToolbar = true,
  showHeaderAction = false,
}: ReportPageSkeletonProps) {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <ModuleSectionNav config={reportsNavConfig} />
      <div
        className={cn(
          "mx-auto px-4 py-5 sm:px-6 sm:py-6",
          WIDTH_CLASS[maxWidth],
        )}
      >
        <div className="mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-lg" />
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-72 max-w-full" />
              </div>
            </div>
            {showHeaderAction && (
              <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
            )}
          </div>
          <Skeleton className="mt-3 h-0.5 w-full rounded-full" />
        </div>
        <div className="space-y-6">
          {showToolbar && (
            <div className="rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: toolbarFields }).map((_, index) => (
                    <div key={index} className="space-y-1.5">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {Array.from({ length: sections }).map((_, sectionIndex) => (
            <Card key={sectionIndex} className="border-border/70 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3.5 w-56 max-w-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  {Array.from({ length: rowsPerSection }).map((_, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="flex min-w-0 items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
                    >
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3.5 w-16" />
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
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

interface ReportCardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  accent?: ReportAccent;
  actions?: ReactNode;
}

/** Icon badge + title/description header shared by every report card. */
export function ReportCardHeader({
  title,
  description,
  icon: Icon,
  accent = "violet",
  actions,
}: ReportCardHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              ACCENT[accent].badge,
            )}
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <CardTitle className="text-base leading-snug">{title}</CardTitle>
          {description && (
            <CardDescription className="mt-1">{description}</CardDescription>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      )}
    </div>
  );
}

interface ReportSectionProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  accent?: ReportAccent;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function ReportSection({
  title,
  description,
  icon,
  accent = "violet",
  actions,
  children,
  className,
  contentClassName,
}: ReportSectionProps) {
  return (
    <Card className={cn("border-border/70 shadow-sm", className)}>
      <CardHeader className="pb-4">
        <ReportCardHeader
          title={title}
          description={description}
          icon={icon}
          accent={accent}
          actions={actions}
        />
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export interface ReportExportRow {
  icon?: ComponentType<{ className?: string }>;
  label: ReactNode;
  value: ReactNode;
  tone?: ReportRowTone;
}

interface ReportExportCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  accent?: ReportAccent;
  rows: ReportExportRow[];
  /** Small muted line between the rows and the export button. */
  footnote?: ReactNode;
  exportLabel: ReactNode;
  onExport: () => void;
  exportDisabled?: boolean;
  className?: string;
}

/**
 * One exportable report as a card: icon-badge header, icon-chip rows with
 * pill values, and an accent-tinted export action.
 */
export function ReportExportCard({
  title,
  description,
  icon,
  accent = "violet",
  rows,
  footnote,
  exportLabel,
  onExport,
  exportDisabled,
  className,
}: ReportExportCardProps) {
  return (
    <Card className={cn("flex flex-col border-border/70 shadow-sm", className)}>
      <CardHeader className="pb-4">
        <ReportCardHeader
          title={title}
          description={description}
          icon={icon}
          accent={accent}
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <dl className="flex-1 space-y-1.5 border-t border-border/60 pt-4">
          {rows.map((row, index) => {
            const RowIcon = row.icon;
            return (
              <div
                key={index}
                className="flex min-h-9 items-center justify-between gap-3"
              >
                <dt className="flex min-w-0 items-center gap-2.5 text-sm text-muted-foreground">
                  {RowIcon && (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70"
                      aria-hidden
                    >
                      <RowIcon className="h-4 w-4" />
                    </span>
                  )}
                  <span className="truncate">{row.label}</span>
                </dt>
                <dd
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    row.tone === "plain"
                      ? "min-w-0 max-w-[60%] truncate text-right text-foreground"
                      : cn(
                          "shrink-0 rounded-lg px-2.5 py-1",
                          ROW_TONE[row.tone ?? "default"],
                        ),
                  )}
                >
                  {row.value}
                </dd>
              </div>
            );
          })}
        </dl>
        {footnote && (
          <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>
        )}
        <Button
          variant="outline"
          className={cn("relative mt-4 w-full pr-10", ACCENT[accent].button)}
          onClick={onExport}
          disabled={exportDisabled}
        >
          <Download className="h-4 w-4" />
          <span className="truncate">{exportLabel}</span>
          <ArrowRight className="absolute right-3.5 h-4 w-4" aria-hidden />
        </Button>
      </CardContent>
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
  accent?: ReportAccent;
  className?: string;
}

/** One report card with label:value rows; avoids dashboard-style KPI tiles. */
export function ReportSummary({
  title,
  description,
  items,
  icon,
  accent,
  className,
}: ReportSummaryProps) {
  return (
    <ReportSection
      title={title}
      description={description}
      icon={icon}
      accent={accent}
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
