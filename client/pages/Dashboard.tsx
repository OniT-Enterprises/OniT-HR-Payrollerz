/**
 * Dashboard - Enterprise Command Center
 * Answers: "Is anything wrong, urgent, or blocking payroll?"
 * Structure: Status → Action Required → KPIs → Quick Actions
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import { employeeService, type Employee } from "@/services/employeeService";
import { departmentService } from "@/services/departmentService";
import { leaveService } from "@/services/leaveService";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { settingsService } from "@/services/settingsService";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import {
  Users,
  DollarSign,
  UserPlus,
  ChevronRight,
  FileText,
  Calculator,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  CalendarDays,
  HelpCircle,
  AlertTriangle,
  Play,
  Zap,
} from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { SEO, seoConfig } from "@/components/SEO";
import DocumentAlertsCard from "@/components/dashboard/DocumentAlertsCard";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-12" />
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-xl" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Next Action Card */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-3 w-36 mb-1" />
                <Skeleton className="h-5 w-48" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-7 w-20 mb-1" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-28 rounded-md" />
                <Skeleton className="h-8 w-32 rounded-md" />
                <Skeleton className="h-8 w-36 rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attention Required */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { session } = useTenant();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [onLeaveToday, setOnLeaveToday] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts({
    enabled: true,
    onShowHelp: () => setShowShortcuts(true),
  });

  // Redirect to setup wizard if setup is incomplete (owner/hr-admin only)
  // Skipped if user dismissed the wizard this session
  useEffect(() => {
    const checkSetup = async () => {
      const role = session?.role;
      if (role !== "owner" && role !== "hr-admin") return;
      if (sessionStorage.getItem("setup-dismissed")) return;
      try {
        const progress = await settingsService.getSetupProgress(tenantId);
        if (!progress.isComplete) {
          navigate("/setup", { replace: true });
        }
      } catch {
        // Settings don't exist - redirect to setup
        navigate("/setup", { replace: true });
      }
    };
    if (tenantId && tenantId !== "local-dev-tenant") {
      checkSetup();
    }
  }, [tenantId, session?.role, navigate]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [employeesResult, leaveStatsResult] = await Promise.allSettled([
        employeeService.getAllEmployees(tenantId),
        leaveService.getLeaveStats(tenantId),
      ]);

      if (employeesResult.status === 'fulfilled') {
        setEmployees(employeesResult.value);
      } else {
        setEmployees([]);
      }

      if (leaveStatsResult.status === 'fulfilled') {
        setPendingLeave(leaveStatsResult.value.pendingRequests);
        setOnLeaveToday(leaveStatsResult.value.employeesOnLeaveToday);
      } else {
        setPendingLeave(0);
        setOnLeaveToday(0);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Derived data
  const activeEmployees = employees.filter((e) => e.status === "active");
  const totalPayroll = activeEmployees.reduce(
    (sum, emp) => sum + (emp.compensation?.monthlySalary || 0),
    0
  );

  // Calculate days until next payroll (25th)
  const getDaysUntilPayday = () => {
    const now = new Date();
    let nextPay = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() > 25) {
      nextPay = new Date(now.getFullYear(), now.getMonth() + 1, 25);
    }
    return Math.ceil((nextPay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Compliance deadlines (Timor-Leste specific)
  const getComplianceStatus = () => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Subsidio Anual (13th month) - Due December 20
    const subsidioDate = new Date(currentYear, 11, 20);
    let daysToSubsidio = Math.ceil((subsidioDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToSubsidio < 0) daysToSubsidio += 365;

    // INSS & WIT - Due 15th of following month
    let taxDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    if (now.getDate() > 15) {
      taxDate = new Date(now.getFullYear(), now.getMonth() + 2, 15);
    }
    const daysToTax = Math.ceil((taxDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      wit: { days: daysToTax, status: daysToTax > 7 ? 'ok' : daysToTax > 3 ? 'warning' : 'urgent' },
      inss: { days: daysToTax, status: daysToTax > 7 ? 'ok' : daysToTax > 3 ? 'warning' : 'urgent' },
      subsidio: { days: daysToSubsidio, status: daysToSubsidio > 60 ? 'ok' : daysToSubsidio > 30 ? 'warning' : 'urgent' },
    };
  };

  // Check for blocking issues (incomplete onboarding)
  const getBlockingIssues = useMemo(() => {
    const issues: Array<{ employee: Employee; issue: string; action: string; path: string }> = [];

    employees.forEach((emp) => {
      if (!emp.documents?.socialSecurityNumber?.number) {
        issues.push({
          employee: emp,
          issue: "Missing INSS number",
          action: "Add INSS",
          path: `/people/employees?id=${emp.id}&edit=true`,
        });
      }
      if (!emp.documents?.workContract?.fileUrl) {
        issues.push({
          employee: emp,
          issue: "Contract not uploaded",
          action: "Upload",
          path: `/people/employees?id=${emp.id}&tab=documents`,
        });
      }
    });

    return issues.slice(0, 4); // Show max 4 issues
  }, [employees]);

  const daysUntilPayday = getDaysUntilPayday();
  const compliance = getComplianceStatus();
  const firstName = user?.displayName?.split(" ")[0] || "there";

  // Payroll status
  const payrollPrepared = false; // In production, check actual payroll status
  const isPayrollUrgent = daysUntilPayday <= 7;
  const isPayrollSafe = daysUntilPayday > 14 || payrollPrepared;

  // Next recommended action logic
  const getNextAction = () => {
    if (isPayrollUrgent && !payrollPrepared) {
      return { label: "Prepare payroll", path: "/payroll/run", urgent: true };
    }
    if (getBlockingIssues.length > 0) {
      return { label: `Fix ${getBlockingIssues.length} blocking issue${getBlockingIssues.length > 1 ? 's' : ''}`, path: getBlockingIssues[0].path, urgent: true };
    }
    if (pendingLeave > 0) {
      return { label: `Review ${pendingLeave} leave request${pendingLeave > 1 ? 's' : ''}`, path: "/people/leave", urgent: false };
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

      <div className="p-6 max-w-6xl mx-auto">
        {/* Header - Minimal */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName}
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

        {/* ═══════════════════════════════════════════════════════════════
            TODAY'S STATUS - 3 Cards: Payroll (PRIMARY), Compliance, Team
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {/* PAYROLL STATUS - PRIMARY CARD */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-lg ${
              isPayrollUrgent && !payrollPrepared
                ? "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/30"
                : isPayrollSafe
                  ? "border-border/50"
                  : "border-green-500/30"
            }`}
            onClick={() => navigate("/payroll/run")}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Payroll Status</p>
                  <p className="text-3xl font-bold">{daysUntilPayday} days</p>
                  <p className="text-sm text-muted-foreground">until pay date (25th)</p>
                </div>
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                  isPayrollUrgent
                    ? "bg-green-500 text-white"
                    : "bg-muted"
                }`}>
                  <Calculator className="h-6 w-6" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  {payrollPrepared ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">Prepared</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">Not prepared</span>
                    </>
                  )}
                </div>
                <Button
                  size="sm"
                  className={isPayrollUrgent
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : ""
                  }
                  variant={isPayrollUrgent ? "default" : "outline"}
                >
                  {payrollPrepared ? "Review" : "Prepare"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* COMPLIANCE STATUS - Timeline Strip */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Compliance</p>
                  <p className="text-lg font-semibold mt-1">
                    {compliance.wit.status === 'ok' && compliance.inss.status === 'ok'
                      ? "On track"
                      : "Needs attention"}
                  </p>
                </div>
              </div>

              {/* Visual Timeline Strip */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${
                    compliance.wit.status === 'ok' ? 'bg-green-500' :
                    compliance.wit.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm flex-1">WIT</span>
                  <span className="text-xs text-muted-foreground">{compliance.wit.days}d</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${
                    compliance.inss.status === 'ok' ? 'bg-green-500' :
                    compliance.inss.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm flex-1">INSS</span>
                  <span className="text-xs text-muted-foreground">{compliance.inss.days}d</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${
                    compliance.subsidio.status === 'ok' ? 'bg-green-500' :
                    compliance.subsidio.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm flex-1">13th Month</span>
                  <span className="text-xs text-muted-foreground">{compliance.subsidio.days}d</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TEAM STATUS */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Team Status</p>
                  <p className="text-lg font-semibold mt-1">
                    {activeEmployees.length - onLeaveToday} / {activeEmployees.length} present
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">On leave today</span>
                  <span className={onLeaveToday > 0 ? "font-medium" : "text-muted-foreground"}>{onLeaveToday}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending requests</span>
                  <span className={pendingLeave > 0 ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                    {pendingLeave}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            NEXT RECOMMENDED ACTION - Smart suggestion
        ═══════════════════════════════════════════════════════════════ */}
        {nextAction && (
          <Card className={`mb-6 cursor-pointer transition-all hover:shadow-md ${
            nextAction.urgent
              ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
              : "border-primary/30"
          }`} onClick={() => navigate(nextAction.path)}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  nextAction.urgent
                    ? "bg-amber-500 text-white"
                    : "bg-primary/10"
                }`}>
                  <Zap className={`h-5 w-5 ${nextAction.urgent ? "" : "text-primary"}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next recommended action</p>
                  <p className="font-semibold">{nextAction.label}</p>
                </div>
                <Button size="sm" variant={nextAction.urgent ? "default" : "outline"} className={
                  nextAction.urgent ? "bg-amber-500 hover:bg-amber-600" : ""
                }>
                  Do it now
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            KPIs - 3 Only: Active Employees, Monthly Payroll, Next Payroll
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card className="border-border/50 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => navigate("/people/employees")}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{activeEmployees.length}</p>
                  <p className="text-sm text-muted-foreground">Active Employees</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => navigate("/payroll/history")}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatCurrencyTL(totalPayroll)}</p>
                  <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => navigate("/payroll/run")}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatCurrencyTL(totalPayroll)}</p>
                  <p className="text-sm text-muted-foreground">Next Payroll Amount</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            QUICK ACTIONS - 3 Only: Run Payroll, Add Employee, Generate Report
        ═══════════════════════════════════════════════════════════════ */}
        <Card className="mb-6 border-border/50">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Quick actions</span>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className={isPayrollUrgent
                    ? "bg-green-500 hover:bg-green-600 text-white gap-2"
                    : "gap-2"
                  }
                  variant={isPayrollUrgent ? "default" : "outline"}
                  onClick={() => navigate("/payroll/run")}
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Payroll
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/people/add")}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Employee
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/reports")}>
                  <FileText className="h-3.5 w-3.5" />
                  Generate Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            ATTENTION REQUIRED - Blocking issues before payroll
        ═══════════════════════════════════════════════════════════════ */}
        {getBlockingIssues.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Attention Required
              </CardTitle>
              <CardDescription>Fix these before running payroll</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {getBlockingIssues.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50 hover:border-amber-500/30 transition-colors cursor-pointer"
                    onClick={() => navigate(item.path)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-muted">
                          {item.employee.personalInfo.firstName[0]}
                          {item.employee.personalInfo.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {item.employee.personalInfo.firstName} {item.employee.personalInfo.lastName}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">{item.issue}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-amber-600 dark:text-amber-400 hover:text-amber-700">
                      {item.action}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            DOCUMENT EXPIRY ALERTS - Employee documents requiring attention
        ═══════════════════════════════════════════════════════════════ */}
        <DocumentAlertsCard className="border-border/50" maxItems={5} />
      </div>

      <KeyboardShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
    </div>
  );
}
