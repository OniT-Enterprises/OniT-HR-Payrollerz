/**
 * RunPayroll shared types and helper functions
 * Extracted from RunPayroll.tsx to reduce file size
 */
import type { Employee } from '@/services/employeeService';
import type { TLBonusINSSCategory, TLPayrollResult } from '@/lib/payroll/calculations-tl';
import type { TLPayFrequency } from '@/lib/payroll/constants-tl';

export interface EmployeePayrollData {
  employee: Employee;
  regularHours: number;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  restDayHours: number;
  absenceHours: number;
  lateArrivalMinutes: number;
  sickDays: number;
  perDiem: number;
  bonus: number;
  bonusINSSCategory: TLBonusINSSCategory | null;
  allowances: number;
  calculation: TLPayrollResult | null;
  isEdited: boolean;
  originalValues: {
    regularHours: number;
    overtimeHours: number;
    nightShiftHours: number;
    holidayHours: number;
    restDayHours: number;
    absenceHours: number;
    lateArrivalMinutes: number;
    bonus: number;
    bonusINSSCategory: TLBonusINSSCategory | null;
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
 * Calculate pro-rated hours for a partial period of EMPLOYMENT — both edges.
 * The employed window is [hireDate, employmentEndDate]; hours are prorated by
 * the calendar-day overlap of that window with [periodStart, periodEnd].
 * A full-period employee (hired on/before start, no end before period end)
 * gets defaultHours unchanged. employmentEndDate is the termination date or a
 * fixed-term contract end — omitted/later than the period means no end edge.
 */
export function calculateProRataHours(
  hireDate: string,
  periodStart: string,
  periodEnd: string,
  defaultHours: number,
  employmentEndDate?: string | null,
): number {
  if (!hireDate || !periodStart || !periodEnd) return defaultHours;

  const hire = new Date(`${hireDate}T00:00:00`);
  const start = new Date(`${periodStart}T00:00:00`);
  const end = new Date(`${periodEnd}T00:00:00`);

  // If any date is invalid, return full hours
  if (isNaN(hire.getTime()) || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return defaultHours;
  }

  // Employment end (invalid dates are ignored, matching the hire-edge policy)
  let empEnd: Date | null = null;
  if (employmentEndDate) {
    const parsed = new Date(`${employmentEndDate}T00:00:00`);
    if (!isNaN(parsed.getTime())) empEnd = parsed;
  }

  // Employment ended before the period, or hired after it — zero hours
  if (empEnd && empEnd < start) return 0;
  if (hire > end) return 0;

  const effectiveStart = hire > start ? hire : start;
  const effectiveEnd = empEnd && empEnd < end ? empEnd : end;
  if (effectiveEnd < effectiveStart) return 0;

  // Full period worked — full hours
  if (effectiveStart.getTime() === start.getTime() && effectiveEnd.getTime() === end.getTime()) {
    return defaultHours;
  }

  // Partial period: prorate by calendar days
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysWorked = Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Round to 2 decimal places
  return Math.round((defaultHours * daysWorked / totalDays) * 100) / 100;
}

// ─── Leave credits for attendance sync ────────────────────────────
//
// Approved leave days record zero attendance hours, so a naive
// expected-minus-recorded absence calculation would dock pay for paid leave.
// This classifies approved leave overlapping the pay period:
//  - paid, non-sick types  → hours credited against absence, scaled by the
//                            policy's paid fraction (a 50%-paid type credits
//                            half the hours; the other half stays deducted)
//  - sick                  → day count for TL sick-pay rules (100%/50%)
//  - unpaid types          → left in absence (deducted), by design

export interface LeaveCreditInput {
  employeeId: string;
  leaveType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  halfDay?: boolean;
}

export interface LeaveCredit {
  paidLeaveHours: number;
  sickDays: number;
}

export function computeLeaveCredits(
  approvedLeave: LeaveCreditInput[],
  periodStart: string,
  periodEnd: string,
  standardDailyHours: number,
  /** Paid fraction (0..1) of the policy for a leave type; 0 = unpaid. */
  payFractionForType: (leaveType: string) => number,
  workingDaysBetween: (start: string, end: string) => number,
): Map<string, LeaveCredit> {
  const credits = new Map<string, LeaveCredit>();

  for (const req of approvedLeave) {
    if (!req.employeeId) continue;
    const overlapStart = req.startDate > periodStart ? req.startDate : periodStart;
    const overlapEnd = req.endDate < periodEnd ? req.endDate : periodEnd;
    if (overlapStart > overlapEnd) continue;

    const days = req.halfDay ? 0.5 : workingDaysBetween(overlapStart, overlapEnd);
    if (days <= 0) continue;

    const credit = credits.get(req.employeeId) ?? { paidLeaveHours: 0, sickDays: 0 };
    if (req.leaveType === 'sick') {
      credit.sickDays += days;
    } else {
      const fraction = Math.min(1, Math.max(0, payFractionForType(req.leaveType)));
      // unpaid (fraction 0): no credit entry — stays as absence deduction
      if (fraction <= 0) continue;
      credit.paidLeaveHours += days * standardDailyHours * fraction;
    }
    credits.set(req.employeeId, credit);
  }

  return credits;
}

const civilYearOf = (iso: string | null | undefined): number | null => {
  if (!iso || iso.length < 4) return null;
  const year = Number.parseInt(iso.slice(0, 4), 10);
  return Number.isInteger(year) ? year : null;
};

/**
 * Every civil year a wage period touches — the key for the once-only final-pay
 * dedup (Art. 56 severance, Art. 44 subsidio, both deduped per civil year).
 *
 * A single year is NOT enough. The dedup used to be keyed on periodEnd's year
 * alone, but a leaver's entitlement is computed from their TERMINATION date, and
 * a period can straddle 1 January — e.g. a weekly final run 2025-12-29 → 2026-01-04
 * for someone whose last day was 2025-12-31. That looked up 2026, could not see
 * the already-paid December 2025 subsidio, and re-paid the whole 13th month.
 * `payroll-schedule.ts` auto-fills a weekly period as "the last 7 days ending
 * yesterday", so an admin running payroll in early January lands there by default.
 *
 * Returning the full set makes the lookup cover both years. Any in-period
 * termination date necessarily falls in one of them, so no leaver is missed
 * without having to enumerate the roster. payDate is only a fallback for runs
 * with no period recorded.
 */
export function finalPayDedupYears(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
  payDate?: string | null,
): number[] {
  const years = new Set<number>();
  for (const iso of [periodStart, periodEnd]) {
    const year = civilYearOf(iso);
    if (year !== null) years.add(year);
  }
  if (years.size === 0) {
    const year = civilYearOf(payDate);
    if (year !== null) years.add(year);
  }
  return [...years].sort((a, b) => a - b);
}

/**
 * Whether an existing run's wage period touches any of `years`, so its committed
 * final-pay earnings count against the run being built. Deliberately generous at
 * both ends of the period: a New-Year-spanning run must be found from either
 * side of the boundary.
 */
export function runTouchesFinalPayYear(
  run: { periodStart?: string | null; periodEnd?: string | null; payDate?: string | null },
  years: readonly number[],
): boolean {
  if (years.length === 0) return false;
  for (const iso of [run.periodStart || run.payDate, run.periodEnd]) {
    const year = civilYearOf(iso);
    if (year !== null && years.includes(year)) return true;
  }
  return false;
}
