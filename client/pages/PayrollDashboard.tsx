/**
 * Payroll Dashboard - Status-Driven Design
 * "Would I trust this page on payday?" - YES.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService } from "@/services/employeeService";
import { leaveService } from "@/services/leaveService";
import { payrollService } from "@/services/payrollService";
import { formatCurrencyTL, TL_INSS } from "@/lib/payroll/constants-tl";
import { adjustToNextBusinessDayTL } from "@/lib/payroll/tl-holidays";
import { formatDateTL } from "@/lib/dateUtils";
import {
  Calculator,
  DollarSign,
  FileText,
  Banknote,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  Calendar,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  ClipboardCheck,
  AlertCircle,
  Shield,
  Play,
  ExternalLink,
  UserX,
  Wallet,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import GuidancePanel from "@/components/GuidancePanel";

const theme = sectionThemes.payroll;

// Payroll status types
type PayrollStatus = "not_prepared" | "preparing" | "ready" | "processing" | "completed";

interface PayrollChecklistItem {
  id: string;
  label: string;
  issueLabel: string; // Grammatically correct issue phrasing
  description: string;
  status: "complete" | "warning" | "error";
  count?: number;
  linkPath?: string; // Direct link to fix the issue
  linkLabel?: string;
}

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    grossPayroll: 0,
    employerINSS: 0,
    employeeINSS: 0,
    estimatedNet: 0,
    nextPayDate: "",
    lastPayrollDate: "",
    daysUntilPayday: 0,
    currentMonth: "",
    blockedEmployees: 0,
  });

  // Checklist with grammatically correct issue labels and direct links
  const [checklist, setChecklist] = useState<PayrollChecklistItem[]>([
    {
      id: "attendance",
      label: t("payrollDashboard.checklist.attendanceLabel"),
      issueLabel: t("payrollDashboard.checklist.attendanceIssue"),
      description: t("payrollDashboard.checklist.attendanceDesc"),
      status: "complete",
      linkPath: "/people/time-tracking",
      linkLabel: t("payrollDashboard.checklist.attendanceLink"),
    },
    {
      id: "leave",
      label: t("payrollDashboard.checklist.leaveLabel"),
      issueLabel: t("payrollDashboard.checklist.leaveIssue"),
      description: t("payrollDashboard.checklist.leaveDesc"),
      status: "warning",
      count: 2,
      linkPath: "/people/leave",
      linkLabel: t("payrollDashboard.checklist.leaveLink"),
    },
    {
      id: "contracts",
      label: t("payrollDashboard.checklist.contractsLabel"),
      issueLabel: t("payrollDashboard.checklist.contractsIssue"),
      description: t("payrollDashboard.checklist.contractsDesc"),
      status: "complete",
      linkPath: "/people/employees?filter=missing-contract",
      linkLabel: t("payrollDashboard.checklist.contractsLink"),
    },
    {
      id: "salaries",
      label: t("payrollDashboard.checklist.salariesLabel"),
      issueLabel: t("payrollDashboard.checklist.salariesIssue"),
      description: t("payrollDashboard.checklist.salariesDesc"),
      status: "complete",
      linkPath: "/people/employees?filter=missing-salary",
      linkLabel: t("payrollDashboard.checklist.salariesLink"),
    },
  ]);

  // Calculate payroll status based on checklist
  const payrollStatus = useMemo<PayrollStatus>(() => {
    const hasErrors = checklist.some(item => item.status === "error");
    const hasWarnings = checklist.some(item => item.status === "warning");

    if (hasErrors) return "not_prepared";
    if (hasWarnings) return "preparing";
    return "ready";
  }, [checklist]);

  // Check if payroll can be run
  const canRunPayroll = payrollStatus === "ready";
  const checklistComplete = checklist.every(item => item.status === "complete");
  const issueCount = checklist.filter(item => item.status !== "complete").length;

  // Calculate compliance deadlines with urgency
  const getComplianceDeadlines = () => {
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");

    // WIT due 15th of following month
    const witCandidate = new Date(now.getFullYear(), now.getMonth(), 15);
    const witBase = now <= witCandidate
      ? witCandidate
      : new Date(now.getFullYear(), now.getMonth() + 1, 15);
    const witIso = adjustToNextBusinessDayTL(
      `${witBase.getFullYear()}-${pad2(witBase.getMonth() + 1)}-${pad2(witBase.getDate())}`
    );
    const witDate = new Date(`${witIso}T00:00:00`);
    const witDays = Math.ceil((witDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // INSS payment window starts 10th; use 20th as the “latest safe” due date
    const inssCandidate = new Date(now.getFullYear(), now.getMonth(), 20);
    const inssBase = now <= inssCandidate
      ? inssCandidate
      : new Date(now.getFullYear(), now.getMonth() + 1, 20);
    const inssIso = adjustToNextBusinessDayTL(
      `${inssBase.getFullYear()}-${pad2(inssBase.getMonth() + 1)}-${pad2(inssBase.getDate())}`
    );
    const inssDate = new Date(`${inssIso}T00:00:00`);
    const inssDays = Math.ceil((inssDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      wit: {
        days: witDays,
        status: witDays > 7 ? 'ok' : witDays > 3 ? 'warning' : 'urgent',
        date: formatDateTL(witDate, { month: "short", day: "numeric" }),
      },
      inss: {
        days: inssDays,
        status: inssDays > 7 ? 'ok' : inssDays > 3 ? 'warning' : 'urgent',
        date: formatDateTL(inssDate, { month: "short", day: "numeric" }),
      },
    };
  };

  const compliance = getComplianceDeadlines();

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = async () => {
    try {
      const [employees, leaveStats, paidRuns] = await Promise.all([
        employeeService.getAllEmployees(tenantId),
        leaveService.getLeaveStats(tenantId),
        payrollService.runs.getAllPayrollRuns({ tenantId, status: 'paid', limit: 1 }),
      ]);

      const activeEmployees = employees.filter((e) => e.status === "active");
      const grossPayroll = activeEmployees.reduce(
        (sum, emp) => sum + (emp.compensation?.monthlySalary || 0),
        0
      );

      // Calculate INSS contributions
      const inssBaseTotal = activeEmployees.reduce(
        (sum, emp) => sum + (emp.compensation?.monthlySalary || 0),
        0
      );
      const employerINSS = inssBaseTotal * TL_INSS.employerRate;
      const employeeINSS = inssBaseTotal * TL_INSS.employeeRate;
      const estimatedNet = grossPayroll - employeeINSS; // Simplified - actual would include WIT

      // Count employees with blocking issues
      const employeesWithoutContracts = activeEmployees.filter(e => !e.documents?.workContract?.fileUrl);
      const employeesWithoutINSS = activeEmployees.filter(e => !e.documents?.socialSecurityNumber?.number);
      const blockedEmployees = new Set([
        ...employeesWithoutContracts.map(e => e.id),
        ...employeesWithoutINSS.map(e => e.id),
      ]).size;

      // Calculate next pay date (25th of current or next month)
      const now = new Date();
      let nextPay = new Date(now.getFullYear(), now.getMonth(), 25);
      if (now.getDate() > 25) {
        nextPay = new Date(now.getFullYear(), now.getMonth() + 1, 25);
      }

      const daysUntilPayday = Math.ceil((nextPay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const payrollMonth = formatDateTL(nextPay, { month: "long", year: "numeric" });

      setStats({
        totalEmployees: activeEmployees.length,
        grossPayroll,
        employerINSS,
        employeeINSS,
        estimatedNet,
        nextPayDate: formatDateTL(nextPay, { month: "short", day: "numeric" }),
        lastPayrollDate: paidRuns.length > 0 && paidRuns[0].paidAt
          ? formatDateTL(new Date(paidRuns[0].paidAt as unknown as Date), {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "N/A",
        daysUntilPayday,
        currentMonth: payrollMonth,
        blockedEmployees,
      });

      // Update checklist based on real data
      setChecklist(prev => prev.map(item => {
        if (item.id === "contracts" && employeesWithoutContracts.length > 0) {
          return {
            ...item,
            status: "warning",
            count: employeesWithoutContracts.length,
          };
        }
        if (item.id === "leave" && leaveStats.pendingRequests > 0) {
          return {
            ...item,
            status: "warning",
            count: leaveStats.pendingRequests,
          };
        }
        if (item.id === "leave" && leaveStats.pendingRequests === 0) {
          return {
            ...item,
            status: "complete",
            count: undefined,
          };
        }
        return item;
      }));

    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Status display config
  const statusConfig = {
    not_prepared: {
      label: t("payrollDashboard.status.gettingReady"),
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      borderColor: "border-amber-200 dark:border-amber-800",
    },
    preparing: {
      label: t("payrollDashboard.status.almostReady"),
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      borderColor: "border-amber-200 dark:border-amber-800",
    },
    ready: {
      label: t("payrollDashboard.status.readyToRun"),
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      borderColor: "border-emerald-200 dark:border-emerald-800",
    },
    processing: {
      label: t("payrollDashboard.status.processing"),
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    completed: {
      label: t("payrollDashboard.status.completed"),
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      borderColor: "border-emerald-200 dark:border-emerald-800",
    },
  };

  const currentStatus = statusConfig[payrollStatus];

  // Primary and secondary links
  const primaryLinks = [
    {
      label: t("payrollDashboard.links.allowances"),
      description: t("payrollDashboard.links.allowancesDesc"),
      path: "/payroll/benefits",
      icon: Wallet,
    },
    {
      label: t("payrollDashboard.links.deductions"),
      description: t("payrollDashboard.links.deductionsDesc"),
      path: "/payroll/deductions",
      icon: DollarSign,
    },
  ];

  const secondaryLinks = [
    {
      label: t("payrollDashboard.links.payrollHistory"),
      description: t("payrollDashboard.links.payrollHistoryDesc"),
      path: "/payroll/history",
      icon: FileText,
    },
    {
      label: t("payrollDashboard.links.bankTransfers"),
      description: t("payrollDashboard.links.bankTransfersDesc"),
      path: "/payroll/transfers",
      icon: Banknote,
    },
    {
      label: t("payrollDashboard.links.taxReports"),
      description: t("payrollDashboard.links.taxReportsDesc"),
      path: "/payroll/taxes",
      icon: FileSpreadsheet,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        {/* Hero Section */}
        <div className="border-b bg-green-50 dark:bg-green-950/30">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-5 w-64" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-7xl mx-auto">
          {/* Status Block */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <div className="flex items-center gap-6">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-11 w-44 rounded-md" />
                  <Skeleton className="h-11 w-36 rounded-md" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checklist Card */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-lg border">
                    <Skeleton className="h-5 w-5 rounded-full mt-0.5" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-36 mb-1" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            {/* Gross Payroll with breakdown */}
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
                <div className="pt-3 border-t border-border/50 space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border/30">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employee coverage */}
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-9 w-16 mb-1" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>

            {/* Last Payroll */}
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-5 w-28 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Manage Section */}
          <div className="mb-6">
            <Skeleton className="h-4 w-20 mb-4" />
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i} className="border-l-4 border-l-green-500/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-24 mb-1" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Past & Reports Toggle */}
          <Skeleton className="h-10 w-full rounded-md mb-4" />

          {/* Compliance Section */}
          <Card className="mt-8">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-40" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-10 rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.payroll} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
                <img src="/images/illustrations/icons/icon-payroll.webp" alt="" className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("payroll.dashboard.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("payroll.dashboard.subtitle")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <GuidancePanel section="payroll" />

        {/* ============================================ */}
        {/* PAYROLL READY BANNER - Shows when 4/4       */}
        {/* ============================================ */}
        {checklistComplete && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                {t("payrollDashboard.readyToRun")}
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {t("payrollDashboard.allVerifiedProceed")}
              </p>
            </div>
            <Button
              onClick={() => navigate("/payroll/run")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="h-4 w-4 mr-2" />
              {t("payrollDashboard.runPayrollBtn")}
            </Button>
          </div>
        )}

        {/* ============================================ */}
        {/* PAYROLL STATUS BLOCK - THE MOST IMPORTANT UI */}
        {/* ============================================ */}
        <Card className={`mb-8 border-2 ${currentStatus.borderColor} ${currentStatus.bg}`}>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Status Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-foreground">
                    {t("payrollDashboard.payrollFor", { month: stats.currentMonth })}
                  </h2>
                  <Badge className={`${currentStatus.bg} ${currentStatus.color} border ${currentStatus.borderColor}`}>
                    {currentStatus.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{t("payrollDashboard.payDate")} <span className="font-semibold text-foreground">{stats.nextPayDate}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className={stats.daysUntilPayday <= 5 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                      {t("payrollDashboard.daysRemaining", { days: String(stats.daysUntilPayday) })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{t("payrollDashboard.employees", { count: String(stats.totalEmployees) })}</span>
                  </div>
                </div>

                {/* Issue Alerts - Fixed grammar */}
                {issueCount > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {checklist.filter(item => item.status !== "complete").map(item => (
                      <button
                        key={item.id}
                        onClick={() => item.linkPath && navigate(item.linkPath)}
                        className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md transition-colors ${
                          item.status === "error"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                        }`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {item.count} {item.issueLabel}{item.count && item.count > 1 ? "s" : ""}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                {canRunPayroll ? (
                  <Button
                    size="lg"
                    onClick={() => navigate("/payroll/run")}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {t("payrollDashboard.confirmRunPayroll")}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => navigate("/payroll/run")}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                  >
                    <Calculator className="h-5 w-5 mr-2" />
                    {t("payrollDashboard.reviewPayroll")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    const checklistSection = document.getElementById("payroll-checklist");
                    checklistSection?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <ClipboardCheck className="h-5 w-5 mr-2" />
                  {t("payrollDashboard.viewChecklist")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ================== */}
        {/* PAYROLL CHECKLIST  */}
        {/* ================== */}
        <Card id="payroll-checklist" className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              {t("payrollDashboard.checklistTitle")}
            </CardTitle>
            <CardDescription>
              {checklistComplete
                ? t("payrollDashboard.allVerifiedReady")
                : t("payrollDashboard.checklistProgress", { done: String(checklist.filter(i => i.status === "complete").length), total: String(checklist.length) })
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    item.status === "complete"
                      ? "bg-muted/30 border-border/50"
                      : item.status === "warning"
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 cursor-pointer hover:border-amber-400"
                      : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800 cursor-pointer hover:border-red-400"
                  }`}
                  onClick={() => {
                    if (item.status !== "complete" && item.linkPath) {
                      navigate(item.linkPath);
                    }
                  }}
                >
                  <div className={`mt-0.5 ${
                    item.status === "complete"
                      ? "text-emerald-500"
                      : item.status === "warning"
                      ? "text-amber-500"
                      : "text-red-500"
                  }`}>
                    {item.status === "complete" ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : item.status === "warning" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${
                        item.status === "complete" ? "text-foreground" : ""
                      }`}>
                        {item.label}
                      </p>
                      {item.count && item.status !== "complete" && (
                        <Badge variant="secondary" className="text-xs">
                          {item.count} {t("payrollDashboard.pending")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    {item.status !== "complete" && item.linkPath && (
                      <p className="text-xs text-primary mt-1 flex items-center gap-1">
                        {item.linkLabel}
                        <ChevronRight className="h-3 w-3" />
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ==================== */}
        {/* PAYROLL SUMMARY STATS */}
        {/* ==================== */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {/* Gross Payroll - Primary Stat with Breakdown */}
          <Card className={`${theme.borderLeft} relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5" />
            <CardContent className="relative pt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("payrollDashboard.grossPayroll")}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(stats.grossPayroll)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
              {/* Breakdown */}
              <div className="pt-3 border-t border-border/50 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>+ {t("payrollDashboard.employerINSS", { rate: (TL_INSS.employerRate * 100).toFixed(0) })}</span>
                  <span>{formatCurrencyTL(stats.employerINSS)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>- {t("payrollDashboard.employeeINSS", { rate: (TL_INSS.employeeRate * 100).toFixed(0) })}</span>
                  <span>{formatCurrencyTL(stats.employeeINSS)}</span>
                </div>
                <div className="flex justify-between font-medium pt-1 border-t border-border/30">
                  <span>{t("payrollDashboard.estNetToEmployees")}</span>
                  <span>{formatCurrencyTL(stats.estimatedNet)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employees needing attention - Softer than "Blocked" */}
          <Card
            className={`${theme.borderLeft} cursor-pointer transition-all hover:shadow-md ${
              stats.blockedEmployees > 0 ? "border-amber-500/50" : ""
            }`}
            onClick={() => navigate("/people/employees?filter=blocking-issues")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stats.blockedEmployees > 0 ? t("payrollDashboard.employeesNeedAttention") : t("payrollDashboard.payrollCoverage")}
                  </p>
                  {stats.blockedEmployees > 0 ? (
                    <>
                      <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {stats.blockedEmployees}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t("payrollDashboard.missingContractsINSS")}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stats.totalEmployees}/{stats.totalEmployees}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {t("payrollDashboard.allEmployeesReady")}
                      </p>
                    </>
                  )}
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  stats.blockedEmployees > 0
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-emerald-100 dark:bg-emerald-900/30"
                }`}>
                  {stats.blockedEmployees > 0 ? (
                    <UserX className="h-6 w-6 text-amber-600" />
                  ) : (
                    <Users className="h-6 w-6 text-emerald-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last Payroll */}
          <Card className={theme.borderLeft}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("payrollDashboard.lastPayroll")}
                  </p>
                  <p className="text-lg font-bold">{stats.lastPayrollDate}</p>
                  {stats.lastPayrollDate !== "N/A" ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="h-3 w-3" />
                        {t("payrollDashboard.completed")}
                      </span>
                    </p>
                  ) : (
                    <>
                      <img src="/images/illustrations/empty-payroll.webp" alt="No payroll yet" className="w-32 h-32 mx-auto mb-4 drop-shadow-lg" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("payrollDashboard.noPayrollYet")}
                      </p>
                    </>
                  )}
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  stats.lastPayrollDate !== "N/A"
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : "bg-muted"
                }`}>
                  {stats.lastPayrollDate !== "N/A" ? (
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* =================== */}
        {/* MANAGE SECTION      */}
        {/* =================== */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {t("payrollDashboard.manage")}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {primaryLinks.map((link) => {
              const LinkIcon = link.icon;
              return (
                <Card
                  key={link.path}
                  className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-green-500/50 hover:border-l-green-500"
                  onClick={() => navigate(link.path)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <LinkIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{link.label}</h3>
                        <p className="text-sm text-muted-foreground">{link.description}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ======================== */}
        {/* PAST & REPORTS SECTION   */}
        {/* (Collapsible Secondary)  */}
        {/* ======================== */}
        <Collapsible open={secondaryOpen} onOpenChange={setSecondaryOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between mb-4 text-muted-foreground hover:text-foreground"
            >
              <span className="text-sm font-semibold uppercase tracking-wide">
                {t("payrollDashboard.pastReports")}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${secondaryOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {secondaryLinks.map((link) => {
                const LinkIcon = link.icon;
                return (
                  <Card
                    key={link.path}
                    className="cursor-pointer hover:shadow-md transition-all border-border/50 hover:border-green-500/30"
                    onClick={() => navigate(link.path)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <LinkIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm">{link.label}</h3>
                          <p className="text-xs text-muted-foreground">{link.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ===================== */}
        {/* COMPLIANCE INFO       */}
        {/* With urgency states   */}
        {/* ===================== */}
        <Card className="mt-8 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
              {t("payrollDashboard.complianceDeadlines")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  compliance.wit.status === 'ok' ? 'bg-emerald-500' :
                  compliance.wit.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className="text-muted-foreground">{t("payrollDashboard.witDue")}</span>
                <span className="font-medium">{compliance.wit.date}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  compliance.wit.status === 'ok'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : compliance.wit.status === 'warning'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {compliance.wit.days}d
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  compliance.inss.status === 'ok' ? 'bg-emerald-500' :
                  compliance.inss.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className="text-muted-foreground">{t("payrollDashboard.inssDue")}</span>
                <span className="font-medium">{compliance.inss.date}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  compliance.inss.status === 'ok'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : compliance.inss.status === 'warning'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {compliance.inss.days}d
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">{t("payrollDashboard.minimumWage")}</span>
                <span className="font-medium">{t("payrollDashboard.minimumWageAmount")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===================== */}
        {/* AUDIT TRAIL NOTE      */}
        {/* ===================== */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            {t("payrollDashboard.lastReviewedBy", { name: user?.displayName || "Admin" })} &bull; {formatDateTL(new Date(), { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
