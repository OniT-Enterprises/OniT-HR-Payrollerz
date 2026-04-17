import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import {
  filterModuleNavConfigByPermissions,
  reportsNavConfig,
} from "@/lib/moduleNav";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";
import { ModuleBrief } from "@/components/dashboard/ModuleBrief";
import { useTenant } from "@/contexts/TenantContext";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";
import { useTaxFilingsDueSoon } from "@/hooks/useTaxFiling";
import { cn } from "@/lib/utils";
import type { FilingDueDate } from "@/types/tax-filing";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  FileText,
  FolderKanban,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";

function ReportsDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <ModuleSectionNav config={reportsNavConfig} />
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
          <div className="space-y-6 xl:col-span-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getFilingLabel(item: FilingDueDate) {
  if (item.type === "monthly_wit") {
    return `WIT ${item.period}`;
  }

  if (item.type === "annual_wit") {
    return `Annual WIT ${item.period}`;
  }

  if (item.task === "payment") {
    return `INSS payment ${item.period}`;
  }

  return `INSS statement ${item.period}`;
}

function getDueDescriptor(item: FilingDueDate) {
  if (item.isOverdue) {
    return `${Math.abs(item.daysUntilDue)}d overdue`;
  }

  if (item.daysUntilDue === 0) {
    return "Due today";
  }

  if (item.daysUntilDue === 1) {
    return "Due tomorrow";
  }

  return `${item.daysUntilDue}d left`;
}

const familyDescriptions: Record<string, string> = {
  "payroll-reports": "Payslips, tax views, year-to-date detail, and payroll summaries.",
  "employee-reports": "Headcount, movement, workforce structure, and staff reporting.",
  "attendance-reports": "Absence, overtime, punctuality, and time trend reporting.",
  "department-reports": "Cost comparisons, allocation views, and org-level reporting.",
  ngo: "Allocation packs and donor-facing exports for restricted funds.",
  custom: "Builder surfaces, saved reports, and reporting setup controls.",
};

const familyStyles = [
  {
    icon: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    pill: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    fill: "#8b5cf6",
  },
  {
    icon: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    pill: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    fill: "#0ea5e9",
  },
  {
    icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    fill: "#10b981",
  },
  {
    icon: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    fill: "#f59e0b",
  },
  {
    icon: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    pill: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    fill: "#14b8a6",
  },
  {
    icon: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    pill: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
    fill: "#d946ef",
  },
];

