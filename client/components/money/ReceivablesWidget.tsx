/**
 * Receivables Progress Widget
 * Visual breakdown of outstanding receivables with aging segments
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';

interface AgingData {
  current: number;
  days30to60: number;
  days60to90: number;
  over90: number;
}

interface ReceivablesWidgetProps {
  aging: AgingData;
  className?: string;
}

const AGING_CONFIG = [
  { key: 'current', label: 'Current (0-30)', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', tooltip: MoneyTooltips.aging.current },
  { key: 'days30to60', label: '31-60 days', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', tooltip: MoneyTooltips.aging.days30to60 },
  { key: 'days60to90', label: '61-90 days', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400', tooltip: MoneyTooltips.aging.days60to90 },
  { key: 'over90', label: '90+ days', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', tooltip: MoneyTooltips.aging.over90 },
] as const;

export function ReceivablesWidget({ aging, className }: ReceivablesWidgetProps) {
  const navigate = useNavigate();

  const total = aging.current + aging.days30to60 + aging.days60to90 + aging.over90;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPercentage = (amount: number) => {
    if (total === 0) return 0;
    return (amount / total) * 100;
  };

  if (total === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Receivables
              <InfoTooltip
                content={MoneyTooltips.terms.receivables}
                title="Accounts Receivable"
              />
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-2xl font-bold text-green-600">$0</p>
            <p className="text-sm text-muted-foreground mt-1">No outstanding invoices</p>
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
            <DollarSign className="h-4 w-4 text-indigo-600" />
            Receivables
            <InfoTooltip
              content={MoneyTooltips.terms.receivables}
              title="Accounts Receivable"
            />
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/money/ar-aging')}>
            View Report
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total */}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total Outstanding</span>
          <span className="text-2xl font-bold">{formatCurrency(total)}</span>
        </div>

        {/* Progress bar */}
        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
          {AGING_CONFIG.map(({ key, color }) => {
            const value = aging[key as keyof AgingData];
            const percent = getPercentage(value);
            if (percent === 0) return null;
            return (
              <div
                key={key}
                className={cn('h-full transition-all', color)}
                style={{ width: `${percent}%` }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="space-y-1.5">
          {AGING_CONFIG.map(({ key, label, color, textColor, tooltip }) => {
            const value = aging[key as keyof AgingData];
            const percent = getPercentage(value);
            if (value === 0) return null;
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', color)} />
                  <span className="text-muted-foreground">{label}</span>
                  <InfoTooltip content={tooltip} size="sm" />
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('font-medium', textColor)}>{formatCurrency(value)}</span>
                  <span className="text-xs text-muted-foreground w-8 text-right">{percent.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Warning for aged receivables */}
        {(aging.days60to90 > 0 || aging.over90 > 0) && (
          <div className="pt-2 border-t">
            <p className="text-xs text-orange-600 dark:text-orange-400">
              {formatCurrency(aging.days60to90 + aging.over90)} ({getPercentage(aging.days60to90 + aging.over90).toFixed(0)}%) overdue 60+ days
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReceivablesWidget;
