/**
 * Payables Summary Widget
 * Overview of bills due with urgency grouping
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';

interface PayablesData {
  overdue: number;
  overdueCount: number;
  dueThisWeek: number;
  dueThisWeekCount: number;
  dueLater: number;
  dueLaterCount: number;
}

interface PayablesSummaryWidgetProps {
  payables: PayablesData;
  className?: string;
}

export function PayablesSummaryWidget({ payables, className }: PayablesSummaryWidgetProps) {
  const navigate = useNavigate();

  const total = payables.overdue + payables.dueThisWeek + payables.dueLater;
  const totalCount = payables.overdueCount + payables.dueThisWeekCount + payables.dueLaterCount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (total === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              Bills Due
              <InfoTooltip
                content={MoneyTooltips.terms.payables}
                title="Accounts Payable"
              />
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-muted-foreground">No bills due</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" />
            Bills Due
            <InfoTooltip
              content={MoneyTooltips.terms.payables}
              title="Accounts Payable"
            />
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/money/bills')}>
            View All
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Overdue */}
        {payables.overdueCount > 0 && (
          <button
            onClick={() => navigate('/money/bills?filter=overdue')}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Overdue ({payables.overdueCount})
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">
              {formatCurrency(payables.overdue)}
            </span>
          </button>
        )}

        {/* Due this week */}
        {payables.dueThisWeekCount > 0 && (
          <button
            onClick={() => navigate('/money/bills?filter=due-soon')}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-1">
                  Due this week ({payables.dueThisWeekCount})
                  <InfoTooltip content={MoneyTooltips.bills.dueThisWeek} size="sm" />
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              {formatCurrency(payables.dueThisWeek)}
            </span>
          </button>
        )}

        {/* Due later */}
        {payables.dueLaterCount > 0 && (
          <button
            onClick={() => navigate('/money/bills')}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Due later ({payables.dueLaterCount})
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {formatCurrency(payables.dueLater)}
            </span>
          </button>
        )}

        {/* Total */}
        <div className="pt-2 border-t flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {totalCount} bill{totalCount !== 1 ? 's' : ''} total
          </span>
          <span className="text-lg font-bold">{formatCurrency(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default PayablesSummaryWidget;
