import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  FileText,
  DollarSign,
  Calendar,
  Users,
  Download,
  Eye,
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  FileDown,
  Mail,
  ShieldCheck,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { payrollService } from "@/services/payrollService";
import { accountingService } from "@/services/accountingService";
import {
  formatCurrency,
  formatPayPeriod,
  getPayPeriodLabel,
  PAYROLL_STATUS_CONFIG,
} from "@/lib/payroll/constants";
// Lazy load PDF generator to avoid 1.5MB bundle hit
const downloadPayslip = async (...args: Parameters<typeof import("@/components/payroll/PayslipPDF").downloadPayslip>) => {
  const { downloadPayslip: download } = await import("@/components/payroll/PayslipPDF");
  return download(...args);
};

// Preload PDF module on first render so download resolves instantly from cache
let _payslipPreloaded = false;
import { QuickBooksExportDialog } from "@/components/payroll/QuickBooksExportDialog";
import { SendPayslipsDialog } from "@/components/payroll/SendPayslipsDialog";
import type { PayrollRun, PayrollRecord, PayrollStatus } from "@/types/payroll";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTL } from "@/lib/dateUtils";

export default function PayrollHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [runRecords, setRunRecords] = useState<PayrollRecord[]>([]);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // QuickBooks export
  const [showQBExportDialog, setShowQBExportDialog] = useState(false);
  const [qbExportRun, setQBExportRun] = useState<PayrollRun | null>(null);
  const [qbExportRecords, setQBExportRecords] = useState<PayrollRecord[]>([]);

  // Send payslips
  const [showSendPayslipsDialog, setShowSendPayslipsDialog] = useState(false);
  const [sendPayslipsRun, setSendPayslipsRun] = useState<PayrollRun | null>(null);
  const [sendPayslipsRecords, setSendPayslipsRecords] = useState<PayrollRecord[]>([]);

  // Approval/Rejection
  const [approveRun, setApproveRun] = useState<PayrollRun | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [rejectRun, setRejectRun] = useState<PayrollRun | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Preload PDF module so downloads resolve instantly from cache
  useEffect(() => {
    if (_payslipPreloaded) return;
    _payslipPreloaded = true;
    import("@/components/payroll/PayslipPDF");
  }, []);

  // Load payroll runs
  useEffect(() => {
    const loadPayrollRuns = async () => {
      try {
        setLoading(true);
        const runs = await payrollService.runs.getAllPayrollRuns({ tenantId });
        setPayrollRuns(runs);
      } catch (error) {
        console.error("Failed to load payroll runs:", error);
        toast({
          title: t("common.error"),
          description: t("payrollHistory.toastLoadError"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPayrollRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, tenantId]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const thisYearRuns = payrollRuns.filter((run) => {
      const runYear = new Date(run.periodStart).getFullYear();
      return runYear === currentYear;
    });

    const paidRuns = thisYearRuns.filter((run) => run.status === "paid");
    const totalPaid = paidRuns.reduce((sum, run) => sum + run.totalNetPay, 0);
    const averagePer = paidRuns.length > 0 ? totalPaid / paidRuns.length : 0;

    // Calculate trend (compare last 2 runs)
    const sortedRuns = [...paidRuns].sort(
      (a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()
    );
    let trend = 0;
    if (sortedRuns.length >= 2) {
      const current = sortedRuns[0].totalNetPay;
      const previous = sortedRuns[1].totalNetPay;
      trend = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    }

    return {
      totalRuns: thisYearRuns.length,
      totalPaid,
      averagePer,
      pendingCount: thisYearRuns.filter((r) => r.status === "draft" || r.status === "approved").length,
      pendingApprovalCount: payrollRuns.filter((r) => r.status === "processing").length,
      trend,
    };
  }, [payrollRuns]);

  // Detect stuck runs (writing_records for more than 2 minutes)
  const stuckRuns = useMemo(() => {
    const TWO_MINUTES_MS = 2 * 60 * 1000;
    const now = Date.now();
    return payrollRuns.filter((run) => {
      if (run.status !== 'writing_records') return false;
      const created = run.createdAt instanceof Date ? run.createdAt : new Date(String(run.createdAt));
      return now - created.getTime() > TWO_MINUTES_MS;
    });
  }, [payrollRuns]);

  const [repairingRunId, setRepairingRunId] = useState<string | null>(null);

  const handleRepairRun = async (runId: string) => {
    setRepairingRunId(runId);
    try {
      const result = await payrollService.runs.repairStuckRun(runId);
      if (result === 'repaired') {
        toast({ title: "Payroll Repaired", description: "All records were present. Run has been recovered." });
      } else {
        toast({ title: "Incomplete Run Removed", description: "The interrupted payroll run and its partial records have been cleaned up." });
      }
      // Reload runs
      const runs = await payrollService.runs.getAllPayrollRuns({ tenantId });
      setPayrollRuns(runs);
    } catch (error) {
      console.error("Failed to repair run:", error);
      toast({ title: "Repair Failed", description: "Could not repair the payroll run. Please try again.", variant: "destructive" });
    } finally {
      setRepairingRunId(null);
    }
  };

  // Filter payroll runs
  const filteredRuns = useMemo(() => {
    return payrollRuns.filter((run) => {
      // Status filter
      if (statusFilter !== "all" && run.status !== statusFilter) {
        return false;
      }

      // Year filter
      if (yearFilter !== "all") {
        const runYear = new Date(run.periodStart).getFullYear().toString();
        if (runYear !== yearFilter) {
          return false;
        }
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const periodLabel = getPayPeriodLabel(run.periodStart, run.periodEnd).toLowerCase();
        if (!periodLabel.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [payrollRuns, statusFilter, yearFilter, searchTerm]);

  // Get status badge
  const getStatusBadge = (status: PayrollStatus) => {
    const config = PAYROLL_STATUS_CONFIG[status];
    const icons: Record<PayrollStatus, React.ReactNode> = {
      draft: <FileText className="h-3 w-3 mr-1" />,
      writing_records: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      processing: <Clock className="h-3 w-3 mr-1" />,
      approved: <CheckCircle className="h-3 w-3 mr-1" />,
      paid: <CheckCircle className="h-3 w-3 mr-1" />,
      cancelled: <XCircle className="h-3 w-3 mr-1" />,
      rejected: <Ban className="h-3 w-3 mr-1" />,
    };

    return (
      <Badge className={`${config.bgClass} ${config.textClass}`}>
        {icons[status]}
        {config.label}
      </Badge>
    );
  };

  // Pending approval runs
  const pendingRuns = useMemo(() => {
    return payrollRuns.filter((run) => run.status === "processing");
  }, [payrollRuns]);

  // Handle approve payroll
  const handleApprovePayroll = async () => {
    if (!approveRun?.id || !user?.uid) return;

    setApproving(true);
    try {
      // Approve the run (service enforces two-person rule)
      await payrollService.runs.approvePayrollRun(
        approveRun.id,
        user.uid,
        { tenantId, userId: user.uid, userEmail: user.email || "" }
      );

      // Create accounting journal entry
      const records = await payrollService.records.getPayrollRecordsByRunId(approveRun.id, tenantId);
      const totalINSSEmployee = records.reduce((sum, r) =>
        sum + (r.deductions?.find(d => d.type === 'inss_employee')?.amount || 0), 0);
      const totalINSSEmployer = records.reduce((sum, r) =>
        sum + (r.employerTaxes?.find(t => t.type === 'inss_employer')?.amount || 0), 0);
      const totalIncomeTax = records.reduce((sum, r) =>
        sum + (r.deductions?.find(d => d.type === 'income_tax')?.amount || 0), 0);

      const journalEntryId = await accountingService.journalEntries.createFromPayrollSummary({
        periodStart: approveRun.periodStart,
        periodEnd: approveRun.periodEnd,
        payDate: approveRun.payDate,
        totalGrossPay: approveRun.totalGrossPay,
        totalINSSEmployer: totalINSSEmployer,
        totalIncomeTax: totalIncomeTax,
        totalINSSEmployee: totalINSSEmployee,
        totalNetPay: approveRun.totalNetPay,
        employeeCount: approveRun.employeeCount,
        approvedBy: user.uid,
        sourceId: approveRun.id,
      }, tenantId);

      // Mark as paid and link journal entry
      await payrollService.runs.markPayrollRunAsPaid(approveRun.id);
      await payrollService.runs.updatePayrollRun(approveRun.id, { journalEntryId });

      // Update local state
      setPayrollRuns((prev) =>
        prev.map((r) =>
          r.id === approveRun.id
            ? { ...r, status: "paid" as PayrollStatus, approvedBy: user.uid }
            : r
        )
      );

      toast({
        title: t("payrollHistory.toastApproved"),
        description: t("payrollHistory.toastApprovedDesc"),
      });

      setShowApproveDialog(false);
      setApproveRun(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("payrollHistory.toastApprovalFailedDesc");
      toast({
        title: t("payrollHistory.toastApprovalFailed"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  // Handle reject payroll
  const handleRejectPayroll = async () => {
    if (!rejectRun?.id || !user?.uid) return;
    if (rejectionReason.trim().length < 10) return;

    setRejecting(true);
    try {
      await payrollService.runs.rejectPayrollRun(
        rejectRun.id,
        user.uid,
        rejectionReason.trim(),
        { tenantId, userId: user.uid, userEmail: user.email || "" }
      );

      // Update local state
      setPayrollRuns((prev) =>
        prev.map((r) =>
          r.id === rejectRun.id
            ? { ...r, status: "rejected" as PayrollStatus, rejectedBy: user.uid, rejectionReason: rejectionReason.trim() }
            : r
        )
      );

      toast({
        title: t("payrollHistory.toastRejected"),
        description: t("payrollHistory.toastRejectedDesc"),
      });

      setShowRejectDialog(false);
      setRejectRun(null);
      setRejectionReason("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("payrollHistory.toastRejectionFailedDesc");
      toast({
        title: t("payrollHistory.toastRejectionFailed"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  // View payroll run details
  const handleViewDetails = async (run: PayrollRun) => {
    setSelectedRun(run);
    setShowDetailsDialog(true);
    setLoadingRecords(true);

    try {
      if (run.id) {
        const records = await payrollService.records.getPayrollRecordsByRunId(run.id, tenantId);
        setRunRecords(records);
      }
    } catch (error) {
      console.error("Failed to load payroll records:", error);
      toast({
        title: t("common.error"),
        description: t("payrollHistory.toastDetailsError"),
        variant: "destructive",
      });
    } finally {
      setLoadingRecords(false);
    }
  };

  // Export to CSV
  const handleExportCSV = (run: PayrollRun) => {
    const _data = {
      period: getPayPeriodLabel(run.periodStart, run.periodEnd),
      payDate: run.payDate,
      employees: run.employeeCount,
      grossPay: run.totalGrossPay,
      deductions: run.totalDeductions,
      netPay: run.totalNetPay,
      status: run.status,
    };

    toast({
      title: t("payrollHistory.toastExportStarted"),
      description: t("payrollHistory.toastExportDesc"),
    });
  };

  // Export to QuickBooks
  const handleExportToQuickBooks = async (run: PayrollRun) => {
    setQBExportRun(run);
    setShowQBExportDialog(true);

    // Load records for this run
    try {
      if (run.id) {
        const records = await payrollService.records.getPayrollRecordsByRunId(run.id, tenantId);
        setQBExportRecords(records);
      }
    } catch (error) {
      console.error("Failed to load payroll records for QB export:", error);
      toast({
        title: t("common.error"),
        description: t("payrollHistory.toastRecordsError"),
        variant: "destructive",
      });
    }
  };

  // Send payslips via email
  const handleSendPayslips = async (run: PayrollRun) => {
    setSendPayslipsRun(run);
    setShowSendPayslipsDialog(true);

    // Load records for this run
    try {
      if (run.id) {
        const records = await payrollService.records.getPayrollRecordsByRunId(run.id, tenantId);
        setSendPayslipsRecords(records);
      }
    } catch (error) {
      console.error("Failed to load payroll records for email:", error);
      toast({
        title: t("common.error"),
        description: t("payrollHistory.toastRecordsError"),
        variant: "destructive",
      });
    }
  };

  // Download payslip PDF for an employee
  const handleDownloadPayslip = async (record: PayrollRecord) => {
    if (!selectedRun) return;

    try {
      toast({
        title: t("payrollHistory.toastGenerating"),
        description: t("payrollHistory.toastGeneratingDesc", { name: record.employeeName }),
      });

      await downloadPayslip(record, selectedRun);

      toast({
        title: t("payrollHistory.toastDownloaded"),
        description: t("payrollHistory.toastDownloadedDesc", { name: record.employeeName }),
      });
    } catch (error) {
      console.error("Failed to generate payslip:", error);
      toast({
        title: t("common.error"),
        description: t("payrollHistory.toastPayslipError"),
        variant: "destructive",
      });
    }
  };

  // Get available years for filter
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString()); // Always include current year
    payrollRuns.forEach((run) => {
      years.add(new Date(run.periodStart).getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [payrollRuns]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-8 w-20 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="mb-6">
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24 ml-auto" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.payrollHistory} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("payrollHistory.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("payrollHistory.subtitle")}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/payroll/run")} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600">
              {t("payrollHistory.runNewPayroll")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("payrollHistory.ytdTotalPaid")}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(stats.totalPaid)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("payrollHistory.payrollRunsYtd")}
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.totalRuns}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("payrollHistory.averagePerRun")}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(stats.averagePer)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("payrollHistory.trendVsLast")}
                    </p>
                    <div className="flex items-center gap-1">
                      <p
                        className={`text-2xl font-bold ${
                          stats.trend >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {stats.trend >= 0 ? "+" : ""}
                        {stats.trend.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className={`p-2.5 bg-gradient-to-br ${stats.trend >= 0 ? "from-emerald-500 to-teal-500" : "from-red-500 to-rose-500"} rounded-xl`}>
                    {stats.trend >= 0 ? (
                      <TrendingUp className="h-6 w-6 text-white" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-white" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-green-600 dark:text-green-400" />
                {t("payrollHistory.filters")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="status-filter">{t("payrollHistory.statusLabel")}</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("payrollHistory.allStatuses")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("payrollHistory.allStatuses")}</SelectItem>
                      <SelectItem value="draft">{t("payrollHistory.draft")}</SelectItem>
                      <SelectItem value="processing">{t("payrollHistory.pendingApproval")}</SelectItem>
                      <SelectItem value="approved">{t("payrollHistory.approved")}</SelectItem>
                      <SelectItem value="paid">{t("payrollHistory.paid")}</SelectItem>
                      <SelectItem value="rejected">{t("payrollHistory.rejected")}</SelectItem>
                      <SelectItem value="cancelled">{t("payrollHistory.cancelled")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="year-filter">{t("payrollHistory.yearLabel")}</Label>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("payrollHistory.selectYear")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("payrollHistory.allYears")}</SelectItem>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="search">{t("payrollHistory.searchLabel")}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder={t("payrollHistory.searchPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stuck run banner */}
          {stuckRuns.length > 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      {stuckRuns.length === 1 ? "An interrupted payroll run was detected" : `${stuckRuns.length} interrupted payroll runs were detected`}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      This can happen if the browser was closed during save. You can attempt to recover or clean up.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {stuckRuns.map((run) => (
                        <Button
                          key={run.id}
                          size="sm"
                          variant="outline"
                          className="border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
                          disabled={repairingRunId === run.id}
                          onClick={() => run.id && handleRepairRun(run.id)}
                        >
                          {repairingRunId === run.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 mr-1" />
                          )}
                          Repair {formatDateTL(run.periodStart, { month: 'short', day: 'numeric' })} – {formatDateTL(run.periodEnd, { month: 'short', day: 'numeric' })}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs: Pending Approval | All Runs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="relative">
                {t("payrollHistory.tabPending")}
                {stats.pendingApprovalCount > 0 && (
                  <Badge className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5">
                    {stats.pendingApprovalCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">{t("payrollHistory.tabAll")}</TabsTrigger>
            </TabsList>

            {/* Pending Approval Tab */}
            <TabsContent value="pending">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    {t("payrollHistory.pendingApprovalTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("payrollHistory.pendingApprovalDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingRuns.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">{t("payrollHistory.noPendingRuns")}</p>
                    </div>
                  ) : (
                    <>
                    {/* Mobile Card View - Pending */}
                    <div className="md:hidden divide-y divide-border/50">
                      {pendingRuns.map((run) => {
                        const isSameUser = run.createdBy === user?.uid;
                        return (
                          <div key={run.id} className="p-4 bg-amber-50/50 dark:bg-amber-950/10">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="font-medium">{getPayPeriodLabel(run.periodStart, run.periodEnd)}</p>
                                <p className="text-sm text-muted-foreground">{formatPayPeriod(run.periodStart, run.periodEnd)}</p>
                              </div>
                              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                                {t("payrollHistory.pendingApproval") || "Pending"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                              <div>
                                <span className="text-muted-foreground">{t("payrollHistory.netPay")}:</span>
                                <span className="ml-1 font-semibold text-emerald-600 tabular-nums">{formatCurrency(run.totalNetPay)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{t("payrollHistory.employees")}:</span>
                                <span className="ml-1 font-medium">{run.employeeCount}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleViewDetails(run)}>
                                <Eye className="h-4 w-4 mr-1" />
                                {t("payrollHistory.viewDetails")}
                              </Button>
                              <Button
                                size="sm"
                                disabled={isSameUser}
                                onClick={() => { setApproveRun(run); setShowApproveDialog(true); }}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {t("payrollHistory.approve")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setRejectRun(run); setRejectionReason(""); setShowRejectDialog(true); }}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                {t("payrollHistory.reject")}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Desktop Table View - Pending */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("payrollHistory.period")}</TableHead>
                            <TableHead>{t("payrollHistory.payDate")}</TableHead>
                            <TableHead className="text-right">{t("payrollHistory.employees")}</TableHead>
                            <TableHead className="text-right">{t("payrollHistory.grossPay")}</TableHead>
                            <TableHead className="text-right">{t("payrollHistory.netPay")}</TableHead>
                            <TableHead>{t("payrollHistory.submittedBy")}</TableHead>
                            <TableHead className="text-right">{t("payrollHistory.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingRuns.map((run) => {
                            const isSameUser = run.createdBy === user?.uid;
                            return (
                              <TableRow key={run.id} className="bg-amber-50/50 dark:bg-amber-950/10">
                                <TableCell>
                                  <div>
                                    <p className="font-medium">
                                      {getPayPeriodLabel(run.periodStart, run.periodEnd)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatPayPeriod(run.periodStart, run.periodEnd)}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {formatDateTL(run.payDate)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {run.employeeCount}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                  {formatCurrency(run.totalGrossPay)}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-emerald-600 tabular-nums">
                                  {formatCurrency(run.totalNetPay)}
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-muted-foreground">
                                    {run.createdBy === user?.uid ? t("payrollHistory.you") : run.createdBy?.slice(0, 8) + "..."}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewDetails(run)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={isSameUser}
                                      onClick={() => {
                                        setApproveRun(run);
                                        setShowApproveDialog(true);
                                      }}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      title={isSameUser ? "Cannot approve your own payroll submission" : "Approve payroll"}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      {t("payrollHistory.approve")}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setRejectRun(run);
                                        setRejectionReason("");
                                        setShowRejectDialog(true);
                                      }}
                                      className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      {t("payrollHistory.reject")}
                                    </Button>
                                  </div>
                                  {isSameUser && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {t("payrollHistory.twoPersonRule")}
                                    </p>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* All Runs Tab */}
            <TabsContent value="all">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                    {t("payrollHistory.payrollRunsTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("payrollHistory.showingRuns", { count: filteredRuns.length })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredRuns.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">{t("payrollHistory.noRunsFound")}</p>
                      <Button onClick={() => navigate("/payroll/run")}>
                        {t("payrollHistory.runFirstPayroll")}
                      </Button>
                    </div>
                  ) : (
                    <>
                    {/* Mobile Card View - All Runs */}
                    <div className="md:hidden divide-y divide-border/50">
                      {filteredRuns.map((run) => (
                        <div key={run.id} className="p-4" onClick={() => handleViewDetails(run)}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="font-medium">{getPayPeriodLabel(run.periodStart, run.periodEnd)}</p>
                              <p className="text-sm text-muted-foreground">{formatPayPeriod(run.periodStart, run.periodEnd)}</p>
                            </div>
                            {getStatusBadge(run.status)}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                            <div>
                              <span className="text-muted-foreground">{t("payrollHistory.netPay")}:</span>
                              <span className="ml-1 font-semibold text-emerald-600 tabular-nums">{formatCurrency(run.totalNetPay)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{t("payrollHistory.employees")}:</span>
                              <span className="ml-1 font-medium">{run.employeeCount}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{formatDateTL(run.payDate)}</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(run)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  {t("payrollHistory.viewDetails")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportCSV(run)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  {t("payrollHistory.exportCsv")}
                                </DropdownMenuItem>
                                {(run.status === "approved" || run.status === "paid") && (
                                  <DropdownMenuItem onClick={() => handleSendPayslips(run)}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    {t("payrollHistory.sendPayslips")}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop Table View - All Runs */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("payrollHistory.period")}</TableHead>
                            <TableHead>{t("payrollHistory.payDate")}</TableHead>
                            <TableHead className="text-right">{t("payrollHistory.employees")}</TableHead>
                            <TableHead className="text-right">{t("payrollHistory.grossPay")}</TableHead>
                            <TableHead className="text-right">{t("payrollHistory.netPay")}</TableHead>
                            <TableHead>{t("payrollHistory.status")}</TableHead>
                            <TableHead className="text-right">{t("payrollHistory.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRuns.map((run) => (
                            <TableRow key={run.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">
                                    {getPayPeriodLabel(run.periodStart, run.periodEnd)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatPayPeriod(run.periodStart, run.periodEnd)}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {formatDateTL(run.payDate)}
                              </TableCell>
                              <TableCell className="text-right">
                                {run.employeeCount}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatCurrency(run.totalGrossPay)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-emerald-600 tabular-nums">
                                {formatCurrency(run.totalNetPay)}
                              </TableCell>
                              <TableCell>{getStatusBadge(run.status)}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleViewDetails(run)}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      {t("payrollHistory.viewDetails")}
                                    </DropdownMenuItem>
                                    {run.status === "processing" && run.createdBy !== user?.uid && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setApproveRun(run);
                                          setShowApproveDialog(true);
                                        }}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        {t("payrollHistory.approve")}
                                      </DropdownMenuItem>
                                    )}
                                    {run.status === "processing" && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setRejectRun(run);
                                          setRejectionReason("");
                                          setShowRejectDialog(true);
                                        }}
                                      >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        {t("payrollHistory.reject")}
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => handleExportCSV(run)}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      {t("payrollHistory.exportCsv")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleExportToQuickBooks(run)}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      {t("payrollHistory.exportQuickBooks")}
                                    </DropdownMenuItem>
                                    {(run.status === "approved" || run.status === "paid") && (
                                      <DropdownMenuItem
                                        onClick={() => handleSendPayslips(run)}
                                      >
                                        <Mail className="h-4 w-4 mr-2" />
                                        {t("payrollHistory.sendPayslips")}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

      {/* QuickBooks Export Dialog */}
      {qbExportRun && (
        <QuickBooksExportDialog
          open={showQBExportDialog}
          onOpenChange={setShowQBExportDialog}
          payrollRun={qbExportRun}
          records={qbExportRecords}
          currentUser={user?.displayName || user?.email || "Current User"}
        />
      )}

      {/* Send Payslips Dialog */}
      {sendPayslipsRun && (
        <SendPayslipsDialog
          open={showSendPayslipsDialog}
          onOpenChange={setShowSendPayslipsDialog}
          payrollRun={sendPayslipsRun}
          records={sendPayslipsRecords}
        />
      )}

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              {t("payrollHistory.approveDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>{t("payrollHistory.approveDialogDescription")}</p>
                {approveRun && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t("payrollHistory.approveDialogPeriod")}</span>
                      <span className="font-medium">
                        {formatPayPeriod(approveRun.periodStart, approveRun.periodEnd)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t("payrollHistory.approveDialogEmployees")}</span>
                      <span className="font-medium">{approveRun.employeeCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t("payrollHistory.approveDialogGrossPay")}</span>
                      <span className="font-medium">{formatCurrency(approveRun.totalGrossPay)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t("payrollHistory.approveDialogNetPay")}</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(approveRun.totalNetPay)}</span>
                    </div>
                  </div>
                )}
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>- {t("payrollHistory.approveMarkPaid")}</li>
                  <li>- {t("payrollHistory.approveCreateJournalEntries")}</li>
                  <li>- {t("payrollHistory.approveGeneratePayslips")}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>{t("payrollHistory.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprovePayroll}
              disabled={approving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("payrollHistory.approving")}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t("payrollHistory.approveAndProcess")}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {t("payrollHistory.rejectDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("payrollHistory.rejectDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          {rejectRun && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <span className="font-medium">
                  {getPayPeriodLabel(rejectRun.periodStart, rejectRun.periodEnd)}
                </span>
                {" - "}
                {t("payrollHistory.employeesNet", { count: rejectRun.employeeCount, amount: formatCurrency(rejectRun.totalNetPay) })}
              </div>
              <div>
                <Label htmlFor="rejection-reason">{t("payrollHistory.rejectionReasonLabel")}</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder={t("payrollHistory.rejectionReasonPlaceholder")}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
                {rejectionReason.length > 0 && rejectionReason.trim().length < 10 && (
                  <p className="text-xs text-red-500 mt-1">
                    {t("payrollHistory.rejectionReasonMinChars", { count: rejectionReason.trim().length })}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={rejecting}>
                  {t("payrollHistory.cancel")}
                </Button>
                <Button
                  onClick={handleRejectPayroll}
                  disabled={rejecting || rejectionReason.trim().length < 10}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {rejecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("payrollHistory.rejecting")}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      {t("payrollHistory.rejectPayroll")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>
                  {t("payrollHistory.detailsTitle")} -{" "}
                  {selectedRun &&
                    getPayPeriodLabel(selectedRun.periodStart, selectedRun.periodEnd)}
                </DialogTitle>
                <DialogDescription>
                  {t("payrollHistory.detailsDescription")}
                </DialogDescription>
              </div>
              {selectedRun && (selectedRun.status === "approved" || selectedRun.status === "paid") && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSendPayslipsRun(selectedRun);
                    setSendPayslipsRecords(runRecords);
                    setShowSendPayslipsDialog(true);
                  }}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {t("payrollHistory.sendPayslips")}
                </Button>
              )}
            </div>
          </DialogHeader>

          {selectedRun && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("payrollHistory.totalGross")}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(selectedRun.totalGrossPay)}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("payrollHistory.totalDeductions")}</p>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(selectedRun.totalDeductions)}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("payrollHistory.totalNetPay")}</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedRun.totalNetPay)}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("payrollHistory.employees")}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {selectedRun.employeeCount}
                  </p>
                </div>
              </div>

              {/* Employee Records */}
              {loadingRecords ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              ) : runRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("payrollHistory.employee")}</TableHead>
                        <TableHead>{t("payrollHistory.department")}</TableHead>
                        <TableHead className="text-right">{t("payrollHistory.hours")}</TableHead>
                        <TableHead className="text-right">{t("payrollHistory.gross")}</TableHead>
                        <TableHead className="text-right">{t("payrollHistory.deductions")}</TableHead>
                        <TableHead className="text-right">{t("payrollHistory.netPay")}</TableHead>
                        <TableHead className="text-right">{t("payrollHistory.payslip")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{record.employeeName}</p>
                              <p className="text-sm text-muted-foreground">
                                {record.employeeNumber}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{record.department}</TableCell>
                          <TableCell className="text-right">
                            {record.regularHours}
                            {record.overtimeHours > 0 && (
                              <span className="text-muted-foreground">
                                {" "}
                                (+{record.overtimeHours} OT)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(record.totalGrossPay)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 tabular-nums">
                            {formatCurrency(record.totalDeductions)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 tabular-nums">
                            {formatCurrency(record.netPay)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadPayslip(record)}
                              title="Download Payslip PDF"
                            >
                              <FileDown className="h-4 w-4 text-blue-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t("payrollHistory.noRecords")}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
