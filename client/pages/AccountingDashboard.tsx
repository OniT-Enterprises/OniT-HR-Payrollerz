import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardIcon, hasCardIcon, cardIconNameFromArt } from "@/components/ui/CardIcon";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { accountingNavConfig } from "@/lib/moduleNav";
import { useAccountingBalanceHealth, useAccountingDashboard } from "@/hooks/useAccounting";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { formatDateTL } from "@/lib/dateUtils";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  FilePlus,
  FileSpreadsheet,
  Landmark,
  Scale,
} from "lucide-react";

function AccountingDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={accountingNavConfig} />
      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-32 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </div>

        {/* Needs attention */}
        <section>
          <Skeleton className="mb-3 h-3 w-32" />
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-4 px-4 py-3.5 ${
                  idx !== 2 ? "border-b border-border/60" : ""
                }`}
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                <Skeleton className="h-4 flex-1" style={{ maxWidth: `${70 - idx * 10}%` }} />
              </div>
            ))}
          </div>
        </section>

        {/* Module hub */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:p-5"
            >
              <Skeleton className="h-12 w-12 rounded-lg sm:h-16 sm:w-16" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

const RED = "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300";
const AMBER = "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300";

export default function AccountingDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { hasModule, canManage } = useTenant();
  const canManageTenant = canManage();
  const hasPayroll = hasModule("payroll");
  const summaryQuery = useAccountingDashboard();
  const balanceQuery = useAccountingBalanceHealth();
  const dashboardQueries = [summaryQuery, balanceQuery];

  if (dashboardQueries.some((query) => query.isLoading)) {
    return <AccountingDashboardSkeleton />;
  }

  if (dashboardQueries.some((query) => query.data === undefined)) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={t("moduleDashboards.accounting.title")}
          description={t("moduleDashboards.accounting.seoDescription")}
        />
        <ModuleSectionNav config={accountingNavConfig} />
        <DashboardLoadError
          isRetrying={dashboardQueries.some((query) => query.isFetching)}
          onRetry={() => Promise.all(dashboardQueries.map((query) => query.refetch()))}
        />
      </div>
    );
  }

  const dashboardData = summaryQuery.data!;
  const balanceHealth = balanceQuery.data!;

  const lastPayrollDate = dashboardData.lastPayrollDate
    ? formatDateTL(new Date(dashboardData.lastPayrollDate), { year: "numeric", month: "short", day: "numeric" })
    : null;

  // Triage: confidence gaps standing between now and a clean close
  const attention = [
    {
      show: !balanceHealth.trialBalanced,
      text: t("moduleDashboards.accounting.attention.trialBalance"),
      path: "/accounting/statements/trial-balance",
      icon: Scale,
      tone: RED,
    },
    {
      show: dashboardData.pendingEntries > 0,
      text: t(
        dashboardData.pendingEntries === 1
          ? "moduleDashboards.accounting.attention.draftEntry"
          : "moduleDashboards.accounting.attention.draftEntries",
        { count: dashboardData.pendingEntries },
      ),
      path: "/accounting/journal",
      icon: FileSpreadsheet,
      tone: AMBER,
    },
    {
      show: hasPayroll && !dashboardData.payrollPosted,
      text: t("moduleDashboards.accounting.attention.payrollNotPosted"),
      path: "/accounting/journal?filter=payroll",
      icon: Landmark,
      tone: AMBER,
    },
  ].filter((item) => item.show);

  const hubCards = [
    {
      title: t("moduleDashboards.accounting.cards.chartOfAccounts"),
      art: "/images/illustrations/xefe-card-ac-chart.webp",
      meta: t("moduleDashboards.accounting.cards.ledgerStructure"),
      path: "/accounting/chart",
      icon: BookOpen,
    },
    {
      title: t("moduleDashboards.accounting.cards.journalEntries"),
      art: "/images/illustrations/xefe-card-ac-journal.webp",
      meta: t("moduleDashboards.accounting.cards.pending", {
        count: dashboardData.pendingEntries,
      }),
      path: "/accounting/journal",
      icon: FileSpreadsheet,
    },
    {
      title: t("moduleDashboards.accounting.cards.trialBalance"),
      art: "/images/illustrations/xefe-card-accounting.webp",
      meta: balanceHealth.trialBalanced
        ? t("moduleDashboards.accounting.cards.balanced")
        : t("moduleDashboards.accounting.cards.outOfBalance"),
      path: "/accounting/statements/trial-balance",
      icon: Scale,
    },
    {
      title: t("moduleDashboards.accounting.cards.balanceSheet"),
      art: "/images/illustrations/xefe-card-ac-balance.webp",
      meta: hasPayroll
        ? dashboardData.payrollPosted
          ? t("moduleDashboards.accounting.cards.live")
          : t("moduleDashboards.accounting.cards.pendingPayroll")
        : t("moduleDashboards.accounting.cards.financialPosition"),
      path: "/accounting/statements/balance-sheet",
      icon: Building2,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("moduleDashboards.accounting.title")}
        description={t("moduleDashboards.accounting.seoDescription")}
      />
      <ModuleSectionNav config={accountingNavConfig} />

      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("moduleDashboards.accounting.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasPayroll
                ? dashboardData.payrollPosted && lastPayrollDate
                  ? t("moduleDashboards.accounting.summaryPosted", {
                      date: lastPayrollDate,
                      amount: formatCurrencyTL(dashboardData.lastPayrollAmount),
                    })
                  : t("moduleDashboards.accounting.summaryNotPosted")
                : t("moduleDashboards.accounting.summaryNoPayroll")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageTenant && (
              <Button variant="outline" onClick={() => navigate("/accounting/journal?action=new")}>
                <FilePlus className="mr-2 h-4 w-4" />
                {t("moduleDashboards.accounting.newEntry")}
              </Button>
            )}
            {hasPayroll && (
              <Button onClick={() => navigate("/accounting/journal?filter=payroll")}>
                <Eye className="mr-2 h-4 w-4" />
                {t("moduleDashboards.accounting.reviewPayroll")}
              </Button>
            )}
          </div>
        </div>

        {/* Needs attention */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("moduleDashboards.common.needsAttention")}
          </h2>
          {attention.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              {attention.map((item, idx) => (
                <button
                  key={item.text}
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
              <CheckCircle2 className="h-5 w-5 text-orange-600" />
              {hasPayroll
                ? t("moduleDashboards.accounting.allGoodWithPayroll")
                : t("moduleDashboards.accounting.allGood")}
            </div>
          )}
        </section>

        {/* Module hub */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {hubCards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="group flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-orange-400/40 sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:p-5"
            >
              {hasCardIcon(cardIconNameFromArt(card.art)) ? (
                <CardIcon
                  name={cardIconNameFromArt(card.art)!}
                  className="h-12 w-12 text-foreground [--card-icon-accent:#ea580c] dark:[--card-icon-accent:#fb923c] sm:h-16 sm:w-16"
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
                <p className="text-sm font-semibold sm:text-base">{card.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{card.meta}</p>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
