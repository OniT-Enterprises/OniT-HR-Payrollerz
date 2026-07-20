import { describe, expect, it } from 'vitest';
import {
  ageAt,
  isMinor,
  isUnderMinimumWorkingAge,
  isLightWorkOnlyAge,
  MINIMUM_WORKING_AGE,
  MINOR_AGE_LIMIT,
  LIGHT_WORK_MAX_HOURS_PER_DAY,
  LIGHT_WORK_MAX_HOURS_PER_WEEK,
} from '@/lib/payroll/minors';

/**
 * Lei 4/2012 (TL Labour Code) — minors at work.
 * Art. 68: minimum working age 15. Art. 5(h): minor = under 17.
 * Art. 69: light work only for 15-16 (5h/day, 25h/week, no night/OT).
 */

describe('ageAt', () => {
  it('computes whole-year age at a reference date', () => {
    expect(ageAt('2000-06-15', '2026-06-15')).toBe(26); // birthday itself counts
    expect(ageAt('2000-06-15', '2026-06-14')).toBe(25); // day before birthday
    expect(ageAt('2000-06-15', '2026-06-16')).toBe(26);
  });

  it('handles month boundaries correctly', () => {
    expect(ageAt('2010-12-31', '2026-01-01')).toBe(15);
    expect(ageAt('2010-01-01', '2026-12-31')).toBe(16);
  });

  it('accepts Date objects as well as ISO strings', () => {
    expect(ageAt(new Date(Date.UTC(2008, 2, 10, 12)), '2026-03-10')).toBe(18);
  });

  it('returns null for missing or unparseable input', () => {
    expect(ageAt('', '2026-01-01')).toBeNull();
    expect(ageAt(undefined, '2026-01-01')).toBeNull();
    expect(ageAt(null, '2026-01-01')).toBeNull();
    expect(ageAt('not-a-date', '2026-01-01')).toBeNull();
  });

  it('returns null when DOB is after the reference date (bad data)', () => {
    expect(ageAt('2030-01-01', '2026-01-01')).toBeNull();
  });
});

describe('isUnderMinimumWorkingAge (Art. 68)', () => {
  it('is true under 15 at the hire date', () => {
    expect(isUnderMinimumWorkingAge('2012-01-02', '2026-07-20')).toBe(true); // 14
  });

  it('is false at exactly 15', () => {
    expect(isUnderMinimumWorkingAge('2011-07-20', '2026-07-20')).toBe(false); // 15 today
  });

  it('never flags without data', () => {
    expect(isUnderMinimumWorkingAge('', '2026-07-20')).toBe(false);
    expect(isUnderMinimumWorkingAge(undefined, '2026-07-20')).toBe(false);
  });
});

describe('isMinor (Art. 5(h): under 17)', () => {
  it('is true for 15 and 16 year olds', () => {
    expect(isMinor('2011-01-01', '2026-07-20')).toBe(true); // 15
    expect(isMinor('2010-01-01', '2026-07-20')).toBe(true); // 16
  });

  it('is false at 17', () => {
    expect(isMinor('2009-07-20', '2026-07-20')).toBe(false); // 17 today
    expect(isMinor('2000-01-01', '2026-07-20')).toBe(false);
  });

  it('never flags without data', () => {
    expect(isMinor('', '2026-07-20')).toBe(false);
  });
});

describe('isLightWorkOnlyAge (Art. 69: 15-16)', () => {
  it('is true only for the 15-16 band', () => {
    expect(isLightWorkOnlyAge('2012-01-01', '2026-07-20')).toBe(false); // 14 — not employable at all
    expect(isLightWorkOnlyAge('2011-01-01', '2026-07-20')).toBe(true);  // 15
    expect(isLightWorkOnlyAge('2010-01-01', '2026-07-20')).toBe(true);  // 16
    expect(isLightWorkOnlyAge('2009-01-01', '2026-07-20')).toBe(false); // 17
  });
});

describe('statutory constants', () => {
  it('pins the Lei 4/2012 values', () => {
    expect(MINIMUM_WORKING_AGE).toBe(15); // Art. 68
    expect(MINOR_AGE_LIMIT).toBe(17); // Art. 5(h)
    expect(LIGHT_WORK_MAX_HOURS_PER_DAY).toBe(5); // Art. 69
    expect(LIGHT_WORK_MAX_HOURS_PER_WEEK).toBe(25); // Art. 69
  });
});
