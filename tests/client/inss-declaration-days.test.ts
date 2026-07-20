import { describe, expect, it } from 'vitest';
import {
  INSS_FULL_MONTH_CONTRACT_DAYS,
  calculateContractDaysInMonth,
  calculateParentalLeaveDaysInMonth,
  calculateUnjustifiedAbsenceDays,
  deriveAbsenceHoursFromDeduction,
} from '@/lib/tax/inss-declaration-days';

/**
 * DL 20/2017 Art. 12: the DR declares remuneration together with the DAYS it
 * covers — 30 only when the contract covers the whole month, otherwise the
 * actual days the contract ran inside the month.
 */
describe('INSS DR contract days (DL 20/2017 Art. 12)', () => {
  it('declares 30 for a contract covering the whole month', () => {
    expect(calculateContractDaysInMonth('2026-06', '2025-01-15')).toBe(30);
  });

  it('declares 30 for a full February despite 28 calendar days (SS convention)', () => {
    expect(calculateContractDaysInMonth('2026-02', '2020-05-01')).toBe(30);
  });

  it('declares 30 for a full 31-day month, not 31', () => {
    expect(calculateContractDaysInMonth('2026-07', '2020-05-01')).toBe(30);
  });

  it('prorates a mid-month hire to the days actually under contract', () => {
    // Hired 15 June → 15..30 June inclusive = 16 days.
    expect(calculateContractDaysInMonth('2026-06', '2026-06-15')).toBe(16);
  });

  it('prorates a mid-month termination', () => {
    // Terminated 10 June → 1..10 June inclusive = 10 days.
    expect(calculateContractDaysInMonth('2026-06', '2024-01-01', '2026-06-10')).toBe(10);
  });

  it('handles hire and termination inside the same month', () => {
    // 5..20 June inclusive = 16 days.
    expect(calculateContractDaysInMonth('2026-06', '2026-06-05', '2026-06-20')).toBe(16);
  });

  it('returns 0 when the contract does not touch the month', () => {
    expect(calculateContractDaysInMonth('2026-06', '2026-07-01')).toBe(0);
    expect(calculateContractDaysInMonth('2026-06', '2024-01-01', '2026-05-31')).toBe(0);
  });

  it('hire on the 1st with termination on the last day is a full month (30)', () => {
    expect(calculateContractDaysInMonth('2026-06', '2026-06-01', '2026-06-30')).toBe(30);
  });

  it('treats a missing/invalid hire date as hired before the month (full 30)', () => {
    // A worker with a paid record but no parseable hire date must not silently
    // drop to 0 declared days — that would misdeclare a real contribution.
    expect(calculateContractDaysInMonth('2026-06', undefined)).toBe(30);
    expect(calculateContractDaysInMonth('2026-06', 'not-a-date')).toBe(30);
  });

  it('ignores an invalid termination date', () => {
    expect(calculateContractDaysInMonth('2026-06', '2024-01-01', '2026-13-99')).toBe(30);
  });

  it('rejects a malformed period', () => {
    expect(() => calculateContractDaysInMonth('2026/06', '2024-01-01')).toThrow(RangeError);
    expect(() => calculateContractDaysInMonth('2026-13', '2024-01-01')).toThrow(RangeError);
  });
});

describe('INSS DR unjustified-absence days', () => {
  it('recovers hours from the persisted absence deduction (amount / hourlyRate)', () => {
    // $2.50/h × 16h absence → $40 deduction.
    expect(deriveAbsenceHoursFromDeduction(40, 2.5)).toBeCloseTo(16, 6);
  });

  it('returns 0 hours when the rate or amount is missing/non-positive', () => {
    expect(deriveAbsenceHoursFromDeduction(40, 0)).toBe(0);
    expect(deriveAbsenceHoursFromDeduction(40, undefined)).toBe(0);
    expect(deriveAbsenceHoursFromDeduction(0, 2.5)).toBe(0);
    expect(deriveAbsenceHoursFromDeduction(undefined, 2.5)).toBe(0);
    expect(deriveAbsenceHoursFromDeduction(-5, 2.5)).toBe(0);
  });

  it('converts hours to whole declared days at 8h/day', () => {
    expect(calculateUnjustifiedAbsenceDays(16)).toBe(2);
    expect(calculateUnjustifiedAbsenceDays(0)).toBe(0);
    // 4h rounds to 1 day (nearest); 3h rounds to 0.
    expect(calculateUnjustifiedAbsenceDays(4)).toBe(1);
    expect(calculateUnjustifiedAbsenceDays(3)).toBe(0);
  });

  it('never declares more absence days than contract days', () => {
    expect(calculateUnjustifiedAbsenceDays(400, 30)).toBe(30);
    expect(calculateUnjustifiedAbsenceDays(80, 5)).toBe(5);
  });
});

describe('INSS DR parental-leave days', () => {
  it('counts approved leave days falling inside the month', () => {
    expect(
      calculateParentalLeaveDaysInMonth('2026-06', [
        { startDate: '2026-06-10', endDate: '2026-06-14' },
      ]),
    ).toBe(5);
  });

  it('clips leave spanning month boundaries to the month', () => {
    // 20 May – 10 June → 1..10 June inside the DR month.
    expect(
      calculateParentalLeaveDaysInMonth('2026-06', [
        { startDate: '2026-05-20', endDate: '2026-06-10' },
      ]),
    ).toBe(10);
  });

  it('merges overlapping requests so a day is never counted twice', () => {
    expect(
      calculateParentalLeaveDaysInMonth('2026-06', [
        { startDate: '2026-06-01', endDate: '2026-06-10' },
        { startDate: '2026-06-08', endDate: '2026-06-15' },
      ]),
    ).toBe(15);
  });

  it('caps a whole-month leave at 30 even in a 31-day month', () => {
    expect(
      calculateParentalLeaveDaysInMonth('2026-07', [
        { startDate: '2026-06-01', endDate: '2026-09-30' },
      ]),
    ).toBe(INSS_FULL_MONTH_CONTRACT_DAYS);
  });

  it('ignores leave entirely outside the month and invalid ranges', () => {
    expect(
      calculateParentalLeaveDaysInMonth('2026-06', [
        { startDate: '2026-07-01', endDate: '2026-07-14' },
        { startDate: '2026-06-10', endDate: '2026-06-01' }, // inverted
        { startDate: 'bad', endDate: '2026-06-10' },
      ]),
    ).toBe(0);
  });

  it('returns 0 with no leaves', () => {
    expect(calculateParentalLeaveDaysInMonth('2026-06', [])).toBe(0);
  });
});
