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
import { Button } from "@/components/ui/button";
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
  ChevronRight,
  Calculator,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  CalendarDays,
  HelpCircle,
  AlertTriangle,
  Play,
  Zap,
  FolderKanban,
  CalendarCheck,
  Wallet,
} from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { SEO, seoConfig } from "@/components/SEO";
import DocumentAlertsCard from "@/components/dashboard/DocumentAlertsCard";

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
  const firstName = user?.displayName?.split(" ")[0] || "there";
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

      <div className="p-6 mx-auto max-w-screen-2xl pb-24">
        {/* ── Greeting ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {new Date().getHours() < 12 ? t("common.greetingMorning") : new Date().getHours() < 18 ? t("common.greetingAfternoon") : t("common.greetingEvening")}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowShortcuts(true)}>
            <HelpCircle className="h-4 w-4 mr-1" />
            <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">?</kbd>
          </Button>
        </div>

        {/* ── Alerts (overdue taxes, blocking issues) ── */}
        {compliance && (compliance.wit.status === 'urgent' || compliance.inss.status === 'urgent') && (
          <div className="mb-6 space-y-2">
            {compliance.wit.status === 'urgent' && (
              <button onClick={() => navigate("/payroll/tax/monthly-wit")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-300 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                <span className="text-sm flex-1"><span className="font-semibold text-red-700 dark:text-red-400">WIT</span> <span className="text-red-600 dark:text-red-300">{t("dashboard.overdue")} {Math.abs(compliance.wit.days)} {t("dashboard.days")}</span></span>
                <ChevronRight className="h-4 w-4 text-red-400" />
              </button>
            )}
            {compliance.inss.status === 'urgent' && (
              <button onClick={() => navigate("/payroll/tax/inss-monthly")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-300 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                <span className="text-sm flex-1"><span className="font-semibold text-red-700 dark:text-red-400">INSS</span> <span className="text-red-600 dark:text-red-300">{t("dashboard.overdue")} {Math.abs(compliance.inss.days)} {t("dashboard.days")}</span></span>
                <ChevronRight className="h-4 w-4 text-red-400" />
              </button>
            )}
          </div>
        )}

        {blockingIssues.length > 0 && (
          <button
            onClick={() => navigate("/people/employees?filter=blocking-issues")}
            className="w-full mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/50 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-left"
          >
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-sm flex-1 text-amber-800 dark:text-amber-200">
              <span className="font-semibold">{blockingIssues.length}</span> {t("dashboard.attentionRequiredDesc")}
            </span>
            <ChevronRight className="h-4 w-4 text-amber-400" />
          </button>
        )}

        {/* ── Stats Row — compact, side by side ── */}
        {(hasPayroll || hasStaff || hasTimeleave) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {hasPayroll && (
              <button onClick={() => navigate("/payroll/run")} className="p-4 rounded-xl border border-border/50 hover:border-green-400/50 hover:shadow-sm transition-all text-left">
                <div className="flex items-center justify-between mb-2">
                  <Calculator className="h-4 w-4 text-green-500" />
                  {payrollPrepared
                    ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  }
                </div>
                <p className="text-2xl font-bold tabular-nums">{daysUntilPayday}<span className="text-sm font-normal text-muted-foreground ml-1">{t("dashboard.days")}</span></p>
                <p className="text-xs text-muted-foreground">{formatCurrencyTL(totalPayroll)}</p>
              </button>
            )}
            {hasStaff && (
              <button onClick={() => navigate("/people/employees")} className="p-4 rounded-xl border border-border/50 hover:border-blue-400/50 hover:shadow-sm transition-all text-left">
                <div className="flex items-center justify-between mb-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  {blockingIssues.length > 0 && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{blockingIssues.length} issues</span>}
                </div>
                <p className="text-2xl font-bold tabular-nums">{activeEmployees.length}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.activeEmployees")}</p>
              </button>
            )}
            {hasTimeleave && (
              <button onClick={() => navigate("/time-leave/leave")} className="p-4 rounded-xl border border-border/50 hover:border-cyan-400/50 hover:shadow-sm transition-all text-left">
                <div className="flex items-center justify-between mb-2">
                  <CalendarDays className="h-4 w-4 text-cyan-500" />
                  {pendingLeave > 0 && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{pendingLeave} pending</span>}
                </div>
                <p className="text-2xl font-bold tabular-nums">{onLeaveToday}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.onLeaveToday")}</p>
              </button>
            )}
            {compliance && (
              <button onClick={() => navigate("/payroll/tax")} className="p-4 rounded-xl border border-border/50 hover:border-border hover:shadow-sm transition-all text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{t("dashboard.compliance")}</span>
                </div>
                <div className="space-y-1.5">
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

        {/* ── Quick Actions ── */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("dashboard.quickActions")}</p>
          <div className="flex flex-wrap gap-2">
            {hasPayroll && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/payroll/run")}>
                <Play className="h-3.5 w-3.5 text-green-500" /> {t("dashboard.runPayroll")}
              </Button>
            )}
            {hasStaff && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/people/add")}>
                <UserPlus className="h-3.5 w-3.5 text-blue-500" /> {t("dashboard.addEmployee")}
              </Button>
            )}
            {hasTimeleave && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/time-leave/attendance")}>
                <CalendarCheck className="h-3.5 w-3.5 text-cyan-500" /> {t("nav.attendance")}
              </Button>
            )}
            {hasModule("money") && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/money/invoices")}>
                <Wallet className="h-3.5 w-3.5 text-indigo-500" /> {t("nav.invoices")}
              </Button>
            )}
            {donorExportEnabled && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/reports/donor-export")}>
                <FolderKanban className="h-3.5 w-3.5 text-orange-500" /> {t("dashboard.donorExport")}
              </Button>
            )}
          </div>
        </div>

        {/* Document Expiry Alerts */}
        {hasStaff && <DocumentAlertsCard className="border-border/50" maxItems={5} />}
      </div>

      {/* ── Sticky Bottom Bar — Next Action (inside content flow, not over sidebar) ── */}
      {nextAction && (
        <div className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-6 px-6">
          <div className="py-3 flex items-center gap-3">
            <Zap className={`h-4 w-4 shrink-0 ${nextAction.urgent ? "text-amber-500" : "text-primary"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{t("dashboard.nextRecommendedAction")}</p>
              <p className="text-sm font-medium truncate">{nextAction.label}</p>
            </div>
            <Button size="sm" onClick={() => navigate(nextAction.path)} className={nextAction.urgent ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}>
              {t("dashboard.doItNow")}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      <KeyboardShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
    </div>
  );
}
