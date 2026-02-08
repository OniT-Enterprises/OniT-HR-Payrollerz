/**
 * BankMatchDialog - Dialog for matching bank transactions to records
 * Displays match options with type badges and handles selection
 */

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
import { FileText, Receipt, CreditCard, Link2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { BankTransaction } from '@/types/money';

interface MatchOption {
  type: 'invoice_payment' | 'bill_payment' | 'expense';
  id: string;
  description: string;
  amount: number;
  date: string;
}

interface BankMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  matchOptions: MatchOption[];
  loading: boolean;
  onMatch: (option: MatchOption) => void;
  formatCurrency: (amount: number) => string;
}

const typeConfig = {
  invoice_payment: {
    label: 'Invoice',
    icon: FileText,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  },
  bill_payment: {
    label: 'Bill',
    icon: Receipt,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  },
  expense: {
    label: 'Expense',
    icon: CreditCard,
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  },
};

export function BankMatchDialog({
  open,
  onOpenChange,
  transaction,
  matchOptions,
  loading,
  onMatch,
  formatCurrency,
}: BankMatchDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-indigo-500/10 to-indigo-600/10">
              <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            {t('money.bankRecon.matchTransaction') || 'Match Transaction'}
          </DialogTitle>
          <DialogDescription>
            {transaction && (
              <div className="mt-2 p-4 rounded-lg border border-border/50 bg-gradient-to-r from-muted/50 to-muted/30">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{transaction.date}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      {transaction.amount >= 0 ? (
                        <ArrowDownLeft className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-500" />
                      )}
                      <p className={`text-xl font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.amount >= 0 ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {transaction.amount >= 0 ? 'Deposit' : 'Withdrawal'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/30">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : matchOptions.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground">
                {t('money.bankRecon.noMatches') || 'No matching records found'}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Try matching manually or check that records exist for this amount
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {matchOptions.length} potential match{matchOptions.length !== 1 ? 'es' : ''} found
              </p>
              {matchOptions.map((option) => {
                const config = typeConfig[option.type];
                const TypeIcon = config.icon;
                return (
                  <button
                    key={`${option.type}-${option.id}`}
                    onClick={() => onMatch(option)}
                    className="w-full text-left p-3 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border hover:shadow-sm transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0">
                          <Badge className={config.className}>
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {config.label}
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
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel') || 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { MatchOption };
