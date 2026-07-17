import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { payrollNavConfig } from "@/lib/moduleNav";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { useSettings } from "@/hooks/useSettings";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { leaveService } from "@/services/leaveService";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { formatDateTL, getTodayTL, parseDateISO } from "@/lib/dateUtils";
import {
  getNextMonthlyAdjustedDeadline,
  getUrgencyFromDays,
} from "@/lib/tax/compliance";
import {
  getConfiguredPayrollSchedule,
  getDaysUntilIso,
  getNextPayDateIso,
} from "@/lib/payroll/payroll-schedule";
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

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { hasModule, canManage, session } = useTenant();
  const canManageTenant = canManage();
  const hasTimeleave = hasModule("timeleave");
  const canReadEmployeeDirectory =
    hasModule("staff") ||
    hasModule("hiring") ||
    canManageTenant ||
    session?.role === "manager";

  const employeeSummaryQuery = useActiveEmployeeSummary(canReadEmployeeDirectory);
  const payrollRunsQuery = usePayrollRuns({ limit: 6 });
  const settingsQuery = useSettings();
  const leaveStatsQuery = useQuery({
    queryKey: ["tenants", tenantId, "payrollHomeLeaveStats"],
    queryFn: () => leaveService.getLeaveStats(tenantId),
    enabled: hasTimeleave,
    staleTime: 5 * 60 * 1000,
  });
  const dashboardQueries = [
    ...(canReadEmployeeDirectory ? [employeeSummaryQuery] : []),
    payrollRunsQuery,
    settingsQuery,
    ...(hasTimeleave ? [leaveStatsQuery] : []),
  ];

  if (dashboardQueries.some((query) => query.isLoading)) {
    return <PayrollDashboardSkeleton />;
  }

  if (
    dashboardQueries.some((query) => query.data === undefined)
  ) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={t("moduleDashboards.payroll.title")}
          description={t("moduleDashboards.payroll.seoDescription")}
        />
        <ModuleSectionNav config={payrollNavConfig} />
        <DashboardLoadError
          isRetrying={dashboardQueries.some((query) => query.isFetching)}
          onRetry={() =>
            Promise.all(dashboardQueries.map((query) => query.refetch()))
          }
        />
      </div>
    );
  }

  const employeeSummary = employeeSummaryQuery.data;
  const payrollRuns = payrollRunsQuery.data ?? [];
  const leaveStats = leaveStatsQuery.data;
  const payrollSchedule = getConfiguredPayrollSchedule(
    settingsQuery.data?.paymentStructure,
  );

  const activeEmployees = employeeSummary?.active ?? 0;
  const grossPayroll = employeeSummary?.totalMonthlySalary ?? 0;
  const blockedEmployees = employeeSummary?.employeesWithBlockingIssues ?? 0;
  const pendingLeave = hasTimeleave ? (leaveStats?.pendingRequests ?? 0) : 0;
  const readyToPay = payrollRuns.filter(
    (run) => run.status === "approved",
  ).length;
  const hasComplianceContext = activeEmployees > 0 || payrollRuns.length > 0;

  const todayIso = getTodayTL();
  const nextPayDateIso = getNextPayDateIso(payrollSchedule, todayIso);
  const nextPayDate = parseDateISO(nextPayDateIso);
  const daysUntilPayday = getDaysUntilIso(nextPayDateIso, todayIso);
  const witDate = parseDateISO(getNextMonthlyAdjustedDeadline(todayIso, 15));
  const inssDate = parseDateISO(getNextMonthlyAdjustedDeadline(todayIso, 20));
  const witDays = getDaysUntilIso(
    getNextMonthlyAdjustedDeadline(todayIso, 15),
    todayIso,
  );
  const inssDays = getDaysUntilIso(
    getNextMonthlyAdjustedDeadline(todayIso, 20),
    todayIso,
  );
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
          {t(
            blockedEmployees === 1
              ? "moduleDashboards.payroll.attention.employeeBlocking"
              : "moduleDashboards.payroll.attention.employeesBlocking",
          )}
        </>
      ),
      path: "/people/employees?filter=blocking-issues",
      icon: ShieldAlert,
      tone: "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300",
    },
    {
      show: hasTimeleave && pendingLeave > 0,
      content: (
        <>
          <span className="font-semibold tabular-nums">{pendingLeave}</span>{" "}
          {t(
            pendingLeave === 1
              ? "moduleDashboards.payroll.attention.leaveRequest"
              : "moduleDashboards.payroll.attention.leaveRequests",
          )}
        </>
      ),
      path: "/time-leave/leave",
      icon: CalendarClock,
      tone: "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300",
    },
    {
      show: canManageTenant && hasComplianceContext && witUrgency !== "ok",
      content: (
        <>
          {t("moduleDashboards.payroll.attention.monthlyWitDueIn")} {" "}
          <span className="font-semibold tabular-nums">{witDays}</span>{" "}
          {t(
            witDays === 1
              ? "moduleDashboards.common.day"
              : "moduleDashboards.common.days",
          )}{" "}
          —{" "}
          {formatDateTL(witDate, { month: "short", day: "numeric" })}
        </>
      ),
      path: "/payroll/tax/monthly-wit",
      icon: FileSpreadsheet,
      tone: urgencyTone(witUrgency),
    },
    {
      show: canManageTenant && hasComplianceContext && inssUrgency !== "ok",
      content: (
        <>
          {t("moduleDashboards.payroll.attention.inssDueIn")} {" "}
          <span className="font-semibold tabular-nums">{inssDays}</span>{" "}
          {t(
            inssDays === 1
              ? "moduleDashboards.common.day"
              : "moduleDashboards.common.days",
          )}{" "}
          —{" "}
          {formatDateTL(inssDate, { month: "short", day: "numeric" })}
        </>
      ),
      path: "/payroll/tax/inss-monthly",
      icon: FileSpreadsheet,
      tone: urgencyTone(inssUrgency),
    },
  ].filter((item) => item.show);

  const hubCards = [
    {
      title: t("moduleDashboards.payroll.cards.runPayroll"),
      art: "/images/illustrations/xefe-card-payroll.webp",
      meta: t("moduleDashboards.payroll.cards.staffInCycle", { count: activeEmployees }),
      path: "/payroll/run",
      icon: Play,
    },
    {
      title: t("moduleDashboards.payroll.cards.history"),
      art: "/images/illustrations/xefe-card-pr-history.webp",
      meta:
        payrollRuns.length > 0
          ? t(
              payrollRuns.length === 1
                ? "moduleDashboards.payroll.cards.recentRun"
                : "moduleDashboards.payroll.cards.recentRuns",
              { count: payrollRuns.length },
            )
          : t("moduleDashboards.payroll.cards.noRuns"),
      path: "/payroll/history",
      icon: History,
    },
    {
      title: t("moduleDashboards.payroll.cards.bankTransfers"),
      art: "/images/illustrations/xefe-card-pr-bank.webp",
      meta:
        readyToPay > 0
          ? t("moduleDashboards.payroll.cards.readyToPay", { count: readyToPay })
          : t("moduleDashboards.payroll.cards.exportPay"),
      path: "/payroll/payments",
      icon: Banknote,
    },
    {
      title: t("moduleDashboards.payroll.cards.taxInss"),
      art: "/images/illustrations/xefe-card-pr-tax.webp",
      meta: t("moduleDashboards.payroll.cards.taxDue", {
        witDays,
        inssDays,
      }),
      path: "/payroll/tax",
      icon: FileSpreadsheet,
    },
  ].filter(
    (card) =>
      canManageTenant ||
      (card.path !== "/payroll/run" && card.path !== "/payroll/tax"),
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("moduleDashboards.payroll.title")}
        description={t("moduleDashboards.payroll.seoDescription")}
      />
      <ModuleSectionNav config={payrollNavConfig} />

      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("moduleDashboards.payroll.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {canReadEmployeeDirectory && (
                <>
                  {t("moduleDashboards.payroll.estimatedGross", {
                    amount: formatCurrencyTL(grossPayroll),
                  })}{" "}
                  ·{" "}
                </>
              )}
              {t("moduleDashboards.payroll.nextPaydayIn")} {" "}
              <span className="font-medium text-foreground">
                {daysUntilPayday}{" "}
                {t(
                  daysUntilPayday === 1
                    ? "moduleDashboards.common.day"
                    : "moduleDashboards.common.days",
                )}
              </span>{" "}
              ({formatDateTL(nextPayDate, { month: "long", day: "numeric" })}).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/payroll/history")}
            >
              <History className="mr-2 h-4 w-4" />
              {t("moduleDashboards.payroll.historyAction")}
            </Button>
            {canManageTenant && (
              <Button onClick={() => navigate("/payroll/run")}>
                <Play className="mr-2 h-4 w-4" />
                {t("moduleDashboards.payroll.runAction")}
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
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 ${
                    idx !== attention.length - 1
                      ? "border-b border-border/60"
                      : ""
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm text-foreground/90">
                    {item.content}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {t("moduleDashboards.payroll.allGood")}
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
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {card.meta}
                </p>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
