/**
 * RunPayroll shared types and helper functions
 * Extracted from RunPayroll.tsx to reduce file size
 */
import type { Employee } from '@/services/employeeService';
import type { TLPayrollResult } from '@/lib/payroll/calculations-tl';
import type { TLPayFrequency } from '@/lib/payroll/constants-tl';
import type { PayrollRecord } from '@/types/payroll';

export interface EmployeePayrollData {
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

export const mapTLEarningTypeToPayrollEarningType = (
  type: string
): PayrollRecord['earnings'][number]['type'] => {
  switch (type) {
    case 'regular':
      return 'regular';
    case 'overtime':
      return 'overtime';
    case 'holiday':
      return 'holiday';
    case 'bonus':
      return 'bonus';
    case 'subsidio_anual':
      return 'subsidio_anual';
    case 'commission':
      return 'commission';
    case 'reimbursement':
      return 'reimbursement';
    case 'per_diem':
    case 'food_allowance':
    case 'transport_allowance':
    case 'housing_allowance':
    case 'travel_allowance':
      return 'allowance';
    default:
      return 'other';
  }
};

export const mapTLDeductionTypeToPayrollDeductionType = (
  type: string
): PayrollRecord['deductions'][number]['type'] => {
  switch (type) {
    case 'income_tax':
      return 'federal_tax';
    case 'inss_employee':
      return 'social_security';
    case 'advance_repayment':
      return 'advance';
    case 'court_order':
      return 'garnishment';
    default:
      return 'other';
  }
};

export const getPayPeriodsInPayMonth = (
  payDateIso: string,
  payFrequency: TLPayFrequency
): number | undefined => {
  if (!payDateIso) return undefined;
  if (payFrequency !== 'weekly' && payFrequency !== 'biweekly') return undefined;

  const intervalDays = payFrequency === 'weekly' ? 7 : 14;
  const payDate = new Date(`${payDateIso}T00:00:00`);
  if (Number.isNaN(payDate.getTime())) return undefined;

  const targetYear = payDate.getFullYear();
  const targetMonth = payDate.getMonth();

  let cursor = new Date(payDate);
  while (true) {
    const previous = new Date(cursor);
    previous.setDate(previous.getDate() - intervalDays);
    if (previous.getFullYear() !== targetYear || previous.getMonth() !== targetMonth) break;
    cursor = previous;
  }

  let count = 0;
  const iter = new Date(cursor);
  while (iter.getFullYear() === targetYear && iter.getMonth() === targetMonth) {
    count += 1;
    iter.setDate(iter.getDate() + intervalDays);
  }

  return count > 0 ? count : undefined;
};

export const formatPayPeriod = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} – ${endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
};

export const formatPayDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
