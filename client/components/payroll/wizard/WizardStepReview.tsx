/**
 * Wizard Step 4 — "Confirm & Submit"
 * Big summary numbers, per-employee net pay list, submit/draft actions.
 * Design: The "receipt" step — show them exactly what they're about to do.
 * Big green number for net pay. Clear "what happens next" section.
 */
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  CheckCircle,
  FileText,
  Loader2,
  Lock,
  Pencil,
  Save,
  Users,
} from "lucide-react";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { formatPayPeriod, formatPayDate } from "@/lib/payroll/run-payroll-helpers";
import type { EmployeePayrollData } from "@/lib/payroll/run-payroll-helpers";
import { useI18n } from "@/i18n/I18nProvider";

interface PayrollTotals {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  incomeTax: number;
  inssEmployee: number;
  inssEmployer: number;
  totalEmployerCost: number;
}

interface WizardStepReviewProps {
  periodStart: string;
  periodEnd: string;
  payDate: string;
  employeeCount: number;
  editedCount: number;
  totals: PayrollTotals;
  includedEmployees: EmployeePayrollData[];
  onSaveDraft: () => void;
  onSubmit: () => void;
  saving: boolean;
  processing: boolean;
}

export function WizardStepReview({
  periodStart,
  periodEnd,
  payDate,
  employeeCount,
  editedCount,
  totals,
  includedEmployees,
  onSaveDraft,
  onSubmit,
  saving,
  processing,
}: WizardStepReviewProps) {
  const { t } = useI18n();
  const isSubmitting = saving || processing;

  return (
    <div className="space-y-6">
      {/* Hero Number — the one thing they care about most */}
      <div className="text-center py-6 px-4 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border border-green-200 dark:border-green-800">
        <p className="text-sm font-medium text-muted-foreground mb-1">{t("runPayroll.netToEmployees")}</p>
        <p className="text-4xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
          {formatCurrencyTL(totals.netPay)}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {employeeCount} {t("runPayroll.employees")} &middot;{" "}
          {periodStart && periodEnd ? formatPayPeriod(periodStart, periodEnd) : t("runPayroll.notSet")}
        </p>
      </div>

      {/* Financial Breakdown — 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-muted/50 border border-border/30">
          <p className="text-xs text-muted-foreground">{t("runPayroll.totalGross")}</p>
          <p className="text-xl font-bold tabular-nums mt-1">{formatCurrencyTL(totals.grossPay)}</p>
        </div>
        <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/10 border border-red-200/30 dark:border-red-800/30">
          <p className="text-xs text-muted-foreground">{t("runPayroll.totalDeductions")}</p>
          <p className="text-xl font-bold tabular-nums text-red-600 mt-1">{formatCurrencyTL(totals.totalDeductions)}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/30 dark:border-amber-800/30">
          <p className="text-xs text-muted-foreground">{t("runPayroll.totalEmployerCost")}</p>
          <p className="text-xl font-bold tabular-nums text-amber-600 mt-1">{formatCurrencyTL(totals.totalEmployerCost)}</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border/30">
          <p className="text-xs text-muted-foreground">{t("runPayroll.payDateLabel")}</p>
          <p className="text-xl font-bold mt-1">{payDate ? formatPayDate(payDate) : "—"}</p>
        </div>
      </div>

      {editedCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <Pencil className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {t("runPayroll.manuallyAdjusted", { count: String(editedCount) })}
          </span>
        </div>
      )}

      {/* Per-Employee Summary */}
      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          {t("runPayroll.employeeBreakdown")}
        </p>
        <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
          {includedEmployees.map((d) => (
            <div
              key={d.employee.id}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-border/30 bg-muted/10 text-sm"
            >
              <span className="font-medium truncate flex-1">
                {d.employee.personalInfo.firstName} {d.employee.personalInfo.lastName}
              </span>
              <span className="tabular-nums font-bold text-emerald-600 ml-4">
                {d.calculation ? formatCurrencyTL(d.calculation.netPay) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* What happens next — clear, no jargon */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
        <p className="font-semibold text-sm mb-2">{t("runPayroll.thisActionWill")}</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground/70" />
            {t("runPayroll.submitForReview")}
          </li>
          <li className="flex items-start gap-2.5">
            <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground/70" />
            {t("runPayroll.differentAdminApprove")}
          </li>
          <li className="flex items-start gap-2.5">
            <Calculator className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground/70" />
            {t("runPayroll.journalEntriesCreated")}
          </li>
        </ul>
      </div>

      {/* Action Buttons — big, clear */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="lg" onClick={onSaveDraft} disabled={isSubmitting}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("runPayroll.savingDraft")}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t("runPayroll.saveDraft")}
            </>
          )}
        </Button>
        <Button
          size="lg"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("runPayroll.submitting")}
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              {t("runPayroll.submitForApproval")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
