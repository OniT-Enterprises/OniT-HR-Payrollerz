/**
 * Bank Reconciliation Page
 * Import bank transactions and match against records
 */

import { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
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

import {
  useBankTransactions,
  useReconciliationSummary,
  useImportTransactions,
  useMatchTransaction,
  useUnmatchTransaction,
  useReconcileTransactions,
  useDeleteBankTransaction,
  useSettleTransaction,
  type SettleMatchInput,
} from '@/hooks/useBankReconciliation';
import { invoiceService } from '@/services/invoiceService';
import { billService } from '@/services/billService';
import { expenseService } from '@/services/expenseService';
import {
  decideSettlement,
  canSettleBillFromBank,
} from '@/lib/accounting/bank-reconciliation-settlement';
import type { BankTransaction } from '@/types/money';
import { addDays, formatDateISO } from '@/lib/dateUtils';
import { absoluteMoney, compareMoney, subtractMoney } from '@/lib/currency';
import { BankReconciliationSummary } from '@/components/money/BankReconciliationSummary';
import { BankMatchDialog, type MatchOption } from '@/components/money/BankMatchDialog';
import MoreDetailsSection from '@/components/MoreDetailsSection';
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
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAccountingRoute = location.pathname.startsWith('/accounting/');
  const accent = isAccountingRoute
    ? {
        iconColor: 'text-orange-500',
        solidBtn: 'bg-orange-600 hover:bg-orange-700',
        badgeSolid: 'bg-orange-500 text-white text-xs tabular-nums',
        bar: 'bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200/50 dark:border-orange-800/50',
        barText: 'text-sm font-medium text-orange-800 dark:text-orange-200',
        outlineBtn: 'border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300',
        iconBadgeGrad: 'bg-orange-500/10',
        iconBadgeText: 'h-4 w-4 text-orange-600 dark:text-orange-400',
        emptyGrad: 'bg-orange-50 dark:bg-orange-950/20',
        emptyIcon: 'h-8 w-8 text-orange-400',
      }
    : {
        iconColor: 'text-indigo-500',
        solidBtn: 'bg-indigo-600 hover:bg-indigo-700',
        badgeSolid: 'bg-indigo-500 text-white text-xs tabular-nums',
        bar: 'bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50',
        barText: 'text-sm font-medium text-indigo-800 dark:text-indigo-200',
        outlineBtn: 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300',
        iconBadgeGrad: 'bg-indigo-500/10',
        iconBadgeText: 'h-4 w-4 text-indigo-600 dark:text-indigo-400',
        emptyGrad: 'bg-indigo-50 dark:bg-indigo-950/20',
        emptyIcon: 'h-8 w-8 text-indigo-400',
      };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Match dialog state
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [transactionToMatch, setTransactionToMatch] = useState<BankTransaction | null>(null);
  const [matchOptions, setMatchOptions] = useState<MatchOption[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // React Query hooks
  const { data: transactions = [], isLoading: loading } = useBankTransactions();
  const { data: summary = {
    unmatchedCount: 0,
    matchedCount: 0,
    reconciledCount: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
  } } = useReconciliationSummary();
  const importMutation = useImportTransactions();
  const matchMutation = useMatchTransaction();
  const settleMutation = useSettleTransaction();
  const unmatchMutation = useUnmatchTransaction();
  const reconcileMutation = useReconcileTransactions();
  const deleteMutation = useDeleteBankTransaction();

  const importing = importMutation.isPending;

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

    try {
      const content = await file.text();
      const result = await importMutation.mutateAsync(content);

      // Re-imported statements dedup silently; say so or the lower count
      // reads as lost rows.
      const skippedNote = result.skipped > 0
        ? `, ${result.skipped} ${t('money.bankRecon.alreadyImportedSkipped') || 'already imported (skipped)'}`
        : '';
      toast({
        title: t('money.bankRecon.importSuccess') || 'Import Complete',
        description: `${result.imported} ${t('money.bankRecon.transactionsImported') || 'transactions imported'}${skippedNote}`,
      });

      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }
    } catch {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bankRecon.importError') || 'Failed to import file',
        variant: 'destructive',
      });
    } finally {
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
      const startDate = formatDateISO(addDays(transaction.date, -45));
      const endDate = formatDateISO(addDays(transaction.date, 45));

      if (transaction.type === 'deposit') {
        // Outstanding invoices are settle options: choosing one RECORDS a
        // payment (they're not date-windowed — an old invoice can be paid
        // today). Recorded payments remain link-only options.
        const [outstandingInvoices, payments] = await Promise.all([
          invoiceService.getOutstandingInvoices(tenantId),
          invoiceService.getPaymentCandidates(tenantId, startDate, endDate, 50),
        ]);

        outstandingInvoices.forEach((invoice) => {
          if ((invoice.balanceDue || 0) <= 0) return;
          options.push({
            type: 'invoice',
            id: invoice.id,
            description: `${invoice.invoiceNumber} - ${invoice.customerName}`,
            amount: invoice.balanceDue,
            date: invoice.issueDate,
            outstanding: invoice.balanceDue,
            documentNumber: invoice.invoiceNumber,
          });
        });

        payments.forEach((payment) => {
          if (payment.amount <= 0) return;
            options.push({
              type: 'invoice_payment',
              id: payment.invoiceId || payment.id,
              description: `${payment.invoiceNumber || 'Payment'} - ${payment.customerName || 'Customer payment'}`,
              amount: payment.amount,
              date: payment.date,
            });
          });
      } else {
        const [unpaidBills, billPayments, expenses, invoicePayments] = await Promise.all([
          billService.getUnpaidBills(tenantId),
          billService.getPaymentCandidates(tenantId, startDate, endDate, 50),
          expenseService.getExpenses(tenantId, {
            startDate,
            endDate,
            pageSize: 50,
          }),
          invoiceService.getPaymentCandidates(tenantId, startDate, endDate, 50),
        ]);

        invoicePayments.forEach((payment) => {
          if (payment.kind !== 'refund' && payment.amount >= 0) return;
          options.push({
            type: 'invoice_refund',
            id: payment.id,
            description: `Refund: ${payment.invoiceNumber || 'Invoice'} - ${payment.customerName || 'Customer'}`,
            amount: payment.amount,
            date: payment.date,
          });
        });

        // Unpaid bills are settle options. Payer-withholding bills are
        // excluded: the bank line shows the cash leg while recordPayment's
        // amount is gross AP — those are paid from the Bills page.
        unpaidBills.forEach((bill) => {
          if ((bill.balanceDue || 0) <= 0) return;
          if (!canSettleBillFromBank(bill.withholding)) return;
          options.push({
            type: 'bill',
            id: bill.id,
            description: `${bill.billNumber || bill.description} - ${bill.vendorName}`,
            amount: -bill.balanceDue,
            date: bill.dueDate,
            outstanding: bill.balanceDue,
            documentNumber: bill.billNumber || bill.description,
          });
        });

        billPayments.forEach((payment) => {
          const cashPaid = payment.cashPaid ?? payment.amount;
          if (cashPaid <= 0) return;
            options.push({
              type: 'bill_payment',
              id: payment.billId,
              description: `Bill: ${payment.billDescription || payment.billNumber || payment.billId} - ${payment.vendorName || 'Vendor payment'}`,
              amount: -cashPaid,
              date: payment.date,
            });
          });

        expenses.data.forEach(exp => {
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
        const diffA = absoluteMoney(subtractMoney(a.amount, transaction.amount));
        const diffB = absoluteMoney(subtractMoney(b.amount, transaction.amount));
        return compareMoney(diffA, diffB);
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

  /** Link-only match: the money is already recorded; this just links the line. */
  const handleMatch = async (option: MatchOption) => {
    if (!transactionToMatch) return;
    if (option.type === 'invoice' || option.type === 'bill') return; // settle options go through handleSettle

    try {
      await matchMutation.mutateAsync({
        transactionId: transactionToMatch.id,
        matchedTo: {
          type: option.type,
          id: option.id,
          description: option.description,
        },
      });

      toast({
        title: t('money.bankRecon.matched') || 'Matched',
        description: t('money.bankRecon.matchedDesc') || 'Transaction matched successfully',
      });

      setMatchDialogOpen(false);
    } catch {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bankRecon.matchError') || 'Failed to match transaction',
        variant: 'destructive',
      });
    }
  };

  /**
   * Settle-on-match: records a real payment on the outstanding invoice/bill
   * (bank line's amount and date, method bank_transfer, reference = bank
   * description) through the existing payment paths, then links the line.
   */
  const handleSettle = async (option: MatchOption) => {
    if (!transactionToMatch) return;

    const decision = decideSettlement(
      transactionToMatch.amount,
      option.outstanding ?? 0,
    );
    if (decision.kind === 'blocked') {
      toast({
        title: t('common.error') || 'Error',
        description:
          t('money.bankRecon.settleBlocked') ||
          'The bank amount is more than the balance due — record this payment from the invoice or bill page instead.',
        variant: 'destructive',
      });
      return;
    }

    const input: SettleMatchInput =
      option.type === 'invoice'
        ? {
            kind: 'invoice',
            transactionId: transactionToMatch.id,
            invoiceId: option.id,
            amount: decision.amount,
            date: transactionToMatch.date,
            reference: transactionToMatch.description,
            matchDescription: option.description,
          }
        : {
            kind: 'bill',
            transactionId: transactionToMatch.id,
            billId: option.id,
            amount: decision.amount,
            date: transactionToMatch.date,
            reference: transactionToMatch.description,
            matchDescription: option.description,
          };

    try {
      await settleMutation.mutateAsync(input);
      toast({
        title: t('money.bankRecon.paymentRecorded') || 'Payment recorded',
        description:
          decision.kind === 'full'
            ? `${option.documentNumber || option.description} ${t('money.bankRecon.nowPaid') || 'is now paid'}`
            : `${t('money.bankRecon.partialRecordedOn') || 'Partial payment recorded on'} ${option.documentNumber || option.description} — ${formatCurrency(decision.remainingAfter)} ${t('money.bankRecon.remainsDue') || 'remains due'}`,
      });
      setMatchDialogOpen(false);
    } catch (error) {
      // The payment services validate for real (balance, dates, statuses) —
      // surface their message instead of a generic failure.
      toast({
        title: t('common.error') || 'Error',
        description:
          error instanceof Error && error.message
            ? error.message
            : t('money.bankRecon.matchError') || 'Failed to match transaction',
        variant: 'destructive',
      });
    }
  };

  const handleUnmatch = async (transactionId: string) => {
    try {
      await unmatchMutation.mutateAsync(transactionId);
      toast({
        title: t('money.bankRecon.unmatched') || 'Unmatched',
      });
    } catch (error) {
      toast({
        title: t('common.error') || 'Error',
        description:
          error instanceof Error && error.message ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (transactionId: string) => {
    try {
      await deleteMutation.mutateAsync(transactionId);
      toast({
        title: t('money.bankRecon.deleted') || 'Deleted',
      });
    } catch {
      toast({
        title: t('common.error') || 'Error',
        variant: 'destructive',
      });
    }
  };

  const handleReconcile = async () => {
    if (selectedIds.size === 0) return;

    try {
      await reconcileMutation.mutateAsync(Array.from(selectedIds));
      toast({
        title: t('money.bankRecon.reconciled') || 'Reconciled',
        description: `${selectedIds.size} ${t('money.bankRecon.transactionsReconciled') || 'transactions reconciled'}`,
      });
      setSelectedIds(new Set());
    } catch {
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
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">{t('money.bankRecon.matched') || 'Matched'}</Badge>;
      case 'reconciled':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{t('money.bankRecon.reconciled') || 'Reconciled'}</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">{t('money.bankRecon.unmatched') || 'Unmatched'}</Badge>;
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
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-7 w-56 mb-2" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <Skeleton className="h-10 w-36" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="relative overflow-hidden border-border/50">
                <CardContent className="relative pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Skeleton className="h-3 w-16 mb-2" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-9 w-[200px]" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>{t('money.bankRecon.date') || 'Date'}</TableHead>
                      <TableHead>{t('money.bankRecon.description') || 'Description'}</TableHead>
                      <TableHead className="text-right">{t('money.bankRecon.amount') || 'Amount'}</TableHead>
                      <TableHead className="text-center">{t('money.bankRecon.status') || 'Status'}</TableHead>
                      <TableHead>{t('money.bankRecon.matchedTo') || 'Matched To'}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-4" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <div>
                              <Skeleton className="h-4 w-40 mb-1" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-4 w-16 ml-auto" />
                        </TableCell>
                        <TableCell className="text-center">
                          <Skeleton className="h-5 w-20 rounded-full mx-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-8 rounded-md" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Bank Reconciliation - Xefe" description="Reconcile bank transactions" />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv"
          className="hidden"
          onChange={handleFileUpload}
        />
        <PageHeader
          title={t('money.bankRecon.title') || 'Bank Reconciliation'}
          subtitle={t('money.bankRecon.subtitle') || 'Import and match bank transactions'}
          icon={Building2}
          iconColor={accent.iconColor}
          actions={
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className={accent.solidBtn}
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
          }
        />
        {/* Summary Cards */}
        <MoreDetailsSection className="animate-fade-up stagger-1 mb-6">
        <div>
          <BankReconciliationSummary summary={summary} formatCurrency={formatCurrency} />
        </div>
        </MoreDetailsSection>

        {/* Actions Bar */}
        {selectedIds.size > 0 && (
          <div className={`flex items-center gap-3 mb-4 p-3 animate-fade-up ${accent.bar}`}>
            <Badge className={accent.badgeSolid}>
              {selectedIds.size}
            </Badge>
            <span className={accent.barText}>
              {selectedIds.size !== 1
                ? (t('money.bankRecon.transactionPlural') || 'transactions')
                : (t('money.bankRecon.transaction') || 'transaction')
              } {t('money.bankRecon.selected') || 'selected'}
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className={accent.outlineBtn}>
              {t('common.cancel') || 'Clear'}
            </Button>
            <Button size="sm" onClick={handleReconcile} className={`${accent.solidBtn} text-white`}>
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
                <div className={`p-1.5 rounded-lg ${accent.iconBadgeGrad}`}>
                  <FileSpreadsheet className={accent.iconBadgeText} />
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
                <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${accent.emptyGrad}`}>
                  <FileSpreadsheet className={accent.emptyIcon} />
                </div>
                <p className="font-medium text-foreground mb-1">
                  {t('money.bankRecon.noTransactions') || 'No transactions yet'}
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  {t('money.bankRecon.uploadCsvHint') || 'Upload a CSV export from your bank to get started'}
                </p>
                <Button onClick={() => fileInputRef.current?.click()} className={`${accent.solidBtn} text-white`}>
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
                          {tx.status === 'matched' && (
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
                                <p className="text-xs text-muted-foreground">{t('money.bankRecon.ref') || 'Ref'}: {tx.reference}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : '-'}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-center">{getStatusBadge(tx.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.matchedTo ? (
                            <span>
                              {tx.matchedTo.description}
                              {tx.matchedTo.paymentRecorded && (
                                <span className="block text-xs text-muted-foreground/70">
                                  {t('money.bankRecon.paymentRecordedTag') || 'Payment recorded'}
                                </span>
                              )}
                            </span>
                          ) : (
                            '-'
                          )}
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
                                <DropdownMenuItem
                                  onSelect={() => {
                                    // Let Radix finish closing the menu before
                                    // mounting another modal layer. Opening the
                                    // dialog synchronously can strand its
                                    // pointer-events lock after the dialog closes.
                                    setTimeout(() => void openMatchDialog(tx), 0);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Link2 className="h-4 w-4 mr-2 text-blue-500" />
                                  {t('money.bankRecon.match') || 'Match'}
                                </DropdownMenuItem>
                              )}
                              {tx.status === 'matched' && !tx.matchedTo?.paymentRecorded && (
                                <DropdownMenuItem onClick={() => handleUnmatch(tx.id)} className="cursor-pointer">
                                  <Link2Off className="h-4 w-4 mr-2 text-amber-500" />
                                  {t('money.bankRecon.unmatch') || 'Unmatch'}
                                </DropdownMenuItem>
                              )}
                              {tx.status === 'matched' && tx.matchedTo?.paymentRecorded && (
                                // Matching recorded a real payment; unlinking here
                                // would leave that payment behind. Managed from the
                                // invoice/bill page instead (service enforces this too).
                                <DropdownMenuItem disabled className="text-xs text-muted-foreground max-w-[240px] whitespace-normal">
                                  <Link2Off className="h-4 w-4 mr-2 flex-shrink-0" />
                                  {t('money.bankRecon.unmatchLocked') || 'Payment recorded — manage it from the invoice or bill page'}
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
          onSettle={handleSettle}
          settling={settleMutation.isPending}
          formatCurrency={formatCurrency}
        />

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
}
