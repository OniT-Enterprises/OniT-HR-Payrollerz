/**
 * Bank Reconciliation Page
 * Import bank transactions and match against records
 */

import { useState, useEffect, useRef } from 'react';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenant } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { bankReconciliationService } from '@/services/bankReconciliationService';
import { invoiceService } from '@/services/invoiceService';
import { billService } from '@/services/billService';
import { expenseService } from '@/services/expenseService';
import type { BankTransaction, Invoice, Bill, Expense } from '@/types/money';
import {
  Upload,
  CheckCircle2,
  XCircle,
  Link2,
  Link2Off,
  Trash2,
  MoreHorizontal,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Check,
  Building2,
} from 'lucide-react';

export default function BankReconciliation() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();
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
  const [matchOptions, setMatchOptions] = useState<Array<{
    type: 'invoice_payment' | 'bill_payment' | 'expense';
    id: string;
    description: string;
    amount: number;
    date: string;
  }>>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    if (session?.tid) {
      bankReconciliationService.setTenantId(session.tid);
      loadData();
    }
  }, [session?.tid]);

  const loadData = async () => {
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
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

    try {
      const options: typeof matchOptions = [];

      if (transaction.type === 'deposit') {
        // For deposits, suggest paid invoices
        const invoices = await invoiceService.getAllInvoices();
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
          billService.getAllBills(),
          expenseService.getAllExpenses(50),
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
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleMatch = async (option: typeof matchOptions[0]) => {
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
    }).format(Math.abs(amount));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-blue-100 text-blue-700">Matched</Badge>;
      case 'reconciled':
        return <Badge className="bg-green-100 text-green-700">Reconciled</Badge>;
      default:
        return <Badge variant="outline">Unmatched</Badge>;
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
        <div className="p-6 max-w-6xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Bank Reconciliation - OniT" description="Reconcile bank transactions" />
      <MainNavigation />

      <div className="p-6 max-w-6xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('money.bankRecon.title') || 'Bank Reconciliation'}</h1>
              <p className="text-muted-foreground">
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
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importing
                ? t('money.bankRecon.importing') || 'Importing...'
                : t('money.bankRecon.importCSV') || 'Import CSV'}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{t('money.bankRecon.unmatched') || 'Unmatched'}</p>
              <p className="text-xl font-bold text-amber-600">{summary.unmatchedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{t('money.bankRecon.matched') || 'Matched'}</p>
              <p className="text-xl font-bold text-blue-600">{summary.matchedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{t('money.bankRecon.reconciled') || 'Reconciled'}</p>
              <p className="text-xl font-bold text-green-600">{summary.reconciledCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{t('money.bankRecon.deposits') || 'Deposits'}</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(summary.totalDeposits)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{t('money.bankRecon.withdrawals') || 'Withdrawals'}</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalWithdrawals)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-muted rounded-lg">
            <span className="text-sm">
              {selectedIds.size} {t('money.bankRecon.selected') || 'selected'}
            </span>
            <Button size="sm" onClick={handleReconcile}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('money.bankRecon.markReconciled') || 'Mark Reconciled'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
              {t('common.cancel') || 'Cancel'}
            </Button>
          </div>
        )}

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                {t('money.bankRecon.transactions') || 'Bank Transactions'}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={selectAllMatched}>
                  {t('money.bankRecon.selectMatched') || 'Select All Matched'}
                </Button>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('money.bankRecon.search') || 'Search...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">
                  {t('money.bankRecon.noTransactions') || 'No transactions yet'}
                </p>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t('money.bankRecon.importFirst') || 'Import your first CSV'}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-sm">
                      <th className="w-10 py-3"></th>
                      <th className="text-left py-3 font-medium">{t('money.bankRecon.date') || 'Date'}</th>
                      <th className="text-left py-3 font-medium">{t('money.bankRecon.description') || 'Description'}</th>
                      <th className="text-right py-3 font-medium">{t('money.bankRecon.amount') || 'Amount'}</th>
                      <th className="text-center py-3 font-medium">{t('money.bankRecon.status') || 'Status'}</th>
                      <th className="text-left py-3 font-medium">{t('money.bankRecon.matchedTo') || 'Matched To'}</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b hover:bg-muted/50">
                        <td className="py-3">
                          {tx.status !== 'reconciled' && (
                            <Checkbox
                              checked={selectedIds.has(tx.id)}
                              onCheckedChange={() => toggleSelect(tx.id)}
                            />
                          )}
                        </td>
                        <td className="py-3 text-sm">{tx.date}</td>
                        <td className="py-3">
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
                        </td>
                        <td className={`py-3 text-right font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 text-center">{getStatusBadge(tx.status)}</td>
                        <td className="py-3 text-sm text-muted-foreground">
                          {tx.matchedTo?.description || '-'}
                        </td>
                        <td className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {tx.status === 'unmatched' && (
                                <DropdownMenuItem onClick={() => openMatchDialog(tx)}>
                                  <Link2 className="h-4 w-4 mr-2" />
                                  {t('money.bankRecon.match') || 'Match'}
                                </DropdownMenuItem>
                              )}
                              {tx.status === 'matched' && (
                                <DropdownMenuItem onClick={() => handleUnmatch(tx.id)}>
                                  <Link2Off className="h-4 w-4 mr-2" />
                                  {t('money.bankRecon.unmatch') || 'Unmatch'}
                                </DropdownMenuItem>
                              )}
                              {tx.status !== 'reconciled' && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(tx.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('common.delete') || 'Delete'}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Match Dialog */}
        <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('money.bankRecon.matchTransaction') || 'Match Transaction'}</DialogTitle>
              <DialogDescription>
                {transactionToMatch && (
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <p className="font-medium">{transactionToMatch.description}</p>
                    <p className={`text-lg font-bold ${transactionToMatch.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(transactionToMatch.amount)}
                    </p>
                    <p className="text-sm">{transactionToMatch.date}</p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto">
              {loadingMatches ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : matchOptions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t('money.bankRecon.noMatches') || 'No matching records found'}
                </p>
              ) : (
                <div className="space-y-2">
                  {matchOptions.map((option) => (
                    <button
                      key={`${option.type}-${option.id}`}
                      onClick={() => handleMatch(option)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{option.description}</p>
                          <p className="text-xs text-muted-foreground">{option.date}</p>
                        </div>
                        <p className={`font-medium ${option.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(option.amount)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMatchDialogOpen(false)}>
                {t('common.cancel') || 'Cancel'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
