/**
 * INSS Annual Reconciliation Page
 *
 * Aggregates monthly INSS filings into an annual summary per employee.
 * Used for year-end reconciliation with the Social Security authority.
 */

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ReportCardHeader } from "@/components/reports/ReportLayout";
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
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import { CalendarDays, Download, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/useSettings";
import { useTaxFilings } from "@/hooks/useTaxFiling";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type { MonthlyINSSReturn, TaxFiling } from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";
import { SEO } from "@/components/SEO";
import { addMoney, roundMoney, sumMoney } from "@/lib/currency";
import { downloadCSVRows } from "@/lib/csvExport";

interface AnnualEmployeeSummary {
  employeeId: string;
  fullName: string;
  inssNumber: string;
  monthsContributed: number;
  totalContributionBase: number;
  totalEmployeeContribution: number;
  totalEmployerContribution: number;
  totalContribution: number;
}

interface AnnualSummary {
  year: string;
  employerName: string;
  employerTIN: string;
  monthsFiled: number;
  totalEmployees: number;
  totalContributionBase: number;
  totalEmployeeContributions: number;
  totalEmployerContributions: number;
  totalContributions: number;
  employees: AnnualEmployeeSummary[];
}

function aggregateAnnual(
  filings: TaxFiling[],
  company: Partial<CompanyDetails>,
  year: string,
): AnnualSummary | null {
  const inssFilings = filings.filter(
    (f) =>
      f.type === "inss_monthly" && f.dataSnapshot && f.period.startsWith(year),
  );

  if (inssFilings.length === 0) return null;

  const employeeMap = new Map<string, AnnualEmployeeSummary>();

  for (const filing of inssFilings) {
    const data = filing.dataSnapshot as MonthlyINSSReturn;
    if (!data.employees) continue;

    for (const emp of data.employees) {
      const existing = employeeMap.get(emp.employeeId);
      if (existing) {
        existing.monthsContributed += 1;
        existing.totalContributionBase = addMoney(
          existing.totalContributionBase,
          emp.contributionBase,
        );
        existing.totalEmployeeContribution = addMoney(
          existing.totalEmployeeContribution,
          emp.employeeContribution,
        );
        existing.totalEmployerContribution = addMoney(
          existing.totalEmployerContribution,
          emp.employerContribution,
        );
        existing.totalContribution = addMoney(
          existing.totalContribution,
          emp.totalContribution,
        );
      } else {
        employeeMap.set(emp.employeeId, {
          employeeId: emp.employeeId,
          fullName: emp.fullName,
          inssNumber: emp.inssNumber || "",
          monthsContributed: 1,
          totalContributionBase: emp.contributionBase,
          totalEmployeeContribution: emp.employeeContribution,
          totalEmployerContribution: emp.employerContribution,
          totalContribution: emp.totalContribution,
        });
      }
    }
  }

  const employees = Array.from(employeeMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );

  // Round all totals to 2 decimal places
  for (const emp of employees) {
    emp.totalContributionBase = roundMoney(emp.totalContributionBase);
    emp.totalEmployeeContribution = roundMoney(emp.totalEmployeeContribution);
    emp.totalEmployerContribution = roundMoney(emp.totalEmployerContribution);
    emp.totalContribution = roundMoney(emp.totalContribution);
  }

  return {
    year,
    employerName: company.legalName || "",
    employerTIN: company.tinNumber || "",
    monthsFiled: inssFilings.length,
    totalEmployees: employees.length,
    totalContributionBase: sumMoney(
      employees.map((employee) => employee.totalContributionBase),
    ),
    totalEmployeeContributions: sumMoney(
      employees.map((employee) => employee.totalEmployeeContribution),
    ),
    totalEmployerContributions: sumMoney(
      employees.map((employee) => employee.totalEmployerContribution),
    ),
    totalContributions: sumMoney(
      employees.map((employee) => employee.totalContribution),
    ),
    employees,
  };
}

export default function INSSAnnual() {
  const { toast } = useToast();
  const { t } = useI18n();

  // React Query hooks
  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    isFetching: settingsFetching,
    refetch: refetchSettings,
  } = useSettings();
  const {
    data: allFilings = [],
    isLoading: filingsLoading,
    isError: filingsError,
    isFetching: filingsFetching,
    refetch: refetchFilings,
  } = useTaxFilings("inss_monthly");

  const loading = settingsLoading || filingsLoading;
  const loadError = settingsError || filingsError;
  const retrying = settingsFetching || filingsFetching;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear - 1));
  const [showSummary, setShowSummary] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set(
      [currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(
        String,
      ),
    );
    for (const filing of allFilings) {
      if (/^\d{4}-\d{2}$/.test(filing.period)) {
        years.add(filing.period.slice(0, 4));
      }
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [allFilings, currentYear]);

  // Derive company from settings inside useMemo to avoid unstable deps
  const company: Partial<CompanyDetails> = useMemo(
    () => settings?.companyDetails || {},
    [settings?.companyDetails],
  );

  // Compute the annual summary from filings data via useMemo
  const summary = useMemo<AnnualSummary | null>(() => {
    if (!showSummary || allFilings.length === 0) return null;
    return aggregateAnnual(allFilings, company, selectedYear);
  }, [showSummary, allFilings, company, selectedYear]);

  const handleGenerate = () => {
    setShowSummary(true);

    const yearFilings = allFilings.filter((f) =>
      f.period.startsWith(selectedYear),
    );
    if (yearFilings.length === 0) {
      toast({
        title: t("reports.inssAnnual.toast.noDataTitle"),
        description: t("reports.inssAnnual.toast.noDataDescription", {
          year: selectedYear,
        }),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("reports.inssAnnual.toast.generatedTitle"),
        description: t("reports.inssAnnual.toast.generatedDescription", {
          count: yearFilings.length,
          year: selectedYear,
        }),
      });
    }
  };

  const handleExportCSV = () => {
    if (!summary) return;

    const header = [
      t("reports.inssAnnual.csv.employeeId"),
      t("reports.inssAnnual.csv.fullName"),
      t("reports.inssAnnual.csv.inssNumber"),
      t("reports.inssAnnual.csv.monthsContributed"),
      t("reports.inssAnnual.csv.annualContributionBase"),
      t("reports.inssAnnual.csv.annualEmployeeContribution"),
      t("reports.inssAnnual.csv.annualEmployerContribution"),
      t("reports.inssAnnual.csv.annualTotalContribution"),
    ];

    const rows = summary.employees.map((e) => [
      e.employeeId,
      e.fullName,
      e.inssNumber || "",
      e.monthsContributed,
      e.totalContributionBase.toFixed(2),
      e.totalEmployeeContribution.toFixed(2),
      e.totalEmployerContribution.toFixed(2),
      e.totalContribution.toFixed(2),
    ]);

    // Add totals row
    rows.push([
      "",
      t("reports.inssAnnual.table.total"),
      "",
      "",
      summary.totalContributionBase.toFixed(2),
      summary.totalEmployeeContributions.toFixed(2),
      summary.totalEmployerContributions.toFixed(2),
      summary.totalContributions.toFixed(2),
    ]);

    downloadCSVRows(
      `INSS_Annual_Reconciliation_${summary.year}.csv`,
      header,
      rows,
    );

    toast({
      title: t("reports.inssAnnual.toast.exportedTitle"),
      description: t("reports.inssAnnual.toast.exportedDescription", {
        year: summary.year,
      }),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div>
              <Skeleton className="h-6 w-56 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>

          <Card className="mb-6">
            <CardHeader className="pb-4">
              <div className="flex min-w-0 items-start gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Skeleton className="h-10 flex-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={t("reports.inssAnnual.title")}
          description={t("reports.inssAnnual.subtitle")}
        />
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={t("reports.inssAnnual.title")}
            subtitle={t("reports.inssAnnual.subtitle")}
            icon={Shield}
            iconColor="text-primary"
          />
          <DashboardLoadError
            isRetrying={retrying}
            onRetry={() => Promise.all([refetchSettings(), refetchFilings()])}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("reports.inssAnnual.title")}
        description={t("reports.inssAnnual.subtitle")}
      />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("reports.inssAnnual.title")}
          subtitle={t("reports.inssAnnual.subtitle")}
          icon={Shield}
          iconColor="text-primary"
        />

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <ReportCardHeader
              icon={CalendarDays}
              accent="primary"
              title={t("reports.inssAnnual.generate.title")}
              description={t("reports.inssAnnual.generate.description")}
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>{t("reports.inssAnnual.generate.year")}</Label>
                <Select
                  value={selectedYear}
                  onValueChange={(v) => {
                    setSelectedYear(v);
                    setShowSummary(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("reports.inssAnnual.generate.selectYear")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={handleGenerate} className="flex-1">
                  {t("reports.inssAnnual.generate.button")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {summary && (
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <ReportCardHeader
                icon={Shield}
                accent="primary"
                title={t("reports.inssAnnual.summary.title", {
                  year: summary.year,
                })}
                description={t("reports.inssAnnual.summary.description", {
                  employer: summary.employerName || "-",
                  tin: summary.employerTIN || "-",
                  monthsFiled: summary.monthsFiled,
                })}
                actions={
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    {t("reports.inssAnnual.actions.export")}
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              {summary.monthsFiled < 12 && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                  {t("reports.inssAnnual.summary.warning", {
                    monthsFiled: summary.monthsFiled,
                  })}
                </div>
              )}

              <dl className="mb-6 grid gap-x-8 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5">
                  <dt className="text-sm text-muted-foreground">
                    {t("reports.inssAnnual.stats.employees")}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {summary.totalEmployees}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5">
                  <dt className="text-sm text-muted-foreground">
                    {t("reports.inssAnnual.stats.monthsFiled")}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {summary.monthsFiled}/12
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5">
                  <dt className="text-sm text-muted-foreground">
                    {t("reports.inssAnnual.stats.totalBase")}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {formatCurrencyTL(summary.totalContributionBase)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5">
                  <dt className="text-sm text-muted-foreground">
                    {t("reports.inssAnnual.stats.employeeContribution")}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {formatCurrencyTL(summary.totalEmployeeContributions)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5 sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">
                    {t("reports.inssAnnual.stats.employerContribution")}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {formatCurrencyTL(summary.totalEmployerContributions)}
                  </dd>
                </div>
              </dl>

              <div className="space-y-3 md:hidden">
                {summary.employees.map((emp) => (
                  <Card key={emp.employeeId}>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="font-semibold">{emp.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {emp.employeeId}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssAnnual.table.inssNumber")}
                          </p>
                          <p className={emp.inssNumber ? "" : "text-amber-700"}>
                            {emp.inssNumber ||
                              t("reports.inssAnnual.table.missing")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssAnnual.table.months")}
                          </p>
                          <p>{emp.monthsContributed}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssAnnual.table.annualBase")}
                          </p>
                          <p>{formatCurrencyTL(emp.totalContributionBase)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssAnnual.table.employeeContribution")}
                          </p>
                          <p>
                            {formatCurrencyTL(emp.totalEmployeeContribution)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssAnnual.table.employerContribution")}
                          </p>
                          <p>
                            {formatCurrencyTL(emp.totalEmployerContribution)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssAnnual.table.totalContribution")}
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
                      <TableHead>
                        {t("reports.inssAnnual.table.employee")}
                      </TableHead>
                      <TableHead>
                        {t("reports.inssAnnual.table.inssNumber")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t("reports.inssAnnual.table.months")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports.inssAnnual.table.annualBase")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports.inssAnnual.table.employeeContribution")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports.inssAnnual.table.employerContribution")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports.inssAnnual.table.totalContribution")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.employees.map((emp) => (
                      <TableRow key={emp.employeeId}>
                        <TableCell>
                          <div className="font-medium">{emp.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {emp.employeeId}
                          </div>
                        </TableCell>
                        <TableCell
                          className={emp.inssNumber ? "" : "text-amber-700"}
                        >
                          {emp.inssNumber ||
                            t("reports.inssAnnual.table.missing")}
                        </TableCell>
                        <TableCell className="text-center">
                          {emp.monthsContributed}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyTL(emp.totalContributionBase)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyTL(emp.totalEmployeeContribution)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyTL(emp.totalEmployerContribution)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrencyTL(emp.totalContribution)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>
                        {t("reports.inssAnnual.table.total")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyTL(summary.totalContributionBase)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyTL(summary.totalEmployeeContributions)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyTL(summary.totalEmployerContributions)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyTL(summary.totalContributions)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
