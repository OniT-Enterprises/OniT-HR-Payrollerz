/**
 * PayrollEmployeeRow - Table row for individual employee in RunPayroll
 * Includes editable inputs, expanded details, and reset functionality
 */

import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type { Employee } from "@/services/employeeService";
import type { TLPayrollResult } from "@/lib/payroll/calculations-tl";
import { useI18n } from "@/i18n/I18nProvider";

interface OriginalValues {
  regularHours: number;
  overtimeHours: number;
  nightShiftHours: number;
  bonus: number;
  perDiem: number;
  allowances: number;
}

interface EmployeePayrollRowData {
  employee: Employee;
  regularHours: number;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  sickDays: number;
  perDiem: number;
  bonus: number;
  allowances: number;
  calculation: TLPayrollResult | null;
  isEdited: boolean;
  originalValues: OriginalValues;
}

interface PayrollEmployeeRowProps {
  data: EmployeePayrollRowData;
  isExpanded: boolean;
  onToggleExpand: (employeeId: string) => void;
  onInputChange: (employeeId: string, field: string, value: number) => void;
  onReset: (employeeId: string) => void;
}

// --- Sub-components ---

function ExpandToggleCell({ isExpanded }: { isExpanded: boolean }) {
  return (
    <TableCell>
      <span title={isExpanded ? "Collapse details" : "Expand details"}>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </span>
    </TableCell>
  );
}

function EmployeeInfoCell({
  employee,
  isEdited,
  editedLabel,
}: {
  employee: Employee;
  isEdited: boolean;
  editedLabel: string;
}) {
  return (
    <TableCell>
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
            <span className="text-xs font-semibold text-green-700 dark:text-green-300">
              {employee.personalInfo.firstName[0]}{employee.personalInfo.lastName[0]}
            </span>
          </div>
          {isEdited && (
            <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-background" title={editedLabel} />
          )}
        </div>
        <div>
          <p className="font-medium text-sm">
            {employee.personalInfo.firstName}{" "}
            {employee.personalInfo.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            {employee.jobDetails.employeeId}
          </p>
        </div>
      </div>
    </TableCell>
  );
}

interface EditableInputCellProps {
  value: number;
  originalValue: number;
  employeeId: string;
  field: string;
  ariaLabel: string;
  onInputChange: (employeeId: string, field: string, value: number) => void;
  width?: string;
  step?: number;
}

function EditableInputCell({
  value,
  originalValue,
  employeeId,
  field,
  ariaLabel,
  onInputChange,
  width = "w-16",
  step = 0.5,
}: EditableInputCellProps) {
  const isModified = value !== originalValue;
  return (
    <TableCell className="text-right">
      <Input
        type="number"
        value={value}
        onChange={(e) =>
          onInputChange(employeeId, field, parseFloat(e.target.value) || 0)
        }
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={ariaLabel}
        className={`${width} text-right ${
          isModified
            ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
            : "border-border/50"
        }`}
        min={0}
        step={step}
      />
    </TableCell>
  );
}

function PaySummaryCell({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  return (
    <TableCell className={`text-right ${className || ""}`}>
      {value !== null ? formatCurrencyTL(value) : "-"}
    </TableCell>
  );
}

function ResetActionCell({
  isEdited,
  employeeName,
  employeeId,
  onReset,
}: {
  isEdited: boolean;
  employeeName: string;
  employeeId: string;
  onReset: (employeeId: string) => void;
}) {
  return (
    <TableCell>
      {isEdited && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-amber-100 dark:hover:bg-amber-900/20"
          title="Reset"
          aria-label={`Reset ${employeeName}`}
          onClick={(e) => {
            e.stopPropagation();
            onReset(employeeId);
          }}
        >
          <RotateCcw className="h-4 w-4 text-amber-600" />
        </Button>
      )}
    </TableCell>
  );
}

function EarningCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg bg-background border border-border/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{formatCurrencyTL(value)}</p>
    </div>
  );
}

