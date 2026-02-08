/**
 * Bank Reconciliation Page
 * Import bank transactions and match against records
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { bankReconciliationService } from '@/services/bankReconciliationService';
import { invoiceService } from '@/services/invoiceService';
import { billService } from '@/services/billService';
import { expenseService } from '@/services/expenseService';
import type { BankTransaction } from '@/types/money';
import { BankReconciliationSummary } from '@/components/money/BankReconciliationSummary';
import { BankMatchDialog, type MatchOption } from '@/components/money/BankMatchDialog';
import {
  Upload,
  CheckCircle2,
  Link2,
  Link2Off,
  Trash2,
  MoreHorizontal,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Building2,
  Loader2,
} from 'lucide-react';

const MAX_FILE_SIZE_MB = 5;

export default function BankReconciliation() {
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState({
    unmatchedCount: 0,
    matchedCount: 0,
    reconciledCount: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
  });

  // Match dialog state
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [transactionToMatch, setTransactionToMatch] = useState<BankTransaction | null>(null);
  const [matchOptions, setMatchOptions] = useState<MatchOption[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [txns, sum] = await Promise.all([
        bankReconciliationService.getAllTransactions(),
        bankReconciliationService.getReconciliationSummary(),
      ]);
      setTransactions(txns);
      setSummary(sum);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bankRecon.loadError') || 'Failed to load transactions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    bankReconciliationService.setTenantId(tenantId);
    loadData();
  }, [tenantId, loadData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: t('common.error') || 'Error',
        description: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImporting(true);
    try {
      const content = await file.text();
      const result = await bankReconciliationService.importTransactions(content);

      toast({
        title: t('money.bankRecon.importSuccess') || 'Import Complete',
        description: `${result.imported} ${t('money.bankRecon.transactionsImported') || 'transactions imported'}`,
      });

      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }

      loadData();
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bankRecon.importError') || 'Failed to import file',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openMatchDialog = async (transaction: BankTransaction) => {
    setTransactionToMatch(transaction);
    setMatchDialogOpen(true);
    setLoadingMatches(true);
    setMatchOptions([]);

    try {
      const options: MatchOption[] = [];

      if (transaction.type === 'deposit') {
        // For deposits, suggest paid invoices
        const invoices = await invoiceService.getAllInvoices(tenantId);
        invoices
          .filter(inv => inv.status === 'paid' && inv.total > 0)
          .forEach(inv => {
            options.push({
              type: 'invoice_payment',
              id: inv.id,
              description: `${inv.invoiceNumber} - ${inv.customerName}`,
              amount: inv.total,
              date: inv.paidAt?.toISOString().split('T')[0] || inv.issueDate,
            });
          });
      } else {
        // For withdrawals, suggest bills and expenses
        const [bills, expenses] = await Promise.all([
          billService.getAllBills(tenantId),
          expenseService.getAllExpenses(tenantId, 50),
        ]);

        bills
          .filter(bill => bill.status === 'paid')
          .forEach(bill => {
            options.push({
              type: 'bill_payment',
              id: bill.id,
              description: `Bill: ${bill.description} - ${bill.vendorName}`,
              amount: -bill.total,
              date: bill.paidAt?.toISOString().split('T')[0] || bill.billDate,
            });
          });

        expenses.forEach(exp => {
          options.push({
            type: 'expense',
            id: exp.id,
            description: `Expense: ${exp.description}`,
            amount: -exp.amount,
            date: exp.date,
          });
        });
      }

      // Sort by amount similarity
      options.sort((a, b) => {
        const diffA = Math.abs(a.amount - transaction.amount);
        const diffB = Math.abs(b.amount - transaction.amount);
        return diffA - diffB;
      });

      setMatchOptions(options.slice(0, 10)); // Show top 10
    } catch (error) {
      console.error('Error loading match options:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bankRecon.matchError') || 'Failed to load match options',
        variant: 'destructive',
      });
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleMatch = async (option: MatchOption) => {
    if (!transactionToMatch) return;

    try {
      await bankReconciliationService.matchTransaction(transactionToMatch.id, {
        type: option.type,
        id: option.id,
        description: option.description,
      });

      toast({
        title: t('money.bankRecon.matched') || 'Matched',
        description: t('money.bankRecon.matchedDesc') || 'Transaction matched successfully',
      });

      setMatchDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bankRecon.matchError') || 'Failed to match transaction',
        variant: 'destructive',
      });
    }
  };

  const handleUnmatch = async (transactionId: string) => {
    try {
      await bankReconciliationService.unmatchTransaction(transactionId);
      toast({
        title: t('money.bankRecon.unmatched') || 'Unmatched',
      });
      loadData();
    } catch (error) {
      toast({
        title: t('common.error') || 'Error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (transactionId: string) => {
    try {
      await bankReconciliationService.deleteTransaction(transactionId);
      toast({
        title: t('money.bankRecon.deleted') || 'Deleted',
      });
      loadData();
    } catch (error) {
      toast({
        title: t('common.error') || 'Error',
        variant: 'destructive',
      });
    }
  };

  const handleReconcile = async () => {
    if (selectedIds.size === 0) return;

    try {
      await bankReconciliationService.reconcileTransactions(Array.from(selectedIds));
      toast({
        title: t('money.bankRecon.reconciled') || 'Reconciled',
        description: `${selectedIds.size} ${t('money.bankRecon.transactionsReconciled') || 'transactions reconciled'}`,
      });
      setSelectedIds(new Set());
      loadData();
    } catch (error) {
      toast({
        title: t('common.error') || 'Error',
        variant: 'destructive',
      });
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAllMatched = () => {
    const matchedIds = transactions
      .filter(tx => tx.status === 'matched')
      .map(tx => tx.id);
    setSelectedIds(new Set(matchedIds));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      signDisplay: 'never',
    }).format(Math.abs(amount));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Matched</Badge>;
      case 'reconciled':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Reconciled</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Unmatched</Badge>;
    }
  };

  const filteredTransactions = transactions.filter(tx =>
    tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.reference?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="border-b bg-indigo-50 dark:bg-indigo-950/30">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <Skeleton className="h-4 w-48 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div>
                  <Skeleton className="h-8 w-56 mb-2" />
                  <Skeleton className="h-4 w-72" />
                </div>
              </div>
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Summary cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 animate-fade-up stagger-1">
            {[
              "from-amber-500/5 to-orange-500/5",
              "from-blue-500/5 to-indigo-500/5",
              "from-emerald-500/5 to-green-500/5",
              "from-green-500/5 to-teal-500/5",
              "from-red-500/5 to-rose-500/5",
            ].map((gradient, i) => (
              <Card key={i} className="relative overflow-hidden border-border/50">
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                <CardContent className="relative pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Skeleton className="h-3 w-16 mb-2" />
                      <Skeleton className="h-7 w-20" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Table skeleton */}
          <Card className="border-border/50 animate-fade-up stagger-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-36 rounded-md" />
                  <Skeleton className="h-9 w-48 rounded-md" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-border/20 last:border-0">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-20" />
                    <div className="flex items-center gap-2 flex-1">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Bank Reconciliation - OniT" description="Reconcile bank transactions" />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-indigo-50 dark:bg-indigo-950/30">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/25">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {t('money.bankRecon.title') || 'Bank Reconciliation'}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t('money.bankRecon.subtitle') || 'Import and match bank transactions'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/25"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {importing
                  ? t('money.bankRecon.importing') || 'Importing...'
                  : t('money.bankRecon.importCSV') || 'Import CSV'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="animate-fade-up stagger-1">
          <BankReconciliationSummary summary={summary} formatCurrency={formatCurrency} />
        </div>

        {/* Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50 animate-fade-up">
            <Badge className="bg-indigo-500 text-white text-xs tabular-nums">
              {selectedIds.size}
            </Badge>
            <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
              transaction{selectedIds.size !== 1 ? 's' : ''} {t('money.bankRecon.selected') || 'selected'}
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300">
              {t('common.cancel') || 'Clear'}
            </Button>
            <Button size="sm" onClick={handleReconcile} className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-sm">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('money.bankRecon.markReconciled') || 'Mark Reconciled'}
            </Button>
          </div>
        )}

        {/* Transactions Table */}
        <Card className="border-border/50 animate-fade-up stagger-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-indigo-500/10 to-indigo-600/10">
                  <FileSpreadsheet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                {t('money.bankRecon.transactions') || 'Bank Transactions'}
                {transactions.length > 0 && (
                  <Badge variant="outline" className="ml-1 text-xs font-normal tabular-nums">
                    {filteredTransactions.length}{filteredTransactions.length !== transactions.length ? ` / ${transactions.length}` : ''}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={selectAllMatched} className="border-border/50">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {t('money.bankRecon.selectMatched') || 'Select All Matched'}
                </Button>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('money.bankRecon.search') || 'Search...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[200px] border-border/50"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/20 dark:to-indigo-950/10 flex items-center justify-center mb-4">
                  <FileSpreadsheet className="h-8 w-8 text-indigo-400" />
                </div>
                <p className="font-medium text-foreground mb-1">
                  {t('money.bankRecon.noTransactions') || 'No transactions yet'}
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  Upload a CSV export from your bank to get started
                </p>
                <Button onClick={() => fileInputRef.current?.click()} className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-sm">
                  <Upload className="h-4 w-4 mr-2" />
                  {t('money.bankRecon.importFirst') || 'Import your first CSV'}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">{t('money.bankRecon.date') || 'Date'}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">{t('money.bankRecon.description') || 'Description'}</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t('money.bankRecon.amount') || 'Amount'}</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">{t('money.bankRecon.status') || 'Status'}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">{t('money.bankRecon.matchedTo') || 'Matched To'}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => (
                      <TableRow
                        key={tx.id}
                        className={`group transition-colors ${
                          tx.status === 'reconciled'
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/5 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10'
                            : tx.type === 'deposit'
                              ? 'hover:bg-green-50/30 dark:hover:bg-green-950/10'
                              : 'hover:bg-red-50/20 dark:hover:bg-red-950/10'
                        }`}
                      >
                        <TableCell>
                          {tx.status !== 'reconciled' && (
                            <Checkbox
                              checked={selectedIds.has(tx.id)}
                              onCheckedChange={() => toggleSelect(tx.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{tx.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {tx.type === 'deposit' ? (
                              <ArrowDownLeft className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-red-500" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{tx.description}</p>
                              {tx.reference && (
                                <p className="text-xs text-muted-foreground">Ref: {tx.reference}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : '-'}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-center">{getStatusBadge(tx.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.matchedTo?.description || '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Actions for ${tx.description}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {tx.status === 'unmatched' && (
                                <DropdownMenuItem onClick={() => openMatchDialog(tx)} className="cursor-pointer">
                                  <Link2 className="h-4 w-4 mr-2 text-blue-500" />
                                  {t('money.bankRecon.match') || 'Match'}
                                </DropdownMenuItem>
                              )}
                              {tx.status === 'matched' && (
                                <DropdownMenuItem onClick={() => handleUnmatch(tx.id)} className="cursor-pointer">
                                  <Link2Off className="h-4 w-4 mr-2 text-amber-500" />
                                  {t('money.bankRecon.unmatch') || 'Unmatch'}
                                </DropdownMenuItem>
                              )}
                              {tx.status !== 'reconciled' && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(tx.id)}
                                  className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('common.delete') || 'Delete'}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Match Dialog */}
        <BankMatchDialog
          open={matchDialogOpen}
          onOpenChange={setMatchDialogOpen}
          transaction={transactionToMatch}
          matchOptions={matchOptions}
          loading={loadingMatches}
          onMatch={handleMatch}
          formatCurrency={formatCurrency}
        />

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
}
