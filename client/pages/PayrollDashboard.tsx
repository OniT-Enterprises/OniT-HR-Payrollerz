import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO, seoConfig } from "@/components/SEO";
import { payrollNavConfig } from "@/lib/moduleNav";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { useTenantId } from "@/contexts/TenantContext";
import { leaveService } from "@/services/leaveService";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { formatDateTL, getTodayTL, parseDateISO } from "@/lib/dateUtils";
import { getNextMonthlyAdjustedDeadline, getUrgencyFromDays } from "@/lib/tax/compliance";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  History,
  Play,
  ShieldAlert,
} from "lucide-react";

function PayrollDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={payrollNavConfig} />
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

function getNextPayDate() {
  const now = new Date();
  if (now.getDate() > 25) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 25);
  }
  return new Date(now.getFullYear(), now.getMonth(), 25);
}

const DAY_MS = 1000 * 60 * 60 * 24;

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const tenantId = useTenantId();

  const { data: employeeSummary, isLoading: employeeLoading } = useActiveEmployeeSummary();
  const { data: payrollRuns = [], isLoading: payrollRunsLoading } = usePayrollRuns({ limit: 6 });
  const { data: leaveStats, isLoading: leaveLoading } = useQuery({
    queryKey: ["tenants", tenantId, "payrollHomeLeaveStats"],
    queryFn: () => leaveService.getLeaveStats(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  if (employeeLoading || payrollRunsLoading || leaveLoading) {
    return <PayrollDashboardSkeleton />;
  }

  const activeEmployees = employeeSummary?.active ?? 0;
  const grossPayroll = employeeSummary?.totalMonthlySalary ?? 0;
  const blockedEmployees = employeeSummary?.employeesWithBlockingIssues ?? 0;
  const pendingLeave = leaveStats?.pendingRequests ?? 0;
  const readyToPay = payrollRuns.filter((run) => run.status === "approved").length;

  const nextPayDate = getNextPayDate();
  const daysUntilPayday = Math.ceil((nextPayDate.getTime() - Date.now()) / DAY_MS);

  const todayIso = getTodayTL();
  const witDate = parseDateISO(getNextMonthlyAdjustedDeadline(todayIso, 15));
  const inssDate = parseDateISO(getNextMonthlyAdjustedDeadline(todayIso, 20));
  const witDays = Math.ceil((witDate.getTime() - Date.now()) / DAY_MS);
  const inssDays = Math.ceil((inssDate.getTime() - Date.now()) / DAY_MS);
  const witUrgency = getUrgencyFromDays(witDays);
  const inssUrgency = getUrgencyFromDays(inssDays);

  const urgencyTone = (u: "ok" | "warning" | "urgent") =>
    u === "urgent"
      ? "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300"
      : "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300";

  // Triage: only what needs a decision before payday (and tax deadlines only when approaching)
  const attention = [
    {
      show: blockedEmployees > 0,
      content: (
        <>
          <span className="font-semibold tabular-nums">{blockedEmployees}</span>{" "}
          employee record{blockedEmployees === 1 ? "" : "s"} with blocking issues
        </>
      ),
      path: "/people/employees?filter=blocking-issues",
      icon: ShieldAlert,
      tone: "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300",
    },
    {
      show: pendingLeave > 0,
      content: (
        <>
          <span className="font-semibold tabular-nums">{pendingLeave}</span>{" "}
          leave request{pendingLeave === 1 ? "" : "s"} awaiting approval
        </>
      ),
      path: "/time-leave/leave",
      icon: CalendarClock,
      tone: "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300",
    },
    {
      show: witUrgency !== "ok",
      content: (
        <>
          Monthly WIT due in <span className="font-semibold tabular-nums">{witDays}</span>{" "}
          day{witDays === 1 ? "" : "s"} — {formatDateTL(witDate, { month: "short", day: "numeric" })}
        </>
      ),
      path: "/payroll/tax/monthly-wit",
      icon: FileSpreadsheet,
      tone: urgencyTone(witUrgency),
    },
    {
      show: inssUrgency !== "ok",
      content: (
        <>
          INSS payment due in <span className="font-semibold tabular-nums">{inssDays}</span>{" "}
          day{inssDays === 1 ? "" : "s"} — {formatDateTL(inssDate, { month: "short", day: "numeric" })}
        </>
      ),
      path: "/payroll/tax/inss-monthly",
      icon: FileSpreadsheet,
      tone: urgencyTone(inssUrgency),
    },
  ].filter((item) => item.show);

  const hubCards = [
    {
      title: "Run payroll",
      art: "/images/illustrations/xefe-card-payroll.webp",
      meta: `${activeEmployees} staff in cycle`,
      path: "/payroll/run",
      icon: Play,
    },
    {
      title: "History",
      art: "/images/illustrations/xefe-card-pr-history.webp",
      meta: payrollRuns.length > 0 ? `${payrollRuns.length} recent run${payrollRuns.length === 1 ? "" : "s"}` : "No runs yet",
      path: "/payroll/history",
      icon: History,
    },
    {
      title: "Bank transfers",
      art: "/images/illustrations/xefe-card-pr-bank.webp",
      meta: readyToPay > 0 ? `${readyToPay} ready to pay` : "Export & pay",
      path: "/payroll/payments",
      icon: Banknote,
    },
    {
      title: "Tax & INSS",
      art: "/images/illustrations/xefe-card-pr-tax.webp",
      meta: `WIT in ${witDays}d · INSS in ${inssDays}d`,
      path: "/payroll/tax",
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.payroll} />
      <ModuleSectionNav config={payrollNavConfig} />

      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCurrencyTL(grossPayroll)} estimated gross · next payday in{" "}
              <span className="font-medium text-foreground">{daysUntilPayday} day{daysUntilPayday === 1 ? "" : "s"}</span>{" "}
              ({formatDateTL(nextPayDate, { month: "long", day: "numeric" })}).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/payroll/history")}>
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate("/payroll/run")}
            >
              <Play className="mr-2 h-4 w-4" />
              Run payroll
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
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 ${
                    idx !== attention.length - 1 ? "border-b border-border/60" : ""
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm text-foreground/90">{item.content}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Payroll is on track — nothing needs attention before payday.
            </div>
          )}
        </section>

        {/* Module hub */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hubCards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40"
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
