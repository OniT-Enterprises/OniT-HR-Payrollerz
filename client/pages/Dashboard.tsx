/**
 * Dashboard
 * Answers three questions: what needs attention, what is the key number, and
 * where should the user go next?
 */

import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "@/stores/chatStore";
import { Send } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { getTodayTL } from "@/lib/dateUtils";
import {
  getConfiguredPayrollSchedule,
  getDaysUntilIso,
  getNextPayDateIso,
} from "@/lib/payroll/payroll-schedule";
import {
  getDaysUntilDueIso,
  getNextAnnualAdjustedDeadline,
  getNextMonthlyAdjustedDeadline,
  getUrgencyFromDays,
} from "@/lib/tax/compliance";
import { useTaxFilingsDueSoon } from "@/hooks/useTaxFiling";
import {
  Users,
  UserPlus,
  Calculator,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  CalendarDays,
  Play,
  Wallet,
  BookOpen,
  FileText,
} from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { SEO, seoConfig } from "@/components/SEO";
import { useLayoutOptional } from "@/contexts/LayoutContext";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";

function XefeBotInline({ t, firstName }: { t: (key: string) => string; firstName: string }) {
  const { setOpen, setPendingQuery } = useChatStore();
  const [input, setInput] = useState("");
  const hour = new Date().getHours();
  const greeting = t(
    hour < 12
      ? "common.greetingMorning"
      : hour < 18
        ? "common.greetingAfternoon"
        : "common.greetingEvening",
  );

  const handleSend = useCallback((query: string) => {
    if (!query.trim()) return;
    setPendingQuery(query.trim());
    setOpen(true);
    setInput("");
  }, [setPendingQuery, setOpen]);

  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ""}!
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("dashboard.botIntro")}</p>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("dashboard.botPlaceholder")}
          className="flex-1 h-9 px-4 rounded-full border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label={t("dashboard.botPlaceholder")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <Card className="mb-6">
          <CardContent className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
            <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-9 w-full max-w-xl rounded-full" />
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-7 w-12" />
                </div>
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Skeleton className="mb-3 h-5 w-24" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-[74px] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const layout = useLayoutOptional();
  const setPageHeader = layout?.setPageHeader;
  const clearPageHeader = layout?.clearPageHeader;
  const { user } = useAuth();
  const { hasModule, canManage, session } = useTenant();
  const canManageTenant = canManage();
  const { t } = useI18n();
  const hasStaff = hasModule("staff");
  const hasHiring = hasModule("hiring");
  const hasPerformance = hasModule("performance");
  const hasTimeleave = hasModule("timeleave");
  const hasPayroll = hasModule("payroll");
  const hasMoney = hasModule("money");
  const hasAccounting = hasModule("accounting");
  const hasReports = hasModule("reports");
  const canReadEmployeeDirectory =
    hasStaff || hasHiring || canManageTenant || session?.role === "manager";
  const shouldLoadEmployeeSummary =
    (hasStaff || hasPayroll || hasTimeleave) && canReadEmployeeDirectory;

  const employeeSummaryQuery = useActiveEmployeeSummary(shouldLoadEmployeeSummary);
  const leaveStatsQuery = useLeaveStats(hasTimeleave);
  const dueDatesQuery = useTaxFilingsDueSoon(2, hasPayroll);
  const payrollRunsQuery = usePayrollRuns({ limit: 10 }, hasPayroll);
  const settingsQuery = useSettings(hasPayroll);

  const employeeSummary = employeeSummaryQuery.data;
  const leaveStats = leaveStatsQuery.data;
  const filingDueDates = dueDatesQuery.data ?? [];
  const payrollRuns = payrollRunsQuery.data ?? [];
  const loading =
    (shouldLoadEmployeeSummary && employeeSummaryQuery.isLoading) ||
    (hasTimeleave && leaveStatsQuery.isLoading) ||
    (hasPayroll && dueDatesQuery.isLoading) ||
    (hasPayroll && payrollRunsQuery.isLoading) ||
    (hasPayroll && settingsQuery.isLoading);
  const loadError =
    (shouldLoadEmployeeSummary && employeeSummaryQuery.isError && employeeSummary === undefined) ||
    (hasTimeleave && leaveStatsQuery.isError && leaveStats === undefined) ||
    (hasPayroll && dueDatesQuery.isError && dueDatesQuery.data === undefined) ||
    (hasPayroll && payrollRunsQuery.isError && payrollRunsQuery.data === undefined) ||
    (hasPayroll && settingsQuery.isError && settingsQuery.data === undefined);
  const retrying =
    employeeSummaryQuery.isFetching ||
    leaveStatsQuery.isFetching ||
    dueDatesQuery.isFetching ||
    payrollRunsQuery.isFetching ||
    (hasPayroll && settingsQuery.isFetching);
  const pendingLeave = hasTimeleave ? leaveStats?.pendingRequests ?? 0 : 0;
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts({
    enabled: true,
    onShowHelp: () => setShowShortcuts(true),
  });

  // Compliance deadlines (Timor-Leste specific)
  const getComplianceStatus = () => {
    const todayIso = getTodayTL();
    const getUpcomingObligation = (predicate: (item: (typeof filingDueDates)[number]) => boolean) => {
      const matches = filingDueDates.filter(predicate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return matches.find((item) => item.status !== "filed") ?? null;
    };

    const witObligation = getUpcomingObligation((item) => item.type === "monthly_wit");
    const inssObligation = getUpcomingObligation(
      (item) => item.type === "inss_monthly" && item.task === "payment"
    );

    const fallbackWitDue = getNextMonthlyAdjustedDeadline(todayIso, 15);
    const fallbackInssDue = getNextMonthlyAdjustedDeadline(todayIso, 20);

    const daysToWit = witObligation?.daysUntilDue ?? getDaysUntilDueIso(todayIso, fallbackWitDue);
    const daysToINSS = inssObligation?.daysUntilDue ?? getDaysUntilDueIso(todayIso, fallbackInssDue);
    const daysToSubsidio = getDaysUntilDueIso(todayIso, getNextAnnualAdjustedDeadline(todayIso, 12, 20));

    return {
      wit: {
        days: daysToWit,
        status: getUrgencyFromDays(daysToWit, witObligation?.isOverdue ?? false),
      },
      inss: {
        days: daysToINSS,
        status: getUrgencyFromDays(daysToINSS, inssObligation?.isOverdue ?? false),
      },
      subsidio: { days: daysToSubsidio, status: daysToSubsidio > 60 ? 'ok' : daysToSubsidio > 30 ? 'warning' : 'urgent' },
    };
  };

  const employeesWithIssues = hasStaff ? (employeeSummary?.employeesWithIssues ?? 0) : 0;
  const activeEmployeeCount = employeeSummary?.active ?? 0;

  const todayIso = getTodayTL();
  const payrollSchedule = getConfiguredPayrollSchedule(settingsQuery.data?.paymentStructure);
  const nextPayDateKey = getNextPayDateIso(payrollSchedule, todayIso);
  const daysUntilPayday = getDaysUntilIso(nextPayDateKey, todayIso);
  // A brand-new org with no staff and no payroll history has no WIT/INSS
  // obligations yet — don't greet it with "overdue" compliance warnings.
  const hasComplianceContext = activeEmployeeCount > 0 || payrollRuns.length > 0;
  const compliance = hasPayroll && hasComplianceContext ? getComplianceStatus() : null;
  const firstName = user?.displayName?.split(" ")[0] || "";

  // Payroll status
  const payrollPrepared = payrollRuns.some(
    (run) =>
      run.payDate === nextPayDateKey &&
      run.status !== "cancelled" &&
      run.status !== "rejected"
  );

  const urgentCompliance = compliance
    ? [
        { label: "WIT", ...compliance.wit },
        { label: "INSS", ...compliance.inss },
        { label: t("dashboard.thirteenthFull"), ...compliance.subsidio },
      ]
        .filter((item) => item.status === "urgent")
        .sort((a, b) => a.days - b.days)[0] ?? null
    : null;
  const shouldRunPayroll =
    canManageTenant && hasPayroll && !payrollPrepared && activeEmployeeCount > 0;
  const shouldReviewLeave = hasTimeleave && pendingLeave > 0;
  const shouldFixEmployees = canManageTenant && hasStaff && employeesWithIssues > 0;
  const shouldAddEmployee = canManageTenant && hasStaff && activeEmployeeCount === 0;
  const hasThingsToDo =
    shouldRunPayroll ||
    shouldReviewLeave ||
    shouldFixEmployees ||
    shouldAddEmployee ||
    Boolean(canManageTenant && urgentCompliance);

  const retryDashboard = useCallback(async () => {
    const requests: Array<Promise<unknown>> = [];
    if (hasPayroll) requests.push(settingsQuery.refetch());
    if (shouldLoadEmployeeSummary) requests.push(employeeSummaryQuery.refetch());
    if (hasTimeleave) requests.push(leaveStatsQuery.refetch());
    if (hasPayroll) {
      requests.push(dueDatesQuery.refetch(), payrollRunsQuery.refetch());
    }
    await Promise.all(requests);
  }, [
    settingsQuery,
    shouldLoadEmployeeSummary,
    employeeSummaryQuery,
    hasTimeleave,
    leaveStatsQuery,
    hasPayroll,
    dueDatesQuery,
    payrollRunsQuery,
  ]);

  useEffect(() => {
    if (!setPageHeader) return;

    setPageHeader({
      title: t("common.dashboard"),
      subtitle: t("dashboard.headerSubtitle"),
      icon: Calculator,
      iconColor: "text-primary",
    });

    return () => {
      clearPageHeader?.();
    };
  }, [setPageHeader, clearPageHeader, t]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background">
        <SEO {...seoConfig.dashboard} />
        <MainNavigation />
        <DashboardLoadError onRetry={retryDashboard} isRetrying={retrying} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.dashboard} />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 pb-10 sm:px-6 sm:py-6 sm:pb-12">
        {/* ── Calm greeting and one direct route into XefeBot ── */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <img
              src="/images/illustrations/xefebot.webp"
              alt="XefeBot"
              className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
            />
            <XefeBotInline t={t} firstName={firstName} />
          </div>
        </div>

        {/* ── Overview cards ── */}
        {(hasPayroll || hasStaff || hasTimeleave) && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {hasPayroll && (
              <button onClick={() => navigate(canManageTenant ? "/payroll/run" : "/payroll")} className="group rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Calculator className="h-4 w-4 text-primary" />
                  </div>
                  {payrollPrepared
                    ? <CheckCircle className="h-4 w-4 text-primary" />
                    : <AlertCircle className="h-4 w-4 text-amber-500" />
                  }
                </div>
                <p className="text-2xl font-bold tabular-nums">{daysUntilPayday}{" "}<span className="text-sm font-normal text-muted-foreground">{t("dashboard.days")}</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("dashboard.untilPayday")}</p>
              </button>
            )}
            {hasStaff && (
              <button onClick={() => navigate("/people/employees")} className="group rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-blue-400/40 hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                  {employeesWithIssues > 0 && <AlertCircle className="h-4 w-4 text-amber-500" />}
                </div>
                <p className="text-2xl font-bold tabular-nums">{activeEmployeeCount}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("dashboard.activeEmployees")}</p>
              </button>
            )}
            {hasTimeleave && (
              <button onClick={() => navigate("/time-leave/leave")} className="group rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-cyan-400/40 hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                    <CalendarDays className="h-4 w-4 text-cyan-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold tabular-nums">{pendingLeave}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("dashboard.pendingRequests")}</p>
              </button>
            )}
          </div>
        )}

        {!hasPayroll &&
          !hasStaff &&
          !hasTimeleave &&
          (hasHiring || hasPerformance || hasMoney || hasAccounting || hasReports) && (
          <div className="mb-6">
            <p className="mb-3 text-sm font-semibold">{t("dashboard.quickActions")}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(hasHiring || hasPerformance) && (
                <button onClick={() => navigate("/people")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{t("nav.people")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {hasMoney && (
                <button onClick={() => navigate("/money")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30">
                  <Wallet className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{t("nav.money")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {hasAccounting && (
                <button onClick={() => navigate("/accounting")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{t("nav.accounting")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {hasReports && (
                <button onClick={() => navigate("/reports")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{t("nav.reports")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Things to do ── */}
        <div>
          <p className="mb-3 text-sm font-semibold">{t("dashboard.thingsToDo")}</p>
          <div className="space-y-2">
            {canManageTenant && urgentCompliance && (
              <button onClick={() => navigate("/payroll/tax")} className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left transition-all hover:shadow-sm dark:border-red-900/40 dark:bg-red-950/20 sm:gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t("dashboard.compliance")}: {urgentCompliance.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {urgentCompliance.days < 0
                      ? t("dashboard.overdueBy", { days: Math.abs(urgentCompliance.days) })
                      : t("dashboard.dueIn", { days: urgentCompliance.days })}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
            {shouldRunPayroll && (
              <button onClick={() => navigate("/payroll/run")} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm sm:gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Play className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t("dashboard.runPayroll")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.todoRunPayrollDesc", { days: daysUntilPayday })}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
            {shouldReviewLeave && (
              <button onClick={() => navigate("/time-leave/leave")} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-cyan-400/30 hover:shadow-sm sm:gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                  <CalendarDays className="h-4 w-4 text-cyan-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t("dashboard.todoLeaveTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.todoLeaveDesc", { count: pendingLeave })}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
            {shouldFixEmployees && (
              <button onClick={() => navigate("/people/employees?filter=issues")} className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left transition-all hover:shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20 sm:gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t("dashboard.todoBlockingTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.todoBlockingDesc", { count: employeesWithIssues })}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
            {shouldAddEmployee && (
              <button onClick={() => navigate("/people/add")} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-blue-400/30 hover:shadow-sm sm:gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <UserPlus className="h-4 w-4 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t("dashboard.addEmployee")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.todoAddEmployeeDesc")}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
            {!hasThingsToDo && (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{t("dashboard.allGood")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <KeyboardShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
    </div>
  );
}
