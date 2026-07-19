/**
 * Fixed-asset depreciation schedule math (client/lib/accounting/depreciation.ts).
 * Policy under test: straight-line, full-month convention, cent-exact final
 * period, catch-up posting, disposal gain/loss.
 */
import { describe, it, expect } from 'vitest';
import {
  addPeriods,
  buildSchedule,
  chargeDueThroughPeriod,
  chargeForScheduleIndex,
  depreciableAmount,
  disposalResult,
  monthlyCharge,
  periodsBetween,
} from '@/lib/accounting/depreciation';

const espresso = {
  acquisitionCost: 3200,
  residualValue: 200,
  usefulLifeMonths: 60,
  depreciationStartPeriod: '2026-07',
};

describe('period helpers', () => {
  it('adds periods across year ends', () => {
    expect(addPeriods('2026-11', 3)).toBe('2027-02');
    expect(addPeriods('2026-01', 0)).toBe('2026-01');
  });
  it('counts inclusive months', () => {
    expect(periodsBetween('2026-07', '2026-07')).toBe(1);
    expect(periodsBetween('2026-07', '2027-06')).toBe(12);
    expect(periodsBetween('2026-07', '2026-06')).toBe(0);
  });
});

describe('straight-line math', () => {
  it('computes depreciable amount and monthly charge', () => {
    expect(depreciableAmount(espresso)).toBe(3000);
    expect(monthlyCharge(espresso)).toBe(50);
  });

  it('true-ups the final period so the total is cent-exact', () => {
    const awkward = {
      acquisitionCost: 1000,
      residualValue: 0,
      usefulLifeMonths: 36, // 27.777… → 27.78 rounded
      depreciationStartPeriod: '2026-01',
    };
    const standard = monthlyCharge(awkward);
    expect(standard).toBe(27.78);
    const last = chargeForScheduleIndex(awkward, 36);
    // 35 × 27.78 = 972.30 → last = 27.70
    expect(last).toBe(27.7);
    const schedule = buildSchedule(awkward);
    expect(schedule).toHaveLength(36);
    expect(schedule[35].accumulated).toBe(1000);
    expect(schedule[35].netBookValue).toBe(0);
  });

  it('never depreciates land (life 0)', () => {
    const land = { acquisitionCost: 50000, residualValue: 0, usefulLifeMonths: 0, depreciationStartPeriod: '2026-01' };
    expect(monthlyCharge(land)).toBe(0);
    expect(buildSchedule(land)).toEqual([]);
  });
});

describe('chargeDueThroughPeriod (catch-up + idempotency window)', () => {
  const base = { ...espresso, status: 'active' as const };

  it('charges one month when up to date', () => {
    const due = chargeDueThroughPeriod(
      { ...base, depreciatedThroughPeriod: '2026-08' },
      '2026-09',
    );
    expect(due).toEqual({ charge: 50, fromIndex: 3, toIndex: 3 });
  });

  it('catches up multiple missed months', () => {
    const due = chargeDueThroughPeriod({ ...base }, '2026-10');
    expect(due).toEqual({ charge: 200, fromIndex: 1, toIndex: 4 });
  });

  it('returns nothing before the start period, when current, or after life ends', () => {
    expect(chargeDueThroughPeriod({ ...base }, '2026-06').charge).toBe(0);
    expect(
      chargeDueThroughPeriod({ ...base, depreciatedThroughPeriod: '2026-09' }, '2026-09').charge,
    ).toBe(0);
    const finished = { ...base, depreciatedThroughPeriod: addPeriods('2026-07', 59) };
    expect(chargeDueThroughPeriod(finished, addPeriods('2026-07', 70)).charge).toBe(0);
  });

  it('caps the final catch-up at the depreciable total', () => {
    const due = chargeDueThroughPeriod({ ...base }, addPeriods('2026-07', 100));
    expect(due.charge).toBe(3000);
    expect(due.toIndex).toBe(60);
  });

  it('never charges disposed assets', () => {
    expect(chargeDueThroughPeriod({ ...base, status: 'disposed' }, '2026-12').charge).toBe(0);
  });
});

describe('disposal', () => {
  it('computes gain when proceeds beat net book value', () => {
    const result = disposalResult({ acquisitionCost: 3200, accumulatedDepreciation: 3000 }, 350);
    expect(result).toEqual({ netBookValue: 200, gainOrLoss: 150 });
  });
  it('computes loss when proceeds fall short', () => {
    const result = disposalResult({ acquisitionCost: 3200, accumulatedDepreciation: 1000 }, 1500);
    expect(result).toEqual({ netBookValue: 2200, gainOrLoss: -700 });
  });
  it('handles scrapping (zero proceeds)', () => {
    const result = disposalResult({ acquisitionCost: 800, accumulatedDepreciation: 800 }, 0);
    expect(result).toEqual({ netBookValue: 0, gainOrLoss: 0 });
  });
});
