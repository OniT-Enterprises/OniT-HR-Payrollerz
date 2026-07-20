/**
 * Day-count helpers for the INSS Declaração de Remunerações (DR).
 *
 * DL 20/2017 Art. 12: remuneration is declared together with the number of
 * DAYS it covers — 30 only when the contract covers the whole calendar month
 * (the social-security 30-day month convention), otherwise the actual days
 * the contract ran inside the month (mid-month hire / termination).
 *
 * Pure, Firebase-free module so the day math is unit-testable (CI runs with
 * no VITE_FIREBASE_* env).
 */

/** SS convention: a full contributory month is declared as 30 days. */
export const INSS_FULL_MONTH_CONTRACT_DAYS = 30;

/** Standard working day used to convert absence hours to declared days. */
export const INSS_HOURS_PER_DAY = 8;

const PERIOD_RE = /^(\d{4})-(\d{2})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parsePeriod(period: string): { year: number; month: number } {
  const match = PERIOD_RE.exec(period);
  if (!match) {
    throw new RangeError('INSS period must use YYYY-MM format.');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new RangeError('INSS period month must be between 01 and 12.');
  }
  return { year, month };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Returns a valid YYYY-MM-DD string, or null when absent/invalid. */
function normalizeISODate(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 10);
  const match = ISO_DATE_RE.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

function dayOfMonthFromISO(iso: string): number {
  return Number(iso.slice(8, 10));
}

/**
 * Contract days to declare for a worker in the DR month (DL 20/2017 Art. 12).
 *
 * - Contract covers the whole calendar month → 30 (SS convention), even for
 *   February or 31-day months.
 * - Mid-month hire and/or termination → the actual calendar days the contract
 *   ran inside the month (inclusive), capped at 30.
 * - Missing/invalid hire date is treated as "hired before this month": the DR
 *   previously always declared 30, and a worker with a paid record and no
 *   parseable hire date should not silently drop to 0 declared days.
 */
export function calculateContractDaysInMonth(
  period: string,
  hireDate: string | undefined | null,
  terminationDate?: string | undefined | null,
): number {
  const { year, month } = parsePeriod(period);
  const lastDay = daysInMonth(year, month);
  const monthStart = `${period}-01`;
  const monthEnd = `${period}-${String(lastDay).padStart(2, '0')}`;

  const hire = normalizeISODate(hireDate);
  const termination = normalizeISODate(terminationDate);

  const effectiveStart = hire && hire > monthStart ? hire : monthStart;
  const effectiveEnd = termination && termination < monthEnd ? termination : monthEnd;

  if (hire && hire > monthEnd) return 0;
  if (termination && termination < monthStart) return 0;
  if (effectiveStart > effectiveEnd) return 0;

  if (effectiveStart === monthStart && effectiveEnd === monthEnd) {
    return INSS_FULL_MONTH_CONTRACT_DAYS;
  }

  const days = dayOfMonthFromISO(effectiveEnd) - dayOfMonthFromISO(effectiveStart) + 1;
  return Math.min(days, INSS_FULL_MONTH_CONTRACT_DAYS);
}

/**
 * Recover the absence hours behind a persisted 'absence' deduction line.
 *
 * The saved PayrollRecord does not persist absenceHours — only the deduction
 * amount (= hourlyRate × absenceHours, calculateAbsenceDeduction) and the
 * record's hourlyRate — so hours are derived by division. Returns 0 when the
 * rate or amount is missing/non-positive rather than guessing.
 */
export function deriveAbsenceHoursFromDeduction(
  absenceDeductionAmount: number | undefined | null,
  hourlyRate: number | undefined | null,
): number {
  const amount = typeof absenceDeductionAmount === 'number' ? absenceDeductionAmount : 0;
  const rate = typeof hourlyRate === 'number' ? hourlyRate : 0;
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || amount <= 0 || rate <= 0) {
    return 0;
  }
  return amount / rate;
}

/**
 * Convert accumulated unpaid-absence hours to declared whole days
 * ("Faltas Injustificadas declaradas"), 8h = 1 day, rounded to the nearest
 * day and clamped to the declared contract days.
 */
export function calculateUnjustifiedAbsenceDays(
  totalAbsenceHours: number,
  contractDays: number = INSS_FULL_MONTH_CONTRACT_DAYS,
): number {
  if (!Number.isFinite(totalAbsenceHours) || totalAbsenceHours <= 0) return 0;
  const days = Math.round(totalAbsenceHours / INSS_HOURS_PER_DAY);
  return Math.max(0, Math.min(days, Math.max(contractDays, 0)));
}

export interface ParentalLeaveInterval {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/**
 * Calendar days of approved maternity/paternity leave falling inside the DR
 * month ("Dias Falta por parentalidade"). Overlapping requests are merged so
 * the same day is never counted twice; the result is capped at 30 (the SS
 * 30-day month convention).
 */
export function calculateParentalLeaveDaysInMonth(
  period: string,
  leaves: ParentalLeaveInterval[],
): number {
  const { year, month } = parsePeriod(period);
  const lastDay = daysInMonth(year, month);
  const monthStart = `${period}-01`;
  const monthEnd = `${period}-${String(lastDay).padStart(2, '0')}`;

  // Clip each leave to the month, drop non-overlapping/invalid ones.
  const clipped: Array<{ start: number; end: number }> = [];
  for (const leave of leaves) {
    const start = normalizeISODate(leave.startDate);
    const end = normalizeISODate(leave.endDate);
    if (!start || !end || start > end) continue;
    if (end < monthStart || start > monthEnd) continue;
    const clippedStart = start > monthStart ? start : monthStart;
    const clippedEnd = end < monthEnd ? end : monthEnd;
    clipped.push({
      start: dayOfMonthFromISO(clippedStart),
      end: dayOfMonthFromISO(clippedEnd),
    });
  }
  if (clipped.length === 0) return 0;

  // Merge overlapping/adjacent intervals, then count inclusive days.
  clipped.sort((a, b) => a.start - b.start || a.end - b.end);
  let total = 0;
  let currentStart = clipped[0].start;
  let currentEnd = clipped[0].end;
  for (let i = 1; i < clipped.length; i++) {
    const interval = clipped[i];
    if (interval.start <= currentEnd + 1) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      total += currentEnd - currentStart + 1;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }
  total += currentEnd - currentStart + 1;

  return Math.min(total, INSS_FULL_MONTH_CONTRACT_DAYS);
}
