/**
 * Trial Balance Page
 * Shows all accounts with debit/credit balances to verify books are balanced
 */

import React, { useState, useMemo } from 'react';
import { AccountType, TrialBalanceRow } from '../../types/accounting';
import { useAccounts, useGenerateTrialBalance } from '@/hooks/useAccounting';
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
  Scale,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Printer,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { Skeleton } from '@/components/ui/skeleton';
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { getTodayTL } from "@/lib/dateUtils";

// Account type display order and colors
const ACCOUNT_TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];


export default function TrialBalance() {
  const { t } = useI18n();
  // Data hooks
  const { isLoading: loading } = useAccounts();
  const generateMutation = useGenerateTrialBalance();

  // Local UI state
  const [trialBalanceRows, setTrialBalanceRows] = useState<TrialBalanceRow[]>([]);
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const year = new Date().getFullYear();
    return `${year}-01-01`;
  });
  const [asOfDate, setAsOfDate] = useState<string>(() => getTodayTL());
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);

  const generating = generateMutation.isPending;

  // Generate trial balance
  const handleGenerateTrialBalance = async () => {
    const fiscalYear = new Date(asOfDate).getFullYear();
    const trialBalance = await generateMutation.mutateAsync({ asOfDate, fiscalYear, periodStart });
    setTrialBalanceRows(trialBalance.rows);
  };

  // Filter rows based on options
  const filteredRows = useMemo(() => {
    let rows = [...trialBalanceRows];

    if (!includeZeroBalances) {
      rows = rows.filter(
        (row) =>
          row.openingDebit !== 0 ||
          row.openingCredit !== 0 ||
          row.periodDebit !== 0 ||
          row.periodCredit !== 0 ||
          row.closingDebit !== 0 ||
          row.closingCredit !== 0
      );
    }

    // Sort by account type order, then by code
    return rows.sort((a, b) => {
      const typeOrderA = ACCOUNT_TYPE_ORDER.indexOf(a.accountType);
      const typeOrderB = ACCOUNT_TYPE_ORDER.indexOf(b.accountType);
      if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
      return a.accountCode.localeCompare(b.accountCode);
    });
  }, [trialBalanceRows, includeZeroBalances]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        openingDebit: acc.openingDebit + row.openingDebit,
        openingCredit: acc.openingCredit + row.openingCredit,
        periodDebit: acc.periodDebit + row.periodDebit,
        periodCredit: acc.periodCredit + row.periodCredit,
        debit: acc.debit + row.closingDebit,
        credit: acc.credit + row.closingCredit,
      }),
      { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, debit: 0, credit: 0 }
    );
  }, [filteredRows]);

  // Check if balanced
  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;
  const difference = totals.debit - totals.credit;

  // Group rows by account type for summary
  const summaryByType = useMemo(() => {
    const summary: Record<AccountType, { openingDebit: number; openingCredit: number; periodDebit: number; periodCredit: number; debit: number; credit: number; count: number }> = {
      asset: { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, debit: 0, credit: 0, count: 0 },
      liability: { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, debit: 0, credit: 0, count: 0 },
      equity: { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, debit: 0, credit: 0, count: 0 },
      revenue: { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, debit: 0, credit: 0, count: 0 },
      expense: { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, debit: 0, credit: 0, count: 0 },
    };

    filteredRows.forEach((row) => {
      summary[row.accountType].openingDebit += row.openingDebit;
      summary[row.accountType].openingCredit += row.openingCredit;
      summary[row.accountType].periodDebit += row.periodDebit;
      summary[row.accountType].periodCredit += row.periodCredit;
      summary[row.accountType].debit += row.closingDebit;
      summary[row.accountType].credit += row.closingCredit;
      summary[row.accountType].count++;
    });

    return summary;
  }, [filteredRows]);

  // Helper to translate account type
  const translateType = (type: AccountType) => {
    const key = `accounting.chartOfAccounts.${type}` as const;
    return t(key);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredRows.length === 0) return;

    const headers = [
      t("accounting.trialBalance.code"),
      t("accounting.trialBalance.accountName"),
      t("accounting.trialBalance.type"),
      t("accounting.trialBalance.openingDebit"),
      t("accounting.trialBalance.openingCredit"),
      t("accounting.trialBalance.periodDebit"),
      t("accounting.trialBalance.periodCredit"),
      t("accounting.trialBalance.debit"),
      t("accounting.trialBalance.credit"),
    ];
    const rows = filteredRows.map((row) => [
      row.accountCode,
      row.accountName,
      translateType(row.accountType),
      row.openingDebit.toFixed(2),
      row.openingCredit.toFixed(2),
      row.periodDebit.toFixed(2),
      row.periodCredit.toFixed(2),
      row.closingDebit.toFixed(2),
      row.closingCredit.toFixed(2),
    ]);

    // Add totals row
    const openingDebitTotal = filteredRows.reduce((s, r) => s + r.openingDebit, 0);
    const openingCreditTotal = filteredRows.reduce((s, r) => s + r.openingCredit, 0);
    const periodDebitTotal = filteredRows.reduce((s, r) => s + r.periodDebit, 0);
    const periodCreditTotal = filteredRows.reduce((s, r) => s + r.periodCredit, 0);
    rows.push(['', t("accounting.trialBalance.totalLabel"), '',
      openingDebitTotal.toFixed(2), openingCreditTotal.toFixed(2),
      periodDebitTotal.toFixed(2), periodCreditTotal.toFixed(2),
      totals.debit.toFixed(2), totals.credit.toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trial-balance-${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <Card className="mb-6">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-44" />
                  </div>
                  <Skeleton className="h-10 w-48" />
                  <Skeleton className="h-10 w-28" />
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-5 mb-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24 ml-auto" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.trialBalance} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
                <Scale className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{t("accounting.trialBalance.title")}</h1>
                <p className="text-muted-foreground mt-1">
                  {t("accounting.trialBalance.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint} disabled={filteredRows.length === 0}>
                <Printer className="mr-2 h-4 w-4" />
                {t("accounting.trialBalance.print")}
              </Button>
              <Button onClick={exportToCSV} disabled={filteredRows.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                {t("accounting.trialBalance.exportCsv")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Generate Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("accounting.trialBalance.generateTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>{t("accounting.trialBalance.periodStartDate")}</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("accounting.trialBalance.asOfDate")}</Label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-[180px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeZero"
                checked={includeZeroBalances}
                onChange={(e) => setIncludeZeroBalances(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="includeZero" className="cursor-pointer">
                {t("accounting.trialBalance.includeZero")}
              </Label>
            </div>

            <Button onClick={handleGenerateTrialBalance} disabled={generating}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("accounting.trialBalance.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Balance Status */}
      {trialBalanceRows.length > 0 && (
        <Card className={isBalanced ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isBalanced ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-200">{t("accounting.trialBalance.balanced")}</h3>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {t("accounting.trialBalance.balancedDesc")}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    <div>
                      <h3 className="font-semibold text-red-800 dark:text-red-200">{t("accounting.trialBalance.notBalanced")}</h3>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {t("accounting.trialBalance.notBalancedDesc", { amount: formatCurrencyTL(Math.abs(difference)), direction: difference > 0 ? t("accounting.trialBalance.debitsHigher") : t("accounting.trialBalance.creditsHigher") })}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">{t("accounting.trialBalance.asOf", { date: asOfDate })}</div>
                <div className="text-lg font-semibold">
                  {t("accounting.trialBalance.accountCount", { count: filteredRows.length })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {trialBalanceRows.length > 0 && (
        <div className="grid gap-4 md:grid-cols-5">
          {ACCOUNT_TYPE_ORDER.map((type) => (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {translateType(type)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrencyTL(
                    type === 'asset' || type === 'expense'
                      ? summaryByType[type].debit - summaryByType[type].credit
                      : summaryByType[type].credit - summaryByType[type].debit
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("accounting.trialBalance.accountCount", { count: summaryByType[type].count })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Trial Balance Table */}
      {trialBalanceRows.length > 0 ? (
        <Card className="print:shadow-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5" />
              {t("accounting.trialBalance.reportTitle")}
            </CardTitle>
            <CardDescription>{t("accounting.trialBalance.asOf", { date: asOfDate })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className="w-[100px] align-bottom border-r">{t("accounting.trialBalance.code")}</TableHead>
                  <TableHead rowSpan={2} className="align-bottom border-r">{t("accounting.trialBalance.accountName")}</TableHead>
                  <TableHead colSpan={2} className="text-center border-b border-r">{t("accounting.trialBalance.openingBalance")}</TableHead>
                  <TableHead colSpan={2} className="text-center border-b border-r">{t("accounting.trialBalance.periodMovement")}</TableHead>
                  <TableHead colSpan={2} className="text-center border-b">{t("accounting.trialBalance.closingBalance")}</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="text-right w-[120px]">{t("accounting.trialBalance.debit")}</TableHead>
                  <TableHead className="text-right w-[120px] border-r">{t("accounting.trialBalance.credit")}</TableHead>
                  <TableHead className="text-right w-[120px]">{t("accounting.trialBalance.debit")}</TableHead>
                  <TableHead className="text-right w-[120px] border-r">{t("accounting.trialBalance.credit")}</TableHead>
                  <TableHead className="text-right w-[120px]">{t("accounting.trialBalance.debit")}</TableHead>
                  <TableHead className="text-right w-[120px]">{t("accounting.trialBalance.credit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Group by account type */}
                {ACCOUNT_TYPE_ORDER.map((type) => {
                  const typeRows = filteredRows.filter((r) => r.accountType === type);
                  if (typeRows.length === 0) return null;

                  return (
                    <React.Fragment key={type}>
                      {/* Type Header */}
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={8} className="font-semibold text-sm">
                          {translateType(type)}
                        </TableCell>
                      </TableRow>

                      {/* Account Rows */}
                      {typeRows.map((row) => (
                        <TableRow key={row.accountId}>
                          <TableCell className="font-mono text-sm">
                            {row.accountCode}
                          </TableCell>
                          <TableCell>{row.accountName}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {row.openingDebit > 0 ? formatCurrencyTL(row.openingDebit) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums border-r">
                            {row.openingCredit > 0 ? formatCurrencyTL(row.openingCredit) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {row.periodDebit > 0 ? formatCurrencyTL(row.periodDebit) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums border-r">
                            {row.periodCredit > 0 ? formatCurrencyTL(row.periodCredit) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {row.closingDebit > 0 ? (
                              <span className="text-green-600 dark:text-green-400">{formatCurrencyTL(row.closingDebit)}</span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {row.closingCredit > 0 ? (
                              <span className="text-blue-600 dark:text-blue-400">{formatCurrencyTL(row.closingCredit)}</span>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Type Subtotal */}
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={2} className="text-right font-medium">
                          {t("accounting.trialBalance.subtotal", { type: translateType(type) })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">
                          {formatCurrencyTL(summaryByType[type].openingDebit)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums border-r">
                          {formatCurrencyTL(summaryByType[type].openingCredit)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">
                          {formatCurrencyTL(summaryByType[type].periodDebit)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums border-r">
                          {formatCurrencyTL(summaryByType[type].periodCredit)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">
                          {formatCurrencyTL(summaryByType[type].debit)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">
                          {formatCurrencyTL(summaryByType[type].credit)}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}

                {/* Grand Totals */}
                <TableRow className="bg-primary/10 font-bold text-lg">
                  <TableCell colSpan={2} className="text-right">
                    {t("accounting.trialBalance.totalLabel")}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrencyTL(totals.openingDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums border-r">
                    {formatCurrencyTL(totals.openingCredit)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrencyTL(totals.periodDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums border-r">
                    {formatCurrencyTL(totals.periodCredit)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                      {formatCurrencyTL(totals.debit)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      {formatCurrencyTL(totals.credit)}
                    </div>
                  </TableCell>
                </TableRow>

                {/* Difference row if not balanced */}
                {!isBalanced && (
                  <TableRow className="bg-red-100 dark:bg-red-950/30">
                    <TableCell colSpan={6} className="text-right font-medium text-red-800 dark:text-red-200">
                      {t("accounting.trialBalance.differenceLabel")}
                    </TableCell>
                    <TableCell colSpan={2} className="text-center font-mono font-bold text-red-800 dark:text-red-200">
                      {formatCurrencyTL(Math.abs(difference))}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Scale className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t("accounting.trialBalance.noReport")}</h3>
              <p>{t("accounting.trialBalance.noReportDesc")}</p>
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
