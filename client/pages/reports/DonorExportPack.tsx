import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ReportCardHeader,
  ReportEmptyState,
  ReportPage,
  ReportSummary,
  ReportToolbar,
} from "@/components/reports/ReportLayout";
import { SEO } from "@/components/SEO";
import { useJournalEntries } from "@/hooks/useAccounting";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { Download, FileSpreadsheet, WifiOff } from "lucide-react";
import { getTodayTL, toDateStringTL } from "@/lib/dateUtils";
import { addMoney } from "@/lib/currency";
import { downloadCSVRows } from "@/lib/csvExport";
import {
  extractDonorLines,
  summarizeDonorLines,
  type DonorLine,
  type DonorSummary,
} from "@/lib/reports/ngoReporting";

export default function DonorExportPack() {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState(toDateStringTL(startOfMonth));
  const [endDate, setEndDate] = useState(getTodayTL());
  const invalidRange = startDate > endDate;

  const entriesQuery = useJournalEntries(
    {
      status: "posted",
      startDate,
      endDate,
    },
    !invalidRange,
  );
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);
  const isLoading = entriesQuery.isLoading;

  const donorLines = useMemo<DonorLine[]>(
    () => extractDonorLines(entries),
    [entries],
  );
  const summaryRows = useMemo<DonorSummary[]>(
    () => summarizeDonorLines(donorLines),
    [donorLines],
  );

  const totals = useMemo(() => {
    return summaryRows.reduce(
      (acc, row) => {
        acc.salaryExpense = addMoney(acc.salaryExpense, row.salaryExpense);
        acc.inssEmployerExpense = addMoney(
          acc.inssEmployerExpense,
          row.inssEmployerExpense,
        );
        acc.totalExpense = addMoney(acc.totalExpense, row.totalExpense);
        return acc;
      },
      { salaryExpense: 0, inssEmployerExpense: 0, totalExpense: 0 },
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

    downloadCSVRows(
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
      ]),
    );

    downloadCSVRows(
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
      ]),
    );

    toast({
      title: t("reports.donorExportPack.toast.title"),
      description: t("reports.donorExportPack.toast.description"),
    });
  };

  if (entriesQuery.isError) {
    return (
      <>
        <SEO
          title={t("reports.donorExportPack.title")}
          description={t("reports.donorExportPack.subtitle")}
        />
        <ReportPage
          title={t("reports.donorExportPack.title")}
          subtitle={t("reports.donorExportPack.subtitle")}
          icon={FileSpreadsheet}
        >
          <ReportEmptyState
            icon={WifiOff}
            title={t("common.connectionIssueTitle")}
            description={t("common.connectionIssueDesc")}
            actionLabel={t("common.retry")}
            onAction={() => {
              void entriesQuery.refetch();
            }}
          />
        </ReportPage>
      </>
    );
  }

  return (
    <>
      <SEO
        title={t("reports.donorExportPack.title")}
        description={t("reports.donorExportPack.subtitle")}
      />
      <ReportPage
        title={t("reports.donorExportPack.title")}
        subtitle={t("reports.donorExportPack.subtitle")}
        icon={FileSpreadsheet}
        actions={
          <Button
            onClick={exportPack}
            disabled={!donorLines.length || invalidRange}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("reports.donorExportPack.exportButton")}
          </Button>
        }
      >
        <ReportToolbar
          ariaLabel={t("reports.shared.filters")}
          hint={
            invalidRange ? (
              <span className="text-destructive">
                {t("reports.shared.invalidDateRange")}
              </span>
            ) : (
              t("reports.donorExportPack.exportHint")
            )
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="donor-export-start">
              {t("reports.donorExportPack.filters.startDate")}
            </Label>
            <Input
              id="donor-export-start"
              type="date"
              value={startDate}
              aria-invalid={invalidRange}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="donor-export-end">
              {t("reports.donorExportPack.filters.endDate")}
            </Label>
            <Input
              id="donor-export-end"
              type="date"
              value={endDate}
              aria-invalid={invalidRange}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </ReportToolbar>

        <ReportSummary
          title={t("reports.shared.summary")}
          icon={FileSpreadsheet}
          items={[
            {
              label: t("reports.donorExportPack.stats.salaryExpense"),
              value: formatUSD(totals.salaryExpense),
            },
            {
              label: t("reports.donorExportPack.stats.inssEmployerExpense"),
              value: formatUSD(totals.inssEmployerExpense),
            },
            {
              label: t("reports.donorExportPack.stats.totalExpense"),
              value: formatUSD(totals.totalExpense),
            },
          ]}
        />

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <ReportCardHeader
              icon={FileSpreadsheet}
              title={t("reports.donorExportPack.summary.title")}
            />
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
                    <div
                      key={`${row.projectCode}-${row.fundingSource}`}
                      className="space-y-3 rounded-lg border border-border/70 p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {row.projectCode}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.fundingSource}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.donorExportPack.summary.salary")}
                          </p>
                          <p className="text-sm font-medium">
                            {formatUSD(row.salaryExpense)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.donorExportPack.summary.inssEmployer")}
                          </p>
                          <p className="text-sm font-medium">
                            {formatUSD(row.inssEmployerExpense)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.donorExportPack.summary.totalExpense")}
                          </p>
                          <p className="text-sm font-semibold">
                            {formatUSD(row.totalExpense)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t("reports.donorExportPack.summary.project")}
                        </TableHead>
                        <TableHead>
                          {t("reports.donorExportPack.summary.fundingSource")}
                        </TableHead>
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
                        <TableRow
                          key={`${row.projectCode}-${row.fundingSource}`}
                        >
                          <TableCell>{row.projectCode}</TableCell>
                          <TableCell>{row.fundingSource}</TableCell>
                          <TableCell className="text-right">
                            {formatUSD(row.salaryExpense)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatUSD(row.inssEmployerExpense)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatUSD(row.totalExpense)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </ReportPage>
    </>
  );
}
