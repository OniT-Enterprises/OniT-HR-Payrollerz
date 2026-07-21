/**
 * Income Statement (Profit & Loss) Page
 * Shows revenue vs expenses for a period with net income/loss bottom line
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { IncomeStatement as IncomeStatementType } from '../../types/accounting';
import { useIncomeStatement } from '@/hooks/useAccounting';
import { useAdvancedTax, useTenantId } from '@/contexts/TenantContext';
import { trialBalanceService } from '@/services/accountingService';
import { InstallmentTaxEtaxFiling } from '@/components/reports/InstallmentTaxEtaxFiling';
import { getTLIncomeTaxInstallmentFrequency } from '@/lib/tax/income-tax-installment-tl';
import { formatCurrencyTL } from '../../lib/payroll/constants-tl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  FileText,
  Download,
  Loader2,
  RefreshCw,
  Printer,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from "@/components/layout/PageHeader";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTL, getTodayTL, parseDateISO } from "@/lib/dateUtils";
import MoreDetailsSection from "@/components/MoreDetailsSection";

function parseIsoDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isCompleteCalendarMonth(start: string, end: string): boolean {
  const startParts = parseIsoDateParts(start);
  const endParts = parseIsoDateParts(end);
  return !!startParts
    && !!endParts
    && startParts.day === 1
    && startParts.year === endParts.year
    && startParts.month === endParts.month
    && endParts.day === lastDayOfMonth(endParts.year, endParts.month);
}

function isCompleteCalendarQuarter(start: string, end: string): boolean {
  const startParts = parseIsoDateParts(start);
  const endParts = parseIsoDateParts(end);
  return !!startParts
    && !!endParts
    && startParts.day === 1
    && [1, 4, 7, 10].includes(startParts.month)
    && startParts.year === endParts.year
    && endParts.month === startParts.month + 2
    && endParts.day === lastDayOfMonth(endParts.year, endParts.month);
}

export default function IncomeStatement() {
  const { t } = useI18n();
  const tenantId = useTenantId();
  const showAdvancedTax = useAdvancedTax();

  // Local UI state
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const year = new Date().getFullYear();
    return `${year}-01-01`;
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => getTodayTL());
  const [requestedReport, setRequestedReport] = useState<{
    periodStart: string;
    periodEnd: string;
    fiscalYear: number;
  } | null>(null);

  const reportQuery = useIncomeStatement(
    requestedReport?.periodStart ?? periodStart,
    requestedReport?.periodEnd ?? periodEnd,
    requestedReport?.fiscalYear ?? new Date(periodEnd).getFullYear(),
    !!requestedReport,
  );

  const report: IncomeStatementType | null = reportQuery.data ?? null;
  const generating = reportQuery.isFetching;

  const requestedStart = requestedReport?.periodStart ?? "";
  const requestedEnd = requestedReport?.periodEnd ?? "";
  const isPotentialInstallmentPeriod = !!requestedReport
    && (isCompleteCalendarMonth(requestedStart, requestedEnd)
      || isCompleteCalendarQuarter(requestedStart, requestedEnd));
  const priorTaxYear = (requestedReport?.fiscalYear ?? new Date().getFullYear()) - 1;
  const priorYearTurnoverQuery = useQuery({
    queryKey: ['tenants', tenantId, 'accounting', 'installmentTaxTurnover', priorTaxYear],
    queryFn: async () => {
      const statement = await trialBalanceService.generateIncomeStatement(
        tenantId,
        `${priorTaxYear}-01-01`,
        `${priorTaxYear}-12-31`,
        priorTaxYear,
      );
      return statement.totalRevenue;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: showAdvancedTax && !!report && isPotentialInstallmentPeriod,
  });
  const installmentFrequency = priorYearTurnoverQuery.data === undefined
    ? null
    : getTLIncomeTaxInstallmentFrequency(priorYearTurnoverQuery.data);
  const isInstallmentPeriod = installmentFrequency === 'quarterly'
    ? isCompleteCalendarQuarter(requestedStart, requestedEnd)
    : installmentFrequency === 'monthly'
      ? isCompleteCalendarMonth(requestedStart, requestedEnd)
      : false;
  const installmentPeriodLabel = requestedReport
    ? `${formatDateTL(parseDateISO(requestedReport.periodStart), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })} – ${formatDateTL(parseDateISO(requestedReport.periodEnd), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`
    : undefined;

  const handleGenerate = async () => {
    const nextRequest = {
      periodStart,
      periodEnd,
      fiscalYear: new Date(periodEnd).getFullYear(),
    };
    const isSameRequest = requestedReport
      && requestedReport.periodStart === nextRequest.periodStart
      && requestedReport.periodEnd === nextRequest.periodEnd
      && requestedReport.fiscalYear === nextRequest.fiscalYear;

    setRequestedReport(nextRequest);
    if (isSameRequest) {
      await reportQuery.refetch();
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!report) return;

    const headers = [
      t("accounting.incomeStatement.code"),
      t("accounting.incomeStatement.accountName"),
      t("accounting.incomeStatement.amount"),
    ];

    const rows: string[][] = [];

    // Revenue section
    rows.push([t("accounting.incomeStatement.revenue"), '', '']);
    report.revenueItems.forEach((item) => {
      rows.push([item.accountCode, item.accountName, item.amount.toFixed(2)]);
    });
    rows.push([
      '',
      t("accounting.incomeStatement.totalRevenue"),
      report.totalRevenue.toFixed(2),
    ]);
    rows.push(['', '', '']); // blank line

    // Expense section
    rows.push([t("accounting.incomeStatement.expenses"), '', '']);
    report.expenseItems.forEach((item) => {
      rows.push([item.accountCode, item.accountName, item.amount.toFixed(2)]);
    });
    rows.push([
      '',
      t("accounting.incomeStatement.totalExpenses"),
      report.totalExpenses.toFixed(2),
    ]);
    rows.push(['', '', '']); // blank line

    // Net income
    rows.push([
      '',
      report.netIncome >= 0
        ? t("accounting.incomeStatement.netProfit")
        : t("accounting.incomeStatement.netLoss"),
      report.netIncome.toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `income-statement-${periodStart}-to-${periodEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.incomeStatement} />
      <MainNavigation />
      <div className="p-6 mx-auto max-w-screen-2xl space-y-6">
        <PageHeader
          title={t("accounting.incomeStatement.title")}
          subtitle={t("accounting.incomeStatement.subtitle")}
          icon={FileText}
          iconColor="text-orange-500"
          actions={
            <>
              <Button variant="outline" onClick={handlePrint} disabled={!report}>
                <Printer className="mr-2 h-4 w-4" />
                {t("accounting.trialBalance.print")}
              </Button>
              <Button onClick={exportToCSV} disabled={!report}>
                <Download className="mr-2 h-4 w-4" />
                {t("accounting.trialBalance.exportCsv")}
              </Button>
            </>
          }
        />

      {/* Generate Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("accounting.incomeStatement.generateTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>{t("accounting.incomeStatement.periodStart")}</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("accounting.incomeStatement.periodEnd")}</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("accounting.incomeStatement.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <MoreDetailsSection className="mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                {t("accounting.incomeStatement.totalRevenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrencyTL(report.totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("accounting.trialBalance.accountCount", { count: report.revenueItems.length })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                {t("accounting.incomeStatement.totalExpenses")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrencyTL(report.totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("accounting.trialBalance.accountCount", { count: report.expenseItems.length })}
              </p>
            </CardContent>
          </Card>

          <Card className={report.netIncome >= 0
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
          }>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {report.netIncome >= 0
                  ? t("accounting.incomeStatement.netProfit")
                  : t("accounting.incomeStatement.netLoss")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${report.netIncome >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {formatCurrencyTL(Math.abs(report.netIncome))}
              </div>
            </CardContent>
          </Card>
        </div>
        </MoreDetailsSection>
      )}

      {/* Income Statement Table */}
      {report ? (
        <>
          <Card className="print:shadow-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("accounting.incomeStatement.reportTitle")}
            </CardTitle>
            <CardDescription>
              {t("accounting.incomeStatement.periodLabel", { start: periodStart, end: periodEnd })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">{t("accounting.incomeStatement.code")}</TableHead>
                  <TableHead>{t("accounting.incomeStatement.accountName")}</TableHead>
                  <TableHead className="text-right w-[180px]">{t("accounting.incomeStatement.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Revenue Section */}
                <TableRow className="bg-green-50/50 dark:bg-green-950/20">
                  <TableCell colSpan={3} className="font-semibold text-sm text-green-800 dark:text-green-200">
                    {t("accounting.incomeStatement.revenue")}
                  </TableCell>
                </TableRow>
                {report.revenueItems.map((item) => (
                  <TableRow key={item.accountId}>
                    <TableCell className="font-mono text-sm">{item.accountCode}</TableCell>
                    <TableCell>{item.accountName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      <span className="text-green-600 dark:text-green-400">{formatCurrencyTL(item.amount)}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {report.revenueItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground italic py-4">
                      {t("accounting.incomeStatement.noRevenueItems")}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-green-50/30 dark:bg-green-950/10 font-medium">
                  <TableCell colSpan={2} className="text-right">
                    {t("accounting.incomeStatement.totalRevenue")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold tabular-nums text-green-700 dark:text-green-300">
                    {formatCurrencyTL(report.totalRevenue)}
                  </TableCell>
                </TableRow>

                {/* Spacer */}
                <TableRow>
                  <TableCell colSpan={3} className="h-2 p-0" />
                </TableRow>

                {/* Expense Section */}
                <TableRow className="bg-red-50/50 dark:bg-red-950/20">
                  <TableCell colSpan={3} className="font-semibold text-sm text-red-800 dark:text-red-200">
                    {t("accounting.incomeStatement.expenses")}
                  </TableCell>
                </TableRow>
                {report.expenseItems.map((item) => (
                  <TableRow key={item.accountId}>
                    <TableCell className="font-mono text-sm">{item.accountCode}</TableCell>
                    <TableCell>{item.accountName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      <span className="text-red-600 dark:text-red-400">{formatCurrencyTL(item.amount)}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {report.expenseItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground italic py-4">
                      {t("accounting.incomeStatement.noExpenseItems")}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-red-50/30 dark:bg-red-950/10 font-medium">
                  <TableCell colSpan={2} className="text-right">
                    {t("accounting.incomeStatement.totalExpenses")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold tabular-nums text-red-700 dark:text-red-300">
                    {formatCurrencyTL(report.totalExpenses)}
                  </TableCell>
                </TableRow>

                {/* Spacer */}
                <TableRow>
                  <TableCell colSpan={3} className="h-2 p-0" />
                </TableRow>

                {/* Net Income / Net Loss */}
                <TableRow className={`font-bold text-lg ${
                  report.netIncome >= 0
                    ? 'bg-green-100 dark:bg-green-950/30'
                    : 'bg-red-100 dark:bg-red-950/30'
                }`}>
                  <TableCell colSpan={2} className="text-right">
                    {report.netIncome >= 0
                      ? t("accounting.incomeStatement.netProfit")
                      : t("accounting.incomeStatement.netLoss")}
                  </TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${
                    report.netIncome >= 0
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    {formatCurrencyTL(Math.abs(report.netIncome))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          </Card>

          {/* Art. 64 installment filing assistance belongs with the formal
              income statement. It appears only for a complete month/quarter
              and only on the accountant-grade flow. */}
          {showAdvancedTax
            && priorYearTurnoverQuery.isSuccess
            && isInstallmentPeriod && (
            <InstallmentTaxEtaxFiling
              revenue={report.totalRevenue}
              priorYearTurnover={priorYearTurnoverQuery.data}
              periodLabel={installmentPeriodLabel}
            />
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t("accounting.incomeStatement.noReport")}</h3>
              <p>{t("accounting.incomeStatement.noReportDesc")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
      </div>
    </div>
  );
}
