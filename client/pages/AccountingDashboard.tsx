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
import GuidancePanel from "@/components/GuidancePanel";
import { SEO, seoConfig } from "@/components/SEO";
import { accountingNavConfig } from "@/lib/moduleNav";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";
import { ModuleBrief } from "@/components/dashboard/ModuleBrief";
import { useAccountingBalanceHealth, useAccountingDashboard } from "@/hooks/useAccounting";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { formatDateTL } from "@/lib/dateUtils";
import { useTenant } from "@/contexts/TenantContext";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Eye,
  FilePlus,
  FileSpreadsheet,
  FolderKanban,
  Landmark,
  Scale,
} from "lucide-react";

function AccountingDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <ModuleSectionNav config={accountingNavConfig} />
      <div className="mx-auto max-w-screen-2xl px-6 py-6 space-y-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <Skeleton className="h-80 w-full rounded-3xl" />
            <Skeleton className="h-72 w-full rounded-3xl" />
          </div>
          <div className="space-y-6 xl:col-span-4">
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        </div>
        <Skeleton className="h-60 w-full rounded-3xl" />
      </div>
    </div>
  );
}

export default function AccountingDashboard() {
  const navigate = useNavigate();
  const { session, hasModule, canManage } = useTenant();
  const ngoReportingEnabled = canUseNgoReporting(session, hasModule("reports"));
  const donorExportEnabled = canUseDonorExport(session, hasModule("reports"), canManage());
  const { data: dashboardData, isLoading: summaryLoading } = useAccountingDashboard();
  const { data: balanceHealth, isLoading: balanceLoading } = useAccountingBalanceHealth();

  if (summaryLoading || balanceLoading || !dashboardData || !balanceHealth) {
    return <AccountingDashboardSkeleton />;
  }

  const lastPayrollDate = dashboardData.lastPayrollDate
    ? formatDateTL(new Date(dashboardData.lastPayrollDate), { year: "numeric", month: "short", day: "numeric" })
    : "No payroll posting yet";

  const payrollFlow = dashboardData.lastPayrollEntry?.entries?.slice(0, 6).map((entry) => ({
    name: entry.account.length > 16 ? `${entry.account.slice(0, 16)}…` : entry.account,
    amount: entry.amount,
    tone: entry.type === "debit" ? "#f97316" : "#0ea5e9",
  })) ?? [];

  const closeSignals = [
    {
      title: "Payroll posting",
      value: dashboardData.payrollPosted ? "Posted" : "Not posted",
      good: dashboardData.payrollPosted,
      note: dashboardData.payrollPosted ? `Latest payroll journal is dated ${lastPayrollDate}.` : "Payroll has not yet flowed into the books.",
    },
    {
      title: "Trial balance health",
      value: balanceHealth.trialBalanced ? "Balanced" : "Out of balance",
      good: balanceHealth.trialBalanced,
      note: balanceHealth.trialBalanced ? "Debits and credits are aligned." : "The books still need attention before close confidence is high.",
    },
    {
      title: "Pending entries",
      value: `${dashboardData.pendingEntries}`,
      good: dashboardData.pendingEntries === 0,
      note:
        dashboardData.pendingEntries === 0
          ? "No draft journal entries are waiting in the queue."
          : "Draft entries are still sitting outside the final books.",
    },
  ];

  const briefLead =
    !dashboardData.payrollPosted || !balanceHealth.trialBalanced || dashboardData.pendingEntries > 0
      ? `Accounting is broadly functioning, but the books still show one or more confidence gaps that should be resolved before anyone treats the close position as fully settled.`
      : `Accounting is in a strong state, with payroll flowing into the ledger cleanly and the books presenting a balanced picture right now.`;

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.accounting} />
      <MainNavigation />
      <ModuleSectionNav config={accountingNavConfig} />

      <DashboardShell
        section="accounting"
        title="Ledger confidence and close health"
        subtitle="A focused view of whether payroll has posted correctly, whether the books reconcile, and which accounting actions still stand between now and a clean close."
        icon={Landmark}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/accounting/journal?action=new")}>
              <FilePlus className="mr-2 h-4 w-4" />
              New entry
            </Button>
            <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={() => navigate("/accounting/journal?filter=payroll")}>
              <Eye className="mr-2 h-4 w-4" />
              Review payroll journals
            </Button>
          </>
        }
        badges={
          <>
            <Badge variant="secondary">{dashboardData.pendingEntries} pending entr{dashboardData.pendingEntries === 1 ? "y" : "ies"}</Badge>
            <Badge variant="secondary">{lastPayrollDate}</Badge>
          </>
        }
        guidance={<GuidancePanel section="accounting" />}
        main={
          <>
            <DashboardPanel eyebrow="Signature view" title="Payroll to ledger flow">
              <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="h-80 rounded-[1.5rem] border border-border/60 bg-muted/25 p-4">
                  {payrollFlow.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={payrollFlow} layout="vertical" margin={{ top: 8, right: 16, left: 10, bottom: 8 }}>
                        <CartesianGrid horizontal={false} stroke="hsl(var(--border) / 0.35)" />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => formatCurrencyTL(Number(value ?? 0))}
                          contentStyle={{ borderRadius: 16, borderColor: "hsl(var(--border))" }}
                        />
                        <Bar dataKey="amount" radius={[12, 12, 12, 12]}>
                          {payrollFlow.map((entry) => (
                            <Cell key={entry.name} fill={entry.tone} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-[1.25rem] border border-dashed border-border/70 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                      No posted payroll entry is available yet, so the payroll-to-ledger visual will appear after the next posted run.
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {closeSignals.map((signal) => (
                    <div key={signal.title} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{signal.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{signal.note}</p>
                        </div>
                        <Badge
                          className={
                            signal.good
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                          }
                        >
                          {signal.value}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="Close posture" title="Where accounting effort is flowing">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    title: "Chart of accounts",
                    value: "Books",
                    description: "Shape and maintain the ledger structure behind every posting.",
                    path: "/accounting/chart",
                    icon: BookOpen,
                  },
                  {
                    title: "Journal review",
                    value: dashboardData.pendingEntries,
                    description: "Draft or unreviewed entries that still need accounting judgment.",
                    path: "/accounting/journal",
                    icon: FileSpreadsheet,
                  },
                  {
                    title: "Trial balance",
                    value: balanceHealth.trialBalanced ? "OK" : "Fix",
                    description: "Use the statement view to confirm the books are aligned.",
                    path: "/accounting/statements/trial-balance",
                    icon: Scale,
                  },
                  {
                    title: "Balance sheet",
                    value: dashboardData.payrollPosted ? "Live" : "Pending",
                    description: "Watch payroll flow into the final financial position.",
                    path: "/accounting/statements/balance-sheet",
                    icon: Building2,
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={() => navigate(item.path)}
                    className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-orange-400/30 hover:bg-background"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="text-2xl font-bold tabular-nums">{item.value}</span>
                    </div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </button>
                ))}
              </div>
            </DashboardPanel>
          </>
        }
        rail={
          <>
            <DashboardMetricCard
              label="Last payroll amount"
              value={formatCurrencyTL(dashboardData.lastPayrollAmount)}
              hint="Most recent payroll posting value in accounting"
              icon={Landmark}
              toneClass="bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
              onClick={() => navigate("/accounting/journal?filter=payroll")}
            />
            <DashboardMetricCard
              label="Pending entries"
              value={dashboardData.pendingEntries}
              hint="Draft journals still waiting for review or posting"
              icon={FileSpreadsheet}
              toneClass="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
              onClick={() => navigate("/accounting/journal")}
            />
            <DashboardMetricCard
              label="Trial balance"
              value={balanceHealth.trialBalanced ? "Balanced" : "Attention"}
              hint="Fast health read on whether debits equal credits"
              icon={Scale}
              toneClass={
                balanceHealth.trialBalanced
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              }
              onClick={() => navigate("/accounting/statements/trial-balance")}
            />

            <DashboardPanel eyebrow="Action rail" title="Best next moves">
              <div className="space-y-3">
                {[
                  {
                    title: "Review journal entries",
                    description: "Clear draft items and move the ledger closer to a settled state.",
                    path: "/accounting/journal",
                    icon: FileSpreadsheet,
                  },
                  {
                    title: "Check trial balance",
                    description: "Confirm whether the books are truly ready for management reporting.",
                    path: "/accounting/statements/trial-balance",
                    icon: Scale,
                  },
                  {
                    title: "Open the balance sheet",
                    description: "See how payroll and other postings are changing the final financial position.",
                    path: "/accounting/statements/balance-sheet",
                    icon: Building2,
                  },
                  ...(ngoReportingEnabled
                    ? [
                        {
                          title: donorExportEnabled ? "Donor export" : "Payroll allocation",
                          description: donorExportEnabled
                            ? "Prepare donor-facing payroll exports from the accounting side."
                            : "Open programme allocation outputs connected to payroll.",
                          path: donorExportEnabled ? "/reports/donor-export" : "/reports/payroll-allocation",
                          icon: FolderKanban,
                        },
                      ]
                    : []),
                ].map((action) => (
                  <button
                    key={action.title}
                    onClick={() => navigate(action.path)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-orange-400/30 hover:bg-background"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
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
          </>
        }
        brief={
          <ModuleBrief
            section="accounting"
            lead={briefLead}
            columns={[
              {
                title: "What’s happening now",
                items: [
                  dashboardData.payrollPosted
                    ? `Payroll has posted into accounting, with the latest entry dated ${lastPayrollDate}.`
                    : `Payroll has not yet posted into accounting, so the books still do not reflect the latest salary cycle.`,
                  `${dashboardData.pendingEntries} draft entr${dashboardData.pendingEntries === 1 ? "y" : "ies"} are still waiting in the queue.`,
                ],
              },
              {
                title: "Watch this week",
                items: [
                  balanceHealth.trialBalanced
                    ? `Trial balance health is currently positive, which raises confidence in the close position.`
                    : `Trial balance health is not yet clean, so management reporting should be treated carefully until it is checked.`,
                ],
              },
              {
                title: "Actions required",
                items: [
                  dashboardData.pendingEntries > 0
                    ? `Clear draft journals so the ledger stops carrying unfinished work.`
                    : `There is no draft entry backlog dominating the accounting queue right now.`,
                  !dashboardData.payrollPosted
                    ? `Confirm the latest payroll has flowed into accounting before treating payroll cost as final.`
                    : `Payroll has already reached the books, so the focus shifts to review rather than recovery.`,
                ],
              },
              {
                title: "Week ahead",
                items: [
                  `Move from posting into verification by checking statements and the balance sheet together, not separately.`,
                  `Use the next few days to reduce manual-entry drag so month-close work does not bunch up at the end.`,
                ],
              },
              {
                title: "Interesting signals",
                items: [
                  `Latest payroll accounting value is ${formatCurrencyTL(dashboardData.lastPayrollAmount)}.`,
                  payrollFlow.length > 0
                    ? `The payroll journal is already giving a visible account-level spread across the ledger.`
                    : `No payroll journal spread is available yet, which is itself a useful signal.`,
                ],
              },
            ]}
          />
        }
      />
    </div>
  );
}
