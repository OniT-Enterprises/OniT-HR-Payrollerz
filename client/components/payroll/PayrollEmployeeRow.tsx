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

export interface EmployeePayrollRowData {
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
        <TableCell>
          <span title={isExpanded ? "Collapse details" : "Expand details"}>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                  {data.employee.personalInfo.firstName[0]}{data.employee.personalInfo.lastName[0]}
                </span>
              </div>
              {data.isEdited && (
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-background" title={t('runPayroll.modified', { count: '' }).trim()} />
              )}
            </div>
            <div>
              <p className="font-medium text-sm">
                {data.employee.personalInfo.firstName}{" "}
                {data.employee.personalInfo.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.employee.jobDetails.employeeId}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell>{data.employee.jobDetails.department}</TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            value={data.regularHours}
            onChange={(e) =>
              onInputChange(employeeId, "regularHours", parseFloat(e.target.value) || 0)
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`${t('runPayroll.hours')} - ${employeeName}`}
            className={`w-20 text-right ${
              data.regularHours !== data.originalValues.regularHours
                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                : "border-border/50"
            }`}
            min={0}
            step={0.5}
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            value={data.overtimeHours}
            onChange={(e) =>
              onInputChange(employeeId, "overtimeHours", parseFloat(e.target.value) || 0)
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`${t('runPayroll.ot')} - ${employeeName}`}
            className={`w-16 text-right ${
              data.overtimeHours !== data.originalValues.overtimeHours
                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                : "border-border/50"
            }`}
            min={0}
            step={0.5}
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            value={data.nightShiftHours}
            onChange={(e) =>
              onInputChange(employeeId, "nightShiftHours", parseFloat(e.target.value) || 0)
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`${t('runPayroll.night')} - ${employeeName}`}
            className={`w-16 text-right ${
              data.nightShiftHours !== data.originalValues.nightShiftHours
                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                : "border-border/50"
            }`}
            min={0}
            step={0.5}
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            value={data.bonus}
            onChange={(e) =>
              onInputChange(employeeId, "bonus", parseFloat(e.target.value) || 0)
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`${t('runPayroll.bonus')} - ${employeeName}`}
            className={`w-24 text-right ${
              data.bonus !== data.originalValues.bonus
                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                : "border-border/50"
            }`}
            min={0}
            step={50}
          />
        </TableCell>
        <TableCell className="text-right font-medium">
          {data.calculation ? formatCurrencyTL(data.calculation.grossPay) : "-"}
        </TableCell>
        <TableCell className="text-right text-red-600">
          {data.calculation ? formatCurrencyTL(data.calculation.totalDeductions) : "-"}
        </TableCell>
        <TableCell className="text-right font-semibold text-emerald-600">
          {data.calculation ? formatCurrencyTL(data.calculation.netPay) : "-"}
        </TableCell>
        <TableCell>
          {data.isEdited && (
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
      </TableRow>

      {/* Expanded details row */}
      {isExpanded && data.calculation && (
        <TableRow className="bg-muted/20 hover:bg-muted/20" role="region" aria-label={`${employeeName} - details`}>
          <TableCell colSpan={11}>
            <div className="p-4 space-y-3 ml-4 border-l-2 border-green-300 dark:border-green-700">
              {/* Earnings */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('runPayroll.earnings')}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-3 rounded-lg bg-background border border-border/50">
                    <p className="text-xs text-muted-foreground">{t('runPayroll.regularPay')}</p>
                    <p className="font-semibold text-sm">{formatCurrencyTL(data.calculation.regularPay)}</p>
                  </div>
                  {data.calculation.overtimePay > 0 && (
                    <div className="p-3 rounded-lg bg-background border border-border/50">
                      <p className="text-xs text-muted-foreground">{t('runPayroll.overtimePay')}</p>
                      <p className="font-semibold text-sm">{formatCurrencyTL(data.calculation.overtimePay)}</p>
                    </div>
                  )}
                  {data.calculation.nightShiftPay > 0 && (
                    <div className="p-3 rounded-lg bg-background border border-border/50">
                      <p className="text-xs text-muted-foreground">{t('runPayroll.nightShift')}</p>
                      <p className="font-semibold text-sm">{formatCurrencyTL(data.calculation.nightShiftPay)}</p>
                    </div>
                  )}
                  {data.calculation.subsidioAnual > 0 && (
                    <div className="p-3 rounded-lg bg-background border border-border/50">
                      <p className="text-xs text-muted-foreground">{t('runPayroll.thirteenthMonth')}</p>
                      <p className="font-semibold text-sm">{formatCurrencyTL(data.calculation.subsidioAnual)}</p>
                    </div>
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
                      <p className="font-semibold text-sm text-red-600">-{formatCurrencyTL(data.calculation.incomeTax)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-500/10">
                      <p className="text-xs text-muted-foreground">{t('runPayroll.inssEmployee4')}</p>
                      <p className="font-semibold text-sm text-red-600">-{formatCurrencyTL(data.calculation.inssEmployee)}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">{t('runPayroll.employerContrib')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-500/10">
                      <p className="text-xs text-muted-foreground">{t('runPayroll.inssEmployer6')}</p>
                      <p className="font-semibold text-sm text-amber-600">{formatCurrencyTL(data.calculation.inssEmployer)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/10">
                      <p className="text-xs text-muted-foreground">{t('runPayroll.totalCost')}</p>
                      <p className="font-semibold text-sm text-emerald-600">{formatCurrencyTL(data.calculation.totalEmployerCost)}</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Tax bases - subtle reference info */}
              <div className="flex gap-4 text-xs text-muted-foreground/70 pt-1 border-t border-border/30">
                <span>{t('runPayroll.taxableIncome')}: {formatCurrencyTL(data.calculation.taxableIncome)}</span>
                <span>{t('runPayroll.inssBase')}: {formatCurrencyTL(data.calculation.inssBase)}</span>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}
