/**
 * PayrollSummaryCards - Summary stats for RunPayroll page
 * Shows Gross Pay, Deductions, Net Pay, and Employee count
 * Uses gradient overlays + hover-lift pattern from dashboard stat cards
 */

import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Users, TrendingDown } from "lucide-react";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { useI18n } from "@/i18n/I18nProvider";

interface PayrollTotals {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

interface PayrollSummaryCardsProps {
  totals: PayrollTotals;
  employeeCount: number;
}

export function PayrollSummaryCards({ totals, employeeCount }: PayrollSummaryCardsProps) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="relative overflow-hidden border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5" />
        <CardContent className="relative p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t('runPayroll.totalGrossPay')}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {t('runPayroll.beforeDeductions')}
              </p>
              <p className="text-2xl font-bold tracking-tight mt-2">
                {formatCurrencyTL(totals.grossPay)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/5" />
        <CardContent className="relative p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t('runPayroll.employeeDeductions')}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {t('runPayroll.taxPlusInss')}
              </p>
              <p className="text-2xl font-bold tracking-tight text-red-600 mt-2">
                {formatCurrencyTL(totals.totalDeductions)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 shadow-lg shadow-red-500/25">
              <TrendingDown className="h-5 w-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" />
        <CardContent className="relative p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t('runPayroll.netPayToEmployees')}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {t('runPayroll.takeHomePay')}
              </p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 mt-2">
                {formatCurrencyTL(totals.netPay)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5" />
        <CardContent className="relative p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t('runPayroll.employees')}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {t('runPayroll.activeInPayroll')}
              </p>
              <p className="text-2xl font-bold tracking-tight mt-2">
                {employeeCount}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
