/**
 * BankMatchDialog - Dialog for matching bank transactions to records
 *
 * Two kinds of match options, and the dialog is explicit about which is which:
 *  - 'invoice' / 'bill': OUTSTANDING documents. Choosing one records a real
 *    payment (bank line's amount and date) through the existing payment paths
 *    and settles the document — a confirm step states exactly what will
 *    happen. Bank amounts above the balance due are blocked, never guessed.
 *  - 'invoice_payment' / 'bill_payment' / 'expense': money already recorded
 *    in Xefe. Choosing one only links the bank line to it.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/i18n/I18nProvider';
import {
  decideSettlement,
  type SettlementDecision,
} from '@/lib/accounting/bank-reconciliation-settlement';
import { FileText, Receipt, CreditCard, Link2, ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';
import type { BankTransaction } from '@/types/money';

interface MatchOption {
  type: 'invoice' | 'bill' | 'invoice_payment' | 'bill_payment' | 'expense';
  id: string;
  description: string;
  amount: number;
  date: string;
  /** Settle options ('invoice' | 'bill') only: current balance due. */
  outstanding?: number;
  /** Settle options only: doc number/name for the confirmation sentence. */
  documentNumber?: string;
}

interface BankMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  matchOptions: MatchOption[];
  loading: boolean;
  /** Link-only match to an already-recorded payment/expense. */
  onMatch: (option: MatchOption) => void;
  /** Settle-on-match: records the payment, then links the bank line. */
  onSettle: (option: MatchOption) => void;
  /** True while a settle mutation is in flight. */
  settling: boolean;
  formatCurrency: (amount: number) => string;
}

const isSettleOption = (option: MatchOption) =>
  option.type === 'invoice' || option.type === 'bill';

const typeConfig = {
  invoice: {
    labelKey: 'money.bankRecon.optUnpaidInvoice',
    labelFallback: 'Unpaid invoice',
    icon: FileText,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  },
  bill: {
    labelKey: 'money.bankRecon.optUnpaidBill',
    labelFallback: 'Unpaid bill',
    icon: Receipt,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  },
  invoice_payment: {
    labelKey: 'money.bankRecon.optRecordedPayment',
    labelFallback: 'Recorded payment',
    icon: FileText,
    className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
  },
  bill_payment: {
    labelKey: 'money.bankRecon.optRecordedPayment',
    labelFallback: 'Recorded payment',
    icon: Receipt,
    className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
  },
  expense: {
    labelKey: 'money.bankRecon.optExpense',
    labelFallback: 'Expense',
    icon: CreditCard,
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  },
};

