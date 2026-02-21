/**
 * ATTL Monthly WIT Return Page
 *
 * Generate and track monthly Wage Income Tax returns for
 * Timor-Leste Tax Authority (Autoridade Tributaria Timor-Leste)
 *
 * Due: 15th of the following month
 * Submission: e-Tax portal or BNU bank branches
 */

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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  ExternalLink,
  Building,
  Landmark,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { taxFilingService } from "@/services/taxFilingService";
import { settingsService } from "@/services/settingsService";


import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type {
  MonthlyWITReturn,
  TaxFiling,
  FilingDueDate,
  SubmissionMethod,
} from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";

// ============================================
// CONSTANTS
// ============================================

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-800",
    icon: AlertTriangle,
  },
  filed: {
    label: "Filed",
    className: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-800",
    icon: FileText,
  },
};

// ============================================
// COMPONENT
// ============================================

export default function ATTLMonthlyWIT() {
  const { toast } = useToast();
  const { user } = useAuth();
  const tenantId = useTenantId();

  // State
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [company, setCompany] = useState<Partial<CompanyDetails>>({});
  const [filings, setFilings] = useState<TaxFiling[]>([]);
  const [dueDates, setDueDates] = useState<FilingDueDate[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<MonthlyWITReturn | null>(null);
  const [showMarkFiledDialog, setShowMarkFiledDialog] = useState(false);
  const [selectedFilingId, setSelectedFilingId] = useState<string | null>(null);

  // Form state for period selection
  const currentDate = new Date();
  const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const defaultYear = previousMonthDate.getFullYear();
  const defaultMonth = String(previousMonthDate.getMonth() + 1).padStart(2, "0");
  const [selectedYear, setSelectedYear] = useState(String(defaultYear));
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // Form state for mark as filed
  const [filedMethod, setFiledMethod] = useState<SubmissionMethod>("etax");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [filedNotes, setFiledNotes] = useState("");

  // ============================================
  // DATA LOADING
  // ============================================

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load company settings
      if (tenantId) {
        const settings = await settingsService.getSettings(tenantId);
        if (settings?.companyDetails) {
          setCompany(settings.companyDetails);
        }
      }

      // Load existing filings
      const allFilings = await taxFilingService.getAllFilings(tenantId, "monthly_wit");
      setFilings(allFilings);

      // Load due dates
      const dues = await taxFilingService.getFilingsDueSoon(tenantId, 6);
      setDueDates(dues.filter(d => d.type === "monthly_wit"));
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "Error",
        description: "Failed to load tax filing data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ACTIONS
  // ============================================

  const handleGenerateReturn = async () => {
    const period = `${selectedYear}-${selectedMonth}`;

    try {
      setGenerating(true);

      // Generate the return data
      const returnData = await taxFilingService.generateMonthlyWITReturn(
        period,
        company,
        tenantId
      );
      setSelectedReturn(returnData);

      // Save as draft
      await taxFilingService.saveFiling(
        "monthly_wit",
        period,
        returnData,
        user?.uid || "",
        tenantId
      );

      // Reload filings
      const allFilings = await taxFilingService.getAllFilings(tenantId, "monthly_wit");
      setFilings(allFilings);

      toast({
        title: "Return Generated",
        description: `Monthly WIT return for ${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear} has been generated.`,
      });
    } catch (error) {
      console.error("Failed to generate return:", error);
      toast({
        title: "Error",
        description: "Failed to generate WIT return. Make sure you have payroll data for this period.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleViewReturn = async (filing: TaxFiling) => {
    setSelectedReturn(filing.dataSnapshot as MonthlyWITReturn);
  };

  const handleExportCSV = () => {
    if (!selectedReturn) return;

    // Build CSV content
    const headers = [
      "Employee ID",
      "Full Name",
      "TIN",
      "Resident",
      "Gross Wages",
      "Taxable Wages",
      "WIT Withheld",
    ];

    const rows = selectedReturn.employees.map(emp => [
      emp.employeeId,
      emp.fullName,
      emp.tinNumber || "",
      emp.isResident ? "Y" : "N",
      emp.grossWages.toFixed(2),
      emp.taxableWages.toFixed(2),
      emp.witWithheld.toFixed(2),
    ]);

    // Add totals row
    rows.push([
      "",
      "TOTAL",
      "",
      "",
      selectedReturn.totalGrossWages.toFixed(2),
      selectedReturn.totalTaxableWages.toFixed(2),
      selectedReturn.totalWITWithheld.toFixed(2),
    ]);

    const csvContent = [
      // Header info
      `Employer: ${selectedReturn.employerName}`,
      `TIN: ${selectedReturn.employerTIN}`,
      `Period: ${selectedReturn.reportingPeriod}`,
      "",
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ].join("\n");

    // Download
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `WIT_Monthly_${selectedReturn.reportingPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV Exported",
      description: "WIT return exported to CSV for e-Tax upload.",
    });
  };

  const handleExportPDF = async () => {
    if (!selectedReturn) return;

    if (!company.tinNumber) {
      toast({
        title: "Company TIN Required",
        description: "Please update your company TIN in Settings before generating tax documents.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { downloadWITReturnPDF } = await import("@/components/reports/WITReturnPDF");
      await downloadWITReturnPDF(
        selectedReturn,
        company || undefined,
        `wit-return-${selectedReturn.reportingPeriod}.pdf`
      );

      toast({
        title: "PDF Exported",
        description: "WIT return exported as PDF for filing records.",
      });
    } catch (error) {
      console.error("Failed to export PDF:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportOfficialForm = async () => {
    if (!selectedReturn) return;

    if (!company.tinNumber) {
      toast({
        title: "Company TIN Required",
        description: "Please update your company TIN in Settings before generating official ATTL forms.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { downloadATTLExcel } = await import("@/lib/excel/attlExport");
      await downloadATTLExcel(
        selectedReturn,
        company || undefined,
        `ATTL_Monthly_Tax_${selectedReturn.reportingPeriod}.xlsx`
      );

      toast({
        title: "Official Form Exported",
        description: "ATTL Consolidated Monthly Taxes Form exported to Excel.",
      });
    } catch (error) {
      console.error("Failed to export Excel:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate Excel form. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsFiled = async () => {
    if (!selectedFilingId) return;

    try {
      await taxFilingService.markAsFiled(
        selectedFilingId,
        filedMethod,
        receiptNumber || undefined,
        filedNotes || undefined,
        user?.uid
      );

      // Reload data
      await loadData();

      setShowMarkFiledDialog(false);
      setSelectedFilingId(null);
      setReceiptNumber("");
      setFiledNotes("");

      toast({
        title: "Filing Recorded",
        description: "The return has been marked as filed.",
      });
    } catch (error) {
      console.error("Failed to mark as filed:", error);
      toast({
        title: "Error",
        description: "Failed to update filing status.",
        variant: "destructive",
      });
    }
  };

  const openMarkFiledDialog = (filingId: string) => {
    setSelectedFilingId(filingId);
    setShowMarkFiledDialog(true);
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1].map(y => ({
      value: String(y),
      label: String(y),
    }));
  }, []);

  const upcomingDue = dueDates.find(d => d.status === "pending" && d.daysUntilDue >= 0);
  const overdueFiling = dueDates.find(d => d.isOverdue);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        {/* Hero Skeleton */}
        <div className="border-b bg-amber-50 dark:bg-amber-950/30">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Skeleton className="h-4 w-48 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div>
                  <Skeleton className="h-8 w-64 mb-2" />
                  <Skeleton className="h-5 w-80" />
                </div>
              </div>
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
        </div>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="ATTL Monthly WIT Return"
        description="Generate and track monthly Wage Income Tax returns for Timor-Leste"
      />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-amber-50 dark:bg-amber-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
                <Landmark className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Monthly WIT Return
                </h1>
                <p className="text-muted-foreground mt-1">
                  Wage Income Tax returns for Autoridade Tributaria Timor-Leste (ATTL)
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open("https://e-tax.mof.gov.tl/login", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              e-Tax Portal
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Alert Banner */}
        {overdueFiling && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">Overdue Filing</p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    WIT return for {overdueFiling.period} was due on {overdueFiling.dueDate}.
                    Please file immediately to avoid penalties.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {upcomingDue && !overdueFiling && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Upcoming Due Date</p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    WIT return for {upcomingDue.period} is due on {upcomingDue.dueDate}
                    ({upcomingDue.daysUntilDue} days remaining).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generate Return Card */}
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle>Generate Return</CardTitle>
                  <CardDescription>Create a new monthly WIT return</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y.value} value={y.value}>
                          {y.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full bg-amber-600 hover:bg-amber-700"
                onClick={handleGenerateReturn}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Return
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Company Info Card */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Employer Details</CardTitle>
                  <CardDescription>Tax registration info</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Company Name:</span>
                <p className="font-medium">{company.legalName || company.tradingName || "Not set"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">TIN:</span>
                <p className="font-medium font-mono">{company.tinNumber || "Not set"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Address:</span>
                <p className="font-medium">{company.registeredAddress || "Not set"}</p>
              </div>
              {!company.tinNumber && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Please update company TIN in Settings before filing.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle>Filing Summary</CardTitle>
                  <CardDescription>Status overview</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted">
                <span className="text-muted-foreground">Total Filings</span>
                <span className="font-medium">{filings.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted">
                <span className="text-muted-foreground">Filed</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {filings.filter(f => f.status === "filed").length}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                  {filings.filter(f => f.status === "pending").length}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted">
                <span className="text-muted-foreground">Overdue</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  {filings.filter(f => f.status === "overdue").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Return Preview */}
        {selectedReturn && (
          <Card className="border-l-4 border-l-violet-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <CardTitle>
                      WIT Return - {selectedReturn.reportingPeriod}
                    </CardTitle>
                    <CardDescription>
                      Period: {selectedReturn.periodStartDate} to {selectedReturn.periodEndDate}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportOfficialForm}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Official Form
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                  <p className="text-2xl font-bold">{selectedReturn.totalEmployees}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedReturn.totalResidentEmployees} residents,{" "}
                    {selectedReturn.totalNonResidentEmployees} non-residents
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Gross Wages</p>
                  <p className="text-2xl font-bold">
                    {formatCurrencyTL(selectedReturn.totalGrossWages)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxable Wages</p>
                  <p className="text-2xl font-bold">
                    {formatCurrencyTL(selectedReturn.totalTaxableWages)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total WIT</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrencyTL(selectedReturn.totalWITWithheld)}
                  </p>
                </div>
              </div>

              {/* Employee Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Resident</TableHead>
                    <TableHead className="text-right">Gross Wages</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">WIT Withheld</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReturn.employees.map((emp) => (
                    <TableRow key={emp.employeeId}>
                      <TableCell className="font-mono text-sm">
                        {emp.employeeId}
                      </TableCell>
                      <TableCell>{emp.fullName}</TableCell>
                      <TableCell>
                        <Badge variant={emp.isResident ? "default" : "secondary"}>
                          {emp.isResident ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyTL(emp.grossWages)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyTL(emp.taxableWages)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyTL(emp.witWithheld)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Filing History */}
        <Card className="border-l-4 border-l-slate-500">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle>Filing History</CardTitle>
                <CardDescription>Track your monthly WIT return submissions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Wages</TableHead>
                  <TableHead className="text-right">WIT</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No filings yet. Generate your first WIT return above.
                    </TableCell>
                  </TableRow>
                ) : (
                  filings.map((filing) => {
                    const statusConfig = STATUS_CONFIG[filing.status];
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={filing.id}>
                        <TableCell className="font-medium">
                          {filing.period}
                        </TableCell>
                        <TableCell>{filing.dueDate}</TableCell>
                        <TableCell>
                          <Badge className={statusConfig.className}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyTL(filing.totalWages)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyTL(filing.totalWITWithheld)}
                        </TableCell>
                        <TableCell className="text-right">
                          {filing.employeeCount}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewReturn(filing)}
                            >
                              View
                            </Button>
                            {filing.status !== "filed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openMarkFiledDialog(filing.id)}
                              >
                                Mark Filed
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-foreground">Filing Instructions</p>
                <ul className="mt-2 text-muted-foreground space-y-1">
                  <li>1. Generate the return for the desired period</li>
                  <li>2. Review the employee data and totals</li>
                  <li>3. Export: <strong className="text-foreground">Official Form</strong> (Excel, matches ATTL format), CSV, or PDF</li>
                  <li>4. Submit via e-Tax portal or deliver 3 copies to BNU bank</li>
                  <li>5. Mark as filed with receipt number for your records</li>
                </ul>
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  The Official Form export uses the 2024/2025 ATTL template format.
                  If the Ministry of Finance updates the form layout, this export may need updating.
                </p>
                <p className="mt-3 text-muted-foreground">
                  <strong className="text-foreground">Due Date:</strong> 15th of the month following the pay period.
                  <br />
                  <strong className="text-foreground">e-Tax Support:</strong> (+670) 74962772 | etax@mof.gov.tl
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mark as Filed Dialog */}
      <Dialog open={showMarkFiledDialog} onOpenChange={setShowMarkFiledDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Return as Filed</DialogTitle>
            <DialogDescription>
              Record the submission details for this WIT return.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Submission Method</Label>
              <Select
                value={filedMethod}
                onValueChange={(v) => setFiledMethod(v as SubmissionMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="etax">e-Tax Portal</SelectItem>
                  <SelectItem value="bnu_paper">BNU Bank (Paper)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Receipt Number (Optional)</Label>
              <Input
                placeholder="Enter receipt or confirmation number"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
              />
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any additional notes about this filing"
                value={filedNotes}
                onChange={(e) => setFiledNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMarkFiledDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkAsFiled}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Filed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
