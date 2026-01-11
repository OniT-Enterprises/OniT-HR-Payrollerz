import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  PieChart,
  FileText,
  Download,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  Loader2,
  Eye,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { payrollService } from "@/services/payrollService";
import { formatCurrency } from "@/lib/payroll/constants";
import type { TaxReport, PayrollRun } from "@/types/payroll";
import { SEO, seoConfig } from "@/components/SEO";

const REPORT_TYPES = [
  { value: "quarterly_941", label: "Form 941 (Quarterly)", description: "Federal quarterly tax return" },
  { value: "annual_w2", label: "W-2 Forms (Annual)", description: "Employee wage statements" },
  { value: "annual_940", label: "Form 940 (Annual)", description: "Federal unemployment tax" },
  { value: "state_quarterly", label: "State Quarterly", description: "State tax quarterly report" },
  { value: "state_annual", label: "State Annual", description: "State tax annual report" },
];

const QUARTERS = [
  { value: "1", label: "Q1 (Jan-Mar)" },
  { value: "2", label: "Q2 (Apr-Jun)" },
  { value: "3", label: "Q3 (Jul-Sep)" },
  { value: "4", label: "Q4 (Oct-Dec)" },
];

export default function TaxReports() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [taxReports, setTaxReports] = useState<TaxReport[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [reportType, setReportType] = useState("");
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportQuarter, setReportQuarter] = useState("");

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [reports, runs] = await Promise.all([
          payrollService.taxReports.getAllTaxReports(),
          payrollService.runs.getAllPayrollRuns(),
        ]);
        setTaxReports(reports);
        setPayrollRuns(runs);
      } catch (error) {
        console.error("Failed to load tax reports:", error);
        toast({
          title: "Error",
          description: "Failed to load tax reports. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  // Calculate YTD totals from payroll runs
  const ytdTotals = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const thisYearRuns = payrollRuns.filter(
      (run) =>
        run.status === "paid" &&
        new Date(run.periodStart).getFullYear() === currentYear
    );

    return thisYearRuns.reduce(
      (acc, run) => ({
        wages: acc.wages + run.totalGrossPay,
        federalTax: acc.federalTax + run.totalDeductions * 0.4, // Approximate
        socialSecurity: acc.socialSecurity + run.totalGrossPay * 0.062,
        medicare: acc.medicare + run.totalGrossPay * 0.0145,
        employeeCount: Math.max(acc.employeeCount, run.employeeCount),
      }),
      { wages: 0, federalTax: 0, socialSecurity: 0, medicare: 0, employeeCount: 0 }
    );
  }, [payrollRuns]);

  // Get status badge
  const getStatusBadge = (status: TaxReport["status"]) => {
    const configs = {
      draft: { icon: FileText, className: "bg-muted text-muted-foreground", label: "Draft" },
      generated: { icon: Clock, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Generated" },
      filed: { icon: CheckCircle, className: "bg-primary/10 text-primary", label: "Filed" },
      accepted: { icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", label: "Accepted" },
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Generate report
  const handleGenerateReport = async () => {
    if (!reportType) {
      toast({
        title: "Validation Error",
        description: "Please select a report type.",
        variant: "destructive",
      });
      return;
    }

    if (reportType.includes("quarterly") && !reportQuarter) {
      toast({
        title: "Validation Error",
        description: "Please select a quarter.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const period = reportType.includes("quarterly")
        ? `Q${reportQuarter} ${reportYear}`
        : reportYear;

      const report: Omit<TaxReport, "id"> = {
        reportType: reportType as TaxReport["reportType"],
        period,
        year: parseInt(reportYear),
        quarter: reportQuarter ? parseInt(reportQuarter) : undefined,
        totalWages: ytdTotals.wages,
        totalFederalTax: ytdTotals.federalTax,
        totalStateTax: ytdTotals.federalTax * 0.5, // Approximate
        totalSocialSecurity: ytdTotals.socialSecurity,
        totalMedicare: ytdTotals.medicare,
        employeeCount: ytdTotals.employeeCount,
        status: "generated",
        createdBy: "current-user",
      };

      await payrollService.taxReports.createTaxReport(report);

      toast({
        title: "Success",
        description: "Tax report generated successfully.",
      });

      // Reload reports
      const reports = await payrollService.taxReports.getAllTaxReports();
      setTaxReports(reports);

      setShowGenerateDialog(false);
      setReportType("");
      setReportQuarter("");
    } catch (error) {
      console.error("Failed to generate report:", error);
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Get report type label
  const getReportTypeLabel = (type: string) => {
    return REPORT_TYPES.find((t) => t.value === type)?.label || type;
  };

  // Available years
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2].map(String);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-8 w-36 mb-2" />
                <Skeleton className="h-4 w-56" />
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
                <Skeleton className="h-6 w-44" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20 ml-auto" />
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
      <SEO {...seoConfig.taxes} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
                <PieChart className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Tax Reports</h1>
                <p className="text-muted-foreground mt-1">Generate and manage tax reports</p>
              </div>
            </div>
            <Button onClick={() => setShowGenerateDialog(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600">
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

          {/* YTD Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">YTD Wages</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(ytdTotals.wages)}
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
                      YTD Federal Tax
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(ytdTotals.federalTax)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      YTD Social Security
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(ytdTotals.socialSecurity)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">YTD Medicare</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(ytdTotals.medicare)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Deadlines */}
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-green-600 dark:text-green-400" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">Form 941 (Q1)</p>
                  <p className="font-semibold text-foreground">April 30, 2026</p>
                  <Badge className="mt-2 bg-amber-500/10 text-amber-600 dark:text-amber-400">Due Soon</Badge>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">State Quarterly</p>
                  <p className="font-semibold text-foreground">April 30, 2026</p>
                  <Badge className="mt-2 bg-amber-500/10 text-amber-600 dark:text-amber-400">Due Soon</Badge>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">Form 940 (Annual)</p>
                  <p className="font-semibold text-foreground">January 31, 2027</p>
                  <Badge className="mt-2 bg-muted text-muted-foreground">Upcoming</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Reports Table */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-green-600 dark:text-green-400" />
                Generated Reports
              </CardTitle>
              <CardDescription>
                View and manage your tax reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {taxReports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No tax reports generated yet</p>
                  <Button onClick={() => setShowGenerateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Your First Report
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report Type</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Total Wages</TableHead>
                        <TableHead className="text-right">Total Tax</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">
                            {getReportTypeLabel(report.reportType)}
                          </TableCell>
                          <TableCell>{report.period}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(report.totalWages)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(report.totalFederalTax)}
                          </TableCell>
                          <TableCell>{getStatusBadge(report.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
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

      {/* Generate Report Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Tax Report</DialogTitle>
            <DialogDescription>
              Select the type and period for your tax report
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="report-type">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <p>{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="report-year">Year</Label>
              <Select value={reportYear} onValueChange={setReportYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reportType.includes("quarterly") && (
              <div>
                <Label htmlFor="report-quarter">Quarter</Label>
                <Select value={reportQuarter} onValueChange={setReportQuarter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q.value} value={q.value}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateReport} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
