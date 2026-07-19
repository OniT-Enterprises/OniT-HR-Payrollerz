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
  Calculator,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  History,
  Play,
  ShieldAlert,
  Users,
} from "lucide-react";
import { HubCard } from "@/components/dashboard/HubCard";
import PageHeader from "@/components/layout/PageHeader";

function PayrollDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={payrollNavConfig} />
      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-32 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>

        {/* Needs attention */}
        <section>
          <Skeleton className="mb-3 h-3 w-36" />
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex w-full items-center gap-4 px-4 py-3.5 ${
                  idx !== 2 ? "border-b border-border/60" : ""
                }`}
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                <Skeleton
                  className={`h-4 flex-1 ${idx === 0 ? "max-w-[12rem]" : idx === 1 ? "max-w-[16rem]" : "max-w-[10rem]"}`}
                />
                <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
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
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { hasModule, canManage, session, showAdvancedTax } = useTenant();
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
      // Brand-new tenant: "payroll is on track" would be misleading with no
      // team yet — point at the real first step instead.
      show: canManageTenant && activeEmployees === 0 && payrollRuns.length === 0,
      content: <>{t("moduleDashboards.payroll.attention.addTeamFirst")}</>,
      path: "/people/add",
      icon: Users,
      tone: "text-primary bg-primary/10",
    },
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
      // The ATTL WIT form is accountant-only; the simple flow lands on the tax hub
      path: showAdvancedTax ? "/payroll/tax/monthly-wit" : "/payroll/tax",
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
      svg: "payroll",
      meta: t("moduleDashboards.payroll.cards.staffInCycle", { count: activeEmployees }),
      purpose: t("moduleDashboards.payroll.cards.runPayrollPurpose"),
      action: t("moduleDashboards.payroll.cards.runPayrollAction"),
      path: "/payroll/run",
      icon: Play,
    },
    {
      title: t("moduleDashboards.payroll.cards.history"),
      art: "/images/illustrations/xefe-card-pr-history.webp",
      svg: "pr-history",
      meta:
        payrollRuns.length > 0
          ? t(
              payrollRuns.length === 1
                ? "moduleDashboards.payroll.cards.recentRun"
                : "moduleDashboards.payroll.cards.recentRuns",
              { count: payrollRuns.length },
            )
          : t("moduleDashboards.payroll.cards.noRuns"),
      purpose: t("moduleDashboards.payroll.cards.historyPurpose"),
      action: t("moduleDashboards.payroll.cards.historyAction"),
      path: "/payroll/history",
      icon: History,
    },
    {
      title: t("moduleDashboards.payroll.cards.bankTransfers"),
      art: "/images/illustrations/xefe-card-pr-bank.webp",
      svg: "pr-bank",
      meta:
        readyToPay > 0
          ? t("moduleDashboards.payroll.cards.readyToPay", { count: readyToPay })
          : t("moduleDashboards.payroll.cards.exportPay"),
      purpose: t("moduleDashboards.payroll.cards.bankTransfersPurpose"),
      action: t("moduleDashboards.payroll.cards.bankTransfersAction"),
      path: "/payroll/payments",
      icon: Banknote,
    },
    {
      title: t("moduleDashboards.payroll.cards.taxInss"),
      art: "/images/illustrations/xefe-card-pr-tax.webp",
      svg: "pr-tax",
      meta: t("moduleDashboards.payroll.cards.taxDue", {
        witDays,
        inssDays,
      }),
      purpose: t("moduleDashboards.payroll.cards.taxInssPurpose"),
      action: t("moduleDashboards.payroll.cards.taxInssAction"),
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

      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        <PageHeader
          size="lg"
          title={t("moduleDashboards.payroll.title")}
          icon={Calculator}
          iconColor="text-primary"
          subtitle={
            <>
              {canReadEmployeeDirectory && (
                <>
                  {t("moduleDashboards.payroll.estimatedGross", {
                    amount: formatCurrencyTL(grossPayroll),
                  })}{" "}
                  ·{" "}
                </>
              )}
              {t("moduleDashboards.payroll.nextPaydayIn")}{" "}
              <span className="font-medium text-foreground">
                {daysUntilPayday}{" "}
                {t(
                  daysUntilPayday === 1
                    ? "moduleDashboards.common.day"
                    : "moduleDashboards.common.days",
                )}
              </span>{" "}
              ({formatDateTL(nextPayDate, { month: "long", day: "numeric" })}).
            </>
          }
          actions={
            <>
              <Button variant="outline" onClick={() => navigate("/payroll/history")}>
                <History className="mr-2 h-4 w-4" />
                {t("moduleDashboards.payroll.historyAction")}
              </Button>
              {canManageTenant && (
                <Button onClick={() => navigate("/payroll/run")}>
                  <Play className="mr-2 h-4 w-4" />
                  {t("moduleDashboards.payroll.runAction")}
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

        {/* Module hub — clear navigation cards: icon badge, title, one-line
            purpose, and an action row anchored at the bottom. */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {hubCards.map((card) => (
            <HubCard
              key={card.path}
              icon={card.icon}
              title={card.title}
              purpose={card.purpose}
              action={card.action}
              accent="green"
              onClick={() => navigate(card.path)}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
