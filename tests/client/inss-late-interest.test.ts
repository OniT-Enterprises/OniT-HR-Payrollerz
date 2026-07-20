import { describe, expect, it } from 'vitest';
import {
  INSS_LATE_INTEREST_RATE_PER_MONTH,
  calculateInssLateInterest,
  monthsOrFractionLate,
} from '@/lib/tax/inss-late-interest';

/**
 * DL 20/2017 Art. 39: late INSS payment accrues 1% of the amount owed per
 * month OR FRACTION of a month of delay.
 */
describe('INSS juros de mora (DL 20/2017 Art. 39)', () => {
  it('exposes the statutory 1%/month rate', () => {
    expect(INSS_LATE_INTEREST_RATE_PER_MONTH).toBe(0.01);
  });

  it('counts a single day late as one full month (fraction rule)', () => {
    expect(monthsOrFractionLate('2026-06-22', '2026-06-23')).toBe(1);
  });

  it('is 0 on or before the due date', () => {
    expect(monthsOrFractionLate('2026-06-22', '2026-06-22')).toBe(0);
    expect(monthsOrFractionLate('2026-06-22', '2026-06-01')).toBe(0);
  });

  it('rolls to the next month only after a full month has elapsed', () => {
    expect(monthsOrFractionLate('2026-06-22', '2026-07-22')).toBe(1);
    expect(monthsOrFractionLate('2026-06-22', '2026-07-23')).toBe(2);
  });

  it('counts months across year boundaries', () => {
    expect(monthsOrFractionLate('2026-11-20', '2027-01-21')).toBe(3);
  });

  it('handles month-end due dates without skipping (31st vs shorter months)', () => {
    // Due 31 Jan; 28 Feb is exactly one month later (clamped), 1 Mar starts month 2.
    expect(monthsOrFractionLate('2026-01-31', '2026-02-28')).toBe(1);
    expect(monthsOrFractionLate('2026-01-31', '2026-03-01')).toBe(2);
  });

  it('estimates interest = base × 1% × months', () => {
    const estimate = calculateInssLateInterest('2026-06-22', '2026-08-01', 1500);
    expect(estimate).not.toBeNull();
    expect(estimate!.monthsLate).toBe(2);
    expect(estimate!.estimatedInterest).toBe(30); // 1500 × 1% × 2
    expect(estimate!.legalBasis).toBe('DL 20/2017 Art. 39');
  });

  it('returns the note without an amount when the base is unknown', () => {
    const estimate = calculateInssLateInterest('2026-06-22', '2026-07-01');
    expect(estimate).not.toBeNull();
    expect(estimate!.monthsLate).toBe(1);
    expect(estimate!.estimatedInterest).toBeUndefined();
  });

  it('returns null when not past due', () => {
    expect(calculateInssLateInterest('2026-06-22', '2026-06-22', 1000)).toBeNull();
  });

  it('rejects malformed dates', () => {
    expect(() => monthsOrFractionLate('22-06-2026', '2026-06-23')).toThrow(RangeError);
  });
});
