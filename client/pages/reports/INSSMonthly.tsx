/**
 * INSS Monthly Return Page
 *
 * Generate and track monthly Social Security (INSS) submissions for Timor-Leste.
 *
 * Note: INSS reporting is submitted via the Social Security portal.
 */

import React, { useMemo, useState } from "react";
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
  Building,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  Loader2,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/useSettings";
import {
  useTaxFilings,
  useTaxFilingsDueSoon,
  useGenerateMonthlyINSS,
  useSaveTaxFiling,
  useMarkTaxFilingAsFiled,
} from "@/hooks/useTaxFiling";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type {
  FilingDueDate,
  MonthlyINSSReturn,
  SubmissionMethod,
  TaxFilingTask,
  TaxFiling,
} from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";

export default function INSSMonthly() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  // React Query hooks
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: filings = [], isLoading: filingsLoading } = useTaxFilings("inss_monthly");
  const { data: allDueDates = [], isLoading: duesLoading } = useTaxFilingsDueSoon(6);
  const generateINSS = useGenerateMonthlyINSS();
  const saveFiling = useSaveTaxFiling();
  const markFiled = useMarkTaxFilingAsFiled();

  const company: Partial<CompanyDetails> = settings?.companyDetails || {};
  const dueDates = useMemo(() => allDueDates.filter(d => d.type === "inss_monthly"), [allDueDates]);
  const loading = settingsLoading || filingsLoading || duesLoading;

  // Local state
  const [selectedReturn, setSelectedReturn] = useState<MonthlyINSSReturn | null>(null);
  const [showMarkFiledDialog, setShowMarkFiledDialog] = useState(false);
  const [selectedFilingId, setSelectedFilingId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaxFilingTask>("statement");

  const currentDate = new Date();
  const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const defaultYear = previousMonthDate.getFullYear();
  const defaultMonth = String(previousMonthDate.getMonth() + 1).padStart(2, "0");
  const [selectedYear, setSelectedYear] = useState(String(defaultYear));
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const [filedMethod, setFiledMethod] = useState<SubmissionMethod>("inss_portal");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [filedNotes, setFiledNotes] = useState("");

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const monthNumber = index + 1;
        return {
          value: String(monthNumber).padStart(2, "0"),
          label: t(`common.months.${monthNumber}`),
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

  const getTaskLabel = (
    task: TaxFilingTask,
    variant: "short" | "full" = "short",
  ) =>
    t(
      task === "payment"
        ? variant === "full"
          ? "reports.inssMonthly.tasks.paymentFull"
          : "reports.inssMonthly.tasks.payment"
        : variant === "full"
          ? "reports.inssMonthly.tasks.statementFull"
          : "reports.inssMonthly.tasks.statement",
    );

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return {
          label: t("reports.inssMonthly.status.pending"),
          className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          icon: Clock,
        };
      case "overdue":
        return {
          label: t("reports.inssMonthly.status.overdue"),
          className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
          icon: AlertTriangle,
        };
      case "filed":
        return {
          label: t("reports.inssMonthly.status.filed"),
          className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          icon: CheckCircle,
        };
      default:
        return {
          label: t("reports.inssMonthly.status.draft"),
          className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
          icon: FileSpreadsheet,
        };
    }
  };

  const handleGenerateReturn = async () => {
    const period = `${selectedYear}-${selectedMonth}`;
    try {
      const returnData = await generateINSS.mutateAsync({ period, company });
      setSelectedReturn(returnData);

      await saveFiling.mutateAsync({
        type: "inss_monthly",
        period,
        dataSnapshot: returnData,
        userId: user?.uid || "",
      });

      toast({
        title: t("reports.inssMonthly.toast.generatedTitle"),
        description: t("reports.inssMonthly.toast.generatedDescription", {
          period: formatPeriodLabel(period),
        }),
      });
    } catch (error) {
      console.error("Failed to generate INSS return:", error);
      toast({
        title: t("reports.inssMonthly.toast.generateErrorTitle"),
        description: t("reports.inssMonthly.toast.generateErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const handleViewReturn = async (filing: TaxFiling) => {
    const snapshot = filing.dataSnapshot as MonthlyINSSReturn | undefined;
    if (!snapshot || !snapshot.employees?.length) {
      // No data snapshot — regenerate from payroll
      try {
        const returnData = await generateINSS.mutateAsync({ period: filing.period, company });
        setSelectedReturn(returnData);
        setSelectedFilingId(filing.id);
      } catch {
        toast({
          title: t("reports.inssMonthly.toast.noDataTitle"),
          description: t("reports.inssMonthly.toast.noDataDescription", {
            period: formatPeriodLabel(filing.period),
          }),
          variant: "destructive",
        });
      }
      return;
    }
    setSelectedReturn(snapshot);
    setSelectedFilingId(filing.id);
  };

  const handleExportCSV = () => {
    if (!selectedReturn) return;

    const header = [
      t("reports.inssMonthly.csv.employeeId"),
      t("reports.inssMonthly.csv.fullName"),
      t("reports.inssMonthly.csv.inssNumber"),
      t("reports.inssMonthly.csv.contributionBase"),
      t("reports.inssMonthly.csv.employeeContribution"),
      t("reports.inssMonthly.csv.employerContribution"),
      t("reports.inssMonthly.csv.totalContribution"),
    ];

    const rows = selectedReturn.employees.map((e) => [
      e.employeeId,
      e.fullName,
      e.inssNumber || "",
      e.contributionBase.toFixed(2),
      e.employeeContribution.toFixed(2),
      e.employerContribution.toFixed(2),
      e.totalContribution.toFixed(2),
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `INSS_Monthly_${selectedReturn.reportingPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: t("reports.inssMonthly.toast.exportedTitle"),
      description: t("reports.inssMonthly.toast.exportedDescription"),
    });
  };

  const handleOpenMarkFiled = (filingId: string, task: TaxFilingTask) => {
    setSelectedFilingId(filingId);
    setSelectedTask(task);
    setShowMarkFiledDialog(true);
  };

  const handleMarkFiled = async () => {
    if (!selectedFilingId) return;
    try {
      await markFiled.mutateAsync({
        filingId: selectedFilingId,
        method: filedMethod,
        receiptNumber: receiptNumber || "",
        notes: filedNotes || "",
        userId: user?.uid || "",
        task: selectedTask,
      });

      toast({
        title: t("reports.inssMonthly.toast.savedTitle"),
        description: t("reports.inssMonthly.toast.savedDescription", {
          task: getTaskLabel(selectedTask),
        }),
      });

      setShowMarkFiledDialog(false);
      setReceiptNumber("");
      setFiledNotes("");
    } catch (error) {
      console.error("Failed to mark INSS filing as filed:", error);
      toast({
        title: t("reports.inssMonthly.toast.updateErrorTitle"),
        description: t("reports.inssMonthly.toast.updateErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const availableYears = useMemo(() => {
    const year = new Date().getFullYear();
    return [year, year - 1, year - 2].map(String);
  }, []);

  const overdueFiling = useMemo(
    () => dueDates.find((d) => d.status === "overdue"),
    [dueDates]
  );

  const upcomingDue = useMemo(() => {
    const upcoming = dueDates
      .filter((d) => d.status === "pending")
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    return upcoming[0];
  }, [dueDates]);

  const formatDueTask = (due: FilingDueDate | undefined | null) => {
    if (!due?.task) return t("reports.inssMonthly.title");
    return getTaskLabel(due.task, "full");
  };

  const getTaskStatus = (filing: TaxFiling, task: TaxFilingTask) =>
    task === "statement" ? (filing.statementStatus || filing.status) : (filing.paymentStatus || filing.status);

  const getTaskDueDate = (filing: TaxFiling, task: TaxFilingTask) => {
    const due = dueDates.find((d) => d.period === filing.period && d.task === task);
    if (due?.dueDate) return due.dueDate;
    return task === "statement"
      ? (filing.statementDueDate || filing.dueDate)
      : (filing.paymentDueDate || filing.dueDate);
  };

  const generating = generateINSS.isPending || saveFiling.isPending;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="mx-auto max-w-screen-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-8 w-56 mb-2" />
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("reports.inssMonthly.title")}
        description={t("reports.inssMonthly.subtitle")}
      />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("reports.inssMonthly.title")}
          subtitle={t("reports.inssMonthly.subtitle")}
          icon={Shield}
          iconColor="text-violet-500"
        />

        {(overdueFiling || upcomingDue) && (
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CardContent className="p-4">
              {overdueFiling ? (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-700 dark:text-red-300">
                      {t("reports.inssMonthly.due.overdueTitle", {
                        task: formatDueTask(overdueFiling),
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {t("reports.inssMonthly.due.overdueDescription", {
                        task: formatDueTask(overdueFiling),
                        period: formatPeriodLabel(overdueFiling.period),
                        dueDate: overdueFiling.dueDate,
                      })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      {t("reports.inssMonthly.due.upcomingTitle", {
                        task: formatDueTask(upcomingDue),
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {t("reports.inssMonthly.due.upcomingDescription", {
                        task: formatDueTask(upcomingDue),
                        period: formatPeriodLabel(upcomingDue?.period || ""),
                        dueDate: upcomingDue?.dueDate || "",
                        days: upcomingDue?.daysUntilDue ?? 0,
                      })}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-muted-foreground" />
              {t("reports.inssMonthly.generate.title")}
            </CardTitle>
            <CardDescription>
              {t("reports.inssMonthly.generate.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>{t("reports.inssMonthly.generate.year")}</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("reports.inssMonthly.generate.selectYear")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("reports.inssMonthly.generate.month")}</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("reports.inssMonthly.generate.selectMonth")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 flex gap-2">
                <Button onClick={handleGenerateReturn} disabled={generating} className="flex-1">
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("reports.inssMonthly.generate.generating")}
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4 mr-2" />
                      {t("reports.inssMonthly.generate.button")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedReturn && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {t("reports.inssMonthly.selected.title", {
                    period: formatPeriodLabel(selectedReturn.reportingPeriod),
                  })}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    {t("reports.inssMonthly.actions.export")}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                {t("reports.inssMonthly.selected.description", {
                  employer: selectedReturn.employerName || company.legalName || "-",
                  tin: selectedReturn.employerTIN || company.tinNumber || "-",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    {t("reports.inssMonthly.stats.employees")}
                  </p>
                  <p className="text-2xl font-bold">{selectedReturn.totalEmployees}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    {t("reports.inssMonthly.stats.contributionBase")}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(selectedReturn.totalContributionBase)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    {t("reports.inssMonthly.stats.employeeContribution")}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(selectedReturn.totalEmployeeContributions)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    {t("reports.inssMonthly.stats.employerContribution")}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(selectedReturn.totalEmployerContributions)}</p>
                </div>
              </div>

              <div className="space-y-3 md:hidden">
                {selectedReturn.employees.map((emp) => (
                  <Card key={emp.employeeId}>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="font-semibold">{emp.fullName}</p>
                        <p className="text-xs text-muted-foreground">{emp.employeeId}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssMonthly.table.inssNumber")}
                          </p>
                          <p className={emp.inssNumber ? "" : "text-amber-700"}>
                            {emp.inssNumber || t("reports.inssMonthly.table.missing")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssMonthly.table.base")}
                          </p>
                          <p>{formatCurrencyTL(emp.contributionBase)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssMonthly.table.employeeContribution")}
                          </p>
                          <p>{formatCurrencyTL(emp.employeeContribution)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssMonthly.table.employerContribution")}
                          </p>
                          <p>{formatCurrencyTL(emp.employerContribution)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssMonthly.table.total")}
                          </p>
                          <p className="font-semibold">
                            {formatCurrencyTL(emp.totalContribution)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden rounded-lg border overflow-hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("reports.inssMonthly.table.employee")}</TableHead>
                      <TableHead>{t("reports.inssMonthly.table.inssNumber")}</TableHead>
                      <TableHead className="text-right">
                        {t("reports.inssMonthly.table.base")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports.inssMonthly.table.employeeContribution")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports.inssMonthly.table.employerContribution")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports.inssMonthly.table.total")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReturn.employees.map((emp) => (
                      <TableRow key={emp.employeeId}>
                        <TableCell>
                          <div className="font-medium">{emp.fullName}</div>
                          <div className="text-xs text-muted-foreground">{emp.employeeId}</div>
                        </TableCell>
                        <TableCell className={emp.inssNumber ? "" : "text-amber-700"}>
                          {emp.inssNumber || t("reports.inssMonthly.table.missing")}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrencyTL(emp.contributionBase)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyTL(emp.employeeContribution)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyTL(emp.employerContribution)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrencyTL(emp.totalContribution)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("reports.inssMonthly.tracker.title")}</CardTitle>
            <CardDescription>
              {t("reports.inssMonthly.tracker.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {filings.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    {t("reports.inssMonthly.tracker.empty")}
                  </CardContent>
                </Card>
              ) : (
                filings.map((filing) => {
                  const statementStatus = getTaskStatus(filing, "statement");
                  const paymentStatus = getTaskStatus(filing, "payment");
                  const statementConfig = getStatusConfig(statementStatus);
                  const paymentConfig = getStatusConfig(paymentStatus);
                  const StatementIcon = statementConfig.icon;
                  const PaymentIcon = paymentConfig.icon;
                  return (
                    <Card key={filing.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {formatPeriodLabel(filing.period)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("reports.inssMonthly.tracker.employees")}: {filing.employeeCount}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewReturn(filing)}
                          >
                            {t("reports.inssMonthly.actions.view")}
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.inssMonthly.tracker.statementDue")}
                            </p>
                            <p>{getTaskDueDate(filing, "statement")}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.inssMonthly.tracker.paymentDue")}
                            </p>
                            <p>{getTaskDueDate(filing, "payment")}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.inssMonthly.tracker.statementStatus")}
                            </p>
                            <Badge className={statementConfig.className}>
                              <StatementIcon className="h-3 w-3 mr-1" />
                              {statementConfig.label}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.inssMonthly.tracker.paymentStatus")}
                            </p>
                            <Badge className={paymentConfig.className}>
                              <PaymentIcon className="h-3 w-3 mr-1" />
                              {paymentConfig.label}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.inssMonthly.tracker.employeeContribution")}
                            </p>
                            <p>{formatCurrencyTL(filing.totalINSSEmployee || 0)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.inssMonthly.tracker.employerContribution")}
                            </p>
                            <p>{formatCurrencyTL(filing.totalINSSEmployer || 0)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {statementStatus !== "filed" && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenMarkFiled(filing.id, "statement")}
                            >
                              {t("reports.inssMonthly.actions.markStatement")}
                            </Button>
                          )}
                          {paymentStatus !== "filed" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleOpenMarkFiled(filing.id, "payment")}
                            >
                              {t("reports.inssMonthly.actions.markPayment")}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="hidden rounded-lg border overflow-hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.inssMonthly.tracker.period")}</TableHead>
                    <TableHead>{t("reports.inssMonthly.tracker.statementDue")}</TableHead>
                    <TableHead>{t("reports.inssMonthly.tracker.paymentDue")}</TableHead>
                    <TableHead>{t("reports.inssMonthly.tracker.statementStatus")}</TableHead>
                    <TableHead>{t("reports.inssMonthly.tracker.paymentStatus")}</TableHead>
                    <TableHead className="text-right">
                      {t("reports.inssMonthly.tracker.employees")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("reports.inssMonthly.tracker.employeeContribution")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("reports.inssMonthly.tracker.employerContribution")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("reports.inssMonthly.tracker.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        {t("reports.inssMonthly.tracker.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filings.map((f) => {
                      const statementStatus = getTaskStatus(f, "statement");
                      const paymentStatus = getTaskStatus(f, "payment");
                      const statementConfig = getStatusConfig(statementStatus);
                      const paymentConfig = getStatusConfig(paymentStatus);
                      const StatementIcon = statementConfig.icon;
                      const PaymentIcon = paymentConfig.icon;
                      return (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">
                            {formatPeriodLabel(f.period)}
                          </TableCell>
                          <TableCell>{getTaskDueDate(f, "statement")}</TableCell>
                          <TableCell>{getTaskDueDate(f, "payment")}</TableCell>
                          <TableCell>
                            <Badge className={statementConfig.className}>
                              <StatementIcon className="h-3 w-3 mr-1" />
                              {statementConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={paymentConfig.className}>
                              <PaymentIcon className="h-3 w-3 mr-1" />
                              {paymentConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{f.employeeCount}</TableCell>
                          <TableCell className="text-right">{formatCurrencyTL(f.totalINSSEmployee || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrencyTL(f.totalINSSEmployer || 0)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleViewReturn(f)}>
                                {t("reports.inssMonthly.actions.view")}
                              </Button>
                              {statementStatus !== "filed" && (
                                <Button size="sm" onClick={() => handleOpenMarkFiled(f.id, "statement")}>
                                  {t("reports.inssMonthly.actions.markStatement")}
                                </Button>
                              )}
                              {paymentStatus !== "filed" && (
                                <Button size="sm" variant="secondary" onClick={() => handleOpenMarkFiled(f.id, "payment")}>
                                  {t("reports.inssMonthly.actions.markPayment")}
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
      </div>

      <Dialog open={showMarkFiledDialog} onOpenChange={setShowMarkFiledDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("reports.inssMonthly.markFiled.title", {
                task: getTaskLabel(selectedTask),
              })}
            </DialogTitle>
            <DialogDescription>
              {t("reports.inssMonthly.markFiled.description", {
                task: getTaskLabel(selectedTask),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("reports.inssMonthly.markFiled.submissionMethod")}</Label>
              <Select value={filedMethod} onValueChange={(v) => setFiledMethod(v as SubmissionMethod)}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("reports.inssMonthly.markFiled.selectMethod")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inss_portal">
                    {t("reports.inssMonthly.markFiled.portal")}
                  </SelectItem>
                  <SelectItem value="not_filed">
                    {t("reports.inssMonthly.markFiled.notFiled")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("reports.inssMonthly.markFiled.receiptLabel")}</Label>
              <Input
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder={t("reports.inssMonthly.markFiled.receiptPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("reports.inssMonthly.markFiled.notesLabel")}</Label>
              <Textarea
                value={filedNotes}
                onChange={(e) => setFiledNotes(e.target.value)}
                placeholder={t("reports.inssMonthly.markFiled.notesPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarkFiledDialog(false)}>
              {t("reports.inssMonthly.markFiled.cancel")}
            </Button>
            <Button onClick={handleMarkFiled}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {t("reports.inssMonthly.markFiled.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
