import { describe, expect, it } from 'vitest';
import {
  addDaysToISODate,
  addMonthsToISODate,
  appendContractRenewal,
  contractSpanExceedsFixedTermLimit,
  deriveProbationEndDate,
  FIXED_TERM_MOTIVES,
  type ContractRenewalEntry,
} from '@/lib/probation';

/**
 * Lei 4/2012 contract-lifecycle helpers:
 * - Art. 12(1)-(2): fixed-term motives (missing motive => deemed permanent)
 * - Art. 13: renewal history
 * - Arts. 12(4)/13: 3-year fixed-term ceiling (dated span)
 * - Art. 14: probation end dates
 */

describe('addDaysToISODate', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDaysToISODate('2026-01-01', 30)).toBe('2026-01-31');
    expect(addDaysToISODate('2026-12-25', 10)).toBe('2027-01-04');
  });

  it('returns "" on unparseable input', () => {
    expect(addDaysToISODate('', 10)).toBe('');
    expect(addDaysToISODate('nope', 10)).toBe('');
  });
});

describe('addMonthsToISODate', () => {
  it('adds calendar months', () => {
    expect(addMonthsToISODate('2026-02-01', 6)).toBe('2026-08-01');
    expect(addMonthsToISODate('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('clamps day overflow to the last day of the target month', () => {
    expect(addMonthsToISODate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToISODate('2024-01-31', 1)).toBe('2024-02-29'); // leap year
    expect(addMonthsToISODate('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('returns "" on unparseable input', () => {
    expect(addMonthsToISODate('', 6)).toBe('');
  });
});

describe('deriveProbationEndDate (Art. 14)', () => {
  it('fixed-term <= 6 months -> start + 8 days', () => {
    expect(
      deriveProbationEndDate('2026-08-01', {
        contractType: 'Fixed-Term',
        contractDurationMonths: 6,
      }),
    ).toBe('2026-08-09');
  });

  it('fixed-term > 6 months -> start + 15 days', () => {
    expect(
      deriveProbationEndDate('2026-08-01', {
        contractType: 'Fixed-Term',
        contractDurationMonths: 12,
      }),
    ).toBe('2026-08-16');
  });

  it('permanent -> start + 30 days (default) or + 90 days (extended)', () => {
    expect(deriveProbationEndDate('2026-08-01', { contractType: 'Permanent' })).toBe('2026-08-31');
    expect(
      deriveProbationEndDate('2026-08-01', {
        contractType: 'Permanent',
        permanentProbation: '90_days',
      }),
    ).toBe('2026-10-30');
  });

  it('returns "" without a start date', () => {
    expect(deriveProbationEndDate('', { contractType: 'Permanent' })).toBe('');
  });
});

describe('appendContractRenewal (Art. 13)', () => {
  const changedAt = '2026-07-20T10:00:00.000Z';

  it('appends when the end date moves forward', () => {
    const result = appendContractRenewal(undefined, '2026-12-31', '2027-12-31', changedAt);
    expect(result).toEqual([
      { from: '2026-12-31', to: '2027-12-31', changedAt },
    ]);
  });

  it('appends to existing history without mutating it', () => {
    const existing: ContractRenewalEntry[] = [
      { from: '2025-12-31', to: '2026-12-31', changedAt: '2025-12-01T00:00:00.000Z' },
    ];
    const result = appendContractRenewal(existing, '2026-12-31', '2027-06-30', changedAt, 'hr@example.com');
    expect(result).toHaveLength(2);
    expect(result?.[1]).toEqual({
      from: '2026-12-31',
      to: '2027-06-30',
      changedAt,
      changedBy: 'hr@example.com',
    });
    expect(existing).toHaveLength(1); // untouched
  });

  it('returns null when not a renewal', () => {
    // first-time set (no previous end date)
    expect(appendContractRenewal(undefined, '', '2027-12-31', changedAt)).toBeNull();
    expect(appendContractRenewal(undefined, undefined, '2027-12-31', changedAt)).toBeNull();
    // cleared
    expect(appendContractRenewal(undefined, '2026-12-31', '', changedAt)).toBeNull();
    // unchanged
    expect(appendContractRenewal(undefined, '2026-12-31', '2026-12-31', changedAt)).toBeNull();
    // moved backward
    expect(appendContractRenewal(undefined, '2026-12-31', '2026-06-30', changedAt)).toBeNull();
  });
});

describe('contractSpanExceedsFixedTermLimit (Arts. 12(4)/13)', () => {
  it('flags a dated span over 3 years even if the end date is in the future', () => {
    expect(contractSpanExceedsFixedTermLimit('2026-01-01', '2029-06-01')).toBe(true);
  });

  it('does not flag spans under the 3-year (1095-day) ceiling', () => {
    // 2026-01-01 -> 2028-12-30 is 1094 days (2028 is a leap year)
    expect(contractSpanExceedsFixedTermLimit('2026-01-01', '2028-12-30')).toBe(false);
    expect(contractSpanExceedsFixedTermLimit('2026-01-01', '2026-12-31')).toBe(false);
  });

  it('never flags without both dates', () => {
    expect(contractSpanExceedsFixedTermLimit(undefined, '2029-01-01')).toBe(false);
    expect(contractSpanExceedsFixedTermLimit('2026-01-01', undefined)).toBe(false);
    expect(contractSpanExceedsFixedTermLimit('2026-01-01', 'nope')).toBe(false);
  });
});

describe('FIXED_TERM_MOTIVES (Art. 12(1))', () => {
  it('ships the statutory lettered motives plus temporary-need catch-alls', () => {
    const values = FIXED_TERM_MOTIVES.map((m) => m.value);
    expect(values).toEqual([
      'substitution_absent_worker', // Art. 12(1)(a)
      'seasonal_activity', // Art. 12(1)(b)
      'specific_project', // Art. 12(1)(c)
      'activity_increase', // "nomeadamente" — non-exhaustive list
      'other_temporary_need',
    ]);
    // every entry carries a label and an article reference for the UI
    for (const motive of FIXED_TERM_MOTIVES) {
      expect(motive.label.length).toBeGreaterThan(0);
      expect(motive.article).toContain('Art. 12');
    }
  });
});
