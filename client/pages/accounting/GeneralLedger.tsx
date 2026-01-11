/**
 * General Ledger Page
 * View all transactions for any account with running balances
 */

import React, { useState, useEffect, useMemo } from 'react';
import { accountingService } from '../../services/accountingService';
import { Account, GeneralLedgerEntry } from '../../types/accounting';
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
  Calendar,
  ChevronRight,
  Loader2,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { Skeleton } from '@/components/ui/skeleton';

export default function GeneralLedger() {
  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<GeneralLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Date filters
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Load accounts on mount
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accountsList = await accountingService.accounts.getAllAccounts();
        // Sort by code
        accountsList.sort((a, b) => a.code.localeCompare(b.code));
        setAccounts(accountsList);
      } catch (error) {
        console.error('Error loading accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();
  }, []);

  // Load ledger entries when account or date range changes
  useEffect(() => {
    const loadLedgerEntries = async () => {
      if (!selectedAccountId) {
        setLedgerEntries([]);
        return;
      }

      setLoadingEntries(true);
      try {
        const entries = await accountingService.generalLedger.getEntriesByAccount(
          selectedAccountId,
          { startDate, endDate }
        );
        setLedgerEntries(entries);
      } catch (error) {
        console.error('Error loading ledger entries:', error);
      } finally {
        setLoadingEntries(false);
      }
    };

    loadLedgerEntries();
  }, [selectedAccountId, startDate, endDate]);

  // Get selected account details
  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // Filter entries by search term
  const filteredEntries = useMemo(() => {
    if (!searchTerm) return ledgerEntries;
    const term = searchTerm.toLowerCase();
    return ledgerEntries.filter(
      (entry) =>
        entry.description.toLowerCase().includes(term) ||
        entry.entryNumber.toLowerCase().includes(term)
    );
  }, [ledgerEntries, searchTerm]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => ({
        debit: acc.debit + entry.debit,
        credit: acc.credit + entry.credit,
      }),
      { debit: 0, credit: 0 }
    );
  }, [filteredEntries]);

  // Get ending balance
  const endingBalance = useMemo(() => {
    if (filteredEntries.length === 0) return 0;
    return filteredEntries[filteredEntries.length - 1].balance;
  }, [filteredEntries]);

  // Export to CSV
  const exportToCSV = () => {
    if (!selectedAccount || filteredEntries.length === 0) return;

    const headers = ['Date', 'Entry #', 'Description', 'Debit', 'Credit', 'Balance'];
    const rows = filteredEntries.map((entry) => [
      entry.entryDate,
      entry.entryNumber,
      entry.description,
      entry.debit.toFixed(2),
      entry.credit.toFixed(2),
      entry.balance.toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `general-ledger-${selectedAccount.code}-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group accounts by type for select dropdown
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
    };
    accounts.forEach((account) => {
      if (account.isActive) {
        groups[account.type].push(account);
      }
    });
    return groups;
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

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AutoBreadcrumb className="mb-2" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">General Ledger</h1>
          <p className="text-muted-foreground">
            View all transactions for any account
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={filteredEntries.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Account & Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Account Select */}
            <div className="space-y-2 md:col-span-2">
              <Label>Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedAccounts).map(([type, accts]) =>
                    accts.length > 0 ? (
                      <React.Fragment key={type}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                          {type}
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
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
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
                  placeholder="Search by description or entry number..."
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
                  {selectedAccount.type.charAt(0).toUpperCase() + selectedAccount.type.slice(1)} •{' '}
                  {selectedAccount.subType.replace(/_/g, ' ')}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Ending Balance</div>
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
              Transactions
            </CardTitle>
            <CardDescription>
              {startDate} to {endDate} • {filteredEntries.length} transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEntries ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions found for this period</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entry #</TableHead>
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry, index) => (
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
                        <TableCell className="text-right font-mono">
                          {entry.debit > 0 ? (
                            <span className="flex items-center justify-end gap-1 text-green-600">
                              <ArrowUpRight className="h-3 w-3" />
                              {formatCurrencyTL(entry.debit)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.credit > 0 ? (
                            <span className="flex items-center justify-end gap-1 text-red-600">
                              <ArrowDownRight className="h-3 w-3" />
                              {formatCurrencyTL(entry.credit)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrencyTL(entry.balance)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3} className="text-right">
                        Period Totals:
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrencyTL(totals.debit)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrencyTL(totals.credit)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
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
              <h3 className="text-lg font-medium mb-2">Select an Account</h3>
              <p>Choose an account above to view its transaction history</p>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