export default function ReportsDashboard() {
  const navigate = useNavigate();
  const { session, hasModule, canManage } = useTenant();
  const hasReports = hasModule("reports");
  const hasPayroll = hasModule("payroll");
  const ngoReportingEnabled = canUseNgoReporting(session, hasReports);
  const donorExportEnabled = canUseDonorExport(session, hasReports, canManage());
  const { data: filingDueDates = [], isLoading } = useTaxFilingsDueSoon(3, hasPayroll);

  if (isLoading) {
    return <ReportsDashboardSkeleton />;
  }

  const filteredConfig = filterModuleNavConfigByPermissions(reportsNavConfig, hasModule);
  const reportFamilies = filteredConfig.sections.flatMap((section) => {
    if (section.id !== "ngo") {
      return [section];
    }

    if (!ngoReportingEnabled) {
      return [];
    }

    return [
      {
        ...section,
        subPages: section.subPages.filter((page) =>
          page.path === "/reports/donor-export" ? donorExportEnabled : true,
        ),
      },
    ];
  });

  const familyCards = reportFamilies.map((section, index) => {
    const style = familyStyles[index % familyStyles.length];
    const outputs =
      section.subPages.length > 0
        ? section.subPages
        : [{ label: section.label, path: section.path, icon: section.icon }];

    return {
      id: section.id,
      title: section.label,
      path: outputs[0]?.path ?? section.path,
      description:
        familyDescriptions[section.id] ??
        "Operational reporting for this slice of the platform.",
      routeCount: outputs.length,
      outputs: outputs.slice(0, 3),
      icon: section.icon,
      style,
    };
  });

  const totalLaunchPoints = familyCards.reduce((sum, family) => sum + family.routeCount, 0);
  const openFilings = filingDueDates
    .filter((item) => item.status !== "filed")
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const overdueCount = openFilings.filter((item) => item.isOverdue).length;
  const dueThisWeek = openFilings.filter(
    (item) => item.daysUntilDue >= 0 && item.daysUntilDue <= 7,
  ).length;
  const nextFilings = openFilings.slice(0, 5);
  const nextFiling = nextFilings[0] ?? null;
  const customFamily = familyCards.find((family) => family.id === "custom");
  const ngoFamily = familyCards.find((family) => family.id === "ngo");
  const largestFamily = [...familyCards].sort((a, b) => b.routeCount - a.routeCount)[0];

  const filingHorizon = nextFilings.map((item) => {
    const urgency = item.isOverdue
      ? 44 + Math.min(Math.abs(item.daysUntilDue), 7)
      : Math.max(8, 32 - Math.min(item.daysUntilDue, 30));

    return {
      name: getFilingLabel(item),
      urgency,
      fill: item.isOverdue
        ? "#ef4444"
        : item.daysUntilDue <= 3
          ? "#f59e0b"
          : "#8b5cf6",
      descriptor: getDueDescriptor(item),
    };
  });

  const actionItems = [
    ...(overdueCount > 0
      ? [
          {
            title: `Clear ${overdueCount} overdue filing${overdueCount === 1 ? "" : "s"}`,
            description: "Compliance items have already crossed their due date.",
            path: "/payroll/tax",
            icon: ShieldAlert,
          },
        ]
      : []),
    ...(dueThisWeek > 0
      ? [
          {
            title: `Prepare ${dueThisWeek} filing${dueThisWeek === 1 ? "" : "s"} due this week`,
            description: "Keep the reporting runway clear before the week closes.",
            path: "/payroll/tax",
            icon: Clock3,
          },
        ]
      : []),
    ...(customFamily
      ? [
          {
            title: "Open the custom report workbench",
            description: "Saved builders and report setup are ready for tuning.",
            path: "/reports/custom",
            icon: Wrench,
          },
        ]
      : []),
    ...(ngoFamily
      ? [
          {
            title: "Refresh NGO and donor packs",
            description: "Allocation-ready exports are available for restricted funding views.",
            path: donorExportEnabled ? "/reports/donor-export" : "/reports/payroll-allocation",
            icon: FolderKanban,
          },
        ]
      : []),
  ];

  const briefLead =
    overdueCount > 0
      ? "Reports is carrying active compliance risk, and the fastest win is to clear the overdue filing queue before attention shifts back to analytics and exports."
      : dueThisWeek > 0
        ? "Reports is in a healthy place overall, but there is a visible filing runway this week that should stay in focus."
        : "Reports is in a calm operating state, with the emphasis shifting from deadlines to better reporting coverage, cleaner exports, and reusable report setups.";

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Reports Dashboard"
        description="Report families, compliance runway, custom reporting, and operational outputs in one place."
      />
      <MainNavigation />
      <ModuleSectionNav config={reportsNavConfig} />

      <DashboardShell
        section="reports"
        title="Reporting control tower"
        subtitle="A single canvas for report families, filing pressure, custom workbenches, and the output lanes that matter most in the week ahead."
        icon={BarChart3}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/reports/setup")}>
              Report setup
            </Button>
            <Button
              className="bg-violet-600 text-white hover:bg-violet-700"
              onClick={() => navigate("/reports/custom")}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Custom reports
            </Button>
          </>
        }
        badges={
          <>
            <Badge variant="secondary">{familyCards.length} report families</Badge>
            <Badge variant="secondary">{totalLaunchPoints} launch points</Badge>
          </>
        }
        main={
          <>
            <DashboardPanel
              eyebrow="Signature view"
              title="Report portfolio map"
              actions={
                overdueCount > 0 ? (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {overdueCount} overdue item{overdueCount === 1 ? "" : "s"}
                  </Badge>
                ) : (
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                    Control tower ready
                  </Badge>
                )
              }
            >
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {familyCards.map((family) => {
                    const Icon = family.icon;
                    const highlightPayroll =
                      family.id === "payroll-reports" && (overdueCount > 0 || dueThisWeek > 0);

                    return (
                      <button
                        key={family.id}
                        type="button"
                        onClick={() => navigate(family.path)}
                        className={cn(
                          "group flex flex-col rounded-2xl border border-border/70 bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md",
                          highlightPayroll ? "ring-1 ring-red-400/40" : "",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", family.style.icon)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", family.style.pill)}>
                            {family.routeCount} output{family.routeCount === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="mt-3">
                          <h3 className="text-base font-semibold tracking-tight">{family.title}</h3>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground line-clamp-2">
                            {family.description}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center text-xs font-medium text-muted-foreground">
                          Open lane
                          <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Next live milestone
                      </p>
                    </div>
                    <p className="mt-2 text-xl font-bold tracking-tight">
                      {nextFiling ? getDueDescriptor(nextFiling) : "Clear runway"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {nextFiling
                        ? `${getFilingLabel(nextFiling)} · ${formatShortDate(nextFiling.dueDate)}`
                        : "No open filing pressure."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Coverage breadth
                        </p>
                        <p className="mt-1 text-xl font-semibold tracking-tight">
                          {familyCards.length} families
                        </p>
                      </div>
                      <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-600 dark:text-violet-300">
                        <FileText className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {totalLaunchPoints} report entry points in this module.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Compliance pressure
                        </p>
                        <p className="mt-1 text-xl font-semibold tracking-tight">
                          {openFilings.length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-red-500/10 p-2.5 text-red-600 dark:text-red-300">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {overdueCount > 0
                        ? `${overdueCount} overdue, ${Math.max(openFilings.length - overdueCount, 0)} on runway.`
                        : dueThisWeek > 0
                          ? `${dueThisWeek} due in the next 7 days.`
                          : "No urgent deadlines."}
                    </p>
                  </div>
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="Live compliance" title="Submission horizon">
              {filingHorizon.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Urgency runway
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Larger bars mean the filing is demanding attention sooner or is already overdue.
                      </p>
                    </div>

                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={filingHorizon}
                          layout="vertical"
                          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid horizontal={false} stroke="hsl(var(--border) / 0.35)" />
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={130}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(_value, _name, payload) => payload?.payload?.descriptor ?? ""}
                            labelFormatter={(label) => label}
                            contentStyle={{ borderRadius: 16, borderColor: "hsl(var(--border))" }}
                          />
                          <Bar dataKey="urgency" radius={[0, 12, 12, 0]}>
                            {filingHorizon.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {nextFilings.map((item) => (
                      <button
                        key={`${item.type}-${item.task ?? "default"}-${item.period}`}
                        type="button"
                        onClick={() => navigate("/payroll/tax")}
                        className={cn(
                          "w-full rounded-2xl border border-border/60 bg-background/80 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                          item.isOverdue ? "ring-1 ring-red-400/35" : "",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{getFilingLabel(item)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Due {formatShortDate(item.dueDate)} and currently {getDueDescriptor(item).toLowerCase()}.
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-semibold",
                              item.isOverdue
                                ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                : item.daysUntilDue <= 3
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
                            )}
                          >
                            {getDueDescriptor(item)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Quiet runway
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                    No immediate filing pressure is visible
                  </h3>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    This is a good window to refine saved reports, tighten custom builders, and make the next round of exports easier to produce.
                  </p>
                </div>
              )}
            </DashboardPanel>
          </>
        }
        rail={
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <DashboardMetricCard
                label="Report Families"
                value={familyCards.length}
                hint="Payroll, people, attendance, department, donor, and custom lanes."
                icon={BarChart3}
                toneClass="bg-violet-500/10 text-violet-600 dark:text-violet-300"
                onClick={() => navigate("/reports/payroll")}
              />
              <DashboardMetricCard
                label="Launch Points"
                value={totalLaunchPoints}
                hint="Distinct report pages or builders reachable from this overview."
                icon={FileText}
                toneClass="bg-sky-500/10 text-sky-600 dark:text-sky-300"
                onClick={() => navigate("/reports/custom")}
              />
              <DashboardMetricCard
                label="Due This Week"
                value={dueThisWeek}
                hint="Filings that need to move before the current week closes."
                icon={Clock3}
                toneClass="bg-amber-500/10 text-amber-600 dark:text-amber-300"
                onClick={() => navigate("/payroll/tax")}
                badge={
                  dueThisWeek > 0 ? (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Quiet</Badge>
                  )
                }
              />
              <DashboardMetricCard
                label="Overdue Filings"
                value={overdueCount}
                hint="Items already beyond due date and demanding immediate follow-up."
                icon={ShieldAlert}
                toneClass="bg-red-500/10 text-red-600 dark:text-red-300"
                onClick={() => navigate("/payroll/tax")}
                badge={
                  overdueCount > 0 ? (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      Escalate
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Clear
                    </Badge>
                  )
                }
              />
            </div>

            <DashboardPanel eyebrow="Action rail" title="Best next moves">
              <div className="space-y-3">
                {actionItems.length > 0 ? (
                  actionItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="flex w-full items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-600 dark:text-violet-300">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium tracking-tight">{item.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm leading-6 text-muted-foreground">
                    The reporting rail is quiet right now. This is a good moment to tune templates and keep custom outputs sharp.
                  </div>
                )}
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="Watch list" title="Important signals">
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Richest reporting lane
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="font-medium">{largestFamily?.title ?? "Reports"}</p>
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                      {largestFamily?.routeCount ?? 0} surfaces
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Custom workspace
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="font-medium">{customFamily ? "Builder and setup are ready" : "Not enabled"}</p>
                    <div className="rounded-2xl bg-fuchsia-500/10 p-2 text-fuchsia-600 dark:text-fuchsia-300">
                      <Wrench className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {customFamily
                      ? `${customFamily.routeCount} entry point${customFamily.routeCount === 1 ? "" : "s"} support reusable outputs and setup.`
                      : "Custom reporting is not currently visible in this tenant."}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    NGO and donor exports
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="font-medium">
                      {ngoFamily ? "Available in this workspace" : "Not currently exposed"}
                    </p>
                    <div className="rounded-2xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {ngoFamily
                      ? donorExportEnabled
                        ? "Both payroll allocation and donor export surfaces are active."
                        : "Payroll allocation is available, while donor export remains gated."
                      : "The standard report families remain the focus here."}
                  </p>
                </div>
              </div>
            </DashboardPanel>
          </>
        }
        brief={
          <ModuleBrief
            section="reports"
            title="Weekly Reporting Brief"
            lead={briefLead}
            columns={[
              {
                title: "What's Happening Now",
                items: [
                  `${familyCards.length} report families are exposed from this module, covering ${totalLaunchPoints} distinct launch surfaces.`,
                  largestFamily
                    ? `${largestFamily.title} is currently the richest lane, with ${largestFamily.routeCount} output surface${largestFamily.routeCount === 1 ? "" : "s"} already in place.`
                    : "The reporting portfolio is still light and ready to grow.",
                ],
              },
              {
                title: "Watch This Week",
                items:
                  nextFilings.length > 0
                    ? nextFilings.slice(0, 2).map(
                        (item) =>
                          `${getFilingLabel(item)} is ${getDueDescriptor(item).toLowerCase()} and due ${formatShortDate(item.dueDate)}.`,
                      )
                    : ["No filing deadlines are immediately visible this week."],
              },
              {
                title: "Actions Required",
                items:
                  actionItems.length > 0
                    ? actionItems.slice(0, 2).map((item) => `${item.title}. ${item.description}`)
                    : ["No urgent action is required. Use the window to improve saved outputs and reporting setup."],
              },
              {
                title: "Week Ahead",
                items: [
                  nextFiling
                    ? `The next checkpoint in the runway is ${getFilingLabel(nextFiling)} on ${formatShortDate(nextFiling.dueDate)}.`
                    : "The next week looks open, which gives room for deeper custom reporting work.",
                  customFamily
                    ? "Custom reports and setup are positioned well for building reusable weekly or monthly packs."
                    : "If custom reporting is enabled later, it can become the fastest path to better operational summaries.",
                ],
              },
              {
                title: "Interesting Signals",
                items: [
                  overdueCount > 0
                    ? `${overdueCount} filing${overdueCount === 1 ? "" : "s"} is already overdue, so compliance pressure is the dominant signal.`
                    : dueThisWeek > 0
                      ? `${dueThisWeek} filing${dueThisWeek === 1 ? "" : "s"} is due in the next seven days, which keeps the module warm but manageable.`
                      : "No visible filing stress is competing with report design and distribution work.",
                  ngoFamily
                    ? donorExportEnabled
                      ? "Donor export is active, which means the reports module can serve both internal and external audiences."
                      : "NGO allocation reporting is active, but donor export remains a future unlock."
                    : "This workspace is currently centered on internal reporting lanes.",
                ],
              },
            ]}
          />
        }
      />
    </div>
  );
}
