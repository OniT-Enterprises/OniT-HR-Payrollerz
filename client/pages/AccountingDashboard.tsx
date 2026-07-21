import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HubCard } from "@/components/dashboard/HubCard";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { accountingNavConfig } from "@/lib/moduleNav";
import { useAccountingBalanceHealth, useAccountingDashboard } from "@/hooks/useAccounting";
import { useTaxFilingByPeriod } from "@/hooks/useTaxFiling";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { formatDateTL, getTodayTL, parseDateISO } from "@/lib/dateUtils";
import { getDaysUntilDueIso } from "@/lib/tax/compliance";
import { formCDueDate } from "@/lib/tax/form-c";
import {
  BookOpen,
  Building2,
  CalendarClock,
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
  const today = getTodayTL();
  const previousTaxYear = Number(today.slice(0, 4)) - 1;
  const annualIncomeTaxQuery = useTaxFilingByPeriod(
    "annual_income_tax",
    String(previousTaxYear),
    canManageTenant,
  );
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
  const annualIncomeTaxDueDate = formCDueDate(previousTaxYear);
  const annualIncomeTaxDays = getDaysUntilDueIso(today, annualIncomeTaxDueDate);
  const annualIncomeTaxNeedsAttention = canManageTenant
    && annualIncomeTaxQuery.isSuccess
    && annualIncomeTaxQuery.data?.status !== "filed"
    && annualIncomeTaxDays <= 60;

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
      show: annualIncomeTaxNeedsAttention,
      text: t("moduleDashboards.accounting.attention.annualIncomeTax", {
        year: previousTaxYear,
        date: formatDateTL(parseDateISO(annualIncomeTaxDueDate), {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      }),
      path: "/accounting/tax/annual-income-tax",
      icon: CalendarClock,
      tone: annualIncomeTaxDays < 0 ? RED : AMBER,
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
      purpose: t("moduleDashboards.accounting.cards.chartOfAccountsPurpose"),
      action: t("moduleDashboards.accounting.cards.chartOfAccountsAction"),
      path: "/accounting/chart",
      icon: BookOpen,
    },
    {
      title: t("moduleDashboards.accounting.cards.journalEntries"),
      purpose: t("moduleDashboards.accounting.cards.journalEntriesPurpose"),
      action: t("moduleDashboards.accounting.cards.journalEntriesAction"),
      path: "/accounting/journal",
      icon: FileSpreadsheet,
    },
    {
      title: t("moduleDashboards.accounting.cards.trialBalance"),
      purpose: t("moduleDashboards.accounting.cards.trialBalancePurpose"),
      action: t("moduleDashboards.accounting.cards.trialBalanceAction"),
      path: "/accounting/statements/trial-balance",
      icon: Scale,
    },
    {
      title: t("moduleDashboards.accounting.cards.balanceSheet"),
      purpose: t("moduleDashboards.accounting.cards.balanceSheetPurpose"),
      action: t("moduleDashboards.accounting.cards.balanceSheetAction"),
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
        <PageHeader
          size="lg"
          title={t("moduleDashboards.accounting.title")}
          icon={Landmark}
          iconColor="text-orange-500"
          subtitle={
            hasPayroll
              ? dashboardData.payrollPosted && lastPayrollDate
                ? t("moduleDashboards.accounting.summaryPosted", {
                    date: lastPayrollDate,
                    amount: formatCurrencyTL(dashboardData.lastPayrollAmount),
                  })
                : t("moduleDashboards.accounting.summaryNotPosted")
              : t("moduleDashboards.accounting.summaryNoPayroll")
          }
          actions={
            <>
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
            </>
          }
        />

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
            <HubCard
              key={card.path}
              icon={card.icon}
              title={card.title}
              purpose={card.purpose}
              action={card.action}
              accent="orange"
              onClick={() => navigate(card.path)}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
