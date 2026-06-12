import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { moneyNavConfig } from "@/lib/moduleNav";
import { useInvoiceStats } from "@/hooks/useInvoices";
import { usePayablesSummary } from "@/hooks/useBills";
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
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
  const { data: stats, isLoading: statsLoading } = useInvoiceStats();
  const { data: payablesSummary, isLoading: payablesLoading } = usePayablesSummary();

  if (statsLoading || payablesLoading || !stats || !payablesSummary) {
    return <MoneyDashboardSkeleton />;
  }

  // Triage: collection + payment pressure that needs a decision
  const attention = [
    {
      show: stats.invoicesDraft > 0,
      text: `Send ${stats.invoicesDraft} draft invoice${stats.invoicesDraft === 1 ? "" : "s"}`,
      path: "/money/invoices?status=draft",
      icon: FileText,
      tone: INDIGO,
    },
    {
      show: stats.invoicesOverdue > 0,
      text: `Follow up ${stats.invoicesOverdue} overdue invoice${stats.invoicesOverdue === 1 ? "" : "s"} — ${formatCurrency(stats.overdueAmount)} late`,
      path: "/money/invoices?status=overdue",
      icon: AlertTriangle,
      tone: RED,
    },
    {
      show: payablesSummary.overdueCount > 0,
      text: `Pay ${payablesSummary.overdueCount} overdue bill${payablesSummary.overdueCount === 1 ? "" : "s"} — ${formatCurrency(payablesSummary.overdue)}`,
      path: "/money/bills?status=overdue",
      icon: Receipt,
      tone: RED,
    },
    {
      show: payablesSummary.dueThisWeekCount > 0,
      text: `${payablesSummary.dueThisWeekCount} bill${payablesSummary.dueThisWeekCount === 1 ? "" : "s"} due this week — ${formatCurrency(payablesSummary.dueThisWeek)}`,
      path: "/money/bills",
      icon: Clock3,
      tone: AMBER,
    },
  ].filter((item) => item.show);

  const hubCards = [
    {
      title: "Invoices",
      art: "/images/illustrations/xefe-card-money.webp",
      meta: `${formatCurrency(stats.totalOutstanding)} outstanding`,
      path: "/money/invoices",
      icon: FileText,
    },
    {
      title: "Bills",
      art: "/images/illustrations/xefe-card-mn-bills.webp",
      meta:
        payablesSummary.overdueCount > 0
          ? `${payablesSummary.overdueCount} overdue`
          : `${formatCurrency(payablesSummary.dueThisWeek)} due this week`,
      path: "/money/bills",
      icon: Receipt,
    },
    {
      title: "Expenses",
      art: "/images/illustrations/xefe-card-mn-expenses.webp",
      meta: "Track spending",
      path: "/money/expenses",
      icon: Wallet,
    },
    {
      title: "Financial Reports",
      art: "/images/illustrations/xefe-card-reports.webp",
      meta: "P&L · cashflow · VAT",
      path: "/money/financials/profit-loss",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Money" description="Invoices, bills, expenses, and financial reports in one place." />
      <ModuleSectionNav config={moneyNavConfig} />

      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Money</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCurrency(stats.revenueThisMonth)} collected this month ·{" "}
              {formatCurrency(stats.totalOutstanding)} outstanding.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/money/bills")}>
              View bills
            </Button>
            <Button
              onClick={() => navigate("/money/invoices/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New invoice
            </Button>
          </div>
        </div>

        {/* Needs attention */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Needs your attention
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
              <CheckCircle2 className="h-5 w-5 text-indigo-600" />
              Cash flow looks calm — no overdue items or bills due this week.
            </div>
          )}
        </section>

        {/* Module hub */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hubCards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-400/40"
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
