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
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
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
        title: "No Data",
        description: `No INSS monthly filings found for ${selectedYear}. Generate monthly returns first.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Annual Summary Generated",
        description: `Aggregated ${yearFilings.length} months of INSS data for ${selectedYear}.`,
      });
    }
  };

  const handleExportCSV = () => {
    if (!summary) return;

    const header = [
      "Employee ID",
      "Full Name",
      "INSS Number",
      "Months Contributed",
      "Annual Contribution Base (USD)",
      "Annual Employee 4% (USD)",
      "Annual Employer 6% (USD)",
      "Annual Total 10% (USD)",
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
      "TOTAL",
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
      title: "Exported",
      description: `INSS annual reconciliation for ${summary.year} exported to CSV.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
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
      <SEO title="INSS Annual Reconciliation" description="Year-end INSS contribution reconciliation for Timor-Leste" />
      <MainNavigation />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <AutoBreadcrumb className="mb-4" />

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg shadow-slate-500/15">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">INSS Annual Reconciliation</h1>
            <p className="text-muted-foreground">
              Aggregate monthly INSS contributions into an annual summary for year-end filing.
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              Generate Annual Summary
            </CardTitle>
            <CardDescription>
              Aggregates all monthly INSS filings for the selected year into per-employee annual totals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setShowSummary(false); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
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
                  Generate Annual Summary
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {summary && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>INSS Annual Summary - {summary.year}</span>
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardTitle>
              <CardDescription>
                Employer: {summary.employerName || "-"} | TIN: {summary.employerTIN || "-"} | Months filed: {summary.monthsFiled}/12
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary.monthsFiled < 12 && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                  Only {summary.monthsFiled} of 12 months have been filed. Generate missing monthly returns before submitting the annual reconciliation.
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Employees</p>
                  <p className="text-2xl font-bold">{summary.totalEmployees}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Months Filed</p>
                  <p className="text-2xl font-bold">{summary.monthsFiled}/12</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Total Base</p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(summary.totalContributionBase)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Employee (4%)</p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(summary.totalEmployeeContributions)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Employer (6%)</p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(summary.totalEmployerContributions)}</p>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>INSS #</TableHead>
                      <TableHead className="text-center">Months</TableHead>
                      <TableHead className="text-right">Annual Base</TableHead>
                      <TableHead className="text-right">Employee (4%)</TableHead>
                      <TableHead className="text-right">Employer (6%)</TableHead>
                      <TableHead className="text-right">Total (10%)</TableHead>
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
                          {emp.inssNumber || "Missing"}
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
                      <TableCell colSpan={3}>TOTAL</TableCell>
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
