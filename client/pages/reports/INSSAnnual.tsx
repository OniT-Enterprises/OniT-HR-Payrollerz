/**
 * INSS Annual Reconciliation Page
 *
 * Aggregates monthly INSS filings into an annual summary per employee.
 * Used for year-end reconciliation with the Social Security authority.
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
import {
  CalendarDays,
  Download,
  Shield,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/useSettings";
import { useTaxFilings } from "@/hooks/useTaxFiling";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type {
  MonthlyINSSReturn,
  TaxFiling,
} from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";
import { SEO } from "@/components/SEO";

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

function aggregateAnnual(filings: TaxFiling[], company: Partial<CompanyDetails>, year: string): AnnualSummary | null {
  const inssFilings = filings.filter(f =>
    f.type === "inss_monthly" && f.dataSnapshot && f.period.startsWith(year)
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
        existing.totalContributionBase += emp.contributionBase;
        existing.totalEmployeeContribution += emp.employeeContribution;
        existing.totalEmployerContribution += emp.employerContribution;
        existing.totalContribution += emp.totalContribution;
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
    a.fullName.localeCompare(b.fullName)
  );

  // Round all totals to 2 decimal places
  for (const emp of employees) {
    emp.totalContributionBase = +emp.totalContributionBase.toFixed(2);
    emp.totalEmployeeContribution = +emp.totalEmployeeContribution.toFixed(2);
    emp.totalEmployerContribution = +emp.totalEmployerContribution.toFixed(2);
    emp.totalContribution = +emp.totalContribution.toFixed(2);
  }

  return {
    year,
    employerName: company.legalName || "",
    employerTIN: company.tinNumber || "",
    monthsFiled: inssFilings.length,
    totalEmployees: employees.length,
    totalContributionBase: +employees.reduce((s, e) => s + e.totalContributionBase, 0).toFixed(2),
    totalEmployeeContributions: +employees.reduce((s, e) => s + e.totalEmployeeContribution, 0).toFixed(2),
    totalEmployerContributions: +employees.reduce((s, e) => s + e.totalEmployerContribution, 0).toFixed(2),
    totalContributions: +employees.reduce((s, e) => s + e.totalContribution, 0).toFixed(2),
    employees,
  };
}

export default function INSSAnnual() {
  const { toast } = useToast();
  const { t } = useI18n();

  // React Query hooks
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: allFilings = [], isLoading: filingsLoading } = useTaxFilings("inss_monthly");

  const loading = settingsLoading || filingsLoading;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear - 1));
  const [showSummary, setShowSummary] = useState(false);

  const availableYears = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2].map(String);
  }, [currentYear]);

  // Derive company from settings inside useMemo to avoid unstable deps
  const company: Partial<CompanyDetails> = useMemo(
    () => settings?.companyDetails || {},
    [settings?.companyDetails]
  );

  // Compute the annual summary from filings data via useMemo
  const summary = useMemo<AnnualSummary | null>(() => {
    if (!showSummary || allFilings.length === 0) return null;
    return aggregateAnnual(allFilings, company, selectedYear);
  }, [showSummary, allFilings, company, selectedYear]);

  const handleGenerate = () => {
    setShowSummary(true);

    const yearFilings = allFilings.filter(f => f.period.startsWith(selectedYear));
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

    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `INSS_Annual_Reconciliation_${summary.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);

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
        <div className="p-6">
          <div className="mx-auto max-w-screen-2xl">
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-80 mb-6" />
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
        title={t("reports.inssAnnual.title")}
        description={t("reports.inssAnnual.subtitle")}
      />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("reports.inssAnnual.title")}
          subtitle={t("reports.inssAnnual.subtitle")}
          icon={Shield}
          iconColor="text-slate-500"
        />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              {t("reports.inssAnnual.generate.title")}
            </CardTitle>
            <CardDescription>
              {t("reports.inssAnnual.generate.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>{t("reports.inssAnnual.generate.year")}</Label>
                <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setShowSummary(false); }}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("reports.inssAnnual.generate.selectYear")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
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
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {t("reports.inssAnnual.summary.title", { year: summary.year })}
                </span>
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("reports.inssAnnual.actions.export")}
                </Button>
              </CardTitle>
              <CardDescription>
                {t("reports.inssAnnual.summary.description", {
                  employer: summary.employerName || "-",
                  tin: summary.employerTIN || "-",
                  monthsFiled: summary.monthsFiled,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary.monthsFiled < 12 && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                  {t("reports.inssAnnual.summary.warning", {
                    monthsFiled: summary.monthsFiled,
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    {t("reports.inssAnnual.stats.employees")}
                  </p>
                  <p className="text-2xl font-bold">{summary.totalEmployees}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    {t("reports.inssAnnual.stats.monthsFiled")}
                  </p>
                  <p className="text-2xl font-bold">{summary.monthsFiled}/12</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    {t("reports.inssAnnual.stats.totalBase")}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(summary.totalContributionBase)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    {t("reports.inssAnnual.stats.employeeContribution")}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(summary.totalEmployeeContributions)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    {t("reports.inssAnnual.stats.employerContribution")}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(summary.totalEmployerContributions)}</p>
                </div>
              </div>

              <div className="space-y-3 md:hidden">
                {summary.employees.map((emp) => (
                  <Card key={emp.employeeId}>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="font-semibold">{emp.fullName}</p>
                        <p className="text-xs text-muted-foreground">{emp.employeeId}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssAnnual.table.inssNumber")}
                          </p>
                          <p className={emp.inssNumber ? "" : "text-amber-700"}>
                            {emp.inssNumber || t("reports.inssAnnual.table.missing")}
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
                          <p>{formatCurrencyTL(emp.totalEmployeeContribution)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.inssAnnual.table.employerContribution")}
                          </p>
                          <p>{formatCurrencyTL(emp.totalEmployerContribution)}</p>
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
                      <TableHead>{t("reports.inssAnnual.table.employee")}</TableHead>
                      <TableHead>{t("reports.inssAnnual.table.inssNumber")}</TableHead>
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
                          <div className="text-xs text-muted-foreground">{emp.employeeId}</div>
                        </TableCell>
                        <TableCell className={emp.inssNumber ? "" : "text-amber-700"}>
                          {emp.inssNumber || t("reports.inssAnnual.table.missing")}
                        </TableCell>
                        <TableCell className="text-center">
                          {emp.monthsContributed}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrencyTL(emp.totalContributionBase)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyTL(emp.totalEmployeeContribution)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyTL(emp.totalEmployerContribution)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrencyTL(emp.totalContribution)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>
                        {t("reports.inssAnnual.table.total")}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrencyTL(summary.totalContributionBase)}</TableCell>
                      <TableCell className="text-right">{formatCurrencyTL(summary.totalEmployeeContributions)}</TableCell>
                      <TableCell className="text-right">{formatCurrencyTL(summary.totalEmployerContributions)}</TableCell>
                      <TableCell className="text-right">{formatCurrencyTL(summary.totalContributions)}</TableCell>
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
