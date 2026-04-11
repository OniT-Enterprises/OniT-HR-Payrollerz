/**
 * ATTL Monthly WIT Return Page
 *
 * Generate and track monthly Wage Income Tax returns for
 * Timor-Leste Tax Authority (Autoridade Tributaria Timor-Leste)
 *
 * Due: 15th of the following month
 * Submission: e-Tax portal or BNU bank branches
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
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
import { useI18n } from "@/i18n/I18nProvider";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
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
import { useSettings } from "@/hooks/useSettings";
import {
  useTaxFilings,
  useTaxFilingsDueSoon,
  useGenerateMonthlyWIT,
  useSaveTaxFiling,
  useMarkTaxFilingAsFiled,
} from "@/hooks/useTaxFiling";

import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type {
  MonthlyWITReturn,
  TaxFiling,
  SubmissionMethod,
  TaxFilingStatus,
} from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { downloadBlob } from "@/lib/downloadBlob";

// ============================================
// COMPONENT
// ============================================

export default function ATTLMonthlyWIT() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  // React Query hooks
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: filings = [], isLoading: filingsLoading } = useTaxFilings("monthly_wit");
  const { data: allDueDates = [], isLoading: duesLoading } = useTaxFilingsDueSoon(6);
  const generateWIT = useGenerateMonthlyWIT();
  const saveFiling = useSaveTaxFiling();
  const markFiled = useMarkTaxFilingAsFiled();

  const company: Partial<CompanyDetails> = settings?.companyDetails || {};
  const dueDates = useMemo(() => allDueDates.filter(d => d.type === "monthly_wit"), [allDueDates]);
  const loading = settingsLoading || filingsLoading || duesLoading;

  // Local state
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

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return {
          value: String(month).padStart(2, "0"),
          label: t(`common.months.${month}`),
        };
      }),
    [t],
  );

  const getMonthLabel = (month: string) => t(`common.months.${Number(month)}`);
  const formatPeriodLabel = (period: string) => {
    const [year, month] = period.split("-");
    if (!year || !month) return period;
    return `${getMonthLabel(month)} ${year}`;
  };

  const getStatusConfig = (status: TaxFilingStatus) => {
    switch (status) {
      case "pending":
        return {
          label: t("reports.attlMonthlyWit.status.pending"),
          className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          icon: Clock,
        };
      case "overdue":
        return {
          label: t("reports.attlMonthlyWit.status.overdue"),
          className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
          icon: AlertTriangle,
        };
      case "filed":
        return {
          label: t("reports.attlMonthlyWit.status.filed"),
          className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          icon: CheckCircle,
        };
      default:
        return {
          label: t("reports.attlMonthlyWit.status.draft"),
          className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
          icon: FileText,
        };
    }
  };

  // Preload PDF/Excel modules so downloads resolve instantly from cache
  const preloaded = useRef(false);
  useEffect(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    import("@/components/reports/WITReturnPDF");
    import("@/lib/excel/attlExport");
  }, []);

  // ============================================
  // ACTIONS
  // ============================================

  const handleGenerateReturn = async () => {
    const period = `${selectedYear}-${selectedMonth}`;

    try {
      // Generate the return data
      const returnData = await generateWIT.mutateAsync({ period, company });
      setSelectedReturn(returnData);

      // Save as draft
      await saveFiling.mutateAsync({
        type: "monthly_wit",
        period,
        dataSnapshot: returnData,
        userId: user?.uid || "",
      });

      toast({
        title: t("reports.attlMonthlyWit.toast.generatedTitle"),
        description: t("reports.attlMonthlyWit.toast.generatedDescription", {
          period: formatPeriodLabel(period),
        }),
      });
    } catch (error) {
      console.error("Failed to generate return:", error);
      toast({
        title: t("reports.attlMonthlyWit.toast.errorTitle"),
        description: t("reports.attlMonthlyWit.toast.generateErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const handleViewReturn = async (filing: TaxFiling) => {
    setSelectedReturn(filing.dataSnapshot as MonthlyWITReturn);
  };

  const handleExportCSV = () => {
    if (!selectedReturn) return;

    // Build CSV content
    const headers = [
      t("reports.attlMonthlyWit.csv.employeeId"),
      t("reports.attlMonthlyWit.csv.fullName"),
      t("reports.attlMonthlyWit.csv.tin"),
      t("reports.attlMonthlyWit.csv.resident"),
      t("reports.attlMonthlyWit.csv.grossWages"),
      t("reports.attlMonthlyWit.csv.taxableWages"),
      t("reports.attlMonthlyWit.csv.witWithheld"),
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
      t("reports.attlMonthlyWit.table.total"),
      "",
      "",
      selectedReturn.totalGrossWages.toFixed(2),
      selectedReturn.totalTaxableWages.toFixed(2),
      selectedReturn.totalWITWithheld.toFixed(2),
    ]);

    const csvContent = [
      // Header info
      `${t("reports.attlMonthlyWit.csv.employer")}: ${selectedReturn.employerName}`,
      `${t("reports.attlMonthlyWit.csv.tinLabel")}: ${selectedReturn.employerTIN}`,
      `${t("reports.attlMonthlyWit.csv.period")}: ${selectedReturn.reportingPeriod}`,
      "",
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ].join("\n");

    // Download
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `WIT_Monthly_${selectedReturn.reportingPeriod}.csv`);

    toast({
      title: t("reports.attlMonthlyWit.toast.csvExportedTitle"),
      description: t("reports.attlMonthlyWit.toast.csvExportedDescription"),
    });
  };

  const handleExportPDF = async () => {
    if (!selectedReturn) return;

    if (!company.tinNumber) {
      toast({
        title: t("reports.attlMonthlyWit.toast.tinRequiredTitle"),
        description: t("reports.attlMonthlyWit.toast.tinRequiredDescription"),
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
        title: t("reports.attlMonthlyWit.toast.pdfExportedTitle"),
        description: t("reports.attlMonthlyWit.toast.pdfExportedDescription"),
      });
    } catch (error) {
      console.error("Failed to export PDF:", error);
      toast({
        title: t("reports.attlMonthlyWit.toast.exportFailedTitle"),
        description: t("reports.attlMonthlyWit.toast.pdfExportFailedDescription"),
        variant: "destructive",
      });
    }
  };

  const handleExportOfficialForm = async () => {
    if (!selectedReturn) return;

    if (!company.tinNumber) {
      toast({
        title: t("reports.attlMonthlyWit.toast.tinRequiredTitle"),
        description: t("reports.attlMonthlyWit.toast.officialTinRequiredDescription"),
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
        title: t("reports.attlMonthlyWit.toast.officialExportedTitle"),
        description: t("reports.attlMonthlyWit.toast.officialExportedDescription"),
      });
    } catch (error) {
      console.error("Failed to export Excel:", error);
      toast({
        title: t("reports.attlMonthlyWit.toast.exportFailedTitle"),
        description: t("reports.attlMonthlyWit.toast.officialExportFailedDescription"),
        variant: "destructive",
      });
    }
  };

  const handleMarkAsFiled = async () => {
    if (!selectedFilingId) return;

    try {
      await markFiled.mutateAsync({
        filingId: selectedFilingId,
        method: filedMethod,
        receiptNumber: receiptNumber || "",
        notes: filedNotes || "",
        userId: user?.uid,
      });

      setShowMarkFiledDialog(false);
      setSelectedFilingId(null);
      setReceiptNumber("");
      setFiledNotes("");

      toast({
        title: t("reports.attlMonthlyWit.toast.filedTitle"),
        description: t("reports.attlMonthlyWit.toast.filedDescription"),
      });
    } catch (error) {
      console.error("Failed to mark as filed:", error);
      toast({
        title: t("reports.attlMonthlyWit.toast.errorTitle"),
        description: t("reports.attlMonthlyWit.toast.updateErrorDescription"),
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

  const generating = generateWIT.isPending || saveFiling.isPending;

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        {/* Hero Skeleton */}
        <div className="border-b bg-amber-50 dark:bg-amber-950/30">
          <div className="mx-auto max-w-screen-2xl px-6 py-5">
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
        <div className="p-6 mx-auto max-w-screen-2xl space-y-6">
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
        title={t("reports.attlMonthlyWit.title")}
        description={t("reports.attlMonthlyWit.subtitle")}
      />
      <MainNavigation />
      <div className="p-6 mx-auto max-w-screen-2xl space-y-6">
        <PageHeader
          title={t("reports.attlMonthlyWit.title")}
          subtitle={t("reports.attlMonthlyWit.subtitle")}
          icon={Landmark}
          iconColor="text-primary"
          actions={
            <Button
              variant="outline"
              onClick={() => window.open("https://e-tax.mof.gov.tl/login", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("reports.attlMonthlyWit.actions.etaxPortal")}
            </Button>
          }
        />
        {/* Alert Banner */}
        {overdueFiling && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">
                    {t("reports.attlMonthlyWit.alerts.overdueTitle")}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {t("reports.attlMonthlyWit.alerts.overdueDescription", {
                      period: formatPeriodLabel(overdueFiling.period),
                      dueDate: overdueFiling.dueDate,
                    })}
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
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    {t("reports.attlMonthlyWit.alerts.upcomingTitle")}
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    {t("reports.attlMonthlyWit.alerts.upcomingDescription", {
                      period: formatPeriodLabel(upcomingDue.period),
                      dueDate: upcomingDue.dueDate,
                      days: upcomingDue.daysUntilDue,
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generate Return Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle>{t("reports.attlMonthlyWit.generate.title")}</CardTitle>
                  <CardDescription>
                    {t("reports.attlMonthlyWit.generate.description")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("reports.attlMonthlyWit.generate.year")}</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("reports.attlMonthlyWit.generate.selectYear")}
                      />
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
                  <Label>{t("reports.attlMonthlyWit.generate.month")}</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("reports.attlMonthlyWit.generate.selectMonth")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(m => (
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
                    {t("reports.attlMonthlyWit.generate.generating")}
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    {t("reports.attlMonthlyWit.generate.button")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Company Info Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>{t("reports.attlMonthlyWit.company.title")}</CardTitle>
                  <CardDescription>
                    {t("reports.attlMonthlyWit.company.description")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t("reports.attlMonthlyWit.company.companyName")}
                </span>
                <p className="font-medium">
                  {company.legalName || company.tradingName || t("reports.attlMonthlyWit.company.notSet")}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t("reports.attlMonthlyWit.company.tin")}
                </span>
                <p className="font-medium font-mono">
                  {company.tinNumber || t("reports.attlMonthlyWit.company.notSet")}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t("reports.attlMonthlyWit.company.address")}
                </span>
                <p className="font-medium">
                  {company.registeredAddress || t("reports.attlMonthlyWit.company.notSet")}
                </p>
              </div>
              {!company.tinNumber && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("reports.attlMonthlyWit.company.tinHint")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle>{t("reports.attlMonthlyWit.summary.title")}</CardTitle>
                  <CardDescription>
                    {t("reports.attlMonthlyWit.summary.description")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted">
                <span className="text-muted-foreground">
                  {t("reports.attlMonthlyWit.summary.totalFilings")}
                </span>
                <span className="font-medium">{filings.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted">
                <span className="text-muted-foreground">
                  {t("reports.attlMonthlyWit.summary.filed")}
                </span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {filings.filter(f => f.status === "filed").length}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted">
                <span className="text-muted-foreground">
                  {t("reports.attlMonthlyWit.summary.pending")}
                </span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                  {filings.filter(f => f.status === "pending").length}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted">
                <span className="text-muted-foreground">
                  {t("reports.attlMonthlyWit.summary.overdue")}
                </span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  {filings.filter(f => f.status === "overdue").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Return Preview */}
        {selectedReturn && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <CardTitle>
                      {t("reports.attlMonthlyWit.preview.title", {
                        period: formatPeriodLabel(selectedReturn.reportingPeriod),
                      })}
                    </CardTitle>
                    <CardDescription>
                      {t("reports.attlMonthlyWit.preview.periodDescription", {
                        start: selectedReturn.periodStartDate,
                        end: selectedReturn.periodEndDate,
                      })}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportOfficialForm}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {t("reports.attlMonthlyWit.actions.officialForm")}
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
                  <p className="text-sm text-muted-foreground">
                    {t("reports.attlMonthlyWit.preview.totalEmployees")}
                  </p>
                  <p className="text-2xl font-bold">{selectedReturn.totalEmployees}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("reports.attlMonthlyWit.preview.employeeBreakdown", {
                      residents: selectedReturn.totalResidentEmployees,
                      nonResidents: selectedReturn.totalNonResidentEmployees,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("reports.attlMonthlyWit.preview.totalGrossWages")}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrencyTL(selectedReturn.totalGrossWages)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("reports.attlMonthlyWit.preview.taxableWages")}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrencyTL(selectedReturn.totalTaxableWages)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("reports.attlMonthlyWit.preview.totalWit")}
                  </p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrencyTL(selectedReturn.totalWITWithheld)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 md:hidden">
                {selectedReturn.employees.map((emp) => (
                  <Card key={emp.employeeId}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{emp.fullName}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {emp.employeeId}
                          </p>
                        </div>
                        <Badge variant={emp.isResident ? "default" : "secondary"}>
                          {emp.isResident
                            ? t("reports.attlMonthlyWit.table.residentYes")
                            : t("reports.attlMonthlyWit.table.residentNo")}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.attlMonthlyWit.table.grossWages")}
                          </p>
                          <p>{formatCurrencyTL(emp.grossWages)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.attlMonthlyWit.table.taxable")}
                          </p>
                          <p>{formatCurrencyTL(emp.taxableWages)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.attlMonthlyWit.table.witWithheld")}
                          </p>
                          <p className="font-semibold">
                            {formatCurrencyTL(emp.witWithheld)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("reports.attlMonthlyWit.table.employeeId")}</TableHead>
                      <TableHead>{t("reports.attlMonthlyWit.table.name")}</TableHead>
                      <TableHead>{t("reports.attlMonthlyWit.table.resident")}</TableHead>
                      <TableHead className="text-right">{t("reports.attlMonthlyWit.table.grossWages")}</TableHead>
                      <TableHead className="text-right">{t("reports.attlMonthlyWit.table.taxable")}</TableHead>
                      <TableHead className="text-right">{t("reports.attlMonthlyWit.table.witWithheld")}</TableHead>
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
                            {emp.isResident
                              ? t("reports.attlMonthlyWit.table.residentYes")
                              : t("reports.attlMonthlyWit.table.residentNo")}
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filing History */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle>{t("reports.attlMonthlyWit.history.title")}</CardTitle>
                <CardDescription>
                  {t("reports.attlMonthlyWit.history.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {filings.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    {t("reports.attlMonthlyWit.history.empty")}
                  </CardContent>
                </Card>
              ) : (
                filings.map((filing) => {
                  const statusConfig = getStatusConfig(filing.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <Card key={filing.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {formatPeriodLabel(filing.period)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("reports.attlMonthlyWit.history.dueDate")}: {filing.dueDate}
                            </p>
                          </div>
                          <Badge className={statusConfig.className}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.attlMonthlyWit.history.totalWages")}
                            </p>
                            <p>{formatCurrencyTL(filing.totalWages)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.attlMonthlyWit.history.wit")}
                            </p>
                            <p>{formatCurrencyTL(filing.totalWITWithheld)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.attlMonthlyWit.history.employees")}
                            </p>
                            <p>{filing.employeeCount}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewReturn(filing)}
                          >
                            {t("reports.attlMonthlyWit.actions.view")}
                          </Button>
                          {filing.status !== "filed" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openMarkFiledDialog(filing.id)}
                            >
                              {t("reports.attlMonthlyWit.actions.markFiled")}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.attlMonthlyWit.history.period")}</TableHead>
                    <TableHead>{t("reports.attlMonthlyWit.history.dueDate")}</TableHead>
                    <TableHead>{t("reports.attlMonthlyWit.history.status")}</TableHead>
                    <TableHead className="text-right">{t("reports.attlMonthlyWit.history.totalWages")}</TableHead>
                    <TableHead className="text-right">{t("reports.attlMonthlyWit.history.wit")}</TableHead>
                    <TableHead className="text-right">{t("reports.attlMonthlyWit.history.employees")}</TableHead>
                    <TableHead>{t("reports.attlMonthlyWit.history.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t("reports.attlMonthlyWit.history.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filings.map((filing) => {
                      const statusConfig = getStatusConfig(filing.status);
                      const StatusIcon = statusConfig.icon;

                      return (
                        <TableRow key={filing.id}>
                          <TableCell className="font-medium">
                            {formatPeriodLabel(filing.period)}
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
                                {t("reports.attlMonthlyWit.actions.view")}
                              </Button>
                              {filing.status !== "filed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openMarkFiledDialog(filing.id)}
                                >
                                  {t("reports.attlMonthlyWit.actions.markFiled")}
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
            </div>
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
                <p className="font-medium text-foreground">
                  {t("reports.attlMonthlyWit.instructions.title")}
                </p>
                <ul className="mt-2 text-muted-foreground space-y-1">
                  <li>{t("reports.attlMonthlyWit.instructions.step1")}</li>
                  <li>{t("reports.attlMonthlyWit.instructions.step2")}</li>
                  <li>{t("reports.attlMonthlyWit.instructions.step3")}</li>
                  <li>{t("reports.attlMonthlyWit.instructions.step4")}</li>
                  <li>{t("reports.attlMonthlyWit.instructions.step5")}</li>
                </ul>
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {t("reports.attlMonthlyWit.instructions.templateWarning")}
                </p>
                <p className="mt-3 text-muted-foreground">
                  <strong className="text-foreground">
                    {t("reports.attlMonthlyWit.instructions.dueDateLabel")}
                  </strong>{" "}
                  {t("reports.attlMonthlyWit.instructions.dueDateValue")}
                  <br />
                  <strong className="text-foreground">
                    {t("reports.attlMonthlyWit.instructions.supportLabel")}
                  </strong>{" "}
                  {t("reports.attlMonthlyWit.instructions.supportValue")}
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
            <DialogTitle>{t("reports.attlMonthlyWit.markFiled.title")}</DialogTitle>
            <DialogDescription>
              {t("reports.attlMonthlyWit.markFiled.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t("reports.attlMonthlyWit.markFiled.submissionMethod")}</Label>
              <Select
                value={filedMethod}
                onValueChange={(v) => setFiledMethod(v as SubmissionMethod)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("reports.attlMonthlyWit.markFiled.selectMethod")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="etax">
                    {t("reports.attlMonthlyWit.markFiled.etax")}
                  </SelectItem>
                  <SelectItem value="bnu_paper">
                    {t("reports.attlMonthlyWit.markFiled.bnu")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("reports.attlMonthlyWit.markFiled.receiptLabel")}</Label>
              <Input
                placeholder={t("reports.attlMonthlyWit.markFiled.receiptPlaceholder")}
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
              />
            </div>

            <div>
              <Label>{t("reports.attlMonthlyWit.markFiled.notesLabel")}</Label>
              <Textarea
                placeholder={t("reports.attlMonthlyWit.markFiled.notesPlaceholder")}
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
              {t("reports.attlMonthlyWit.markFiled.cancel")}
            </Button>
            <Button onClick={handleMarkAsFiled}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {t("reports.attlMonthlyWit.markFiled.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
