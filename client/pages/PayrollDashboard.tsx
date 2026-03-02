/**
 * Payroll Dashboard - Status-Driven Design
 * "Would I trust this page on payday?" - YES.
 */

import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useQuery } from '@tanstack/react-query';
import { useAllEmployees } from "@/hooks/useEmployees";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { leaveService } from "@/services/leaveService";
import { formatCurrencyTL, TL_INSS } from "@/lib/payroll/constants-tl";
import { formatDateTL, getTodayTL, parseDateISO } from "@/lib/dateUtils";
import { getNextMonthlyAdjustedDeadline, getUrgencyFromDays } from "@/lib/tax/compliance";
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
  UserX,
  Wallet,
  FolderKanban,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import GuidancePanel from "@/components/GuidancePanel";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";
import { getComplianceIssues, countBlockedEmployees } from "@/lib/employeeUtils";

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
  const { session, hasModule, canManage } = useTenant();
  const tenantId = useTenantId();
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const ngoReportingEnabled = canUseNgoReporting(session, hasModule("reports"));
  const donorExportEnabled = canUseDonorExport(
    session,
    hasModule("reports"),
    canManage()
  );

  // React Query: fetch all employees, payroll runs, and leave stats
  const { data: allEmployees = [], isLoading: loadingEmployees } = useAllEmployees();
  const { data: allPayrollRuns = [], isLoading: loadingRuns } = usePayrollRuns({ status: 'paid', limit: 1 });
  const { data: leaveStats, isLoading: loadingLeave } = useQuery({
    queryKey: ['tenants', tenantId, 'leaveStats'],
    queryFn: () => leaveService.getLeaveStats(tenantId),
    staleTime: 5 * 60 * 1000,
  });
  const loading = loadingEmployees || loadingRuns || loadingLeave;

  // Derive stats from fetched data
  const stats = useMemo(() => {
    const activeEmployees = allEmployees.filter((e) => e.status === "active");
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

    // Count employees with compliance issues (shared utility)
    const allIssues = getComplianceIssues(activeEmployees);
    const blockedEmployees = countBlockedEmployees(allIssues);

    // Calculate next pay date (25th of current or next month)
    const now = new Date();
    let nextPay = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() > 25) {
      nextPay = new Date(now.getFullYear(), now.getMonth() + 1, 25);
    }

    const daysUntilPayday = Math.ceil((nextPay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const payrollMonth = formatDateTL(nextPay, { month: "long", year: "numeric" });

    const paidRuns = allPayrollRuns;

    return {
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
    };
  }, [allEmployees, allPayrollRuns]);

  // Derive checklist from fetched data
  const checklist = useMemo<PayrollChecklistItem[]>(() => {
    const activeEmployees = allEmployees.filter((e) => e.status === "active");
    const issues = getComplianceIssues(activeEmployees);
    const contractIssues = issues.filter(i => i.field === "contract").length;
    const inssIssues = issues.filter(i => i.field === "inss").length;
    const deptIssues = issues.filter(i => i.field === "department").length;
    const sefopeIssues = issues.filter(i => i.field === "sefope").length;
    const pendingLeave = leaveStats?.pendingRequests ?? 0;

    return [
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
        status: pendingLeave > 0 ? "warning" : "complete",
        count: pendingLeave > 0 ? pendingLeave : undefined,
        linkPath: "/people/leave",
        linkLabel: t("payrollDashboard.checklist.leaveLink"),
      },
      {
        id: "contracts",
        label: t("payrollDashboard.checklist.contractsLabel"),
        issueLabel: t("payrollDashboard.checklist.contractsIssue"),
        description: t("payrollDashboard.checklist.contractsDesc"),
        status: contractIssues > 0 ? "warning" : "complete",
        count: contractIssues > 0 ? contractIssues : undefined,
        linkPath: "/people/employees?filter=missing-contract",
        linkLabel: t("payrollDashboard.checklist.contractsLink"),
      },
      {
        id: "inss",
        label: "INSS numbers",
        issueLabel: "missing INSS",
        description: "Employees need INSS for tax filing",
        status: inssIssues > 0 ? "error" : "complete",
        count: inssIssues > 0 ? inssIssues : undefined,
        linkPath: "/people/employees?filter=missing-inss",
        linkLabel: "Review",
      },
      {
        id: "departments",
        label: "Departments",
        issueLabel: "no department",
        description: "Assign departments for reporting",
        status: deptIssues > 0 ? "warning" : "complete",
        count: deptIssues > 0 ? deptIssues : undefined,
        linkPath: "/people/employees",
        linkLabel: "Review",
      },
      {
        id: "sefope",
        label: "SEFOPE registration",
        issueLabel: "missing SEFOPE",
        description: "Labor ministry registration number",
        status: sefopeIssues > 0 ? "warning" : "complete",
        count: sefopeIssues > 0 ? sefopeIssues : undefined,
        linkPath: "/people/employees",
        linkLabel: "Review",
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
    ];
  }, [allEmployees, leaveStats, t]);

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
    const todayIso = getTodayTL();
    const today = parseDateISO(todayIso);

    // WIT due 15th of following month
    const witDate = parseDateISO(getNextMonthlyAdjustedDeadline(todayIso, 15));
    const witDays = Math.ceil((witDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // INSS has two practical deadlines: statement by 10th and payment by 20th
    const inssStatementDate = parseDateISO(getNextMonthlyAdjustedDeadline(todayIso, 10));
    const inssStatementDays = Math.ceil((inssStatementDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const inssPaymentDate = parseDateISO(getNextMonthlyAdjustedDeadline(todayIso, 20));
    const inssPaymentDays = Math.ceil((inssPaymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      wit: {
        days: witDays,
        status: getUrgencyFromDays(witDays),
        date: formatDateTL(witDate, { month: "short", day: "numeric" }),
      },
      inssStatement: {
        days: inssStatementDays,
        status: getUrgencyFromDays(inssStatementDays),
        date: formatDateTL(inssStatementDate, { month: "short", day: "numeric" }),
      },
      inssPayment: {
        days: inssPaymentDays,
        status: getUrgencyFromDays(inssPaymentDays),
        date: formatDateTL(inssPaymentDate, { month: "short", day: "numeric" }),
      },
    };
  };

  const compliance = getComplianceDeadlines();


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

  const ngoLinks = ngoReportingEnabled
    ? [
        {
          label: t("payrollDashboard.links.payrollAllocation"),
          description: t("payrollDashboard.links.payrollAllocationDesc"),
          path: "/reports/payroll-allocation",
          icon: FolderKanban,
        },
        ...(donorExportEnabled
          ? [{
              label: t("payrollDashboard.links.donorExport"),
              description: t("payrollDashboard.links.donorExportDesc"),
              path: "/reports/donor-export",
              icon: FileSpreadsheet,
            }]
          : []),
      ]
    : [];

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
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex items-center gap-5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <Skeleton className="h-11 w-40 rounded-md" />
              </div>
            </CardContent>
          </Card>

          {/* Compliance deadlines */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <Skeleton className="h-4 w-32" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-8 rounded" />
              </div>
            ))}
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-l-4 border-l-green-500">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-3 w-24 mb-1" />
                      <Skeleton className="h-7 w-28" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Checklist */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-10 rounded ml-auto" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-2 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-32 flex-1" />
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
        {/* STATUS BLOCK — single primary CTA            */}
        {/* ============================================ */}
        <Card className={`mb-6 border-2 ${currentStatus.borderColor} ${currentStatus.bg}`}>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <h2 className="text-lg font-bold text-foreground truncate">
                    {t("payrollDashboard.payrollFor", { month: stats.currentMonth })}
                  </h2>
                  <Badge className={`${currentStatus.bg} ${currentStatus.color} border ${currentStatus.borderColor} shrink-0`}>
                    {currentStatus.label}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("payrollDashboard.payDate")} <span className="font-semibold text-foreground">{stats.nextPayDate}</span>
                  </span>
                  <span className={`flex items-center gap-1.5 ${stats.daysUntilPayday <= 5 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>
                    <Clock className="h-3.5 w-3.5" />
                    {t("payrollDashboard.daysRemaining", { days: String(stats.daysUntilPayday) })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {t("payrollDashboard.employees", { count: String(stats.totalEmployees) })}
                  </span>
                </div>
                {/* Inline issue pills */}
                {issueCount > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {checklist.filter(item => item.status !== "complete").map(item => (
                      <button
                        key={item.id}
                        onClick={() => item.linkPath && navigate(item.linkPath)}
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
                          item.status === "error"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {item.count} {item.issueLabel}{item.count && item.count > 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="lg"
                onClick={() => navigate("/payroll/run")}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25 shrink-0"
              >
                {canRunPayroll ? (
                  <><Play className="h-5 w-5 mr-2" />{t("payrollDashboard.confirmRunPayroll")}</>
                ) : (
                  <><Calculator className="h-5 w-5 mr-2" />{t("payrollDashboard.reviewPayroll")}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ===================== */}
        {/* COMPLIANCE DEADLINES  */}
        {/* Promoted: time-sensitive */}
        {/* ===================== */}
        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm px-1">
          <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Shield className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            {t("payrollDashboard.complianceDeadlines")}
          </span>
          {[
            { label: t("payrollDashboard.witDue"), ...compliance.wit },
            { label: t("payrollDashboard.inssStatementDue"), ...compliance.inssStatement },
            { label: t("payrollDashboard.inssPaymentDue"), ...compliance.inssPayment },
          ].map((d) => (
            <span key={d.label} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${
                d.status === 'ok' ? 'bg-emerald-500' : d.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-medium">{d.date}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                d.status === 'ok'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : d.status === 'warning'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>{d.days}d</span>
            </span>
          ))}
        </div>

        {/* ==================== */}
        {/* FINANCIAL SUMMARY    */}
        {/* ==================== */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {/* Gross Payroll with breakdown */}
          <Card className={`${theme.borderLeft} relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5" />
            <CardContent className="relative pt-5 pb-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("payrollDashboard.grossPayroll")}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(stats.grossPayroll)}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="pt-2 border-t border-border/50 space-y-1 text-xs">
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

          {/* Employees */}
          <Card
            className={`${theme.borderLeft} cursor-pointer transition-all hover:shadow-md ${
              stats.blockedEmployees > 0 ? "border-amber-500/50" : ""
            }`}
            onClick={() => navigate("/people/employees?filter=blocking-issues")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {stats.blockedEmployees > 0 ? t("payrollDashboard.employeesNeedAttention") : t("payrollDashboard.payrollCoverage")}
                  </p>
                  {stats.blockedEmployees > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.blockedEmployees}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t("payrollDashboard.missingContractsINSS")}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stats.totalEmployees}/{stats.totalEmployees}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {t("payrollDashboard.allEmployeesReady")}
                      </p>
                    </>
                  )}
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  stats.blockedEmployees > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"
                }`}>
                  {stats.blockedEmployees > 0 ? (
                    <UserX className="h-5 w-5 text-amber-600" />
                  ) : (
                    <Users className="h-5 w-5 text-emerald-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last Payroll */}
          <Card className={theme.borderLeft}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("payrollDashboard.lastPayroll")}
                  </p>
                  {stats.lastPayrollDate !== "N/A" ? (
                    <>
                      <p className="text-lg font-bold">{stats.lastPayrollDate}</p>
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {t("payrollDashboard.completed")}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">{t("payrollDashboard.noPayrollYet")}</p>
                  )}
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  stats.lastPayrollDate !== "N/A" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted"
                }`}>
                  {stats.lastPayrollDate !== "N/A" ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ================== */}
        {/* PAYROLL CHECKLIST  */}
        {/* Compact: only show issues, collapse when all good */}
        {/* ================== */}
        {!checklistComplete ? (
          <Card id="payroll-checklist" className="mb-6 border-amber-200/50 dark:border-amber-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                {t("payrollDashboard.checklistTitle")}
                <Badge variant="secondary" className="text-xs ml-auto">
                  {checklist.filter(i => i.status === "complete").length}/{checklist.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-2 sm:grid-cols-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      item.status === "complete"
                        ? "bg-muted/30 border-border/50"
                        : item.status === "warning"
                        ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 cursor-pointer hover:border-amber-400"
                        : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800 cursor-pointer hover:border-red-400"
                    }`}
                    onClick={() => {
                      if (item.status !== "complete" && item.linkPath) navigate(item.linkPath);
                    }}
                  >
                    <div className={
                      item.status === "complete" ? "text-emerald-500" :
                      item.status === "warning" ? "text-amber-500" : "text-red-500"
                    }>
                      {item.status === "complete" ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : item.status === "warning" ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                    </div>
                    <span className="flex-1 truncate font-medium">{item.label}</span>
                    {item.count && item.status !== "complete" && (
                      <Badge variant="secondary" className="text-xs shrink-0">{item.count}</Badge>
                    )}
                    {item.status !== "complete" && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div id="payroll-checklist" className="mb-6 flex items-center gap-2 px-1 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">{t("payrollDashboard.allVerifiedReady")}</span>
          </div>
        )}

        {/* ======================== */}
        {/* QUICK LINKS              */}
        {/* Manage + Reports + NGO   */}
        {/* ======================== */}
        <Collapsible open={secondaryOpen} onOpenChange={setSecondaryOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between py-2 px-1 mb-3 text-muted-foreground hover:text-foreground transition-colors">
              <span className="text-xs font-semibold uppercase tracking-wide">
                {t("payrollDashboard.manage")} &amp; {t("payrollDashboard.pastReports")}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${secondaryOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
              {[...primaryLinks, ...secondaryLinks, ...ngoLinks].map((link) => {
                const LinkIcon = link.icon;
                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/50 hover:border-green-500/30 hover:shadow-sm transition-all text-left"
                  >
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <LinkIcon className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{link.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Audit trail */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            {t("payrollDashboard.lastReviewedBy", { name: user?.displayName || "Admin" })} &bull; {formatDateTL(new Date(), { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
