/**
 * Run Payroll Page - Timor-Leste Version
 * Uses TL tax law (10% above $500) and INSS (4% + 6%)
 *
 * UX Principle: "Point of no return" - treat this page with seriousness
 *
 * Calculation logic extracted to usePayrollCalculator hook.
 */

import React, { useState, useMemo } from "react";
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
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  Calculator,
  Users,
  Save,
  CheckCircle,
  AlertTriangle,
  Search,
  Calendar,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useCreatePayrollRunWithRecords } from "@/hooks/usePayroll";
import { SEO, seoConfig } from "@/components/SEO";
import { toDateStringTL } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import {
  PayrollLoadingSkeleton,
  TaxInfoBanner,
  PayrollSummaryCards,
  PayrollEmployeeRow,
  TaxSummaryCard,
  PayrollPeriodConfig,
  PayrollComplianceCard,
  PayrollDialogs,
} from "@/components/payroll";
import {
  formatPayPeriod,
  formatPayDate,
} from "@/lib/payroll/run-payroll-helpers";
import { usePayrollCalculator } from "@/hooks/usePayrollCalculator";

export default function RunPayroll() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const tenantId = useTenantId();

  // React Query: fetch all employees
  const { data: allEmployees = [], isLoading: loadingEmployees } = useAllEmployees();
  const activeEmployees = useMemo(() => allEmployees.filter(e => e.status === 'active'), [allEmployees]);

  // React Query: mutation for creating payroll runs
  const createPayrollMutation = useCreatePayrollRunWithRecords();

  // All calculation logic lives in the hook
  const calc = usePayrollCalculator({
    activeEmployees,
    tenantId,
    userId: user?.uid || "current-user",
  });

  // Dialog states (UI-only, kept in component)
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showFinalConfirmDialog, setShowFinalConfirmDialog] = useState(false);

  // Compliance UI states
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false);
  const [complianceOverrideReason, setComplianceOverrideReason] = useState("");
  const [showAllCompliance, setShowAllCompliance] = useState(false);

  // Save as draft
  const handleSaveDraft = async () => {
    const includedData = calc.getIncludedData();

    const validationErrors = calc.validateAllEmployees(includedData);
    if (validationErrors.length > 0) {
      toast({
        title: t("runPayroll.toastValidationErrors"),
        description: validationErrors.slice(0, 3).join("\n") +
          (validationErrors.length > 3 ? `\n...and ${validationErrors.length - 3} more` : ""),
        variant: "destructive",
      });
      return;
    }

    const payrollRun = calc.buildPayrollRun(includedData);
    const records = calc.buildPayrollRecords(includedData);

    createPayrollMutation.mutate(
      { payrollRun, records },
      {
        onSuccess: () => {
          toast({
            title: t("common.success"),
            description: t("runPayroll.toastDraftSaved"),
          });
          setShowSaveDialog(false);
        },
        onError: () => {
          toast({
            title: t("common.error"),
            description: t("runPayroll.toastSaveFailed"),
            variant: "destructive",
          });
        },
      }
    );
  };

  // Process payroll (final step)
  const handleProcessPayroll = async () => {
    if (!calc.periodStart || !calc.periodEnd || !calc.payDate) {
      toast({
        title: t("runPayroll.toastDatesRequired"),
        description: t("runPayroll.toastDatesRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    if (calc.periodStart >= calc.periodEnd) {
      toast({
        title: t("runPayroll.toastInvalidPeriod"),
        description: t("runPayroll.toastInvalidPeriodDesc"),
        variant: "destructive",
      });
      return;
    }

    if (calc.payDate < calc.periodEnd) {
      toast({
        title: t("runPayroll.toastInvalidPayDate"),
        description: t("runPayroll.toastInvalidPayDateDesc"),
        variant: "destructive",
      });
      return;
    }

    // SEC-6: Date range validation
    const now = new Date();
    const twoYearsAgo = toDateStringTL(new Date(now.getFullYear() - 2, now.getMonth(), 1));
    const oneMonthAhead = toDateStringTL(new Date(now.getFullYear(), now.getMonth() + 2, 0));
    if (calc.periodStart < twoYearsAgo || calc.periodEnd > oneMonthAhead) {
      toast({
        title: t("runPayroll.toastDateOutOfBounds"),
        description: t("runPayroll.toastDateOutOfBoundsDesc"),
        variant: "destructive",
      });
      return;
    }

    // SEC-7: Compliance override reason validation
    if (calc.hasComplianceIssues && calc.excludedEmployees.size < calc.complianceIssues.length) {
      if (!complianceAcknowledged) {
        toast({
          title: t("runPayroll.toastComplianceRequired"),
          description: t("runPayroll.toastComplianceRequiredDesc"),
          variant: "destructive",
        });
        return;
      }
      if (complianceOverrideReason.trim().length < 10) {
        toast({
          title: t("runPayroll.toastOverrideShort"),
          description: t("runPayroll.toastOverrideShortDesc"),
          variant: "destructive",
        });
        return;
      }
    }

    const includedData = calc.getIncludedData();

    const validationErrors = calc.validateAllEmployees(includedData);
    if (validationErrors.length > 0) {
      toast({
        title: t("runPayroll.toastValidationErrors"),
        description: validationErrors.slice(0, 3).join("\n") +
          (validationErrors.length > 3 ? `\n...and ${validationErrors.length - 3} more` : ""),
        variant: "destructive",
      });
      return;
    }

    const payrollRun = {
      ...calc.buildPayrollRun(includedData),
      status: 'processing' as const,
    };
    const records = calc.buildPayrollRecords(includedData);
    const audit = { tenantId, userId: user?.uid || "current-user", userEmail: user?.email || "" };

    createPayrollMutation.mutate(
      { payrollRun, records, audit },
      {
        onSuccess: () => {
          toast({
            title: t("runPayroll.toastSubmittedTitle"),
            description: t("runPayroll.toastSubmittedDesc", { count: String(includedData.length) }),
          });

          setShowFinalConfirmDialog(false);
          setShowApproveDialog(false);

          navigate("/payroll/history");
        },
        onError: () => {
          toast({
            title: t("runPayroll.toastErrorTitle"),
            description: t("runPayroll.toastErrorDesc"),
            variant: "destructive",
          });
        },
      }
    );
  };

  // Derive saving/processing from mutation state
  const saving = createPayrollMutation.isPending;
  const processing = createPayrollMutation.isPending;

  if (loadingEmployees) {
    return <PayrollLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.runPayroll} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between animate-fade-up">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
                <Calculator className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {t("runPayroll.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("runPayroll.processPayrollFor", { count: String(activeEmployees.length) })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/payroll")}
                className="text-muted-foreground shadow-sm"
              >
                {t("common.cancel")}
              </Button>
              <Button variant="outline" onClick={() => setShowSaveDialog(true)} className="shadow-sm">
                <Save className="h-4 w-4 mr-2" />
                {t("runPayroll.saveDraft")}
              </Button>
              <Button onClick={() => setShowApproveDialog(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/25">
                <CheckCircle className="h-4 w-4 mr-2" />
                {t("runPayroll.submitForApproval")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Pay Period Banner */}
        <Card className="mb-6 border-2 border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 animate-fade-up stagger-1">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 text-sm px-3 py-1">
                      {t("runPayroll.payPeriod")}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal capitalize">
                      {t(`runPayroll.${calc.payFrequency}`)}
                    </Badge>
                    {calc.editedCount > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-xs">
                        <Pencil className="h-3 w-3 mr-1" />
                        {t("runPayroll.edited", { count: String(calc.editedCount) })}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold mt-1">
                    {calc.periodStart && calc.periodEnd ? formatPayPeriod(calc.periodStart, calc.periodEnd) : t("runPayroll.notSet")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t("runPayroll.payDateBanner")}</p>
                <p className="text-lg font-semibold">{calc.payDate ? formatPayDate(calc.payDate) : t("runPayroll.notSet")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TL Tax Info Banner */}
        <TaxInfoBanner />

        {/* Compliance Notice */}
        <PayrollComplianceCard
          complianceIssues={calc.complianceIssues}
          excludedEmployees={calc.excludedEmployees}
          setExcludedEmployees={calc.setExcludedEmployees}
          complianceAcknowledged={complianceAcknowledged}
          setComplianceAcknowledged={setComplianceAcknowledged}
          complianceOverrideReason={complianceOverrideReason}
          setComplianceOverrideReason={setComplianceOverrideReason}
          showAllCompliance={showAllCompliance}
          setShowAllCompliance={setShowAllCompliance}
          totalEmployees={activeEmployees.length}
        />

        {/* Period Settings */}
        <PayrollPeriodConfig
          payFrequency={calc.payFrequency}
          setPayFrequency={calc.setPayFrequency}
          periodStart={calc.periodStart}
          setPeriodStart={calc.setPeriodStart}
          periodEnd={calc.periodEnd}
          setPeriodEnd={calc.setPeriodEnd}
          payDate={calc.payDate}
          setPayDate={calc.setPayDate}
          includeSubsidioAnual={calc.includeSubsidioAnual}
          setIncludeSubsidioAnual={calc.setIncludeSubsidioAnual}
          onSyncAttendance={calc.handleSyncFromAttendance}
          syncingAttendance={calc.syncingAttendance}
        />

        {/* Summary Cards */}
        <div className="animate-fade-up stagger-2">
          <PayrollSummaryCards totals={calc.totals} employeeCount={activeEmployees.length} />
        </div>

        {/* Tax Summary Card */}
        <div className="animate-fade-up stagger-3">
          <TaxSummaryCard totals={calc.totals} />
        </div>

        {/* Payroll Warnings */}
        {calc.payrollWarnings.length > 0 && (
          <Card className="mb-6 border-red-500/30 bg-red-50/30 dark:bg-red-950/10 animate-fade-up">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200 text-base">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                {t("runPayroll.payrollWarnings", { count: String(calc.payrollWarnings.length) })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1.5">
                {calc.payrollWarnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 p-2 rounded-md bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-medium">{w.employeeName}:</span>
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employee Payroll Table */}
        <Card className="border-border/50 animate-fade-up stagger-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                    <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  {t("runPayroll.employeePayroll")}
                  <Badge variant="outline" className="text-xs font-normal tabular-nums ml-1">
                    {calc.filteredData.length}{calc.filteredData.length !== calc.employeePayrollData.length ? ` / ${calc.employeePayrollData.length}` : ''}
                  </Badge>
                  {calc.editedCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                      {t("runPayroll.modified", { count: String(calc.editedCount) })}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {t("runPayroll.adjustHoursDesc")}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("runPayroll.searchEmployees")}
                    value={calc.searchTerm}
                    onChange={(e) => calc.setSearchTerm(e.target.value)}
                    className="pl-9 border-border/50"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t("runPayroll.employee")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t("runPayroll.department")}</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.hours")}</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.ot")}</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.night")}</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.bonus")}</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.gross")}</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.deductions")}</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.netPay")}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calc.filteredData.map((data) => (
                    <PayrollEmployeeRow
                      key={data.employee.id}
                      data={data}
                      isExpanded={calc.expandedRows.has(data.employee.id || "")}
                      onToggleExpand={calc.toggleRowExpansion}
                      onInputChange={calc.handleInputChange}
                      onReset={calc.handleResetRow}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {calc.filteredData.length === 0 && (
              <div className="text-center py-16">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/20 dark:to-emerald-950/10 flex items-center justify-center mb-4">
                  <Search className="h-7 w-7 text-green-400" />
                </div>
                <p className="font-medium text-foreground mb-1">{t("runPayroll.noEmployeesFound")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("runPayroll.tryAdjustSearch")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="h-8" />
      </div>

      {/* Dialogs */}
      <PayrollDialogs
        showSaveDialog={showSaveDialog}
        setShowSaveDialog={setShowSaveDialog}
        handleSaveDraft={handleSaveDraft}
        saving={saving}
        showApproveDialog={showApproveDialog}
        setShowApproveDialog={setShowApproveDialog}
        showFinalConfirmDialog={showFinalConfirmDialog}
        setShowFinalConfirmDialog={setShowFinalConfirmDialog}
        handleProcessPayroll={handleProcessPayroll}
        processing={processing}
        periodStart={calc.periodStart}
        periodEnd={calc.periodEnd}
        payDate={calc.payDate}
        employeeCount={activeEmployees.length}
        editedCount={calc.editedCount}
        totals={calc.totals}
        t={t}
      />
    </div>
  );
}
