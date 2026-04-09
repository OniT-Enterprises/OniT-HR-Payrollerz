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
function ReconStatCard({ label, children, gradientFrom, gradientTo, icon: Icon, iconShadow }: {
  label: string;
  children: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  icon: React.ComponentType<{ className?: string }>;
  iconShadow: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo}`} />
      <CardContent className="relative pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {children}
          </div>
          <div className={`p-2 rounded-lg bg-gradient-to-br ${gradientFrom.replace('/5', '')} ${gradientTo.replace('/5', '')} shadow-md ${iconShadow}`}>
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
        gradientFrom="from-amber-500/5"
        gradientTo="to-orange-500/5"
        icon={AlertCircle}
        iconShadow="shadow-amber-500/20"
      >
        <p className="text-2xl font-bold tracking-tight text-amber-600 mt-1">{summary.unmatchedCount}</p>
      </ReconStatCard>

      <ReconStatCard
        label={t('money.bankRecon.matched') || 'Matched'}
        gradientFrom="from-blue-500/5"
        gradientTo="to-indigo-500/5"
        icon={Link2}
        iconShadow="shadow-blue-500/20"
      >
        <p className="text-2xl font-bold tracking-tight text-blue-600 mt-1">{summary.matchedCount}</p>
      </ReconStatCard>

      <Card className="relative overflow-hidden border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5" />
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </div>
          {totalTransactions > 0 && (
            <div className="mt-2">
              <div className="h-1 w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-500"
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
        gradientFrom="from-green-500/5"
        gradientTo="to-teal-500/5"
        icon={ArrowDownLeft}
        iconShadow="shadow-green-500/20"
      >
        <p className="text-2xl font-bold tracking-tight text-green-600 mt-1">{formatCurrency(summary.totalDeposits)}</p>
      </ReconStatCard>

      <ReconStatCard
        label={t('money.bankRecon.withdrawals') || 'Withdrawals'}
        gradientFrom="from-red-500/5"
        gradientTo="to-rose-500/5"
        icon={ArrowUpRight}
        iconShadow="shadow-red-500/20"
      >
        <p className="text-2xl font-bold tracking-tight text-red-600 mt-1">{formatCurrency(summary.totalWithdrawals)}</p>
      </ReconStatCard>
    </div>
  );
}
