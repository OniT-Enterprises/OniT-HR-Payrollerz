import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardIcon, hasCardIcon, cardIconNameFromArt } from "@/components/ui/CardIcon";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { moneyNavConfig } from "@/lib/moduleNav";
import { useInvoiceStats } from "@/hooks/useInvoices";
import { usePayablesSummary } from "@/hooks/useBills";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenant } from "@/contexts/TenantContext";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";

function MoneyDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={moneyNavConfig} />
      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </div>

        {/* Needs attention */}
        <section>
          <Skeleton className="mb-3 h-3 w-32" />
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-4 px-4 py-3.5 ${
                  idx !== 2 ? "border-b border-border/70" : ""
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
              className="flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:p-5"
            >
              <Skeleton className="h-12 w-12 rounded-lg sm:h-16 sm:w-16" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function formatCurrency(amount: number, locale: "en" | "tet" | "pt") {
  const numberLocale = locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : "pt-TL";
  return new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const RED = "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300";
const AMBER = "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300";
const INDIGO = "text-indigo-600 bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300";

export default function MoneyDashboard() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { canManage, session } = useTenant();
  const canManageTenant = canManage();
  const canManageExpenses = canManageTenant || session?.role === "manager";
  const formatMoney = (amount: number) => formatCurrency(amount, locale);
  const invoiceStatsQuery = useInvoiceStats();
  const payablesQuery = usePayablesSummary();
  const dashboardQueries = [invoiceStatsQuery, payablesQuery];

  if (dashboardQueries.some((query) => query.isLoading)) {
    return <MoneyDashboardSkeleton />;
  }

  if (dashboardQueries.some((query) => query.data === undefined)) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={t("moduleDashboards.money.title")}
          description={t("moduleDashboards.money.seoDescription")}
        />
        <ModuleSectionNav config={moneyNavConfig} />
        <DashboardLoadError
          isRetrying={dashboardQueries.some((query) => query.isFetching)}
          onRetry={() => Promise.all(dashboardQueries.map((query) => query.refetch()))}
        />
      </div>
    );
  }

  const stats = invoiceStatsQuery.data!;
  const payablesSummary = payablesQuery.data!;

  // Triage: collection + payment pressure that needs a decision
  const attention = [
    {
      show: stats.invoicesOverdue > 0,
      text: t(
        stats.invoicesOverdue === 1
          ? "moduleDashboards.money.attention.overdueInvoice"
          : "moduleDashboards.money.attention.overdueInvoices",
        {
          count: stats.invoicesOverdue,
          amount: formatMoney(stats.overdueAmount),
        },
      ),
      path: "/money/invoices?status=overdue",
      icon: AlertTriangle,
      tone: RED,
    },
    {
      show: payablesSummary.overdueCount > 0,
      text: t(
        payablesSummary.overdueCount === 1
          ? "moduleDashboards.money.attention.overdueBill"
          : "moduleDashboards.money.attention.overdueBills",
        {
          count: payablesSummary.overdueCount,
          amount: formatMoney(payablesSummary.overdue),
        },
      ),
      path: "/money/bills?status=overdue",
      icon: Receipt,
      tone: RED,
    },
    {
      show: payablesSummary.dueThisWeekCount > 0,
      text: t(
        payablesSummary.dueThisWeekCount === 1
          ? "moduleDashboards.money.attention.billDueThisWeek"
          : "moduleDashboards.money.attention.billsDueThisWeek",
        {
          count: payablesSummary.dueThisWeekCount,
          amount: formatMoney(payablesSummary.dueThisWeek),
        },
      ),
      path: "/money/bills",
      icon: Clock3,
      tone: AMBER,
    },
    {
      show: stats.invoicesDraft > 0,
      text: t(
        stats.invoicesDraft === 1
          ? "moduleDashboards.money.attention.draftInvoice"
          : "moduleDashboards.money.attention.draftInvoices",
        { count: stats.invoicesDraft },
      ),
      path: "/money/invoices?status=draft",
      icon: FileText,
      tone: INDIGO,
    },
  ].filter((item) => item.show);

  const hubCards = [
    {
      title: t("moduleDashboards.money.cards.invoices"),
      art: "/images/illustrations/xefe-card-money.webp",
      meta: t("moduleDashboards.money.cards.outstanding", {
        amount: formatMoney(stats.totalOutstanding),
      }),
      path: "/money/invoices",
      icon: FileText,
    },
    {
      title: t("moduleDashboards.money.cards.bills"),
      art: "/images/illustrations/xefe-card-mn-bills.webp",
      meta:
        payablesSummary.overdueCount > 0
          ? t("moduleDashboards.money.cards.overdue", {
              count: payablesSummary.overdueCount,
            })
          : t("moduleDashboards.money.cards.dueThisWeek", {
              amount: formatMoney(payablesSummary.dueThisWeek),
            }),
      path: "/money/bills",
      icon: Receipt,
    },
    ...(canManageExpenses ? [{
      title: t("moduleDashboards.money.cards.expenses"),
      art: "/images/illustrations/xefe-card-mn-expenses.webp",
      meta: t("moduleDashboards.money.cards.expensesMeta"),
      path: "/money/expenses",
      icon: Wallet,
    }] : []),
    {
      title: t("moduleDashboards.money.cards.financialReports"),
      art: "/images/illustrations/xefe-card-reports.webp",
      meta: t("moduleDashboards.money.cards.financialReportsMeta"),
      path: canManageExpenses
        ? "/money/financials/profit-loss"
        : "/money/financials/ar-aging",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("moduleDashboards.money.title")}
        description={t("moduleDashboards.money.seoDescription")}
      />
      <ModuleSectionNav config={moneyNavConfig} />

      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("moduleDashboards.money.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("moduleDashboards.money.summary", {
                collected: formatMoney(stats.revenueThisMonth),
                outstanding: formatMoney(stats.totalOutstanding),
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/money/bills")}>
              {t("moduleDashboards.money.viewBills")}
            </Button>
            {canManageTenant && (
              <Button onClick={() => navigate("/money/invoices/new")}>
                <Plus className="mr-2 h-4 w-4" />
                {t("moduleDashboards.money.newInvoice")}
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
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              {attention.map((item, idx) => (
                <button
                  key={item.text}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 ${
                    idx !== attention.length - 1 ? "border-b border-border/70" : ""
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
            <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-5 text-sm text-foreground/75 shadow-sm dark:bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {t("moduleDashboards.money.allGood")}
            </div>
          )}
        </section>

        {/* Module hub */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {hubCards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="group flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:border-indigo-400/40 dark:hover:bg-indigo-950/20 sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:p-5"
            >
              {hasCardIcon(cardIconNameFromArt(card.art)) ? (
                <CardIcon
                  name={cardIconNameFromArt(card.art)!}
                  className="h-12 w-12 text-foreground [--card-icon-accent:#4f46e5] dark:[--card-icon-accent:#818cf8] sm:h-16 sm:w-16"
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
