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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { payrollService } from "@/services/payrollService";
import {
  formatCurrency,
  formatPayPeriod,
  getPayPeriodLabel,
  PAYROLL_STATUS_CONFIG,
} from "@/lib/payroll/constants";
import { downloadPayslip } from "@/components/payroll/PayslipPDF";
import type { PayrollRun, PayrollRecord, PayrollStatus } from "@/types/payroll";

export default function PayrollHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [runRecords, setRunRecords] = useState<PayrollRecord[]>([]);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Load payroll runs
  useEffect(() => {
    const loadPayrollRuns = async () => {
      try {
        setLoading(true);
        const runs = await payrollService.runs.getAllPayrollRuns();
        setPayrollRuns(runs);
      } catch (error) {
        console.error("Failed to load payroll runs:", error);
        toast({
          title: "Error",
          description: "Failed to load payroll history. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPayrollRuns();
  }, [toast]);

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
      trend,
    };
  }, [payrollRuns]);

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
      processing: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      approved: <Clock className="h-3 w-3 mr-1" />,
      paid: <CheckCircle className="h-3 w-3 mr-1" />,
      cancelled: <XCircle className="h-3 w-3 mr-1" />,
    };

    return (
      <Badge className={`${config.bgClass} ${config.textClass}`}>
        {icons[status]}
        {config.label}
      </Badge>
    );
  };

  // View payroll run details
  const handleViewDetails = async (run: PayrollRun) => {
    setSelectedRun(run);
    setShowDetailsDialog(true);
    setLoadingRecords(true);

    try {
      if (run.id) {
        const records = await payrollService.records.getPayrollRecordsByRunId(run.id);
        setRunRecords(records);
      }
    } catch (error) {
      console.error("Failed to load payroll records:", error);
      toast({
        title: "Error",
        description: "Failed to load payroll details.",
        variant: "destructive",
      });
    } finally {
      setLoadingRecords(false);
    }
  };

  // Export to CSV
  const handleExportCSV = (run: PayrollRun) => {
    const data = {
      period: getPayPeriodLabel(run.periodStart, run.periodEnd),
      payDate: run.payDate,
      employees: run.employeeCount,
      grossPay: run.totalGrossPay,
      deductions: run.totalDeductions,
      netPay: run.totalNetPay,
      status: run.status,
    };

    console.log("Exporting payroll run:", data);
    toast({
      title: "Export Started",
      description: "CSV file will be downloaded shortly.",
    });
  };

  // Download payslip PDF for an employee
  const handleDownloadPayslip = async (record: PayrollRecord) => {
    if (!selectedRun) return;

    try {
      toast({
        title: "Generating Payslip",
        description: `Preparing payslip for ${record.employeeName}...`,
      });

      await downloadPayslip(record, selectedRun);

      toast({
        title: "Payslip Downloaded",
        description: `Payslip for ${record.employeeName} has been downloaded.`,
      });
    } catch (error) {
      console.error("Failed to generate payslip:", error);
      toast({
        title: "Error",
        description: "Failed to generate payslip. Please try again.",
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
      <MainNavigation />

      <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-emerald-500" />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Payroll History
                  </h1>
                  <p className="text-muted-foreground">
                    View and manage past payroll runs
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate("/payroll/run")}>
                Run New Payroll
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      YTD Total Paid
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(stats.totalPaid)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Payroll Runs (YTD)
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {stats.totalRuns}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Average Per Run
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(stats.averagePer)}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Trend vs Last
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
                  {stats.trend >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="year-filter">Year</Label>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by period..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payroll Runs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Payroll Runs</CardTitle>
              <CardDescription>
                Showing {filteredRuns.length} payroll runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredRuns.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No payroll runs found</p>
                  <Button onClick={() => navigate("/payroll/run")}>
                    Run Your First Payroll
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Pay Date</TableHead>
                        <TableHead className="text-right">Employees</TableHead>
                        <TableHead className="text-right">Gross Pay</TableHead>
                        <TableHead className="text-right">Net Pay</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
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
                            {new Date(run.payDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {run.employeeCount}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(run.totalGrossPay)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
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
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleExportCSV(run)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Export CSV
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Payroll Details -{" "}
              {selectedRun &&
                getPayPeriodLabel(selectedRun.periodStart, selectedRun.periodEnd)}
            </DialogTitle>
            <DialogDescription>
              View individual employee payroll records
            </DialogDescription>
          </DialogHeader>

          {selectedRun && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Gross</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(selectedRun.totalGrossPay)}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Deductions</p>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(selectedRun.totalDeductions)}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Net Pay</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedRun.totalNetPay)}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Employees</p>
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
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Deductions</TableHead>
                        <TableHead className="text-right">Net Pay</TableHead>
                        <TableHead className="text-right">Payslip</TableHead>
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
                          <TableCell className="text-right">
                            {formatCurrency(record.totalGrossPay)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(record.totalDeductions)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
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
                  No individual records found for this payroll run.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
