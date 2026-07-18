import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CardIcon,
  hasCardIcon,
  cardIconNameFromArt,
} from "@/components/ui/CardIcon";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import {
  filterModuleNavConfigByPermissions,
  reportsNavConfig,
} from "@/lib/moduleNav";
import { useTenant } from "@/contexts/TenantContext";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";
import { useTaxFilingsDueSoon } from "@/hooks/useTaxFiling";
import { useI18n } from "@/i18n/I18nProvider";
import type { FilingDueDate } from "@/types/tax-filing";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ShieldAlert,
  Wrench,
} from "lucide-react";

function ReportsDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={reportsNavConfig} />
      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-md sm:w-40" />
        </div>

        <section>
          <Skeleton className="mb-3 h-3 w-32" />
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`flex w-full items-center gap-4 px-4 py-3.5 ${
                  i !== 2 ? "border-b border-border/60" : ""
                }`}
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                <Skeleton className="h-4 flex-1 max-w-xs" />
                <Skeleton className="h-4 w-4 shrink-0" />
              </div>
            ))}
          </div>
        </section>

        <section>
          <Skeleton className="mb-3 h-3 w-32" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:min-h-0 sm:gap-3 sm:p-5"
              >
                <Skeleton className="h-12 w-12 rounded-md sm:h-16 sm:w-16" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function formatShortDate(value: string, locale: "en" | "tet" | "pt") {
  const dateLocale =
    locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : "pt-TL";
  return new Intl.DateTimeFormat(dateLocale, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getFilingLabel(item: FilingDueDate, t: Translate) {
  if (item.type === "monthly_wit") {
    return t("moduleDashboards.reports.filings.monthlyWit", {
      period: item.period,
    });
  }
  if (item.type === "annual_wit") {
    return t("moduleDashboards.reports.filings.annualWit", {
      period: item.period,
    });
  }
  if (item.task === "payment") {
    return t("moduleDashboards.reports.filings.inssPayment", {
      period: item.period,
    });
  }
  return t("moduleDashboards.reports.filings.inssStatement", {
    period: item.period,
  });
}

function getDueDescriptor(item: FilingDueDate, t: Translate) {
  if (item.isOverdue) {
    return t("moduleDashboards.reports.filings.overdue", {
      days: Math.abs(item.daysUntilDue),
    });
  }
  if (item.daysUntilDue === 0)
    return t("moduleDashboards.reports.filings.dueToday");
  if (item.daysUntilDue === 1)
    return t("moduleDashboards.reports.filings.dueTomorrow");
  return t("moduleDashboards.reports.filings.daysLeft", {
    days: item.daysUntilDue,
  });
}

const RED = "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300";
const AMBER =
  "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300";
const VIOLET =
  "text-violet-600 bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300";

export default function ReportsDashboard() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { session, hasModule, canManage, showAdvancedTax } = useTenant();
  const hasReports = hasModule("reports");
  const hasPayroll = hasModule("payroll");
  const hasStaff = hasModule("staff");
  const hasTimeleave = hasModule("timeleave");
  const canManageTenant = canManage();
  const ngoReportingEnabled = canUseNgoReporting(session, hasReports);
  const donorExportEnabled = canUseDonorExport(
    session,
    hasReports,
    canManage(),
  );
  const filingQuery = useTaxFilingsDueSoon(3, hasPayroll && canManageTenant);

  if (filingQuery.isLoading) {
    return <ReportsDashboardSkeleton />;
  }

  if (hasPayroll && canManageTenant && filingQuery.data === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={t("moduleDashboards.reports.title")}
          description={t("moduleDashboards.reports.seoDescription")}
        />
        <ModuleSectionNav config={reportsNavConfig} />
        <DashboardLoadError
          isRetrying={filingQuery.isFetching}
          onRetry={() => filingQuery.refetch()}
        />
      </div>
    );
  }

  const filingDueDates = filingQuery.data ?? [];

  const filteredConfig = filterModuleNavConfigByPermissions(
    reportsNavConfig,
    hasModule,
    canManage(),
    canManage() || session?.role === "manager",
    showAdvancedTax,
  );
  const reportFamilies = filteredConfig.sections.flatMap((section) => {
    if (section.id === "payroll-reports" && !hasPayroll) return [];
    if (
      (section.id === "employee-reports" ||
        section.id === "department-reports") &&
      !hasStaff
    )
      return [];
    if (section.id === "attendance-reports" && !hasTimeleave) return [];
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
    ngo: "/images/illustrations/xefe-card-reports.webp",
    custom: "/images/illustrations/xefe-card-reports.webp",
  };
  const familyCards = reportFamilies.map((section) => {
    const outputs =
      section.subPages.length > 0 ? section.subPages : [{ path: section.path }];
    const count = outputs.length;
    return {
      id: section.id,
      title: t(`nav.${section.labelKey}`) || section.label,
      art:
        familyArt[section.id] ?? "/images/illustrations/xefe-card-reports.webp",
      path: outputs[0]?.path ?? section.path,
      description:
        t(`moduleDashboards.reports.families.${section.id}`) ||
        t(
          count === 1
            ? "moduleDashboards.reports.families.fallbackSingle"
            : "moduleDashboards.reports.families.fallbackPlural",
          { count },
        ),
      icon: section.icon,
    };
  });

  const openFilings = filingDueDates
    .filter((item) => item.status !== "filed")
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const overdueCount = openFilings.filter((item) => item.isOverdue).length;
  const dueThisWeek = openFilings.filter(
    (item) => item.daysUntilDue >= 0 && item.daysUntilDue <= 7,
  ).length;

  const compliancePhrase =
    overdueCount > 0
      ? t(
          overdueCount === 1
            ? "moduleDashboards.reports.compliance.filingOverdue"
            : "moduleDashboards.reports.compliance.filingsOverdue",
          { count: overdueCount },
        )
      : dueThisWeek > 0
        ? t(
            dueThisWeek === 1
              ? "moduleDashboards.reports.compliance.filingDueThisWeek"
              : "moduleDashboards.reports.compliance.filingsDueThisWeek",
            { count: dueThisWeek },
          )
        : t("moduleDashboards.reports.compliance.noneDue");

  // Triage: the real actionable signal in Reports is the tax/INSS filing runway
  const attention = openFilings.slice(0, 5).map((item) => ({
    key: `${item.type}-${item.task ?? "default"}-${item.period}`,
    text: t("moduleDashboards.reports.filings.line", {
      label: getFilingLabel(item, t),
      descriptor: getDueDescriptor(item, t),
      date: formatShortDate(item.dueDate, locale),
    }),
    path: "/payroll/tax",
    icon: item.isOverdue ? ShieldAlert : Clock3,
    tone: item.isOverdue ? RED : item.daysUntilDue <= 3 ? AMBER : VIOLET,
  }));

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("moduleDashboards.reports.title")}
        description={t("moduleDashboards.reports.seoDescription")}
      />
      <ModuleSectionNav config={reportsNavConfig} />

      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Header — module icon in the page's accent tile anchors the title
              (same tinted-tile treatment as the hub cards below) */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10">
              <BarChart3 className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t("moduleDashboards.reports.title")}
              </h1>
              <p className="mt-0.5 text-sm text-foreground/70">
                {canManageTenant
                  ? t(
                      familyCards.length === 1
                        ? "moduleDashboards.reports.summarySingle"
                        : "moduleDashboards.reports.summaryPlural",
                      { count: familyCards.length, compliance: compliancePhrase },
                    )
                  : t(
                      familyCards.length === 1
                        ? "moduleDashboards.reports.summaryReadOnlySingle"
                        : "moduleDashboards.reports.summaryReadOnlyPlural",
                      { count: familyCards.length },
                    )}
              </p>
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <Button
              className="w-full sm:w-auto"
              onClick={() => navigate("/reports/custom")}
            >
              <Wrench className="mr-2 h-4 w-4" />
              {t("reports.custom.buildReport")}
            </Button>
          </div>
        </div>

        {/* Filing runway */}
        {hasPayroll && canManageTenant && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("moduleDashboards.reports.filingRunway")}
            </h2>
            {attention.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                {attention.map((item, idx) => (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.path)}
                    className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 ${
                      idx !== attention.length - 1
                        ? "border-b border-border/60"
                        : ""
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
                    >
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm text-foreground/90">
                      {item.text}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {t("moduleDashboards.reports.allGood")}
              </div>
            )}
          </section>
        )}

        {/* Report library */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("moduleDashboards.reports.browseReports")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {familyCards.map((card) => (
              <button
                key={card.id}
                onClick={() => navigate(card.path)}
                className="flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 text-left shadow-sm transition-colors hover:border-violet-400/50 sm:min-h-0 sm:gap-3 sm:p-5"
              >
                {hasCardIcon(cardIconNameFromArt(card.art)) ? (
                  <CardIcon
                    name={cardIconNameFromArt(card.art)!}
                    className="h-12 w-12 text-foreground [--card-icon-accent:#7c3aed] dark:[--card-icon-accent:#a78bfa] sm:h-16 sm:w-16"
                  />
                ) : (
                  <img
                    src={card.art}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-12 w-12 object-contain sm:h-16 sm:w-16"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold sm:text-base">
                    {card.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                    {card.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
