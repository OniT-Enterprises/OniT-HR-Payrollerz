import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO, seoConfig } from "@/components/SEO";
import { payrollNavConfig } from "@/lib/moduleNav";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { ChartTooltip, chartHoverCursor } from "@/components/dashboard/ChartTooltip";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";
import { ModuleBrief } from "@/components/dashboard/ModuleBrief";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { leaveService } from "@/services/leaveService";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";
import { formatCurrencyTL, TL_INSS } from "@/lib/payroll/constants-tl";
import { formatDateTL, getTodayTL, parseDateISO } from "@/lib/dateUtils";
import { getNextMonthlyAdjustedDeadline, getUrgencyFromDays } from "@/lib/tax/compliance";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Calculator,
  CalendarClock,
  CheckCircle2,
  FileSpreadsheet,
  FolderKanban,
  Play,
  ShieldAlert,
  Wallet,
} from "lucide-react";

function PayrollDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={payrollNavConfig} />
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

function getNextPayDate() {
  const now = new Date();
  const nextPay = new Date(now.getFullYear(), now.getMonth(), 25);
  if (now.getDate() > 25) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 25);
  }
  return nextPay;
}

function PaydayRing({ daysUntilPayday, status }: { daysUntilPayday: number; status: "ok" | "warning" | "urgent" }) {
  const clamped = Math.max(0, Math.min(30, 30 - daysUntilPayday));
  const fill = Math.max(14, (clamped / 30) * 100);
  const tone =
    status === "urgent"
      ? "hsl(var(--destructive))"
      : status === "warning"
        ? "rgb(217 119 6)"
        : "hsl(var(--primary))";

  return (
    <div className="relative flex h-60 items-center justify-center">
      <div
        className={status === "urgent" ? "animate-pulse-subtle" : ""}
        style={{
          width: 216,
          height: 216,
          borderRadius: "999px",
          background: `conic-gradient(${tone} ${fill}%, hsl(var(--muted)) ${fill}% 100%)`,
          padding: 14,
          boxShadow: `0 20px 50px -24px ${tone}`,
        }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-card text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Payday runway
          </p>
          <p className="mt-3 text-6xl font-bold tracking-tight">{daysUntilPayday}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            day{daysUntilPayday === 1 ? "" : "s"} until the next salary cycle
          </p>
        </div>
      </div>
      <div className="absolute inset-0 -z-10 rounded-full bg-primary/10 blur-3xl" />
    </div>
  );
}

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { session, hasModule, canManage } = useTenant();
  const ngoReportingEnabled = canUseNgoReporting(session, hasModule("reports"));
  const donorExportEnabled = canUseDonorExport(session, hasModule("reports"), canManage());

  const { data: employeeSummary, isLoading: employeeLoading } = useActiveEmployeeSummary();
  const { data: payrollRuns = [], isLoading: payrollRunsLoading } = usePayrollRuns({ limit: 6 });
  const { data: leaveStats, isLoading: leaveLoading } = useQuery({
    queryKey: ["tenants", tenantId, "payrollDashboardLeaveStats"],
    queryFn: () => leaveService.getLeaveStats(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const loading = employeeLoading || payrollRunsLoading || leaveLoading;

  const summary = useMemo(() => {
    const grossPayroll = employeeSummary?.totalMonthlySalary ?? 0;
    const employeeINSS = grossPayroll * TL_INSS.employeeRate;
    const employerINSS = grossPayroll * TL_INSS.employerRate;
    const estimatedNet = Math.max(grossPayroll - employeeINSS, 0);
    const activeEmployees = employeeSummary?.active ?? 0;
    const blockedEmployees = employeeSummary?.employeesWithIssues ?? 0;
    const pendingLeave = leaveStats?.pendingRequests ?? 0;
    const nextPayDate = getNextPayDate();
    const daysUntilPayday = Math.ceil((nextPayDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const status: "ok" | "warning" | "urgent" =
      daysUntilPayday <= 5 ? "urgent" : daysUntilPayday <= 10 ? "warning" : "ok";

    const readiness = [
      {
        label: "Attendance captured",
        count: activeEmployees,
        score: 92,
        status: "complete" as const,
        hint: "Timesheets are flowing into payroll.",
      },
      {
        label: "Leave approvals",
        count: pendingLeave,
        score: pendingLeave > 0 ? 58 : 100,
        status: pendingLeave > 0 ? ("warning" as const) : ("complete" as const),
        hint: pendingLeave > 0 ? "Pending leave can still change payroll totals." : "No leave approvals blocking the run.",
      },
      {
        label: "Compliance blockers",
        count: blockedEmployees,
        score: blockedEmployees > 0 ? 38 : 100,
        status: blockedEmployees > 0 ? ("error" as const) : ("complete" as const),
        hint: blockedEmployees > 0 ? "Contracts, INSS, or department data still need review." : "Staff records look ready for payroll.",
      },
      {
        label: "Bank transfer prep",
        count: payrollRuns.filter((run) => run.status === "approved" || run.status === "paid").length,
        score: payrollRuns.length > 0 ? 80 : 44,
        status: payrollRuns.length > 0 ? ("warning" as const) : ("error" as const),
        hint: payrollRuns.length > 0 ? "Recent runs available for export and payment." : "No recent run has been prepared yet.",
      },
    ];

    const recentRuns = payrollRuns
      .slice()
      .sort((left, right) => {
        const leftDate = left.payDate ?? left.createdAt ?? "";
        const rightDate = right.payDate ?? right.createdAt ?? "";
        return leftDate.localeCompare(rightDate);
      })
      .slice(-6)
      .map((run, index) => ({
        name: run.payDate ? formatDateTL(parseDateISO(run.payDate), { month: "short", day: "numeric" }) : `Run ${index + 1}`,
        gross: run.totalGrossPay ?? run.totalNetPay ?? 0,
        net: run.totalNetPay ?? 0,
        status: run.status,
      }));

    const payrollMix = [
      { name: "Gross", value: grossPayroll, tone: "#6A9C29" },
      { name: "Employee INSS", value: employeeINSS, tone: "#f59e0b" },
      { name: "Employer INSS", value: employerINSS, tone: "#fb7185" },
      { name: "Estimated net", value: estimatedNet, tone: "#0ea5e9" },
    ];

    const todayIso = getTodayTL();
    const witDate = parseDateISO(getNextMonthlyAdjustedDeadline(todayIso, 15));
    const inssDate = parseDateISO(getNextMonthlyAdjustedDeadline(todayIso, 20));
    const witDays = Math.ceil((witDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const inssDays = Math.ceil((inssDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return {
      activeEmployees,
      blockedEmployees,
      pendingLeave,
      grossPayroll,
      employeeINSS,
      employerINSS,
      estimatedNet,
      daysUntilPayday,
      nextPayDate,
      status,
      readiness,
      recentRuns,
      payrollMix,
      compliance: [
        {
          label: "Monthly WIT",
          days: witDays,
          due: formatDateTL(witDate, { month: "short", day: "numeric" }),
          urgency: getUrgencyFromDays(witDays),
        },
        {
          label: "INSS payment",
          days: inssDays,
          due: formatDateTL(inssDate, { month: "short", day: "numeric" }),
          urgency: getUrgencyFromDays(inssDays),
        },
      ],
    };
  }, [employeeSummary, leaveStats, payrollRuns]);

  if (loading) {
    return <PayrollDashboardSkeleton />;
  }

  const briefLead =
    summary.blockedEmployees > 0
      ? `Payroll is moving, but ${summary.blockedEmployees} employee record${summary.blockedEmployees === 1 ? "" : "s"} still need attention before the cleanest possible run.`
      : `Payroll is in a healthy position for the coming cycle, with the main focus shifting from cleanup to timing and approvals.`;

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.payroll} />
      <ModuleSectionNav config={payrollNavConfig} />

      <DashboardShell
        section="payroll"
        title="Payroll command center"
        subtitle="A visual read on payroll readiness, funding pressure, compliance timing, and the actions that matter before payday."
        icon={Calculator}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/payroll/history")}>
              View history
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate("/payroll/run")}>
              <Play className="mr-2 h-4 w-4" />
              Run payroll
            </Button>
          </>
        }
        badges={
          <>
            <Badge variant="secondary">{summary.activeEmployees} staff in cycle</Badge>
            <Badge variant="secondary">{formatDateTL(summary.nextPayDate, { month: "long", day: "numeric" })}</Badge>
          </>
        }
        main={
          <>
            <DashboardPanel
              eyebrow="Signature view"
              title="Payday runway"
              actions={
                <Badge
                  variant="secondary"
                  className={
                    summary.status === "urgent"
                      ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                      : summary.status === "warning"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  }
                >
                  {summary.status === "urgent" ? "Action window is tight" : summary.status === "warning" ? "Final prep window" : "Healthy runway"}
                </Badge>
              }
              contentClassName="pt-2"
            >
              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
                  <PaydayRing daysUntilPayday={summary.daysUntilPayday} status={summary.status} />
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Compensation mix</p>
                    <div className="mt-4 h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summary.payrollMix} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.5)" />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                          <Tooltip
                            cursor={chartHoverCursor}
                            content={
                              <ChartTooltip formatValue={(v) => formatCurrencyTL(Number(v ?? 0))} />
                            }
                          />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48}>
                            {summary.payrollMix.map((entry) => (
                              <Cell key={entry.name} fill={entry.tone} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {summary.compliance.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{item.label}</p>
                            <p className="text-xs text-muted-foreground">Due {item.due}</p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              item.urgency === "urgent"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                                : item.urgency === "warning"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            }
                          >
                            {item.days}d
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="Operational signal" title="Payroll readiness atlas">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="h-80 rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.readiness} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                      <CartesianGrid horizontal={false} stroke="hsl(var(--border) / 0.35)" />
                      <XAxis type="number" domain={[0, 100]} hide />
                      <XAxis dataKey="label" />
                      <Tooltip
                        cursor={chartHoverCursor}
                        content={
                          <ChartTooltip
                            useRowNameAsLabel
                            formatValue={(v) => `${Number(v ?? 0)}% ready`}
                          />
                        }
                      />
                      <Bar dataKey="score" radius={[6, 6, 6, 6]} maxBarSize={22}>
                        {summary.readiness.map((entry) => (
                          <Cell
                            key={entry.label}
                            fill={
                              entry.status === "error"
                                ? "#ef4444"
                                : entry.status === "warning"
                                  ? "#f59e0b"
                                  : "#6A9C29"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {summary.readiness.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold tabular-nums">{item.count}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.score}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="Run history pulse" title="Recent payroll velocity">
              <div className="h-72 rounded-2xl border border-border/60 bg-muted/25 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.recentRuns} margin={{ top: 12, right: 16, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="payrollGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6A9C29" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="#6A9C29" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="payrollNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border) / 0.35)" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--muted-foreground) / 0.3)", strokeWidth: 1 }}
                      content={
                        <ChartTooltip formatValue={(v) => formatCurrencyTL(Number(v ?? 0))} />
                      }
                    />
                    <Area type="monotone" dataKey="gross" stroke="#6A9C29" fill="url(#payrollGross)" strokeWidth={3} />
                    <Area type="monotone" dataKey="net" stroke="#0ea5e9" fill="url(#payrollNet)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </DashboardPanel>
          </>
        }
        rail={
          <>
            <DashboardMetricCard
              label="Gross payroll"
              value={formatCurrencyTL(summary.grossPayroll)}
              hint="Estimated monthly salary exposure"
              icon={Wallet}
              toneClass="bg-primary/10 text-primary"
            />
            <DashboardMetricCard
              label="People blocked"
              value={summary.blockedEmployees}
              hint="Records missing data that can affect payroll"
              icon={ShieldAlert}
              toneClass="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              badge={summary.blockedEmployees > 0 ? <Badge variant="secondary">Needs review</Badge> : <Badge variant="secondary">Clear</Badge>}
              onClick={() => navigate("/people/employees?filter=blocking-issues")}
            />
            <DashboardMetricCard
              label="Pending leave"
              value={summary.pendingLeave}
              hint="Approvals that can still change the final run"
              icon={CalendarClock}
              toneClass="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
              onClick={() => navigate("/time-leave/leave")}
            />

            <DashboardPanel eyebrow="Action rail" title="What to do next">
              <div className="space-y-3">
                {[
                  {
                    label: "Prepare the run",
                    description: "Open the run wizard and freeze the current cycle.",
                    path: "/payroll/run",
                    icon: Play,
                  },
                  {
                    label: "Review tax and INSS",
                    description: "Check filing readiness and payment timing.",
                    path: "/payroll/tax",
                    icon: FileSpreadsheet,
                  },
                  {
                    label: "Export bank transfers",
                    description: "Move approved runs toward payment.",
                    path: "/payroll/payments",
                    icon: Banknote,
                  },
                  ...(ngoReportingEnabled
                    ? [
                        {
                          label: donorExportEnabled ? "Donor export" : "Payroll allocation",
                          description: donorExportEnabled
                            ? "Prepare the donor-facing payroll package."
                            : "Review allocation outputs for programme reporting.",
                          path: donorExportEnabled ? "/reports/donor-export" : "/reports/payroll-allocation",
                          icon: FolderKanban,
                        },
                      ]
                    : []),
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{action.label}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="Signals" title="Cycle watchlist">
              <div className="space-y-3">
                {[
                  {
                    label: summary.status === "urgent" ? "Payroll window is now tight." : "Payday runway is still manageable.",
                    hint: `Next pay date is ${formatDateTL(summary.nextPayDate, { month: "long", day: "numeric" })}.`,
                    urgent: summary.status === "urgent",
                  },
                  {
                    label: summary.blockedEmployees > 0 ? "Employee record cleanup will affect confidence." : "Staff records are largely clean for payroll.",
                    hint:
                      summary.blockedEmployees > 0
                        ? `${summary.blockedEmployees} people still have blocking issues.`
                        : "No material blockers detected in employee setup.",
                    urgent: summary.blockedEmployees > 0,
                  },
                  {
                    label: summary.pendingLeave > 0 ? "Leave approvals can still move the numbers." : "Leave is unlikely to move this cycle much.",
                    hint:
                      summary.pendingLeave > 0
                        ? `${summary.pendingLeave} leave request${summary.pendingLeave === 1 ? "" : "s"} waiting for review.`
                        : "Pending leave volume is currently low.",
                    urgent: summary.pendingLeave > 0,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <div className="flex gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          item.urgent
                            ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        }`}
                      >
                        {item.urgent ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
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
            section="payroll"
            lead={briefLead}
            columns={[
              {
                title: "What’s happening now",
                items: [
                  `${summary.activeEmployees} staff are currently inside the payroll footprint for this cycle.`,
                  `Gross payroll is tracking at ${formatCurrencyTL(summary.grossPayroll)} before final approvals and tax adjustments.`,
                ],
              },
              {
                title: "Watch this week",
                items: summary.compliance.map((item) => `${item.label} is due in ${item.days} day${item.days === 1 ? "" : "s"} on ${item.due}.`),
              },
              {
                title: "Actions required",
                items: [
                  summary.blockedEmployees > 0
                    ? `Clear employee compliance blockers before locking the run.`
                    : `No employee data blockers are currently forcing payroll to stop.`,
                  summary.pendingLeave > 0
                    ? `Approve or reject pending leave so the payroll team is not guessing.`
                    : `Leave approvals are under control for the current cycle.`,
                ],
              },
              {
                title: "Week ahead",
                items: [
                  `Move from preparation into execution by opening the run wizard and capturing any final changes.`,
                  `Plan payment exports and bank transfer timing early if the cycle will be approved in the next few days.`,
                ],
              },
              {
                title: "Interesting signals",
                items: [
                  `Employer INSS currently adds ${formatCurrencyTL(summary.employerINSS)} on top of salary cost.`,
                  `Estimated take-home before other deductions is hovering around ${formatCurrencyTL(summary.estimatedNet)}.`,
                ],
              },
            ]}
          />
        }
      />
    </div>
  );
}
