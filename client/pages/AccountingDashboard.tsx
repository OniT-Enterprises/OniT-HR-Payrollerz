import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO, seoConfig } from "@/components/SEO";
import { accountingNavConfig } from "@/lib/moduleNav";
import { useAccountingBalanceHealth, useAccountingDashboard } from "@/hooks/useAccounting";
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
  const { data: dashboardData, isLoading: summaryLoading } = useAccountingDashboard();
  const { data: balanceHealth, isLoading: balanceLoading } = useAccountingBalanceHealth();

  if (summaryLoading || balanceLoading || !dashboardData || !balanceHealth) {
    return <AccountingDashboardSkeleton />;
  }

  const lastPayrollDate = dashboardData.lastPayrollDate
    ? formatDateTL(new Date(dashboardData.lastPayrollDate), { year: "numeric", month: "short", day: "numeric" })
    : null;

  // Triage: confidence gaps standing between now and a clean close
  const attention = [
    {
      show: dashboardData.pendingEntries > 0,
      text: `${dashboardData.pendingEntries} draft journal entr${dashboardData.pendingEntries === 1 ? "y" : "ies"} to review`,
      path: "/accounting/journal",
      art: "/images/illustrations/xefe-card-ac-journal.webp",
      icon: FileSpreadsheet,
      tone: AMBER,
    },
    {
      show: !balanceHealth.trialBalanced,
      text: "Trial balance is out of balance",
      path: "/accounting/statements/trial-balance",
      art: "/images/illustrations/xefe-card-accounting.webp",
      icon: Scale,
      tone: RED,
    },
    {
      show: !dashboardData.payrollPosted,
      text: "Latest payroll is not yet posted to the ledger",
      path: "/accounting/journal?filter=payroll",
      icon: Landmark,
      tone: AMBER,
    },
  ].filter((item) => item.show);

  const hubCards = [
    {
      title: "Chart of Accounts",
      meta: "Ledger structure",
      path: "/accounting/chart",
      art: "/images/illustrations/xefe-card-ac-chart.webp",
      icon: BookOpen,
    },
    {
      title: "Journal Entries",
      meta: `${dashboardData.pendingEntries} pending`,
      path: "/accounting/journal",
      icon: FileSpreadsheet,
    },
    {
      title: "Trial Balance",
      meta: balanceHealth.trialBalanced ? "Balanced" : "Out of balance",
      path: "/accounting/statements/trial-balance",
      icon: Scale,
    },
    {
      title: "Balance Sheet",
      meta: dashboardData.payrollPosted ? "Live" : "Pending payroll",
      path: "/accounting/statements/balance-sheet",
      art: "/images/illustrations/xefe-card-ac-balance.webp",
      icon: Building2,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.accounting} />
      <ModuleSectionNav config={accountingNavConfig} />

      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {dashboardData.payrollPosted && lastPayrollDate
                ? `Last payroll posted ${lastPayrollDate} · ${formatCurrencyTL(dashboardData.lastPayrollAmount)}.`
                : "Latest payroll has not yet posted to the ledger."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/accounting/journal?action=new")}>
              <FilePlus className="mr-2 h-4 w-4" />
              New entry
            </Button>
            <Button
              className="bg-orange-600 text-white hover:bg-orange-700"
              onClick={() => navigate("/accounting/journal?filter=payroll")}
            >
              <Eye className="mr-2 h-4 w-4" />
              Review payroll journals
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
              <CheckCircle2 className="h-5 w-5 text-orange-600" />
              The books are balanced and payroll has posted — nothing needs attention.
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
