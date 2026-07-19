/**
 * Recurring journal templates — pure date & validation logic
 * (client/lib/accounting/recurring.ts, mirrored by the CF scheduler).
 */
import { describe, it, expect } from 'vitest';
import {
  advanceMonthlyRunDate,
  clampDayToMonth,
  daysInMonth,
  firstRunDate,
  templateIsDue,
  validateRecurringTemplate,
} from '@/lib/accounting/recurring';

describe('recurring run-date math', () => {
  it('advances one month keeping the day', () => {
    expect(advanceMonthlyRunDate('2026-03-15', 15)).toBe('2026-04-15');
  });

  it('clamps a day-31 template in short months and springs back', () => {
    expect(advanceMonthlyRunDate('2026-01-31', 31)).toBe('2026-02-28');
    // sticky dayOfMonth: after the clamped Feb posting, March returns to 31
    expect(advanceMonthlyRunDate('2026-02-28', 31)).toBe('2026-03-31');
  });

  it('handles leap February', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(advanceMonthlyRunDate('2028-01-30', 30)).toBe('2028-02-29');
  });

  it('rolls December into January of the next year', () => {
    expect(advanceMonthlyRunDate('2026-12-05', 5)).toBe('2027-01-05');
  });

  it('clampDayToMonth bounds the day into [1, days-in-month]', () => {
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);
    expect(clampDayToMonth(2026, 2, 0)).toBe(1);
    expect(clampDayToMonth(2026, 7, 12)).toBe(12);
  });
});

describe('firstRunDate', () => {
  it('runs this month when the day is still ahead', () => {
    expect(firstRunDate('2026-07-10', 25)).toBe('2026-07-25');
  });

  it('runs today when the day is today', () => {
    expect(firstRunDate('2026-07-25', 25)).toBe('2026-07-25');
  });

  it('rolls to next month when the day has passed', () => {
    expect(firstRunDate('2026-07-26', 25)).toBe('2026-08-25');
  });

  it('clamps within the starting month', () => {
    expect(firstRunDate('2026-02-10', 31)).toBe('2026-02-28');
  });
});

describe('templateIsDue', () => {
  it('is due when nextRunDate has arrived and not past endDate', () => {
    expect(templateIsDue('2026-07-01', '2026-07-19')).toBe(true);
    expect(templateIsDue('2026-07-19', '2026-07-19')).toBe(true);
  });

  it('is not due before nextRunDate, without one, or past endDate', () => {
    expect(templateIsDue('2026-08-01', '2026-07-19')).toBe(false);
    expect(templateIsDue(undefined, '2026-07-19')).toBe(false);
    expect(templateIsDue('2026-07-01', '2026-07-19', '2026-06-30')).toBe(false);
  });
});

describe('validateRecurringTemplate', () => {
  const line = (accountId: string, debit: number, credit: number) => ({ accountId, debit, credit });

  it('accepts a balanced two-line template', () => {
    expect(
      validateRecurringTemplate({
        name: 'Rent accrual',
        dayOfMonth: 1,
        lines: [line('a', 650, 0), line('b', 0, 650)],
      }),
    ).toEqual([]);
  });

  it('rejects unbalanced, empty-name, bad-day and two-sided lines', () => {
    expect(
      validateRecurringTemplate({ name: '', dayOfMonth: 0, lines: [line('a', 100, 0)] }),
    ).toEqual(expect.arrayContaining(['nameRequired', 'dayOfMonthInvalid', 'twoLinesRequired', 'unbalanced']));
    expect(
      validateRecurringTemplate({
        name: 'x',
        dayOfMonth: 5,
        lines: [line('a', 100, 50), line('b', 0, 50)],
      }),
    ).toContain('oneSidedLines');
    expect(
      validateRecurringTemplate({
        name: 'x',
        dayOfMonth: 5,
        lines: [line('', 100, 0), line('b', 0, 100)],
      }),
    ).toContain('accountRequired');
  });

  it('is cent-exact on balance comparison', () => {
    expect(
      validateRecurringTemplate({
        name: 'x',
        dayOfMonth: 5,
        lines: [line('a', 0.1, 0), line('b', 0.2, 0), line('c', 0, 0.3)],
      }),
    ).toEqual([]);
  });
});
