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
import { moneyNavConfig } from "@/lib/moduleNav";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";
import { ModuleBrief } from "@/components/dashboard/ModuleBrief";
import { useInvoiceStats, useInvoiceTopCustomers } from "@/hooks/useInvoices";
import { usePayablesSummary } from "@/hooks/useBills";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  CircleCheck,
  Clock3,
  FileText,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";

function MoneyDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <ModuleSectionNav config={moneyNavConfig} />
      <div className="mx-auto max-w-screen-2xl px-6 py-6 space-y-6">
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function CashPressureSummary({
  overdueAmount,
  outstandingAmount,
  collectedThisMonth,
}: {
  overdueAmount: number;
  outstandingAmount: number;
  collectedThisMonth: number;
}) {
  const ratio = outstandingAmount > 0 ? Math.min(100, Math.round((overdueAmount / outstandingAmount) * 100)) : 0;
  const healthy = outstandingAmount - overdueAmount;
  const toneClass = ratio >= 45 ? "text-red-600" : ratio >= 20 ? "text-amber-600" : "text-indigo-600";
  const barTone = ratio >= 45 ? "bg-red-500" : ratio >= 20 ? "bg-amber-500" : "bg-indigo-500";

  const rows = [
    { label: "Collected this month", value: formatCurrency(collectedThisMonth), tone: "text-emerald-600" },
    { label: "Outstanding", value: formatCurrency(outstandingAmount), tone: "text-indigo-600" },
    { label: "Overdue", value: formatCurrency(overdueAmount), tone: toneClass },
  ];

  return (
    <div className="flex h-full flex-col">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Overdue pressure
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={`text-4xl font-bold tracking-tight ${toneClass}`}>{ratio}%</p>
        <p className="text-sm text-muted-foreground">of outstanding is overdue</p>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barTone}`} style={{ width: `${ratio}%` }} />
      </div>

      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span className={`text-sm font-semibold tabular-nums ${row.tone}`}>{row.value}</span>
          </div>
        ))}
      </div>

      {healthy > 0 ? (
        <p className="mt-auto pt-4 text-xs text-muted-foreground">
          {formatCurrency(healthy)} still on a normal aging runway.
        </p>
      ) : null}
    </div>
  );
}

export default function MoneyDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useInvoiceStats();
  const { data: topCustomers = [], isLoading: topCustomersLoading } = useInvoiceTopCustomers(6);
  const { data: payablesSummary, isLoading: payablesLoading } = usePayablesSummary();

  if (statsLoading || payablesLoading || topCustomersLoading || !stats || !payablesSummary) {
    return <MoneyDashboardSkeleton />;
  }

  const actionItems = [
    ...(stats.invoicesDraft > 0
      ? [
          {
            title: `Send ${stats.invoicesDraft} draft invoice${stats.invoicesDraft === 1 ? "" : "s"}`,
            description: "Drafts are ready to leave the system and become receivables.",
            path: "/money/invoices?status=draft",
            icon: FileText,
          },
        ]
      : []),
    ...(stats.invoicesOverdue > 0
      ? [
          {
            title: `Follow up ${stats.invoicesOverdue} overdue invoice${stats.invoicesOverdue === 1 ? "" : "s"}`,
            description: `${formatCurrency(stats.overdueAmount)} is already late.`,
            path: "/money/invoices?status=overdue",
            icon: AlertTriangle,
          },
        ]
      : []),
    ...(payablesSummary.overdueCount > 0
      ? [
          {
            title: `Pay ${payablesSummary.overdueCount} overdue bill${payablesSummary.overdueCount === 1 ? "" : "s"}`,
            description: `${formatCurrency(payablesSummary.overdue)} is already outside its due date.`,
            path: "/money/bills?status=overdue",
            icon: Receipt,
          },
        ]
      : []),
    ...(payablesSummary.dueThisWeekCount > 0
      ? [
          {
            title: `Review ${payablesSummary.dueThisWeekCount} bill${payablesSummary.dueThisWeekCount === 1 ? "" : "s"} due this week`,
            description: `${formatCurrency(payablesSummary.dueThisWeek)} is scheduled to leave the business soon.`,
            path: "/money/bills",
            icon: Clock3,
          },
        ]
      : []),
  ];

  const cashMap = [
    { name: "Collected", value: stats.revenueThisMonth, tone: "#22c55e" },
    { name: "Outstanding", value: stats.totalOutstanding, tone: "#6366f1" },
    { name: "Overdue", value: stats.overdueAmount, tone: "#ef4444" },
    { name: "Bills this week", value: payablesSummary.dueThisWeek, tone: "#f59e0b" },
    { name: "Bills later", value: payablesSummary.dueLater, tone: "#0ea5e9" },
  ];

  const customerExposure = topCustomers.map((customer) => ({
    name: customer.name.length > 14 ? `${customer.name.slice(0, 14)}…` : customer.name,
    outstanding: customer.outstanding,
    invoices: customer.invoiceCount,
    oldest: customer.oldestInvoiceDays,
  }));

  const briefLead =
    stats.invoicesOverdue > 0 || payablesSummary.overdueCount > 0
      ? `The money module is carrying real collection and payment pressure, with overdue items on both the receivable and payable side.`
      : `The money module is stable right now, with most of the focus shifting to cash timing, invoice release, and keeping the next week smooth.`;

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Money Dashboard" description="Cash movement, receivables, payables, and operational finance in one place." />
      <MainNavigation />
      <ModuleSectionNav config={moneyNavConfig} />

      <DashboardShell
        section="money"
        title="Cash pulse and collections"
        subtitle="A wide-angle view of what is coming in, what is going out, where pressure is building, and which customers or bills deserve attention next."
        icon={Wallet}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/money/bills")}>
              View bills
            </Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => navigate("/money/invoices/new")}>
              <Plus className="mr-2 h-4 w-4" />
              New invoice
            </Button>
          </>
        }
        badges={
          <>
            <Badge variant="secondary">{formatCurrency(stats.revenueThisMonth)} collected this month</Badge>
            <Badge variant="secondary">{formatCurrency(stats.totalOutstanding)} outstanding</Badge>
          </>
        }
        main={
          <>
            <DashboardPanel
              eyebrow="Signature view"
              title="Cash pressure map"
              actions={
                actionItems.length > 0 ? (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {actionItems.length} active pressure point{actionItems.length === 1 ? "" : "s"}
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Calm cycle
                  </Badge>
                )
              }
            >
              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
                  <CashPressureSummary
                    overdueAmount={stats.overdueAmount}
                    outstandingAmount={stats.totalOutstanding}
                    collectedThisMonth={stats.revenueThisMonth}
                  />
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Cash inflow vs outflow
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Inflow and outflow tension across the system.
                    </p>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cashMap} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.35)" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => formatCurrency(Number(value ?? 0))}
                          contentStyle={{ borderRadius: 16, borderColor: "hsl(var(--border))" }}
                        />
                        <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                          {cashMap.map((entry) => (
                            <Cell key={entry.name} fill={entry.tone} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="Collections focus" title="Who still owes you">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="h-80 rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customerExposure} layout="vertical" margin={{ top: 8, right: 20, left: 10, bottom: 8 }}>
                      <CartesianGrid horizontal={false} stroke="hsl(var(--border) / 0.35)" />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value, name) =>
                          name === "outstanding" ? formatCurrency(Number(value ?? 0)) : `${value ?? 0}`
                        }
                        contentStyle={{ borderRadius: 16, borderColor: "hsl(var(--border))" }}
                      />
                      <Bar dataKey="outstanding" radius={[12, 12, 12, 12]} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {topCustomers.length > 0 ? (
                    topCustomers.map((customer) => (
                      <div key={customer.id} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{customer.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {customer.invoiceCount} open invoice{customer.invoiceCount === 1 ? "" : "s"} with the oldest one at {customer.oldestInvoiceDays} days.
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold">{formatCurrency(customer.outstanding)}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Outstanding</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-border/60 bg-emerald-50/80 p-5 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                      Collections are clean right now. No major customer exposure is building in open invoices.
                    </div>
                  )}
                </div>
              </div>
            </DashboardPanel>
          </>
        }
        rail={
          <>
            <DashboardMetricCard
              label="Money owed to you"
              value={formatCurrency(stats.totalOutstanding)}
              hint={`${stats.invoicesSent} unpaid invoice${stats.invoicesSent === 1 ? "" : "s"} currently open`}
              icon={ArrowDownLeft}
              toneClass="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
              onClick={() => navigate("/money/invoices")}
            />
            <DashboardMetricCard
              label="Overdue receivables"
              value={formatCurrency(stats.overdueAmount)}
              hint={`${stats.invoicesOverdue} invoice${stats.invoicesOverdue === 1 ? "" : "s"} already past due`}
              icon={AlertTriangle}
              toneClass="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              onClick={() => navigate("/money/invoices?status=overdue")}
            />
            <DashboardMetricCard
              label="Bills due this week"
              value={formatCurrency(payablesSummary.dueThisWeek)}
              hint={`${payablesSummary.dueThisWeekCount} bill${payablesSummary.dueThisWeekCount === 1 ? "" : "s"} scheduled soon`}
              icon={ArrowUpRight}
              toneClass="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
              onClick={() => navigate("/money/bills")}
            />

            <DashboardPanel eyebrow="Action rail" title="Immediate finance moves">
              <div className="space-y-3">
                {(actionItems.length > 0
                  ? actionItems
                  : [
                      {
                        title: "Release a new invoice",
                        description: "The board is quiet, so use the moment to push fresh revenue out.",
                        path: "/money/invoices/new",
                        icon: Plus,
                      },
                      {
                        title: "Review cash reports",
                        description: "Open the financial reports stack and check the latest movement.",
                        path: "/money/financials/cashflow",
                        icon: BadgeDollarSign,
                      },
                    ]
                ).map((action) => (
                  <button
                    key={action.title}
                    onClick={() => navigate(action.path)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-background"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="Signals" title="Commercial watchlist">
              <div className="space-y-3">
                {[
                  {
                    label:
                      stats.revenueThisMonth >= stats.revenuePreviousMonth
                        ? "Collections are pacing ahead of last month."
                        : "Collections are trailing the previous month.",
                    hint: `${formatCurrency(stats.revenueThisMonth)} received this month versus ${formatCurrency(stats.revenuePreviousMonth)} last month.`,
                    good: stats.revenueThisMonth >= stats.revenuePreviousMonth,
                  },
                  {
                    label:
                      payablesSummary.overdueCount > 0
                        ? "Supplier pressure is building."
                        : "Supplier payments are under control.",
                    hint:
                      payablesSummary.overdueCount > 0
                        ? `${payablesSummary.overdueCount} overdue bill${payablesSummary.overdueCount === 1 ? "" : "s"} need attention now.`
                        : "No overdue bills are currently detected.",
                    good: payablesSummary.overdueCount === 0,
                  },
                  {
                    label:
                      stats.invoicesDraft > 0
                        ? "Revenue is waiting inside draft invoices."
                        : "Draft backlog is not slowing invoice flow.",
                    hint:
                      stats.invoicesDraft > 0
                        ? `${stats.invoicesDraft} draft invoice${stats.invoicesDraft === 1 ? "" : "s"} are ready to send.`
                        : "Draft volume is low right now.",
                    good: stats.invoicesDraft === 0,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <div className="flex gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          item.good
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                        }`}
                      >
                        {item.good ? <CircleCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          </>
        }
        brief={
          <ModuleBrief
            section="money"
            lead={briefLead}
            columns={[
              {
                title: "What’s happening now",
                items: [
                  `${formatCurrency(stats.totalOutstanding)} is still sitting in open receivables.`,
                  `${formatCurrency(payablesSummary.dueThisWeek + payablesSummary.overdue)} is either overdue or landing within the next week on the payables side.`,
                ],
              },
              {
                title: "Watch this week",
                items: [
                  stats.invoicesOverdue > 0
                    ? `Overdue invoices are now a visible drag on cash confidence.`
                    : `Receivables are aging normally, with no serious overdue spike.`,
                  payablesSummary.dueThisWeekCount > 0
                    ? `Bills due this week should be sequenced against collection timing.`
                    : `Short-term payable pressure is light right now.`,
                ],
              },
              {
                title: "Actions required",
                items: [
                  stats.invoicesDraft > 0
                    ? `Convert drafts into live invoices so revenue can start moving.`
                    : `Invoice release discipline is currently good.`,
                  payablesSummary.overdueCount > 0
                    ? `Clear overdue supplier balances before they start affecting relationships.`
                    : `No urgent supplier cleanup is forcing action.`,
                ],
              },
              {
                title: "Week ahead",
                items: [
                  `Use the next few days to pull forward collections from the highest-exposure customers.`,
                  `Match bill timing to expected cash arrival rather than paying everything blindly on due date alone.`,
                ],
              },
              {
                title: "Interesting signals",
                items: [
                  `This month has collected ${formatCurrency(stats.revenueThisMonth)} compared with ${formatCurrency(stats.revenuePreviousMonth)} last month.`,
                  topCustomers.length > 0
                    ? `${topCustomers[0].name} is currently the single biggest customer exposure in the ledger.`
                    : `Customer exposure is well spread with no single obvious concentration risk.`,
                ],
              },
            ]}
          />
        }
      />
    </div>
  );
}
