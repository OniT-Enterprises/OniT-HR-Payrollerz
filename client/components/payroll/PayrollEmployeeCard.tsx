/**
 * PayrollEmployeeCard — one employee's hours & pay as a responsive card.
 *
 * Replaces the old 13-column table row. Our users are mobile-first, often
 * non-accountant TL small businesses (see docs/DASHBOARD_DESIGN.md): a
 * horizontal-scrolling spreadsheet hid the one number they came for (Net Pay)
 * and clipped values behind native number spinners. A card keeps identity on
 * the left, Net Pay prominent and always visible, the common edits
 * (Hours / OT / Bonus) inline, and the rarely-used Night / Holiday / Rest Day
 * hours + full breakdown one tap away — the same at every width.
 */

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type { Employee } from "@/services/employeeService";
import type { TLBonusINSSCategory, TLPayrollResult } from "@/lib/payroll/calculations-tl";
import { useI18n } from "@/i18n/I18nProvider";
import { useAdvancedTax } from "@/contexts/TenantContext";

// Native number spinners clip the value (e.g. "190.67" → "190.6▲▼") and are
// fiddly on touch. Hide them; users type the value.
const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none";

// Standard monthly hours are stored as 190.6667; show a clean 2-dp value.
const round2 = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 100) / 100);

interface OriginalValues {
  regularHours: number;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  restDayHours: number;
  bonus: number;
  bonusINSSCategory: TLBonusINSSCategory | null;
  perDiem: number;
  allowances: number;
}

interface EmployeePayrollRowData {
  employee: Employee;
  regularHours: number;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  restDayHours: number;
  sickDays: number;
  perDiem: number;
  bonus: number;
  bonusINSSCategory: TLBonusINSSCategory | null;
  allowances: number;
  calculation: TLPayrollResult | null;
  isEdited: boolean;
  originalValues: OriginalValues;
}

interface PayrollEmployeeCardProps {
  data: EmployeePayrollRowData;
  isExpanded: boolean;
  onToggleExpand: (employeeId: string) => void;
  onInputChange: (employeeId: string, field: string, value: number) => void;
  onBonusCategoryChange: (employeeId: string, category: TLBonusINSSCategory) => void;
  onReset: (employeeId: string) => void;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

// --- Editable fields ---

interface LabeledNumberProps {
  label: string;
  value: number;
  originalValue: number;
  employeeId: string;
  field: string;
  ariaLabel: string;
  onInputChange: (employeeId: string, field: string, value: number) => void;
}

function LabeledNumber({
  label,
  value,
  originalValue,
  employeeId,
  field,
  ariaLabel,
  onInputChange,
}: LabeledNumberProps) {
  const isModified = value !== originalValue;
  return (
    <label className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        value={round2(value)}
        onChange={(e) =>
          onInputChange(employeeId, field, parseFloat(e.target.value) || 0)
        }
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={ariaLabel}
        className={`h-9 w-20 text-right ${NO_SPINNER} ${
          isModified
            ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
            : "border-border/50"
        }`}
        min={0}
        // "any" — fractional standard hours (190.67) must not read as invalid;
        // the native spinner (the only reason for a fixed step) is hidden.
        step="any"
      />
    </label>
  );
}

function BonusField({
  data,
  employeeId,
  employeeName,
  onInputChange,
  onBonusCategoryChange,
  t,
}: {
  data: EmployeePayrollRowData;
  employeeId: string;
  employeeName: string;
  onInputChange: (employeeId: string, field: string, value: number) => void;
  onBonusCategoryChange: (employeeId: string, category: TLBonusINSSCategory) => void;
  t: Translate;
}) {
  const showAdvancedTax = useAdvancedTax();
  const isModified =
    data.bonus !== data.originalValues.bonus ||
    data.bonusINSSCategory !== data.originalValues.bonusINSSCategory;

  return (
    <label className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {t("runPayroll.bonus")}
      </span>
      <Input
        type="number"
        value={round2(data.bonus)}
        onChange={(event) =>
          onInputChange(employeeId, "bonus", parseFloat(event.target.value) || 0)
        }
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label={`${t("runPayroll.bonus")} - ${employeeName}`}
        className={`h-9 w-24 text-right ${NO_SPINNER} ${
          isModified
            ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
            : "border-border/50"
        }`}
        min={0}
        step="any"
      />
      {/* Simple flow auto-classifies the bonus (usePayrollCalculator); only
          accountant-grade users pick the DL 20/2017 INSS category. */}
      {showAdvancedTax && data.bonus > 0 && (
        <Select
          value={data.bonusINSSCategory ?? ""}
          onValueChange={(value) =>
            onBonusCategoryChange(employeeId, value as TLBonusINSSCategory)
          }
        >
          <SelectTrigger
            className="h-8 w-36 text-xs"
            onClick={(event) => event.stopPropagation()}
            aria-label={`${t("runPayroll.bonusType")} - ${employeeName}`}
          >
            <SelectValue placeholder={t("runPayroll.bonusTypeRequired")} />
          </SelectTrigger>
          <SelectContent onClick={(event) => event.stopPropagation()}>
            <SelectItem value="individual_performance">
              {t("runPayroll.bonusPerformance")}
            </SelectItem>
            <SelectItem value="company_profit">
              {t("runPayroll.bonusCompanyProfit")}
            </SelectItem>
            <SelectItem value="extraordinary">
              {t("runPayroll.bonusExtraordinary")}
            </SelectItem>
          </SelectContent>
        </Select>
      )}
    </label>
  );
}

// --- Read-only breakdown cards (shown when expanded) ---

function EarningCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg bg-background border border-border/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{formatCurrencyTL(value)}</p>
    </div>
  );
}

function DeductionCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-500/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm text-red-600">-{formatCurrencyTL(value)}</p>
    </div>
  );
}

// Compact "Night 8h · Holiday 8h" line for the collapsed card, so special
// hours pulled in by the sync are never hidden silently.
function specialHoursSummary(data: EmployeePayrollRowData, t: Translate): string | null {
  const parts: string[] = [];
  if (data.nightShiftHours > 0) parts.push(`${t("runPayroll.night")} ${round2(data.nightShiftHours)}h`);
  if (data.holidayHours > 0) parts.push(`${t("runPayroll.holiday")} ${round2(data.holidayHours)}h`);
  if (data.restDayHours > 0) parts.push(`${t("runPayroll.restDay")} ${round2(data.restDayHours)}h`);
  return parts.length ? parts.join(" · ") : null;
}

function ExpandedDetails({
  data,
  employeeId,
  employeeName,
  calculation,
  onInputChange,
  t,
}: {
  data: EmployeePayrollRowData;
  employeeId: string;
  employeeName: string;
  calculation: TLPayrollResult;
  onInputChange: (employeeId: string, field: string, value: number) => void;
  t: Translate;
}) {
  return (
    <div className="border-t border-border/50 bg-muted/20 p-4 space-y-3">
      {/* Special hours — editable, but tucked away since most staff have none.
          Worked public holidays / Sundays are auto-classified by the attendance
          sync (Lei 4/2012 Arts. 27, 30); manual entry covers non-Sunday rest
          days and tenants not using attendance. */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {t("runPayroll.specialHours") || "Special hours (2× pay)"}
        </p>
        <div className="flex flex-wrap gap-3">
          <LabeledNumber
            label={t("runPayroll.night")}
            value={data.nightShiftHours}
            originalValue={data.originalValues.nightShiftHours}
            employeeId={employeeId}
            field="nightShiftHours"
            ariaLabel={`${t("runPayroll.night")} - ${employeeName}`}
            onInputChange={onInputChange}
          />
          <LabeledNumber
            label={t("runPayroll.holiday")}
            value={data.holidayHours}
            originalValue={data.originalValues.holidayHours}
            employeeId={employeeId}
            field="holidayHours"
            ariaLabel={`${t("runPayroll.holiday")} - ${employeeName}`}
            onInputChange={onInputChange}
          />
          <LabeledNumber
            label={t("runPayroll.restDay")}
            value={data.restDayHours}
            originalValue={data.originalValues.restDayHours}
            employeeId={employeeId}
            field="restDayHours"
            ariaLabel={`${t("runPayroll.restDay")} - ${employeeName}`}
            onInputChange={onInputChange}
          />
        </div>
      </div>

      {/* Earnings */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {t("runPayroll.earnings")}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <EarningCard label={t("runPayroll.regularPay")} value={calculation.regularPay} />
          {calculation.overtimePay > 0 && (
            <EarningCard label={t("runPayroll.overtimePay")} value={calculation.overtimePay} />
          )}
          {calculation.nightShiftPay > 0 && (
            <EarningCard label={t("runPayroll.nightShift")} value={calculation.nightShiftPay} />
          )}
          {calculation.holidayPay > 0 && (
            <EarningCard label={t("runPayroll.holidayPay")} value={calculation.holidayPay} />
          )}
          {calculation.restDayPay > 0 && (
            <EarningCard label={t("runPayroll.restDayPay")} value={calculation.restDayPay} />
          )}
          {calculation.subsidioAnual > 0 && (
            <EarningCard label={t("runPayroll.thirteenthMonth")} value={calculation.subsidioAnual} />
          )}
          {calculation.serviceCompensation > 0 && (
            <EarningCard label={t("runPayroll.serviceCompensation")} value={calculation.serviceCompensation} />
          )}
        </div>
      </div>

      {/* Deductions + Employer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
            {t("runPayroll.employeeDeductions")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <DeductionCard label={t("runPayroll.incomeTax")} value={calculation.incomeTax} />
            <DeductionCard label={t("runPayroll.inssEmployee4")} value={calculation.inssEmployee} />
            {/* Attendance reductions — shown so the deduction total reconciles
                (a big unpaid absence otherwise looks unexplained). */}
            {calculation.absenceDeduction > 0 && (
              <DeductionCard label={t("runPayroll.absence") || "Absence"} value={calculation.absenceDeduction} />
            )}
            {calculation.lateDeduction > 0 && (
              <DeductionCard label={t("runPayroll.lateArrival") || "Late arrival"} value={calculation.lateDeduction} />
            )}
            {/* Deductions & Advances register lines (post 30%-cap amounts). */}
            {calculation.advanceRepayment > 0 && (
              <DeductionCard label={t("runPayroll.advanceRepayment")} value={calculation.advanceRepayment} />
            )}
            {calculation.loanRepayment > 0 && (
              <DeductionCard label={t("runPayroll.loanRepayment")} value={calculation.loanRepayment} />
            )}
            {calculation.courtOrders > 0 && (
              <DeductionCard label={t("runPayroll.courtOrder")} value={calculation.courtOrders} />
            )}
            {calculation.otherDeductions > 0 && (
              <DeductionCard label={t("runPayroll.otherDeductions")} value={calculation.otherDeductions} />
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
            {t("runPayroll.employerContrib")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-500/10">
              <p className="text-xs text-muted-foreground">{t("runPayroll.inssEmployer6")}</p>
              <p className="font-semibold text-sm text-amber-600">{formatCurrencyTL(calculation.inssEmployer)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/10">
              <p className="text-xs text-muted-foreground">{t("runPayroll.totalCost")}</p>
              <p className="font-semibold text-sm text-emerald-600">{formatCurrencyTL(calculation.totalEmployerCost)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tax bases — subtle reference info */}
      <div className="flex gap-4 text-xs text-muted-foreground/70 pt-1 border-t border-border/30">
        <span>{t("runPayroll.taxableIncome")}: {formatCurrencyTL(calculation.taxableIncome)}</span>
        <span>{t("runPayroll.inssBase")}: {formatCurrencyTL(calculation.inssBase)}</span>
      </div>
    </div>
  );
}

// --- Main card ---

function PayrollEmployeeCardComponent({
  data,
  isExpanded,
  onToggleExpand,
  onInputChange,
  onBonusCategoryChange,
  onReset,
}: PayrollEmployeeCardProps) {
  const { t } = useI18n();
  const employeeId = data.employee.id || "";
  const employeeName = `${data.employee.personalInfo.firstName} ${data.employee.personalInfo.lastName}`;
  const initials = `${data.employee.personalInfo.firstName[0] ?? ""}${data.employee.personalInfo.lastName[0] ?? ""}`;
  const calc = data.calculation;
  const special = specialHoursSummary(data, t);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggleExpand(employeeId);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-colors ${
        data.isEdited
          ? "border-amber-300 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20"
          : "border-border/50 bg-card"
      }`}
    >
      {/* Header — click to expand. Inputs stopPropagation so they stay usable. */}
      <div
        className="cursor-pointer p-4"
        onClick={() => onToggleExpand(employeeId)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label={`${employeeName} — ${t("runPayroll.stepHoursTitle")}`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="text-xs font-semibold text-green-700 dark:text-green-300">{initials}</span>
              </div>
              {data.isEdited && (
                <div
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-background"
                  title={t("runPayroll.modified", { count: "" }).trim()}
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{employeeName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {data.employee.jobDetails.employeeId}
                {data.employee.jobDetails.department ? ` · ${data.employee.jobDetails.department}` : ""}
              </p>
              {special && (
                <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">{special}</p>
              )}
            </div>
          </div>

          {/* Outcome — Net Pay prominent, always visible */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("runPayroll.netPay")}</p>
              <p className="font-extrabold tabular-nums text-emerald-600 text-base leading-tight">
                {calc ? formatCurrencyTL(calc.netPay) : "—"}
              </p>
              {calc && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {formatCurrencyTL(calc.grossPay)}
                  {calc.totalDeductions > 0 && (
                    <> · <span className="text-red-600">-{formatCurrencyTL(calc.totalDeductions)}</span></>
                  )}
                </p>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Inline edits — the common case */}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <LabeledNumber
            label={t("runPayroll.hours")}
            value={data.regularHours}
            originalValue={data.originalValues.regularHours}
            employeeId={employeeId}
            field="regularHours"
            ariaLabel={`${t("runPayroll.hours")} - ${employeeName}`}
            onInputChange={onInputChange}
          />
          <LabeledNumber
            label={t("runPayroll.ot")}
            value={data.overtimeHours}
            originalValue={data.originalValues.overtimeHours}
            employeeId={employeeId}
            field="overtimeHours"
            ariaLabel={`${t("runPayroll.ot")} - ${employeeName}`}
            onInputChange={onInputChange}
          />
          <BonusField
            data={data}
            employeeId={employeeId}
            employeeName={employeeName}
            onInputChange={onInputChange}
            onBonusCategoryChange={onBonusCategoryChange}
            t={t}
          />
          {data.isEdited && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-9 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/20"
              title={t("common.reset") || "Reset"}
              aria-label={`${t("common.reset") || "Reset"} ${employeeName}`}
              onClick={(e) => {
                e.stopPropagation();
                onReset(employeeId);
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              {t("common.reset") || "Reset"}
            </Button>
          )}
        </div>
      </div>

      {isExpanded && calc && (
        <ExpandedDetails
          data={data}
          employeeId={employeeId}
          employeeName={employeeName}
          calculation={calc}
          onInputChange={onInputChange}
          t={t}
        />
      )}
    </div>
  );
}

/**
 * Memoized so editing one employee doesn't re-render the whole list. The
 * calculator hook returns a stable `data` reference for untouched rows and the
 * callbacks are useCallback-stable, so a keystroke re-renders only this card —
 * the difference between smooth and unusable at 300+ employees.
 */
export const PayrollEmployeeCard = React.memo(PayrollEmployeeCardComponent);