/** Transaction summary shown in the dialog description */
function TransactionSummary({ transaction, formatCurrency }: { transaction: BankTransaction; formatCurrency: (amount: number) => string }) {
  const isDeposit = transaction.amount >= 0;
  return (
    <div className="mt-2 p-4 rounded-lg border border-border/50 bg-muted/40">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-foreground">{transaction.description}</p>
          <p className="text-xs text-muted-foreground mt-1">{transaction.date}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5">
            {isDeposit ? (
              <ArrowDownLeft className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-red-500" />
            )}
            <p className={`text-xl font-bold ${isDeposit ? 'text-green-600' : 'text-red-600'}`}>
              {isDeposit ? '+' : '-'}{formatCurrency(transaction.amount)}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] mt-1">
            {isDeposit ? 'Deposit' : 'Withdrawal'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

/** Loading skeleton for match options */
function MatchOptionsLoading() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-40 mb-1" />
      {[1, 2, 3].map(i => (
        <div key={i} className="w-full p-3 rounded-lg border border-border/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
              <div className="min-w-0">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-14 flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty state when no matches found */
function MatchOptionsEmpty({ t }: { t: (key: string) => string }) {
  return (
    <div className="text-center py-8">
      <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-muted-foreground">
        {t('money.bankRecon.noMatches') || 'No matching records found'}
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        Try matching manually or check that records exist for this amount
      </p>
    </div>
  );
}

/** One-line caption saying what selecting the option will actually do. */
function OptionCaption({ option, decision, formatCurrency }: {
  option: MatchOption;
  decision: SettlementDecision | null;
  formatCurrency: (amount: number) => string;
}) {
  const { t } = useI18n();

  if (!isSettleOption(option)) {
    return (
      <p className="text-xs text-muted-foreground/70 mt-1">
        {t('money.bankRecon.linkOnlyHint') || 'Already recorded — matching just links this bank line'}
      </p>
    );
  }
  if (!decision || decision.kind === 'blocked') {
    return (
      <p className="text-xs text-red-500/80 mt-1">
        {decision?.reason === 'overpayment'
          ? (t('money.bankRecon.blockedOverpayment') || 'Bank amount is more than the balance due — cannot match')
          : (t('money.bankRecon.blockedGeneric') || 'Cannot record this payment')}
      </p>
    );
  }
  if (decision.kind === 'partial') {
    return (
      <p className="text-xs text-muted-foreground mt-1">
        {t('money.bankRecon.willRecordPartial') || 'Will record a partial payment'}
        {' — '}{formatCurrency(decision.remainingAfter)}{' '}
        {t('money.bankRecon.remainsDue') || 'remains due'}
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground mt-1">
      {t('money.bankRecon.willRecordFull') || 'Will record the payment — becomes paid'}
    </p>
  );
}

/** List of match option buttons */
function MatchOptionsList({ matchOptions, transaction, onSelect, formatCurrency }: {
  matchOptions: MatchOption[];
  transaction: BankTransaction;
  onSelect: (option: MatchOption) => void;
  formatCurrency: (amount: number) => string;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground mb-1">
        {matchOptions.length} potential match{matchOptions.length !== 1 ? 'es' : ''} found
      </p>
      {matchOptions.map((option) => {
        const config = typeConfig[option.type];
        const TypeIcon = config.icon;
        const decision = isSettleOption(option)
          ? decideSettlement(transaction.amount, option.outstanding ?? 0)
          : null;
        const blocked = decision?.kind === 'blocked';
        return (
          <button
            key={`${option.type}-${option.id}`}
            onClick={() => onSelect(option)}
            disabled={blocked}
            className={`w-full text-left p-3 rounded-lg border border-border/50 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              blocked
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-muted/50 hover:border-border hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0">
                  <Badge className={config.className}>
                    <TypeIcon className="h-3 w-3 mr-1" />
                    {t(config.labelKey) || config.labelFallback}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate group-hover:text-foreground transition-colors">{option.description}</p>
                  <p className="text-xs text-muted-foreground">{option.date}</p>
                </div>
              </div>
              <p className={`font-semibold flex-shrink-0 ${option.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {option.amount >= 0 ? '+' : '-'}{formatCurrency(option.amount)}
              </p>
            </div>
            <OptionCaption option={option} decision={decision} formatCurrency={formatCurrency} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Confirm step for settle options: states plainly that a payment will be
 * recorded and what the invoice/bill becomes. (Only shown for decisions that
 * are not blocked — blocked options can't be selected in the first place.)
 */
function SettleConfirm({ option, decision, settling, onBack, onConfirm, formatCurrency }: {
  option: MatchOption;
  decision: Exclude<SettlementDecision, { kind: 'blocked' }>;
  settling: boolean;
  onBack: () => void;
  onConfirm: () => void;
  formatCurrency: (amount: number) => string;
}) {
  const { t } = useI18n();
  const docLabel = option.documentNumber || option.description;

  return (
    <div className="space-y-4 py-2">
      <div className="p-4 rounded-lg border border-border/50 bg-muted/40 text-sm">
        {decision.kind === 'full' ? (
          <p>
            {t('money.bankRecon.confirmFullA') || 'This records a payment of'}{' '}
            <span className="font-semibold">{formatCurrency(decision.amount)}</span>{' '}
            {t('money.bankRecon.confirmOn') || 'on'}{' '}
            <span className="font-semibold">{docLabel}</span>
            {'. '}
            {option.type === 'invoice'
              ? (t('money.bankRecon.confirmInvoicePaid') || 'The invoice becomes paid.')
              : (t('money.bankRecon.confirmBillPaid') || 'The bill becomes paid.')}
          </p>
        ) : (
          <p>
            {t('money.bankRecon.confirmPartialA') || 'This records a partial payment of'}{' '}
            <span className="font-semibold">{formatCurrency(decision.amount)}</span>{' '}
            {t('money.bankRecon.confirmOn') || 'on'}{' '}
            <span className="font-semibold">{docLabel}</span>
            {'. '}
            <span className="font-semibold">{formatCurrency(decision.remainingAfter)}</span>{' '}
            {t('money.bankRecon.confirmRemainsDue') || 'will remain due.'}
          </p>
        )}
        {option.type === 'invoice' && decision.kind === 'full' && (
          <p className="text-xs text-muted-foreground mt-2">
            {t('money.bankRecon.confirmReceiptEmail') || 'If the customer has an email on file, they will receive a payment receipt.'}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack} disabled={settling}>
          {t('common.back') || 'Back'}
        </Button>
        <Button onClick={onConfirm} disabled={settling}>
          {settling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('money.bankRecon.recordAndMatch') || 'Record payment & match'}
        </Button>
      </div>
    </div>
  );
}

export function BankMatchDialog({
  open,
  onOpenChange,
  transaction,
  matchOptions,
  loading,
  onMatch,
  onSettle,
  settling,
  formatCurrency,
}: BankMatchDialogProps) {
  const { t } = useI18n();
  const [confirmOption, setConfirmOption] = useState<MatchOption | null>(null);

  // A fresh open always starts on the option list, never a stale confirm —
  // reset in the close handler (not an effect) so no cascading render.
  const handleOpenChange = (next: boolean) => {
    if (!next) setConfirmOption(null);
    onOpenChange(next);
  };

  const handleSelect = (option: MatchOption) => {
    if (isSettleOption(option)) {
      setConfirmOption(option);
    } else {
      onMatch(option);
    }
  };

  const confirmDecision = confirmOption && transaction
    ? decideSettlement(transaction.amount, confirmOption.outstanding ?? 0)
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10">
              <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            {t('money.bankRecon.matchTransaction') || 'Match Transaction'}
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              {transaction && <TransactionSummary transaction={transaction} formatCurrency={formatCurrency} />}
            </div>
          </DialogDescription>
        </DialogHeader>
        {confirmOption && confirmDecision && confirmDecision.kind !== 'blocked' ? (
          <SettleConfirm
            option={confirmOption}
            decision={confirmDecision}
            settling={settling}
            onBack={() => setConfirmOption(null)}
            onConfirm={() => onSettle(confirmOption)}
            formatCurrency={formatCurrency}
          />
        ) : (
          <>
            <div className="max-h-[300px] overflow-y-auto">
              {loading ? (
                <MatchOptionsLoading />
              ) : matchOptions.length === 0 || !transaction ? (
                <MatchOptionsEmpty t={t} />
              ) : (
                <MatchOptionsList
                  matchOptions={matchOptions}
                  transaction={transaction}
                  onSelect={handleSelect}
                  formatCurrency={formatCurrency}
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel') || 'Cancel'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type { MatchOption };
