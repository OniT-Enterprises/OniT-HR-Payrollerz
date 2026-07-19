/**
 * Recurring journal templates — pure date and validation logic.
 * Firebase-free so it can be unit-tested directly and mirrored by the
 * Cloud Function scheduler (functions/src/accounting.ts) without drift.
 *
 * Date policy: `dayOfMonth` is sticky on the template (a "post on the 31st"
 * template posts on 28/29 Feb, then back on 31 Mar) — the clamp happens per
 * month, never permanently.
 */
import type { JournalEntryLine } from '@/types/accounting';

export const RECURRING_MAX_CATCH_UP = 3;

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function clampDayToMonth(year: number, month1to12: number, day: number): number {
  return Math.min(Math.max(1, Math.trunc(day)), daysInMonth(year, month1to12));
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * First run on/after `startFrom` that lands on the template's dayOfMonth
 * (clamped to the month). If startFrom's clamped day has already passed,
 * the first run is next month.
 */
export function firstRunDate(startFromISO: string, dayOfMonth: number): string {
  const [y, m, d] = startFromISO.split('-').map(Number);
  const thisMonthDay = clampDayToMonth(y, m, dayOfMonth);
  if (thisMonthDay >= d) return iso(y, m, thisMonthDay);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return iso(ny, nm, clampDayToMonth(ny, nm, dayOfMonth));
}

/** The run after `currentISO`, one calendar month later, day clamped. */
export function advanceMonthlyRunDate(currentISO: string, dayOfMonth: number): string {
  const [y, m] = currentISO.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return iso(ny, nm, clampDayToMonth(ny, nm, dayOfMonth));
}

export function templateIsDue(
  nextRunDate: string | undefined,
  todayISO: string,
  endDate?: string,
): boolean {
  if (!nextRunDate) return false;
  if (nextRunDate > todayISO) return false;
  if (endDate && nextRunDate > endDate) return false;
  return true;
}

export interface RecurringTemplateValidationInput {
  name: string;
  dayOfMonth: number;
  lines: Array<Pick<JournalEntryLine, 'accountId' | 'debit' | 'credit'>>;
}

/** Returns human-keyed error codes; empty array = valid. */
export function validateRecurringTemplate(input: RecurringTemplateValidationInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('nameRequired');
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    errors.push('dayOfMonthInvalid');
  }
  const lines = input.lines.filter((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0);
  if (lines.length < 2) errors.push('twoLinesRequired');
  if (lines.some((l) => (l.debit || 0) > 0 && (l.credit || 0) > 0)) errors.push('oneSidedLines');
  if (lines.some((l) => !l.accountId)) errors.push('accountRequired');
  const debit = Math.round(lines.reduce((s, l) => s + (l.debit || 0), 0) * 100);
  const credit = Math.round(lines.reduce((s, l) => s + (l.credit || 0), 0) * 100);
  if (debit !== credit) errors.push('unbalanced');
  if (debit === 0) errors.push('zeroAmount');
  return errors;
}
