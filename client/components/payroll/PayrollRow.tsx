/**
 * PayrollRow - Memoized row component for RunPayroll table
 * Prevents full table re-render on each keystroke by handling input state locally
 */

import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronUp,
  ChevronDown,
  RotateCcw,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { Employee } from "@/services/employeeService";
import type { TLPayrollResult } from "@/lib/payroll/calculations-tl";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";

export interface PayrollRowData {
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
  originalValues: {
    regularHours: number;
    overtimeHours: number;
    nightShiftHours: number;
    bonus: number;
    perDiem: number;
    allowances: number;
  };
}

interface PayrollRowProps {
  data: PayrollRowData;
  isExpanded: boolean;
  isExcluded: boolean;
  onToggleExpand: (employeeId: string) => void;
  onInputChange: (employeeId: string, field: keyof PayrollRowData, value: number) => void;
  onReset: (employeeId: string) => void;
  onToggleExclude: (employeeId: string) => void;
  hasComplianceIssue?: boolean;
}

/**
 * Debounced input for numeric fields
 * Updates local state immediately but debounces parent update
 */
function DebouncedNumberInput({
  value,
  onChange,
  className = "",
  step = "1",
  min = "0",
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  step?: string;
  min?: string;
}) {
  const [localValue, setLocalValue] = useState(value.toString());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync local value when parent changes (reset, etc)
  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      // Clear previous timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce parent update (300ms)
      debounceRef.current = setTimeout(() => {
        const parsed = parseFloat(newValue);
        if (!isNaN(parsed)) {
          onChange(parsed);
        }
      }, 300);
    },
    [onChange]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Input
      type="number"
      value={localValue}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      className={className}
      step={step}
      min={min}
    />
  );
}

/**
 * Memoized PayrollRow component
 * Only re-renders when its specific props change
 */
export const PayrollRow = memo(function PayrollRow({
  data,
  isExpanded,
  isExcluded,
  onToggleExpand,
  onInputChange,
  onReset,
  onToggleExclude,
  hasComplianceIssue = false,
}: PayrollRowProps) {
  const employeeId = data.employee.id || "";
  const calc = data.calculation;

  const handleFieldChange = useCallback(
    (field: keyof PayrollRowData) => (value: number) => {
      onInputChange(employeeId, field, value);
    },
    [employeeId, onInputChange]
  );

  // Row click handler - expand row
  const handleRowClick = useCallback(() => {
    onToggleExpand(employeeId);
  }, [employeeId, onToggleExpand]);

  // Reset handler
  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onReset(employeeId);
    },
    [employeeId, onReset]
  );

  return (
    <>
      <TableRow
        className={`cursor-pointer transition-colors ${
          isExcluded
            ? "opacity-50 bg-gray-100 dark:bg-gray-900"
            : data.isEdited
            ? "bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            : "hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
        onClick={handleRowClick}
      >
        <TableCell>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {data.isEdited && (
              <div className="h-2 w-2 rounded-full bg-amber-500" title="Modified" />
            )}
            {hasComplianceIssue && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <div>
              <p className="font-medium">
                {data.employee.personalInfo.firstName}{" "}
                {data.employee.personalInfo.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.employee.jobDetails.employeeId}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {data.employee.jobDetails.department}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <DebouncedNumberInput
            value={data.regularHours}
            onChange={handleFieldChange("regularHours")}
            className="w-20 text-right"
            step="0.5"
          />
        </TableCell>
        <TableCell className="text-right">
          <DebouncedNumberInput
            value={data.overtimeHours}
            onChange={handleFieldChange("overtimeHours")}
            className="w-16 text-right"
            step="0.5"
          />
        </TableCell>
        <TableCell className="text-right">
          <DebouncedNumberInput
            value={data.nightShiftHours}
            onChange={handleFieldChange("nightShiftHours")}
            className="w-16 text-right"
            step="0.5"
          />
        </TableCell>
        <TableCell className="text-right">
          <DebouncedNumberInput
            value={data.bonus}
            onChange={handleFieldChange("bonus")}
            className="w-20 text-right"
            step="0.01"
          />
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatCurrencyTL(calc?.grossPay || 0)}
        </TableCell>
        <TableCell className="text-right text-red-600">
          {formatCurrencyTL(calc?.totalDeductions || 0)}
        </TableCell>
        <TableCell className="text-right font-semibold text-emerald-600">
          {formatCurrencyTL(calc?.netPay || 0)}
        </TableCell>
        <TableCell>
          {data.isEdited && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              title="Reset to original"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded row details */}
      {isExpanded && (
        <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
          <TableCell colSpan={11}>
            <div className="py-4 px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Earnings breakdown */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Earnings
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Regular Pay</span>
                      <span>{formatCurrencyTL(calc?.regularPay || 0)}</span>
                    </div>
                    {(calc?.overtimePay || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Overtime</span>
                        <span>{formatCurrencyTL(calc?.overtimePay || 0)}</span>
                      </div>
                    )}
                    {(calc?.nightShiftPay || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Night Shift</span>
                        <span>{formatCurrencyTL(calc?.nightShiftPay || 0)}</span>
                      </div>
                    )}
                    {(calc?.bonus || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Bonus</span>
                        <span>{formatCurrencyTL(calc?.bonus || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium pt-1 border-t">
                      <span>Gross Total</span>
                      <span>{formatCurrencyTL(calc?.grossPay || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions breakdown */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    Deductions
                    <Lock className="h-3 w-3" />
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Income Tax (10%)</span>
                      <span className="text-red-600">
                        {formatCurrencyTL(calc?.incomeTax || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>INSS Employee (4%)</span>
                      <span className="text-red-600">
                        {formatCurrencyTL(calc?.inssEmployee || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium pt-1 border-t text-red-600">
                      <span>Total Deductions</span>
                      <span>{formatCurrencyTL(calc?.totalDeductions || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Net pay */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Net Pay
                  </p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrencyTL(calc?.netPay || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Take-home pay this period
                  </p>
                </div>

                {/* Employer cost */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Employer Cost
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Gross Pay</span>
                      <span>{formatCurrencyTL(calc?.grossPay || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>INSS Employer (6%)</span>
                      <span>{formatCurrencyTL(calc?.inssEmployer || 0)}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-1 border-t">
                      <span>Total Employer Cost</span>
                      <span>{formatCurrencyTL(calc?.totalEmployerCost || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {calc?.warnings && calc.warnings.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      {calc.warnings.map((warning, i) => (
                        <p key={i}>{warning}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
});

export default PayrollRow;
