/**
 * General Ledger Page
 * View all transactions for any account with running balances
 */

import React, { useState, useMemo } from 'react';
import { useAccounts, useGeneralLedgerEntries } from "@/hooks/useAccounting";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  BookOpen,
  Search,
  Download,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { Skeleton } from '@/components/ui/skeleton';
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { getTodayTL, toDateStringTL } from "@/lib/dateUtils";

export default function GeneralLedger() {
  const { t } = useI18n();

  // Local UI state
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return toDateStringTL(date);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return getTodayTL();
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch accounts via React Query
  const { data: accounts = [], isLoading: loading } = useAccounts();

  // Derive selected account from fetched accounts
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const accountKey = selectedAccount?.id || selectedAccount?.code;

  // Fetch GL entries via React Query
  const { data: glData, isLoading: loadingEntries } = useGeneralLedgerEntries(
    accountKey,
    { startDate, endDate, accountType: selectedAccount?.type, accountSubType: selectedAccount?.subType }
  );
  const openingBalance = glData?.openingBalance ?? 0;
  const allEntries = useMemo(() => glData?.entries ?? [], [glData?.entries]);

  // Filter entries by search term
  const filteredEntries = useMemo(() => {
    const entries = allEntries;
    if (!searchTerm) return entries;
    const term = searchTerm.toLowerCase();
    return entries.filter(
      (entry) =>
        entry.description.toLowerCase().includes(term) ||
        entry.entryNumber.toLowerCase().includes(term)
    );
  }, [allEntries, searchTerm]);

  // Calculate totals
  const totals = useMemo(() => {
    return allEntries.reduce(
      (acc, entry) => ({
        debit: acc.debit + entry.debit,
        credit: acc.credit + entry.credit,
      }),
      { debit: 0, credit: 0 }
    );
  }, [allEntries]);

  // Get ending balance
  const endingBalance = useMemo(() => {
    if (allEntries.length === 0) return openingBalance;
    return allEntries[allEntries.length - 1].balance;
  }, [allEntries, openingBalance]);

  // Export to CSV
  const exportToCSV = () => {
    if (!selectedAccount || (allEntries.length === 0 && openingBalance === 0)) return;

    const headers = [
      t("accounting.generalLedger.date"),
      t("accounting.generalLedger.entryNumber"),
      t("accounting.generalLedger.description"),
      t("accounting.generalLedger.debit"),
      t("accounting.generalLedger.credit"),
      t("accounting.generalLedger.balance"),
    ];
    const rows: string[][] = [];

    // Opening balance row
    if (openingBalance !== 0) {
      rows.push([startDate, '', t("accounting.generalLedger.openingBalance"), '', '', openingBalance.toFixed(2)]);
    }

    for (const entry of allEntries) {
      rows.push([
        entry.entryDate,
        entry.entryNumber,
        entry.description,
        entry.debit.toFixed(2),
        entry.credit.toFixed(2),
        entry.balance.toFixed(2),
      ]);
    }

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `general-ledger-${selectedAccount.code}-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group accounts by type for select dropdown
  const groupedAccounts = useMemo(() => {
    const activeAccounts = accounts.filter((a) => a.isActive);
    return {
      asset: activeAccounts.filter((a) => a.type === 'asset'),
      liability: activeAccounts.filter((a) => a.type === 'liability'),
      equity: activeAccounts.filter((a) => a.type === 'equity'),
      revenue: activeAccounts.filter((a) => a.type === 'revenue'),
      expense: activeAccounts.filter((a) => a.type === 'expense'),
    };
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- accounts is stable from React Query
  }, [accounts]);

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
                <Skeleton className="h-6 w-56" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2 md:col-span-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-40 flex-1" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
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

  const canExport = !!selectedAccount && (allEntries.length > 0 || openingBalance !== 0);

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.generalLedger} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{t("accounting.generalLedger.title")}</h1>
                <p className="text-muted-foreground mt-1">
                  {t("accounting.generalLedger.subtitle")}
                </p>
              </div>
            </div>
            <Button onClick={exportToCSV} disabled={!canExport}>
              <Download className="mr-2 h-4 w-4" />
              {t("accounting.generalLedger.exportCsv")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("accounting.generalLedger.selectAccountRange")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Account Select */}
            <div className="space-y-2 md:col-span-2">
              <Label>{t("accounting.generalLedger.account")}</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("accounting.generalLedger.selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedAccounts).map(([type, accts]) =>
                    accts.length > 0 ? (
                      <React.Fragment key={type}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                          {t(`accounting.chartOfAccounts.${type}`)}
                        </div>
                        {accts.map((account) => (
                          <SelectItem key={account.id} value={account.id!}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ) : null
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>{t("accounting.generalLedger.startDate")}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("accounting.generalLedger.endDate")}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Search */}
          {selectedAccountId && (
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("accounting.generalLedger.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Summary */}
      {selectedAccount && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">
                  {selectedAccount.code} - {selectedAccount.name}
                </CardTitle>
                <CardDescription>
                  {t(`accounting.chartOfAccounts.${selectedAccount.type}`)} •{' '}
                  {selectedAccount.subType.replace(/_/g, ' ')}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">{t("accounting.generalLedger.endingBalance")}</div>
                <div className="text-2xl font-bold">{formatCurrencyTL(endingBalance)}</div>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Ledger Entries Table */}
      {selectedAccountId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {t("accounting.generalLedger.transactions")}
            </CardTitle>
            <CardDescription>
              {t("accounting.generalLedger.transactionsSummary", { start: startDate, end: endDate, count: allEntries.length })}
              {searchTerm && allEntries.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t("accounting.generalLedger.showingFiltered", { filtered: filteredEntries.length, total: allEntries.length })}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEntries ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allEntries.length === 0 && openingBalance === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <img src="/images/illustrations/empty-accounting.webp" alt="No transactions yet" className="w-32 h-32 mx-auto mb-4 drop-shadow-lg" />
                <p>{t("accounting.generalLedger.noTransactions")}</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("accounting.generalLedger.date")}</TableHead>
                      <TableHead>{t("accounting.generalLedger.entryNumber")}</TableHead>
                      <TableHead className="w-[40%]">{t("accounting.generalLedger.description")}</TableHead>
                      <TableHead className="text-right">{t("accounting.generalLedger.debit")}</TableHead>
                      <TableHead className="text-right">{t("accounting.generalLedger.credit")}</TableHead>
                      <TableHead className="text-right">{t("accounting.generalLedger.balance")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Opening Balance Row */}
                    {openingBalance !== 0 && (
                      <TableRow className="bg-muted/30 italic">
                        <TableCell className="font-mono text-sm text-muted-foreground">{startDate}</TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">—</span></TableCell>
                        <TableCell className="font-medium">{t("accounting.generalLedger.openingBalance")}</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">
                          {formatCurrencyTL(openingBalance)}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredEntries.length === 0 && allEntries.length > 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground italic py-6">
                          {t("accounting.generalLedger.noMatches")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((entry, index) => (
                        <TableRow key={entry.id || index}>
                          <TableCell className="font-mono text-sm">
                            {entry.entryDate}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-blue-600">
                              {entry.entryNumber}
                            </span>
                          </TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {entry.debit > 0 ? (
                              <span className="flex items-center justify-end gap-1 text-green-600">
                                <ArrowUpRight className="h-3 w-3" />
                                {formatCurrencyTL(entry.debit)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {entry.credit > 0 ? (
                              <span className="flex items-center justify-end gap-1 text-red-600">
                                <ArrowDownRight className="h-3 w-3" />
                                {formatCurrencyTL(entry.credit)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium tabular-nums">
                            {formatCurrencyTL(entry.balance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}

                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3} className="text-right">
                        {t("accounting.generalLedger.periodTotals")}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCurrencyTL(totals.debit)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCurrencyTL(totals.credit)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCurrencyTL(endingBalance)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t("accounting.generalLedger.selectAnAccount")}</h3>
              <p>{t("accounting.generalLedger.selectAccountDesc")}</p>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