function ExpandedDetailsRow({
  employeeName,
  calculation,
  t,
}: {
  employeeName: string;
  calculation: TLPayrollResult;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <TableRow className="bg-muted/20 hover:bg-muted/20" role="region" aria-label={`${employeeName} - details`}>
      <TableCell colSpan={11}>
        <div className="p-4 space-y-3 ml-4 border-l-2 border-green-300 dark:border-green-700">
          {/* Earnings */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('runPayroll.earnings')}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <EarningCard label={t('runPayroll.regularPay')} value={calculation.regularPay} />
              {calculation.overtimePay > 0 && (
                <EarningCard label={t('runPayroll.overtimePay')} value={calculation.overtimePay} />
              )}
              {calculation.nightShiftPay > 0 && (
                <EarningCard label={t('runPayroll.nightShift')} value={calculation.nightShiftPay} />
              )}
              {calculation.subsidioAnual > 0 && (
                <EarningCard label={t('runPayroll.thirteenthMonth')} value={calculation.subsidioAnual} />
              )}
            </div>
          </div>
          {/* Deductions + Employer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">{t('runPayroll.employeeDeductions')}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-500/10">
                  <p className="text-xs text-muted-foreground">{t('runPayroll.incomeTax')}</p>
                  <p className="font-semibold text-sm text-red-600">-{formatCurrencyTL(calculation.incomeTax)}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-500/10">
                  <p className="text-xs text-muted-foreground">{t('runPayroll.inssEmployee4')}</p>
                  <p className="font-semibold text-sm text-red-600">-{formatCurrencyTL(calculation.inssEmployee)}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">{t('runPayroll.employerContrib')}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-500/10">
                  <p className="text-xs text-muted-foreground">{t('runPayroll.inssEmployer6')}</p>
                  <p className="font-semibold text-sm text-amber-600">{formatCurrencyTL(calculation.inssEmployer)}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/10">
                  <p className="text-xs text-muted-foreground">{t('runPayroll.totalCost')}</p>
                  <p className="font-semibold text-sm text-emerald-600">{formatCurrencyTL(calculation.totalEmployerCost)}</p>
                </div>
              </div>
            </div>
          </div>
          {/* Tax bases - subtle reference info */}
          <div className="flex gap-4 text-xs text-muted-foreground/70 pt-1 border-t border-border/30">
            <span>{t('runPayroll.taxableIncome')}: {formatCurrencyTL(calculation.taxableIncome)}</span>
            <span>{t('runPayroll.inssBase')}: {formatCurrencyTL(calculation.inssBase)}</span>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

// --- Editable cells row ---

function PayrollEditableCells({
  data,
  employeeId,
  employeeName,
  onInputChange,
  t,
}: {
  data: EmployeePayrollRowData;
  employeeId: string;
  employeeName: string;
  onInputChange: (employeeId: string, field: string, value: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <EditableInputCell
        value={data.regularHours}
        originalValue={data.originalValues.regularHours}
        employeeId={employeeId}
        field="regularHours"
        ariaLabel={`${t('runPayroll.hours')} - ${employeeName}`}
        onInputChange={onInputChange}
        width="w-20"
      />
      <EditableInputCell
        value={data.overtimeHours}
        originalValue={data.originalValues.overtimeHours}
        employeeId={employeeId}
        field="overtimeHours"
        ariaLabel={`${t('runPayroll.ot')} - ${employeeName}`}
        onInputChange={onInputChange}
      />
      <EditableInputCell
        value={data.nightShiftHours}
        originalValue={data.originalValues.nightShiftHours}
        employeeId={employeeId}
        field="nightShiftHours"
        ariaLabel={`${t('runPayroll.night')} - ${employeeName}`}
        onInputChange={onInputChange}
      />
      <EditableInputCell
        value={data.bonus}
        originalValue={data.originalValues.bonus}
        employeeId={employeeId}
        field="bonus"
        ariaLabel={`${t('runPayroll.bonus')} - ${employeeName}`}
        onInputChange={onInputChange}
        width="w-24"
        step={50}
      />
    </>
  );
}

// --- Main component ---

export function PayrollEmployeeRow({
  data,
  isExpanded,
  onToggleExpand,
  onInputChange,
  onReset,
}: PayrollEmployeeRowProps) {
  const { t } = useI18n();
  const employeeId = data.employee.id || "";
  const employeeName = `${data.employee.personalInfo.firstName} ${data.employee.personalInfo.lastName}`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggleExpand(employeeId);
    }
  };

  return (
    <React.Fragment>
      <TableRow
        className={`cursor-pointer transition-colors ${
          data.isEdited
            ? "bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            : "hover:bg-muted"
        }`}
        onClick={() => onToggleExpand(employeeId)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label={`${employeeName} payroll details`}
      >
        <ExpandToggleCell isExpanded={isExpanded} />
        <EmployeeInfoCell
          employee={data.employee}
          isEdited={data.isEdited}
          editedLabel={t('runPayroll.modified', { count: '' }).trim()}
        />
        <TableCell>{data.employee.jobDetails.department}</TableCell>
        <PayrollEditableCells
          data={data}
          employeeId={employeeId}
          employeeName={employeeName}
          onInputChange={onInputChange}
          t={t}
        />
        <PaySummaryCell
          value={data.calculation ? data.calculation.grossPay : null}
          className="font-medium"
        />
        <PaySummaryCell
          value={data.calculation ? data.calculation.totalDeductions : null}
          className="text-red-600"
        />
        <PaySummaryCell
          value={data.calculation ? data.calculation.netPay : null}
          className="font-semibold text-emerald-600"
        />
        <ResetActionCell
          isEdited={data.isEdited}
          employeeName={employeeName}
          employeeId={employeeId}
          onReset={onReset}
        />
      </TableRow>

      {isExpanded && data.calculation && (
        <ExpandedDetailsRow
          employeeName={employeeName}
          calculation={data.calculation}
          t={t}
        />
      )}
    </React.Fragment>
  );
}
