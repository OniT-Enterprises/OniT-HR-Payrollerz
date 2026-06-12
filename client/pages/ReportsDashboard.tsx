import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { filterModuleNavConfigByPermissions, reportsNavConfig } from "@/lib/moduleNav";
import { useTenant } from "@/contexts/TenantContext";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";
import { useTaxFilingsDueSoon } from "@/hooks/useTaxFiling";
import type { FilingDueDate } from "@/types/tax-filing";
import { CheckCircle2, ChevronRight, Clock3, ShieldAlert, Wrench } from "lucide-react";

function ReportsDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={reportsNavConfig} />
      <div className="mx-auto max-w-screen-xl space-y-8 px-6 py-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function getFilingLabel(item: FilingDueDate) {
  if (item.type === "monthly_wit") return `WIT ${item.period}`;
  if (item.type === "annual_wit") return `Annual WIT ${item.period}`;
  if (item.task === "payment") return `INSS payment ${item.period}`;
  return `INSS statement ${item.period}`;
}

function getDueDescriptor(item: FilingDueDate) {
  if (item.isOverdue) return `${Math.abs(item.daysUntilDue)}d overdue`;
  if (item.daysUntilDue === 0) return "due today";
  if (item.daysUntilDue === 1) return "due tomorrow";
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

const RED = "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300";
const AMBER = "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300";
const VIOLET = "text-violet-600 bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300";

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
    if (section.id !== "ngo") return [section];
    if (!ngoReportingEnabled) return [];
    return [
      {
        ...section,
        subPages: section.subPages.filter((page) =>
          page.path === "/reports/donor-export" ? donorExportEnabled : true,
        ),
      },
    ];
  });

  const familyArt: Record<string, string> = {
    "payroll-reports": "/images/illustrations/xefe-card-payroll.webp",
    "employee-reports": "/images/illustrations/xefe-card-people.webp",
    "attendance-reports": "/images/illustrations/xefe-card-tl-attendance.webp",
    "department-reports": "/images/illustrations/xefe-card-people.webp",
    "ngo": "/images/illustrations/xefe-card-reports.webp",
    "custom": "/images/illustrations/xefe-card-reports.webp",
  };
  const familyCards = reportFamilies.map((section) => {
    const outputs = section.subPages.length > 0 ? section.subPages : [{ path: section.path }];
    const count = outputs.length;
    return {
      id: section.id,
      title: section.label,
      art: familyArt[section.id] ?? "/images/illustrations/xefe-card-reports.webp",
      path: outputs[0]?.path ?? section.path,
      description: familyDescriptions[section.id] ?? `${count} report${count === 1 ? "" : "s"} in this lane.`,
      icon: section.icon,
    };
  });

  const openFilings = filingDueDates
    .filter((item) => item.status !== "filed")
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const overdueCount = openFilings.filter((item) => item.isOverdue).length;
  const dueThisWeek = openFilings.filter((item) => item.daysUntilDue >= 0 && item.daysUntilDue <= 7).length;

  const compliancePhrase =
    overdueCount > 0
      ? `${overdueCount} filing${overdueCount === 1 ? "" : "s"} overdue`
      : dueThisWeek > 0
        ? `${dueThisWeek} filing${dueThisWeek === 1 ? "" : "s"} due this week`
        : "no filings due";

  // Triage: the real actionable signal in Reports is the tax/INSS filing runway
  const attention = openFilings.slice(0, 5).map((item) => ({
    key: `${item.type}-${item.task ?? "default"}-${item.period}`,
    text: `${getFilingLabel(item)} — ${getDueDescriptor(item)} (due ${formatShortDate(item.dueDate)})`,
    path: "/payroll/tax",
    icon: item.isOverdue ? ShieldAlert : Clock3,
    tone: item.isOverdue ? RED : item.daysUntilDue <= 3 ? AMBER : VIOLET,
  }));

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Reports" description="Payroll, people, attendance, department, and compliance reports in one place." />
      <ModuleSectionNav config={reportsNavConfig} />

      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {familyCards.length} report {familyCards.length === 1 ? "family" : "families"} · {compliancePhrase}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/reports/setup")}>
              Report setup
            </Button>
            <Button
              onClick={() => navigate("/reports/custom")}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Custom reports
            </Button>
          </div>
        </div>

        {/* Filing runway */}
        {hasPayroll && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Filing runway
            </h2>
            {attention.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                {attention.map((item, idx) => (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.path)}
                    className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 ${
                      idx !== attention.length - 1 ? "border-b border-border/60" : ""
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm text-foreground/90">{item.text}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-violet-600" />
                No tax filings due — the reporting runway is clear.
              </div>
            )}
          </section>
        )}

        {/* Report library */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Browse reports
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {familyCards.map((card) => (
              <button
                key={card.id}
                onClick={() => navigate(card.path)}
                className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-violet-400/40"
              >
                <img
                  src={card.art}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="h-16 w-16 object-contain transition-transform duration-300 group-hover:scale-105"
                />
                <div>
                  <p className="text-base font-semibold">{card.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{card.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
