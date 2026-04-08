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
import GuidancePanel from "@/components/GuidancePanel";

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

      <div className="p-6 mx-auto max-w-screen-2xl">
        {/* Greeting — friendly, brief */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {new Date().getHours() < 12 ? t("common.greetingMorning") : new Date().getHours() < 18 ? t("common.greetingAfternoon") : t("common.greetingEvening")}, {firstName}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setShowShortcuts(true)}
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">?</kbd>
          </Button>
        </div>

        <GuidancePanel section="dashboard" />

        {/* ════════════════════════════════════════════════════════════
            QUICK ACTIONS — big tappable buttons, first thing after greeting
        ════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {hasPayroll && (
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2 hover:border-green-400 hover:bg-green-50/50 dark:hover:bg-green-950/20"
              onClick={() => navigate("/payroll/run")}
            >
              <Play className="h-5 w-5 text-green-600" />
              <span className="text-xs font-medium">{t("dashboard.runPayroll")}</span>
            </Button>
          )}
          {hasStaff && (
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
              onClick={() => navigate("/people/add")}
            >
              <UserPlus className="h-5 w-5 text-blue-600" />
              <span className="text-xs font-medium">{t("dashboard.addEmployee")}</span>
            </Button>
          )}
          {hasTimeleave && (
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2 hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20"
              onClick={() => navigate("/time-leave/attendance")}
            >
              <CalendarCheck className="h-5 w-5 text-cyan-600" />
              <span className="text-xs font-medium">{t("nav.attendance")}</span>
            </Button>
          )}
          {hasModule("money") && (
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
              onClick={() => navigate("/money/invoices")}
            >
              <Wallet className="h-5 w-5 text-indigo-600" />
              <span className="text-xs font-medium">{t("nav.invoices")}</span>
            </Button>
          )}
          {donorExportEnabled && (
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
              onClick={() => navigate("/reports/donor-export")}
            >
              <FolderKanban className="h-5 w-5 text-orange-600" />
              <span className="text-xs font-medium">{t("dashboard.donorExport")}</span>
            </Button>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════
            3 BIG TILES — Payroll / People / Leave
            Each tile: icon + big number + description + action button
        ════════════════════════════════════════════════════════════ */}
        {(hasPayroll || hasStaff || hasTimeleave) && (
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {hasPayroll && (
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isPayrollUrgent
                    ? "border-2 border-green-400 bg-green-50/60 dark:bg-green-950/20 dark:border-green-700"
                    : "border-border/50"
                }`}
                onClick={() => navigate("/payroll/run")}
              >
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/20 flex items-center justify-center">
                      <Calculator className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-bold">{t("dashboard.payrollStatus")}</p>
                  </div>
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <p className="text-4xl font-extrabold tabular-nums">{daysUntilPayday}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.days")} {t("dashboard.untilPayDate")}</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-muted-foreground">{formatCurrencyTL(totalPayroll)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-3 border-t border-border/50">
                    {payrollPrepared ? (
                      <><CheckCircle className="h-3.5 w-3.5 text-green-500" /><span className="text-xs text-green-600 dark:text-green-400 font-medium">{t("dashboard.prepared")}</span></>
                    ) : (
                      <><AlertCircle className="h-3.5 w-3.5 text-amber-500" /><span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{t("dashboard.notPrepared")}</span></>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {hasStaff && (
              <Card
                className="cursor-pointer transition-all hover:shadow-md border-border/50"
                onClick={() =>
                  blockingIssues.length > 0
                    ? navigate("/people/employees?filter=blocking-issues")
                    : navigate("/people/employees")
                }
              >
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-bold">{t("dashboard.teamStatus")}</p>
                  </div>
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <p className="text-4xl font-extrabold tabular-nums">{activeEmployees.length}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.activeEmployees")}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate("/people/add"); }}>
                      <UserPlus className="h-3 w-3 mr-1" />
                      {t("dashboard.addEmployee")}
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 pt-3 border-t border-border/50">
                    {blockingIssues.length > 0 ? (
                      <><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /><span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{blockingIssues.length} {t("dashboard.needsAttention")}</span></>
                    ) : (
                      <><CheckCircle className="h-3.5 w-3.5 text-green-500" /><span className="text-xs text-green-600 dark:text-green-400 font-medium">{t("dashboard.allGood")}</span></>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {hasTimeleave && (
              <Card
                className="cursor-pointer transition-all hover:shadow-md border-border/50"
                onClick={() => navigate(pendingLeave > 0 ? "/time-leave/leave" : "/time-leave/attendance")}
              >
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
                      <CalendarDays className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-bold">{pendingLeave > 0 ? t("dashboard.pendingRequests") : t("dashboard.teamStatus")}</p>
                  </div>
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <p className="text-4xl font-extrabold tabular-nums">
                        {pendingLeave > 0 ? pendingLeave : activeEmployees.length - onLeaveToday}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pendingLeave > 0 ? t("dashboard.pendingRequests") : `${activeEmployees.length - onLeaveToday}/${activeEmployees.length} ${t("dashboard.present")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-3 border-t border-border/50">
                    {pendingLeave > 0 ? (
                      <><AlertCircle className="h-3.5 w-3.5 text-amber-500" /><span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{t("common.review")}</span></>
                    ) : (
                      <><CheckCircle className="h-3.5 w-3.5 text-green-500" /><span className="text-xs text-muted-foreground">{onLeaveToday} {t("dashboard.onLeaveToday")}</span></>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            COMPLIANCE — inline strip, not hidden in MoreDetailsSection
        ════════════════════════════════════════════════════════════ */}
        {compliance && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6 px-1 text-sm">
            <span className="text-muted-foreground font-medium">{t("dashboard.compliance")}:</span>
            {[
              { label: t("dashboard.wit"), ...compliance.wit },
              { label: t("dashboard.inss"), ...compliance.inss },
              { label: t("dashboard.thirteenthMonth"), ...compliance.subsidio },
            ].map((d) => (
              <span key={d.label} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${
                  d.status === 'ok' ? 'bg-emerald-500' : d.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className="text-muted-foreground">{d.label}</span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  d.status === 'ok'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : d.status === 'warning'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>{d.days}d</span>
              </span>
            ))}
          </div>
        )}

        {/* Attention — compact banner */}
        {blockingIssues.length > 0 && (
          <div
            className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/50 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
            onClick={() => navigate("/people/employees?filter=blocking-issues")}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold">{blockingIssues.length}</span> {t("dashboard.attentionRequiredDesc")}
              </span>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300">
              {t("common.review")}
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            NEXT RECOMMENDED ACTION — at the bottom, not screaming at top
        ════════════════════════════════════════════════════════════ */}
        {nextAction && (
          <Card
            className={`mb-6 cursor-pointer transition-all hover:shadow-md border ${
              nextAction.urgent
                ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800"
                : "border-border/50"
            }`}
            onClick={() => navigate(nextAction.path)}
          >
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  nextAction.urgent
                    ? "bg-amber-500 text-white"
                    : "bg-primary/10 text-primary"
                }`}>
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{t("dashboard.nextRecommendedAction")}</p>
                  <p className="text-sm font-semibold">{nextAction.label}</p>
                </div>
                <Button size="sm" variant={nextAction.urgent ? "default" : "outline"} className={
                  nextAction.urgent ? "bg-amber-500 hover:bg-amber-600" : ""
                }>
                  {t("dashboard.doItNow")}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Expiry Alerts */}
        {hasStaff && <DocumentAlertsCard className="border-border/50" maxItems={5} />}
      </div>

      <KeyboardShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
    </div>
  );
}
