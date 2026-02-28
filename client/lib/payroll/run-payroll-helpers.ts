/**
 * RunPayroll shared types and helper functions
 * Extracted from RunPayroll.tsx to reduce file size
 */
import type { Employee } from '@/services/employeeService';
import type { TLPayrollResult } from '@/lib/payroll/calculations-tl';
import type { TLPayFrequency } from '@/lib/payroll/constants-tl';

export interface EmployeePayrollData {
  employee: Employee;
  regularHours: number;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  absenceHours: number;
  lateArrivalMinutes: number;
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
    absenceHours: number;
    lateArrivalMinutes: number;
    bonus: number;
    perDiem: number;
    allowances: number;
  };
}

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
    timeZone: 'Asia/Dili',
  })} – ${endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Dili',
  })}`;
};

export const formatPayDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Dili',
  });
};

/**
 * Calculate pro-rated hours for mid-period hires.
 * If the employee's hire date falls within [periodStart, periodEnd],
 * returns prorated hours based on calendar days worked vs total days in period.
 * If hired before the period, returns the full defaultHours unchanged.
 */
export function calculateProRataHours(
  hireDate: string,
  periodStart: string,
  periodEnd: string,
  defaultHours: number,
): number {
  if (!hireDate || !periodStart || !periodEnd) return defaultHours;

  const hire = new Date(`${hireDate}T00:00:00`);
  const start = new Date(`${periodStart}T00:00:00`);
  const end = new Date(`${periodEnd}T00:00:00`);

  // If any date is invalid, return full hours
  if (isNaN(hire.getTime()) || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return defaultHours;
  }

  // Hired before or on period start — full hours
  if (hire <= start) return defaultHours;

  // Hired after period end — zero hours (shouldn't normally happen for active employees)
  if (hire > end) return 0;

  // Mid-period hire: prorate by calendar days
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysWorked = Math.round((end.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Round to 2 decimal places
  return Math.round((defaultHours * daysWorked / totalDays) * 100) / 100;
}
