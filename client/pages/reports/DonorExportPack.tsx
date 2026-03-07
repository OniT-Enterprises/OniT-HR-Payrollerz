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
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { reportsNavConfig } from "@/lib/moduleNav";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { SEO } from "@/components/SEO";
import { useJournalEntries } from "@/hooks/useAccounting";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { Download, FileSpreadsheet } from "lucide-react";
import { getTodayTL, toDateStringTL } from "@/lib/dateUtils";
import {
  extractDonorLines,
  summarizeDonorLines,
  type DonorLine,
  type DonorSummary,
} from "@/lib/reports/ngoReporting";

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export default function DonorExportPack() {
  const { toast } = useToast();
  const { t, locale } = useI18n();
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

  const formatUSD = (value: number): string =>
    new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-PT", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const exportPack = () => {
    if (!donorLines.length) return;

    downloadCsv(
      `donor-payroll-summary-${startDate}-to-${endDate}.csv`,
      [
        t("reports.donorExportPack.csv.projectCode"),
        t("reports.donorExportPack.csv.fundingSource"),
        t("reports.donorExportPack.csv.salaryExpense"),
        t("reports.donorExportPack.csv.inssEmployerExpense"),
        t("reports.donorExportPack.csv.totalExpense"),
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
        t("reports.donorExportPack.csv.date"),
        t("reports.donorExportPack.csv.entryNumber"),
        t("reports.donorExportPack.csv.payrollRunId"),
        t("reports.donorExportPack.csv.projectCode"),
        t("reports.donorExportPack.csv.fundingSource"),
        t("reports.donorExportPack.csv.accountCode"),
        t("reports.donorExportPack.csv.accountName"),
        t("reports.donorExportPack.csv.debit"),
        t("reports.donorExportPack.csv.credit"),
        t("reports.donorExportPack.csv.description"),
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

    toast({
      title: t("reports.donorExportPack.toast.title"),
      description: t("reports.donorExportPack.toast.description"),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("reports.donorExportPack.title")}
        description={t("reports.donorExportPack.subtitle")}
      />
      <MainNavigation />
      <ModuleSectionNav config={reportsNavConfig} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <AutoBreadcrumb />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("reports.donorExportPack.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("reports.donorExportPack.subtitle")}
            </p>
          </div>
          <Button onClick={exportPack} disabled={!donorLines.length} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            {t("reports.donorExportPack.exportButton")}
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t("reports.donorExportPack.filters.startDate")}
              </p>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t("reports.donorExportPack.filters.endDate")}
              </p>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="sm:col-span-2 text-sm text-muted-foreground">
              {t("reports.donorExportPack.exportHint")}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("reports.donorExportPack.stats.salaryExpense")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-lg sm:text-2xl font-semibold break-words">
              {formatUSD(totals.salaryExpense)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("reports.donorExportPack.stats.inssEmployerExpense")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-lg sm:text-2xl font-semibold break-words">
              {formatUSD(totals.inssEmployerExpense)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("reports.donorExportPack.stats.totalExpense")}
              </CardTitle>
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
              {t("reports.donorExportPack.summary.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("reports.donorExportPack.summary.loading")}
              </p>
            ) : summaryRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("reports.donorExportPack.summary.empty")}
              </p>
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
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.donorExportPack.summary.salary")}
                            </p>
                            <p className="text-sm font-medium">{formatUSD(row.salaryExpense)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.donorExportPack.summary.inssEmployer")}
                            </p>
                            <p className="text-sm font-medium">{formatUSD(row.inssEmployerExpense)}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.donorExportPack.summary.totalExpense")}
                            </p>
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
                        <TableHead>{t("reports.donorExportPack.summary.project")}</TableHead>
                        <TableHead>{t("reports.donorExportPack.summary.fundingSource")}</TableHead>
                        <TableHead className="text-right">
                          {t("reports.donorExportPack.summary.salary")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.donorExportPack.summary.inssEmployer")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.donorExportPack.summary.totalExpense")}
                        </TableHead>
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
