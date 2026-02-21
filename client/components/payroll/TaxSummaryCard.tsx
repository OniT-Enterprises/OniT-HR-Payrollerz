/**
 * TaxSummaryCard - Tax & INSS summary for RunPayroll page
 * Shows system-calculated (locked) tax and social security figures
 * Uses subtle gradient backgrounds for depth and visual hierarchy
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Lock } from "lucide-react";
import { formatCurrencyTL, TL_DEDUCTION_TYPE_LABELS } from "@/lib/payroll/constants-tl";
import { useI18n } from "@/i18n/I18nProvider";

interface TaxSummaryTotals {
  incomeTax: number;
  inssEmployee: number;
  inssEmployer: number;
  totalEmployerCost: number;
}

interface TaxSummaryCardProps {
  totals: TaxSummaryTotals;
}

export function TaxSummaryCard({ totals }: TaxSummaryCardProps) {
  const { t } = useI18n();
  return (
    <Card className="mb-6 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
            <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          {t('runPayroll.taxInssTitle')}
          <Badge variant="outline" className="ml-2 text-xs font-normal">
            <Lock className="h-3 w-3 mr-1" />
            {t('runPayroll.systemCalculated')}
          </Badge>
        </CardTitle>
        <CardDescription>{t('runPayroll.taxSummaryDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg relative border border-red-500/10 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 hover:shadow-md transition-all duration-200">
            <Lock className="h-3 w-3 text-muted-foreground/40 absolute top-3 right-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {TL_DEDUCTION_TYPE_LABELS.income_tax.tl}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t('runPayroll.incomeTaxRate')}
            </p>
            <p className="text-lg font-semibold text-red-600 mt-1">
              {formatCurrencyTL(totals.incomeTax)}
            </p>
          </div>
          <div className="p-4 rounded-lg relative border border-red-500/10 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 hover:shadow-md transition-all duration-200">
            <Lock className="h-3 w-3 text-muted-foreground/40 absolute top-3 right-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {TL_DEDUCTION_TYPE_LABELS.inss_employee.tl}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t('runPayroll.inssEmployeeLabel')}
            </p>
            <p className="text-lg font-semibold text-red-600 mt-1">
              {formatCurrencyTL(totals.inssEmployee)}
            </p>
          </div>
          <div className="p-4 rounded-lg relative border border-amber-500/10 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 hover:shadow-md transition-all duration-200">
            <Lock className="h-3 w-3 text-muted-foreground/40 absolute top-3 right-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {TL_DEDUCTION_TYPE_LABELS.inss_employer.tl}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t('runPayroll.inssEmployerLabel')}
            </p>
            <p className="text-lg font-semibold text-amber-600 mt-1">
              {formatCurrencyTL(totals.inssEmployer)}
            </p>
          </div>
          <div className="p-4 rounded-lg relative border border-emerald-500/15 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 hover:shadow-md transition-all duration-200">
            <Lock className="h-3 w-3 text-muted-foreground/40 absolute top-3 right-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {t('runPayroll.totalEmployerCost')}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t('runPayroll.grossPlusInss')}
            </p>
            <p className="text-lg font-semibold text-emerald-600 mt-1">
              {formatCurrencyTL(totals.totalEmployerCost)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
