import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
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

      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
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
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hubCards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-orange-400/40"
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
                <p className="mt-0.5 text-sm text-muted-foreground">{card.meta}</p>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
