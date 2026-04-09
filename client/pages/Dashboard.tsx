/**
 * Dashboard - Enterprise Command Center
 * Answers: "Is anything wrong, urgent, or blocking payroll?"
 * Structure: Status → Action Required → KPIs → Quick Actions
 */

import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useChatStore } from "@/stores/chatStore";
import { Send } from "lucide-react";
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

function PrimosBotInline({ t, firstName }: { t: (key: string) => string; firstName: string }) {
  const { setOpen, addMessage } = useChatStore();
  const [input, setInput] = useState("");
  const greeting = new Date().getHours() < 12 ? "Bondia" : new Date().getHours() < 18 ? "Botardi" : "Bonite";

  const quickPrompts = [
    { label: t("dashboard.botPromptStaff"), query: "How many employees do we have?" },
    { label: t("dashboard.botPromptPayroll"), query: "When is the next payroll due?" },
    { label: t("dashboard.botPromptLeave"), query: "Who is on leave today?" },
  ];

  const handleSend = useCallback((query: string) => {
    if (!query.trim()) return;
    addMessage({ role: "user", text: query.trim() });
    setOpen(true);
    setInput("");
  }, [addMessage, setOpen]);

  const fullText = `${greeting}${firstName ? `, ${firstName}` : ""}! ${t("dashboard.botGreeting")}`;
  const [charCount, setCharCount] = useState(0);
  const displayedText = fullText.slice(0, charCount);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setCharCount(i);
      if (i >= fullText.length) clearInterval(id);
    }, 25);
    return () => clearInterval(id);
     
  }, [fullText]);

  const greetingEnd = greeting.length + (firstName ? `, ${firstName}` : "").length + 1;

  return (
    <div className="flex-1 min-w-0 space-y-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight">
          {displayedText.slice(0, greetingEnd)}
          {displayedText.length < fullText.length && <span className="inline-block w-0.5 h-5 bg-primary align-text-bottom ml-0.5 animate-pulse" />}
        </h2>
        {displayedText.length > greetingEnd && (
          <p className="text-sm text-muted-foreground mt-0.5">{displayedText.slice(greetingEnd + 1)}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {quickPrompts.map((p) => (
          <button
            key={p.query}
            onClick={() => handleSend(p.query)}
            className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors"
          >
            {p.label}
          </button>
        ))}
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
        <button type="submit" disabled={!input.trim()} className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-primary/90 transition-colors">
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

function GreetingParticles() {
  const hour = new Date().getHours();
  const isNight = hour >= 19 || hour < 6;
  const isMorning = hour >= 6 && hour < 12;

  if (isNight) {
    // Twinkling stars
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/30 dark:bg-white/40"
            style={{
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              left: `${10 + i * 12}%`,
              top: `${15 + (i * 17) % 60}%`,
              animation: `twinkle ${2 + (i % 3) * 0.7}s ease-in-out ${i * 0.4}s infinite`,
            }}
          />
        ))}
        <style>{`@keyframes twinkle { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.4); } }`}</style>
      </div>
    );
  }

  if (isMorning) {
    // Soft rising rays
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <span
            key={i}
            className="absolute bg-gradient-to-t from-amber-300/10 to-transparent dark:from-amber-400/5"
            style={{
              width: "2px",
              height: `${30 + i * 10}%`,
              left: `${60 + i * 8}%`,
              bottom: 0,
              animation: `ray ${3 + i * 0.5}s ease-in-out ${i * 0.6}s infinite`,
              transformOrigin: "bottom",
            }}
          />
        ))}
        <style>{`@keyframes ray { 0%, 100% { opacity: 0.3; transform: scaleY(0.8); } 50% { opacity: 0.7; transform: scaleY(1); } }`}</style>
      </div>
    );
  }

  // Afternoon — gentle floating warm dots
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-primary/10 dark:bg-primary/15"
          style={{
            width: `${4 + i * 2}px`,
            height: `${4 + i * 2}px`,
            left: `${15 + i * 16}%`,
            top: `${30 + (i * 23) % 50}%`,
            animation: `float ${4 + i}s ease-in-out ${i * 0.8}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes float { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; } 50% { transform: translateY(-8px) scale(1.2); opacity: 0.7; } }`}</style>
    </div>
  );
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
        {/* ── PrimosBot greeting card ── */}
        <div className="relative mb-8 rounded-2xl bg-card border border-border p-5 overflow-hidden">
          <GreetingParticles />
          <div className="relative flex items-start gap-4">
            <img
              src="/images/illustrations/primosbot.webp"
              alt="PrimosBot"
              className="h-20 w-20 object-contain shrink-0"
            />
            <PrimosBotInline t={t} firstName={firstName} />
          </div>
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
