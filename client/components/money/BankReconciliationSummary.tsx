/**
 * BankReconciliationSummary - Summary cards for bank reconciliation
 * Shows counts of unmatched, matched, reconciled transactions and totals
 * Uses gradient overlays + hover-lift pattern matching dashboard stat cards
 */

import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/i18n/I18nProvider';
import {
  AlertCircle,
  Link2,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

interface BankReconciliationSummaryProps {
  summary: {
    unmatchedCount: number;
    matchedCount: number;
    reconciledCount: number;
    totalDeposits: number;
    totalWithdrawals: number;
  };
  formatCurrency: (amount: number) => string;
}

/** Reusable stat card for the reconciliation summary grid */
function ReconStatCard({ label, children, tint, iconBg, icon: Icon }: {
  label: string;
  children: React.ReactNode;
  /** Flat wash behind the card content, e.g. "bg-amber-500/5". */
  tint: string;
  /** Solid icon badge color, e.g. "bg-amber-500". */
  iconBg: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="relative overflow-hidden border-border/50">
      <div className={`absolute inset-0 ${tint}`} />
      <CardContent className="relative pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {children}
          </div>
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BankReconciliationSummary({ summary, formatCurrency }: BankReconciliationSummaryProps) {
  const { t } = useI18n();

  const totalTransactions = summary.unmatchedCount + summary.matchedCount + summary.reconciledCount;
  const completionPercent = totalTransactions > 0
    ? Math.round((summary.reconciledCount / totalTransactions) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <ReconStatCard
        label={t('money.bankRecon.unmatched') || 'Unmatched'}
        tint="bg-amber-500/5"
        icon={AlertCircle}
        iconBg="bg-amber-500"
      >
        <p className="text-2xl font-bold tracking-tight text-amber-600 mt-1">{summary.unmatchedCount}</p>
      </ReconStatCard>

      <ReconStatCard
        label={t('money.bankRecon.matched') || 'Matched'}
        tint="bg-blue-500/5"
        icon={Link2}
        iconBg="bg-blue-500"
      >
        <p className="text-2xl font-bold tracking-tight text-blue-600 mt-1">{summary.matchedCount}</p>
      </ReconStatCard>

      <Card className="relative overflow-hidden border-border/50">
        <div className="absolute inset-0 bg-emerald-500/5" />
        <CardContent className="relative pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t('money.bankRecon.reconciled') || 'Reconciled'}
              </p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 mt-1">
                {summary.reconciledCount}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </div>
          {totalTransactions > 0 && (
            <div className="mt-2">
              <div className="h-1 w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1">{completionPercent}% complete</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ReconStatCard
        label={t('money.bankRecon.deposits') || 'Deposits'}
        tint="bg-green-500/5"
        icon={ArrowDownLeft}
        iconBg="bg-green-500"
      >
        <p className="text-2xl font-bold tracking-tight text-green-600 mt-1">{formatCurrency(summary.totalDeposits)}</p>
      </ReconStatCard>

      <ReconStatCard
        label={t('money.bankRecon.withdrawals') || 'Withdrawals'}
        tint="bg-red-500/5"
        icon={ArrowUpRight}
        iconBg="bg-red-500"
      >
        <p className="text-2xl font-bold tracking-tight text-red-600 mt-1">{formatCurrency(summary.totalWithdrawals)}</p>
      </ReconStatCard>
    </div>
  );
}
