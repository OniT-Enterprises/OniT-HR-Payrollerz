/**
 * Balance Sheet Page
 * Shows assets, liabilities, and equity as of a specific date
 * Verifies the accounting equation: Assets = Liabilities + Equity
 */

import React, { useState } from 'react';
import type { BalanceSheet as BalanceSheetType } from '../../types/accounting';
import { useGenerateBalanceSheet } from '@/hooks/useAccounting';
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
  BarChart3,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Printer,
  Building2,
  Landmark,
  Shield,
} from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { getTodayTL } from "@/lib/dateUtils";

export default function BalanceSheet() {
  const { t } = useI18n();
  const generateMutation = useGenerateBalanceSheet();

  const [report, setReport] = useState<BalanceSheetType | null>(null);
  const [asOfDate, setAsOfDate] = useState<string>(() => getTodayTL());

  const generating = generateMutation.isPending;

  const handleGenerate = async () => {
    const fiscalYear = new Date(asOfDate).getFullYear();
    const result = await generateMutation.mutateAsync({ asOfDate, fiscalYear });
    setReport(result);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!report) return;

    const headers = [
      t("accounting.balanceSheet.code"),
      t("accounting.balanceSheet.accountName"),
      t("accounting.balanceSheet.amount"),
    ];

    const rows: string[][] = [];

    // Assets
    rows.push([t("accounting.balanceSheet.assets"), '', '']);
    report.assetItems.forEach((item) => {
      rows.push([item.accountCode, item.accountName, item.amount.toFixed(2)]);
    });
    rows.push(['', t("accounting.balanceSheet.totalAssets"), report.totalAssets.toFixed(2)]);
    rows.push(['', '', '']);

    // Liabilities
    rows.push([t("accounting.balanceSheet.liabilities"), '', '']);
    report.liabilityItems.forEach((item) => {
      rows.push([item.accountCode, item.accountName, item.amount.toFixed(2)]);
    });
    rows.push(['', t("accounting.balanceSheet.totalLiabilities"), report.totalLiabilities.toFixed(2)]);
    rows.push(['', '', '']);

    // Equity
    rows.push([t("accounting.balanceSheet.equity"), '', '']);
    report.equityItems.forEach((item) => {
      rows.push([item.accountCode || '', item.accountName, item.amount.toFixed(2)]);
    });
    rows.push(['', t("accounting.balanceSheet.totalEquity"), report.totalEquity.toFixed(2)]);
    rows.push(['', '', '']);

    // Total L+E
    rows.push([
      '',
      t("accounting.balanceSheet.totalLiabilitiesAndEquity"),
      (report.totalLiabilities + report.totalEquity).toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-sheet-${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const totalLiabilitiesAndEquity = report
    ? report.totalLiabilities + report.totalEquity
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.balanceSheet} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{t("accounting.balanceSheet.title")}</h1>
                <p className="text-muted-foreground mt-1">
                  {t("accounting.balanceSheet.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint} disabled={!report}>
                <Printer className="mr-2 h-4 w-4" />
                {t("accounting.trialBalance.print")}
              </Button>
              <Button onClick={exportToCSV} disabled={!report}>
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
          <CardTitle className="text-lg">{t("accounting.balanceSheet.generateTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>{t("accounting.trialBalance.asOfDate")}</Label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("accounting.balanceSheet.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Balance Check Status */}
      {report && (
        <Card className={report.isBalanced
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
          : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
        }>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {report.isBalanced ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-200">{t("accounting.balanceSheet.balanced")}</h3>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {t("accounting.balanceSheet.balancedDesc")}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    <div>
                      <h3 className="font-semibold text-red-800 dark:text-red-200">{t("accounting.balanceSheet.notBalanced")}</h3>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {t("accounting.balanceSheet.notBalancedDesc")}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">{t("accounting.trialBalance.asOf", { date: asOfDate })}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {report && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {t("accounting.balanceSheet.totalAssets")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrencyTL(report.totalAssets)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("accounting.trialBalance.accountCount", { count: report.assetItems.length })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Landmark className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                {t("accounting.balanceSheet.totalLiabilities")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrencyTL(report.totalLiabilities)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("accounting.trialBalance.accountCount", { count: report.liabilityItems.length })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                {t("accounting.balanceSheet.totalEquity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrencyTL(report.totalEquity)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("accounting.trialBalance.accountCount", { count: report.equityItems.length })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Balance Sheet Table */}
      {report ? (
        <Card className="print:shadow-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("accounting.balanceSheet.reportTitle")}
            </CardTitle>
            <CardDescription>{t("accounting.trialBalance.asOf", { date: asOfDate })}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">{t("accounting.balanceSheet.code")}</TableHead>
                  <TableHead>{t("accounting.balanceSheet.accountName")}</TableHead>
                  <TableHead className="text-right w-[180px]">{t("accounting.balanceSheet.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Assets Section */}
                <TableRow className="bg-blue-50/50 dark:bg-blue-950/20">
                  <TableCell colSpan={3} className="font-semibold text-sm text-blue-800 dark:text-blue-200">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {t("accounting.balanceSheet.assets")}
                    </div>
                  </TableCell>
                </TableRow>
                {report.assetItems.map((item) => (
                  <TableRow key={item.accountId}>
                    <TableCell className="font-mono text-sm">{item.accountCode}</TableCell>
                    <TableCell>{item.accountName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrencyTL(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {report.assetItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground italic py-4">
                      {t("accounting.balanceSheet.noItems")}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-blue-50/30 dark:bg-blue-950/10 font-medium">
                  <TableCell colSpan={2} className="text-right">
                    {t("accounting.balanceSheet.totalAssets")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold tabular-nums text-blue-700 dark:text-blue-300">
                    {formatCurrencyTL(report.totalAssets)}
                  </TableCell>
                </TableRow>

                {/* Spacer */}
                <TableRow>
                  <TableCell colSpan={3} className="h-4 p-0" />
                </TableRow>

                {/* Liabilities Section */}
                <TableRow className="bg-orange-50/50 dark:bg-orange-950/20">
                  <TableCell colSpan={3} className="font-semibold text-sm text-orange-800 dark:text-orange-200">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4" />
                      {t("accounting.balanceSheet.liabilities")}
                    </div>
                  </TableCell>
                </TableRow>
                {report.liabilityItems.map((item) => (
                  <TableRow key={item.accountId}>
                    <TableCell className="font-mono text-sm">{item.accountCode}</TableCell>
                    <TableCell>{item.accountName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrencyTL(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {report.liabilityItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground italic py-4">
                      {t("accounting.balanceSheet.noItems")}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-orange-50/30 dark:bg-orange-950/10 font-medium">
                  <TableCell colSpan={2} className="text-right">
                    {t("accounting.balanceSheet.totalLiabilities")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold tabular-nums text-orange-700 dark:text-orange-300">
                    {formatCurrencyTL(report.totalLiabilities)}
                  </TableCell>
                </TableRow>

                {/* Spacer */}
                <TableRow>
                  <TableCell colSpan={3} className="h-2 p-0" />
                </TableRow>

                {/* Equity Section */}
                <TableRow className="bg-purple-50/50 dark:bg-purple-950/20">
                  <TableCell colSpan={3} className="font-semibold text-sm text-purple-800 dark:text-purple-200">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t("accounting.balanceSheet.equity")}
                    </div>
                  </TableCell>
                </TableRow>
                {report.equityItems.map((item) => (
                  <TableRow key={item.accountId}>
                    <TableCell className="font-mono text-sm">{item.accountCode || ''}</TableCell>
                    <TableCell>
                      {item.accountId === '__current_year_earnings__'
                        ? t("accounting.balanceSheet.currentYearEarnings")
                        : item.accountName}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrencyTL(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {report.equityItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground italic py-4">
                      {t("accounting.balanceSheet.noItems")}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-purple-50/30 dark:bg-purple-950/10 font-medium">
                  <TableCell colSpan={2} className="text-right">
                    {t("accounting.balanceSheet.totalEquity")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold tabular-nums text-purple-700 dark:text-purple-300">
                    {formatCurrencyTL(report.totalEquity)}
                  </TableCell>
                </TableRow>

                {/* Spacer */}
                <TableRow>
                  <TableCell colSpan={3} className="h-2 p-0" />
                </TableRow>

                {/* Total Liabilities + Equity */}
                <TableRow className="bg-primary/10 font-bold text-lg">
                  <TableCell colSpan={2} className="text-right">
                    {t("accounting.balanceSheet.totalLiabilitiesAndEquity")}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrencyTL(totalLiabilitiesAndEquity)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t("accounting.balanceSheet.noReport")}</h3>
              <p>{t("accounting.balanceSheet.noReportDesc")}</p>
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
