import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { SEO, seoConfig } from "@/components/SEO";
import { useJournalEntries } from "@/hooks/useAccounting";
import { Download, FileSpreadsheet } from "lucide-react";
import { getTodayTL, toDateStringTL } from "@/lib/dateUtils";
import {
  extractDonorLines,
  summarizeDonorLines,
  type DonorLine,
  type DonorSummary,
} from "@/lib/reports/ngoReporting";

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export default function DonorExportPack() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState(toDateStringTL(startOfMonth));
  const [endDate, setEndDate] = useState(getTodayTL());

  const { data: entries = [], isLoading } = useJournalEntries({
    status: "posted",
    startDate,
    endDate,
  });

  const donorLines = useMemo<DonorLine[]>(() => extractDonorLines(entries), [entries]);
  const summaryRows = useMemo<DonorSummary[]>(
    () => summarizeDonorLines(donorLines),
    [donorLines]
  );

  const totals = useMemo(() => {
    return summaryRows.reduce(
      (acc, row) => {
        acc.salaryExpense += row.salaryExpense;
        acc.inssEmployerExpense += row.inssEmployerExpense;
        acc.totalExpense += row.totalExpense;
        return acc;
      },
      { salaryExpense: 0, inssEmployerExpense: 0, totalExpense: 0 }
    );
  }, [summaryRows]);

  const exportPack = () => {
    if (!donorLines.length) return;

    downloadCsv(
      `donor-payroll-summary-${startDate}-to-${endDate}.csv`,
      [
        "Project Code",
        "Funding Source",
        "Salary Expense",
        "INSS Employer Expense",
        "Total Expense",
      ],
      summaryRows.map((row) => [
        row.projectCode,
        row.fundingSource,
        row.salaryExpense.toFixed(2),
        row.inssEmployerExpense.toFixed(2),
        row.totalExpense.toFixed(2),
      ])
    );

    downloadCsv(
      `donor-payroll-journal-lines-${startDate}-to-${endDate}.csv`,
      [
        "Date",
        "Entry Number",
        "Payroll Run ID",
        "Project Code",
        "Funding Source",
        "Account Code",
        "Account Name",
        "Debit",
        "Credit",
        "Description",
      ],
      donorLines.map((line) => [
        line.date,
        line.entryNumber,
        line.sourceId,
        line.projectCode,
        line.fundingSource,
        line.accountCode,
        line.accountName,
        line.debit.toFixed(2),
        line.credit.toFixed(2),
        line.description,
      ])
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.payrollReports} />
      <MainNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <AutoBreadcrumb />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Donor Export Pack</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Export donor-ready payroll accounting data directly from posted journal entries.
            </p>
          </div>
          <Button onClick={exportPack} disabled={!donorLines.length} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Pack (2 CSV)
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Start Date</p>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">End Date</p>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Salary Expense</CardTitle>
            </CardHeader>
            <CardContent className="text-lg sm:text-2xl font-semibold break-words">
              {formatUSD(totals.salaryExpense)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">INSS Employer Expense</CardTitle>
            </CardHeader>
            <CardContent className="text-lg sm:text-2xl font-semibold break-words">
              {formatUSD(totals.inssEmployerExpense)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Expense</CardTitle>
            </CardHeader>
            <CardContent className="text-lg sm:text-2xl font-semibold break-words">
              {formatUSD(totals.totalExpense)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Summary by Project and Funding Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading journal entries...</p>
            ) : summaryRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payroll journal lines found for this period.</p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {summaryRows.map((row) => (
                    <Card key={`${row.projectCode}-${row.fundingSource}`}>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold">{row.projectCode}</p>
                          <p className="text-xs text-muted-foreground">{row.fundingSource}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Salary</p>
                            <p className="text-sm font-medium">{formatUSD(row.salaryExpense)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">INSS Employer</p>
                            <p className="text-sm font-medium">{formatUSD(row.inssEmployerExpense)}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Expense</p>
                            <p className="text-sm font-semibold">{formatUSD(row.totalExpense)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Funding Source</TableHead>
                        <TableHead className="text-right">Salary Expense</TableHead>
                        <TableHead className="text-right">INSS Employer</TableHead>
                        <TableHead className="text-right">Total Expense</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryRows.map((row) => (
                        <TableRow key={`${row.projectCode}-${row.fundingSource}`}>
                          <TableCell>{row.projectCode}</TableCell>
                          <TableCell>{row.fundingSource}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.salaryExpense)}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.inssEmployerExpense)}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.totalExpense)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
