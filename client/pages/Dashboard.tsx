/**
 * Dashboard - Enterprise Command Center
 * Answers: "Is anything wrong, urgent, or blocking payroll?"
 * Structure: Status → Action Required → KPIs → Quick Actions
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { getComplianceIssues } from "@/lib/employeeUtils";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { getTodayTL } from "@/lib/dateUtils";
import {
  getDaysUntilDueIso,
  getNextAnnualAdjustedDeadline,
  getNextMonthlyAdjustedDeadline,
  getUrgencyFromDays,
} from "@/lib/tax/compliance";
import { canUseDonorExport } from "@/lib/ngo/access";
import { useTaxFilingsDueSoon } from "@/hooks/useTaxFiling";
import { settingsService } from "@/services/settingsService";
import {
  Users,
  UserPlus,
  Calculator,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  CalendarDays,
  Play,
} from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { SEO, seoConfig } from "@/components/SEO";

function getNextPayDate() {
  const now = new Date();
  let nextPay = new Date(now.getFullYear(), now.getMonth(), 25);
  if (now.getDate() > 25) {
    nextPay = new Date(now.getFullYear(), now.getMonth() + 1, 25);
  }
  return nextPay;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-6 mx-auto max-w-screen-2xl">
        {/* Greeting */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-12" />
        </div>

        {/* Hero Action Card */}
        <Card className="mb-6 border-2">
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-6 w-56" />
              </div>
              <Skeleton className="h-11 w-32 rounded-md" />
            </div>
          </CardContent>
        </Card>

        {/* 3 Big Tiles */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6 pb-5">
                <div className="flex items-start justify-between mb-3">
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                  <div className="text-right space-y-1.5">
                    <Skeleton className="h-9 w-16 ml-auto" />
                    <Skeleton className="h-3 w-24 ml-auto" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Compliance Strip */}
        <div className="flex items-center gap-6 mb-6 px-1">
          <Skeleton className="h-4 w-24" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-8 rounded" />
            </div>
          ))}
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { session, hasModule, canManage } = useTenant();
  const tenantId = useTenantId();
  const { t } = useI18n();
  const hasStaff = hasModule("staff");
  const hasTimeleave = hasModule("timeleave");
  const hasPayroll = hasModule("payroll");
  const hasReports = hasModule("reports");
  const shouldLoadEmployees = hasStaff || hasPayroll || hasTimeleave;
  const { data: activeEmployees = [], isLoading: employeesLoading } = useEmployeeDirectory(
    { status: "active" },
    shouldLoadEmployees
  );
  const { data: leaveStats, isLoading: leaveStatsLoading } = useLeaveStats(hasTimeleave);
  const { data: filingDueDates = [], isLoading: dueDatesLoading } = useTaxFilingsDueSoon(2, hasPayroll);
  const { data: payrollRuns = [], isLoading: payrollRunsLoading } = usePayrollRuns({ limit: 10 }, hasPayroll);
  const canManageTenant = canManage();
  const { data: setupProgress, isLoading: setupLoading } = useQuery({
    queryKey: ["tenants", tenantId, "setupProgress"],
    queryFn: () => settingsService.getSetupProgress(tenantId).catch(() => null),
    enabled: Boolean(tenantId && canManageTenant),
    staleTime: 5 * 60 * 1000,
  });
  const loading =
    employeesLoading ||
    leaveStatsLoading ||
    dueDatesLoading ||
    payrollRunsLoading ||
    setupLoading;
  const pendingLeave = hasTimeleave ? leaveStats?.pendingRequests ?? 0 : 0;
  const onLeaveToday = hasTimeleave ? leaveStats?.employeesOnLeaveToday ?? 0 : 0;
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts({
    enabled: true,
    onShowHelp: () => setShowShortcuts(true),
  });

  // Derived data
  const totalPayroll = activeEmployees.reduce(
    (sum, emp) => sum + (emp.compensation?.monthlySalary || 0),
    0
  );

  // Calculate days until next payroll (25th)
  const getDaysUntilPayday = () => {
    const now = new Date();
    const nextPay = getNextPayDate();
    return Math.ceil((nextPay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

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

  // Compliance issues — shared utility, single source of truth
  const blockingIssues = hasStaff ? getComplianceIssues(activeEmployees).slice(0, 6) : [];

  const daysUntilPayday = getDaysUntilPayday();
  const compliance = hasPayroll ? getComplianceStatus() : null;
  const nextPayDate = getNextPayDate();
  const nextPayDateKey = formatDateKey(nextPayDate);
  const firstName = user?.displayName?.split(" ")[0] || "";
  const donorExportEnabled = canUseDonorExport(
    session,
    hasReports,
    canManageTenant
  );
  const setupIncomplete = canManageTenant && setupProgress?.isComplete === false;

  // Payroll status
  const payrollPrepared = payrollRuns.some(
    (run) =>
      run.payDate === nextPayDateKey &&
      run.status !== "cancelled" &&
      run.status !== "rejected"
  );
  const isPayrollUrgent = daysUntilPayday <= 7;

  // Next recommended action logic
  const getNextAction = () => {
    if (setupIncomplete) {
      return {
        label: t("dashboard.finishSetup"),
        path: "/setup",
        urgent: true,
      };
    }
    if (hasPayroll && isPayrollUrgent && !payrollPrepared) {
      return { label: t("dashboard.preparePayroll"), path: "/payroll/run", urgent: true };
    }
    if (blockingIssues.length > 0) {
      return {
        label: t("dashboard.fixBlockingIssues", { count: blockingIssues.length }),
        path: blockingIssues[0].path,
        urgent: true,
      };
    }
    if (hasTimeleave && pendingLeave > 0) {
      return { label: t("dashboard.reviewLeaveRequests", { count: pendingLeave }), path: "/time-leave/leave", urgent: false };
    }
    return null;
  };

  const nextAction = getNextAction();

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.dashboard} />
      <MainNavigation />

      <div className="p-6 mx-auto max-w-screen-2xl pb-12">
        {/* ── Greeting banner with illustration ── */}
        <div className="flex items-center justify-between mb-8 rounded-2xl bg-card border border-border p-6 overflow-hidden">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {new Date().getHours() < 12 ? t("common.greetingMorning") : new Date().getHours() < 18 ? t("common.greetingAfternoon") : t("common.greetingEvening")}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("dashboard.heresWhatsGoing")}
            </p>
          </div>
          <img
            src="/images/illustrations/dashboard-greeting.png"
            alt=""
            className="hidden md:block h-24 w-auto -mr-2 -my-2 object-contain opacity-90 dark:opacity-70"
          />
        </div>

        {/* ── Overview cards ── */}
        {(hasPayroll || hasStaff || hasTimeleave) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {hasPayroll && (
              <button onClick={() => navigate("/payroll/run")} className="group p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/30 transition-all text-left">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calculator className="h-4 w-4 text-primary" />
                  </div>
                  {payrollPrepared
                    ? <CheckCircle className="h-4 w-4 text-primary" />
                    : <AlertCircle className="h-4 w-4 text-amber-500" />
                  }
                </div>
                <p className="text-2xl font-bold tabular-nums">{daysUntilPayday}<span className="text-sm font-normal text-muted-foreground ml-1">{t("dashboard.days")}</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrencyTL(totalPayroll)}</p>
              </button>
            )}
            {hasStaff && (
              <button onClick={() => navigate("/people/employees")} className="group p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-blue-400/40 transition-all text-left">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                  {blockingIssues.length > 0 && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{blockingIssues.length} issues</span>}
                </div>
                <p className="text-2xl font-bold tabular-nums">{activeEmployees.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.activeEmployees")}</p>
              </button>
            )}
            {hasTimeleave && (
              <button onClick={() => navigate("/time-leave/leave")} className="group p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-cyan-400/40 transition-all text-left">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <CalendarDays className="h-4 w-4 text-cyan-500" />
                  </div>
                  {pendingLeave > 0 && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{pendingLeave} pending</span>}
                </div>
                <p className="text-2xl font-bold tabular-nums">{onLeaveToday}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.onLeaveToday")}</p>
              </button>
            )}
            {compliance && (
              <button onClick={() => navigate("/payroll/tax")} className="group p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-border transition-all text-left">
                <div className="mb-3">
                  <span className="text-xs font-medium text-muted-foreground">{t("dashboard.compliance")}</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "WIT", ...compliance.wit },
                    { label: "INSS", ...compliance.inss },
                    { label: "13th", ...compliance.subsidio },
                  ].map((d) => (
                    <div key={d.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className={`font-semibold tabular-nums ${
                        d.status === 'ok' ? 'text-emerald-600 dark:text-emerald-400'
                          : d.status === 'warning' ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>{d.days}d</span>
                    </div>
                  ))}
                </div>
              </button>
            )}
          </div>
        )}

        {/* ── Things to do ── */}
        <div>
          <p className="text-sm font-semibold mb-3">{t("dashboard.thingsToDo")}</p>
          <div className="space-y-2">
            {hasPayroll && !payrollPrepared && (
              <button onClick={() => navigate("/payroll/run")} className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm hover:border-primary/30 transition-all text-left">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Play className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.runPayroll")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.todoRunPayrollDesc", { days: daysUntilPayday })}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            )}
            {hasTimeleave && pendingLeave > 0 && (
              <button onClick={() => navigate("/time-leave/leave")} className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm hover:border-cyan-400/30 transition-all text-left">
                <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <CalendarDays className="h-4 w-4 text-cyan-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.todoLeaveTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.todoLeaveDesc", { count: pendingLeave })}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            )}
            {blockingIssues.length > 0 && (
              <button onClick={() => navigate(blockingIssues[0].path)} className="w-full flex items-center gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 hover:shadow-sm transition-all text-left">
                <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.todoBlockingTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.todoBlockingDesc", { count: blockingIssues.length })}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            )}
            {hasStaff && (
              <button onClick={() => navigate("/people/add")} className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm hover:border-blue-400/30 transition-all text-left">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <UserPlus className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.addEmployee")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.todoAddEmployeeDesc")}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
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
