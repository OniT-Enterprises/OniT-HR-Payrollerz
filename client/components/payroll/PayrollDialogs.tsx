/**
 * PayrollDialogs — Save draft, approve, and final confirm dialogs
 * Extracted from RunPayroll.tsx
 */
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Save,
  CheckCircle,
  Loader2,
  ChevronDown,
  Lock,
  FileText,
  Calculator,
  Calendar,
  Pencil,
  AlertCircle,
} from 'lucide-react';
import { formatCurrencyTL } from '@/lib/payroll/constants-tl';
import { formatPayPeriod, formatPayDate } from '@/lib/payroll/run-payroll-helpers';

interface PayrollTotals {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  incomeTax: number;
  inssEmployee: number;
  inssEmployer: number;
  totalEmployerCost: number;
}

interface PayrollDialogsProps {
  // Save dialog
  showSaveDialog: boolean;
  setShowSaveDialog: (v: boolean) => void;
  handleSaveDraft: () => void;
  saving: boolean;
  // Approve dialog
  showApproveDialog: boolean;
  setShowApproveDialog: (v: boolean) => void;
  // Final confirm dialog
  showFinalConfirmDialog: boolean;
  setShowFinalConfirmDialog: (v: boolean) => void;
  handleProcessPayroll: () => void;
  processing: boolean;
  // Shared data
  periodStart: string;
  periodEnd: string;
  payDate: string;
  employeeCount: number;
  editedCount: number;
  totals: PayrollTotals;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function PayrollDialogs({
  showSaveDialog,
  setShowSaveDialog,
  handleSaveDraft,
  saving,
  showApproveDialog,
  setShowApproveDialog,
  showFinalConfirmDialog,
  setShowFinalConfirmDialog,
  handleProcessPayroll,
  processing,
  periodStart,
  periodEnd,
  payDate,
  employeeCount,
  editedCount,
  totals,
  t,
}: PayrollDialogsProps) {
  return (
    <>
      {/* Save Draft Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                <Save className="h-4 w-4 text-green-600" />
              </div>
              {t('runPayroll.saveDraftTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('runPayroll.saveDraftDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">{t('runPayroll.period')}</p>
                <p className="font-semibold text-sm mt-0.5">
                  {periodStart && periodEnd
                    ? formatPayPeriod(periodStart, periodEnd)
                    : t('runPayroll.notSet')}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">{t('runPayroll.employees')}</p>
                <p className="font-semibold text-sm mt-0.5">{employeeCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">{t('runPayroll.totalGross')}</p>
                <p className="font-semibold text-sm mt-0.5">{formatCurrencyTL(totals.grossPay)}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/10">
                <p className="text-xs text-muted-foreground">{t('runPayroll.totalNet')}</p>
                <p className="font-semibold text-sm text-emerald-600 mt-0.5">{formatCurrencyTL(totals.netPay)}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveDraft} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('runPayroll.savingDraft')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('runPayroll.saveDraft')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog — Review summary */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              {t('runPayroll.reviewTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('runPayroll.reviewDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Period highlight */}
            <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">{t('runPayroll.payPeriod')}</span>
              </div>
              <p className="font-semibold text-lg">
                {periodStart && periodEnd ? formatPayPeriod(periodStart, periodEnd) : t('runPayroll.notSet')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('runPayroll.payDateLabel')} {payDate ? formatPayDate(payDate) : t('runPayroll.notSet')}
              </p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">{t('runPayroll.employees')}</p>
                <p className="text-lg font-bold tracking-tight">{employeeCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">{t('runPayroll.totalGross')}</p>
                <p className="text-lg font-bold tracking-tight">{formatCurrencyTL(totals.grossPay)}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-500/10">
                <p className="text-xs text-muted-foreground">{t('runPayroll.totalDeductions')}</p>
                <p className="text-lg font-bold tracking-tight text-red-600">{formatCurrencyTL(totals.totalDeductions)}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/10">
                <p className="text-xs text-muted-foreground">{t('runPayroll.netToEmployees')}</p>
                <p className="text-lg font-bold tracking-tight text-emerald-600">{formatCurrencyTL(totals.netPay)}</p>
              </div>
            </div>

            {/* Total employer cost */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/10 border border-amber-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('runPayroll.totalEmployerCost')}</p>
                  <p className="text-[10px] text-muted-foreground/60">{t('runPayroll.employerCostHint')}</p>
                </div>
                <p className="text-lg font-bold tracking-tight text-amber-600">{formatCurrencyTL(totals.totalEmployerCost)}</p>
              </div>
            </div>

            {editedCount > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Pencil className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-300">
                  {t('runPayroll.manuallyAdjusted', { count: String(editedCount) })}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              {t('runPayroll.backToEdit')}
            </Button>
            <Button
              onClick={() => {
                setShowApproveDialog(false);
                setShowFinalConfirmDialog(true);
              }}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25"
            >
              {t('runPayroll.continueToConfirm')}
              <ChevronDown className="h-4 w-4 ml-2 rotate-[-90deg]" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Confirm Dialog — Point of no return */}
      <Dialog open={showFinalConfirmDialog} onOpenChange={setShowFinalConfirmDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-amber-700 dark:text-amber-400">{t('runPayroll.submitForApprovalTitle')}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Warning banner */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border-2 border-amber-300 dark:border-amber-700">
              <p className="font-semibold text-amber-800 dark:text-amber-200 mb-3">
                {t('runPayroll.aboutToSubmit', { count: String(employeeCount) })}
              </p>
              <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                <div className="flex justify-between">
                  <span>{t('runPayroll.payDateLabel')}</span>
                  <span className="font-medium">{payDate ? formatPayDate(payDate) : t('runPayroll.notSet')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('runPayroll.totalNetPay')}</span>
                  <span className="font-medium">{formatCurrencyTL(totals.netPay)}</span>
                </div>
              </div>
            </div>

            {/* Consequences */}
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                {t('runPayroll.thisActionWill')}
              </p>
              <ul className="space-y-1.5 text-sm text-amber-700 dark:text-amber-300">
                <li className="flex items-start gap-2">
                  <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {t('runPayroll.submitForReview')}
                </li>
                <li className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {t('runPayroll.differentAdminApprove')}
                </li>
                <li className="flex items-start gap-2">
                  <Calculator className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {t('runPayroll.journalEntriesCreated')}
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowFinalConfirmDialog(false);
                setShowApproveDialog(true);
              }}
            >
              {t('runPayroll.back')}
            </Button>
            <Button
              onClick={handleProcessPayroll}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/25"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('runPayroll.submitting')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('runPayroll.submitForApproval')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
