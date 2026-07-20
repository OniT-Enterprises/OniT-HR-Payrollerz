/**
 * Settings → engine wiring: every tenant-editable number must actually reach
 * the calculation it claims to control, and the statutory fallbacks must hold
 * when no config is passed.
 *
 * Covers the Jul-2026 "inert settings" fixes:
 *  - night-shift premium (new PayrollConfig.overtimeRates.nightShiftPremium)
 *  - INSS-base toggles for food allowance / per diem
 *  - annual-leave carry-over + probation gating (functions/src/leave-logic.ts —
 *    the exact module the Cloud Functions execute)
 */
import { describe, expect, it } from 'vitest';
import {
  calculateOvertimePay,
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';
import {
  annualCarryOverPolicyFromConfig,
  computeAnnualCarryOver,
  firstTrackedAnnualYear,
  probationEligibleFromDate,
} from '../../functions/src/leave-logic';

// ─── Night-shift premium ────────────────────────────────────────────

describe('night-shift premium wiring', () => {
  it('defaults to the statutory +25% when no config is given', () => {
    const pay = calculateOvertimePay(10, 0, 8, 0, 0);
    expect(pay.nightShift).toBe(10 * 8 * 0.25);
  });

  it('honors a configured premium in the per-component path', () => {
    const pay = calculateOvertimePay(10, 0, 8, 0, 0, {
      standard: 1.5,
      sundayHoliday: 2,
      nightShiftPremium: 0.3,
    });
    expect(pay.nightShift).toBe(10 * 8 * 0.3);
  });

  it('honors a configured premium in the aggregate-rounding path', () => {
    const pay = calculateOvertimePay(10, 0, 8, 0, 0, {
      standard: 1.5,
      sundayHoliday: 2,
      nightShiftPremium: 0.5,
      rounding: 'aggregate',
    });
    expect(pay.nightShift).toBe(10 * 8 * 0.5);
  });
});

// ─── INSS-base toggles (food allowance / per diem) ──────────────────

const baseInput = (overrides: Partial<TLPayrollInput> = {}): TLPayrollInput => ({
  employeeId: 'emp-1',
  monthlySalary: 500,
  payFrequency: 'monthly',
  isHourly: false,
  regularHours: 176,
  overtimeHours: 0,
  nightShiftHours: 0,
  holidayHours: 0,
  restDayHours: 0,
  absenceHours: 0,
  lateArrivalMinutes: 0,
  sickDaysUsed: 0,
  ytdSickDaysUsed: 0,
  bonus: 0,
  bonusINSSCategory: null,
  commission: 0,
  perDiem: 0,
  foodAllowance: 0,
  transportAllowance: 0,
  otherEarnings: 0,
  nonCashBenefits: 0,
  nonCashBenefitINSSCategory: null,
  otherDeductions: [],
  taxInfo: { isResident: true, hasTaxExemption: false },
  ...overrides,
});

describe('INSS-base toggles', () => {
  it('excludes food allowance and per diem from the INSS base by default (DL 20/2017 Art. 9)', () => {
    const result = calculateTLPayroll(baseInput({ foodAllowance: 60, perDiem: 40 }));
    // 4% of salary only — allowances outside the base
    expect(result.inssEmployee).toBe(500 * 0.04);
  });

  it('includes food allowance in the base when the tenant opts it in', () => {
    const result = calculateTLPayroll(
      baseInput({ foodAllowance: 60 }),
      { inssBase: { excludeFoodAllowance: false, excludePerDiem: true } },
    );
    expect(result.inssEmployee).toBe(22.4); // (500 + 60) × 4%
  });

  it('includes per diem in the base when the tenant opts it in', () => {
    const result = calculateTLPayroll(
      baseInput({ perDiem: 40 }),
      { inssBase: { excludeFoodAllowance: true, excludePerDiem: false } },
    );
    expect(result.inssEmployee).toBe((500 + 40) * 0.04);
  });

  it('keeps both excluded when the toggles are explicitly on', () => {
    const result = calculateTLPayroll(
      baseInput({ foodAllowance: 60, perDiem: 40 }),
      { inssBase: { excludeFoodAllowance: true, excludePerDiem: true } },
    );
    expect(result.inssEmployee).toBe(500 * 0.04);
  });
});

// ─── Annual-leave carry-over (leave-logic, tested = running) ────────

const DEFAULT_POLICY = { allowed: true, maxDays: 6 };

describe('annualCarryOverPolicyFromConfig', () => {
  it('defaults to allowed with a 6-day cap when config is missing', () => {
    expect(annualCarryOverPolicyFromConfig(undefined)).toEqual(DEFAULT_POLICY);
  });

  it('reads the per-type cap and toggle', () => {
    const config = {
      timeOffPolicies: {
        annualLeave: { carryOverAllowed: false, maxCarryOverDays: 10 },
      },
    };
    expect(annualCarryOverPolicyFromConfig(config)).toEqual({ allowed: false, maxDays: 10 });
  });

  it('falls back to the top-level maxCarryOverDays when the per-type cap is absent', () => {
    const config = {
      timeOffPolicies: { annualLeave: {}, maxCarryOverDays: 4 },
    };
    expect(annualCarryOverPolicyFromConfig(config)).toEqual({ allowed: true, maxDays: 4 });
  });
});

describe('computeAnnualCarryOver', () => {
  const chain = (usage: Record<number, number>, targetYear: number, policy = DEFAULT_POLICY) =>
    computeAnnualCarryOver({
      targetYear,
      firstTrackedYear: Math.min(...Object.keys(usage).map(Number)),
      annualEntitlement: 12,
      committedInYear: (year) => usage[year] ?? 0,
      policy,
    });

  it('carries unused days into the next year, capped by the policy', () => {
    // 12 entitled − 3 used = 9 unused → capped at 6
    expect(chain({ 2025: 3 }, 2026)).toBe(6);
  });

  it('carries fewer days when most were used', () => {
    expect(chain({ 2025: 10 }, 2026)).toBe(2);
  });

  it('never carries a negative amount when over-consumed', () => {
    expect(chain({ 2025: 14 }, 2026)).toBe(0);
  });

  it('compounds across a multi-year chain but stays within the cap', () => {
    // 2024: 12 unused → carry 6. 2025: 12 + 6 − 16 = 2 → carry 2 into 2026.
    expect(chain({ 2024: 0, 2025: 16 }, 2026)).toBe(2);
  });

  it('returns 0 with no tracked history (never fabricates carry-over)', () => {
    expect(computeAnnualCarryOver({
      targetYear: 2026,
      firstTrackedYear: null,
      annualEntitlement: 12,
      committedInYear: () => 0,
      policy: DEFAULT_POLICY,
    })).toBe(0);
  });

  it('returns 0 when history starts in the target year itself', () => {
    expect(chain({ 2026: 2 }, 2026)).toBe(0);
  });

  it('returns 0 when the policy disallows carry-over or the cap is 0', () => {
    expect(chain({ 2025: 0 }, 2026, { allowed: false, maxDays: 6 })).toBe(0);
    expect(chain({ 2025: 0 }, 2026, { allowed: true, maxDays: 0 })).toBe(0);
  });

  it('keeps fractional days (half-day requests) to 2 decimals', () => {
    expect(chain({ 2025: 6.5 }, 2026)).toBe(5.5);
  });
});

describe('firstTrackedAnnualYear', () => {
  it('finds the earliest pending/approved annual request year', () => {
    expect(firstTrackedAnnualYear([
      { leaveType: 'annual', status: 'approved', startDate: '2025-03-02' },
      { leaveType: 'annual', status: 'pending', startDate: '2024-11-10' },
      { leaveType: 'sick', status: 'approved', startDate: '2023-01-05' },
      { leaveType: 'annual', status: 'rejected', startDate: '2022-01-05' },
    ])).toBe(2024);
  });

  it('returns null when there is no qualifying history', () => {
    expect(firstTrackedAnnualYear([
      { leaveType: 'sick', status: 'approved', startDate: '2025-01-05' },
    ])).toBeNull();
  });
});

// ─── Probation gate ─────────────────────────────────────────────────

describe('probationEligibleFromDate', () => {
  it('adds the probation months to the hire date', () => {
    expect(probationEligibleFromDate('2026-02-10', 3)).toBe('2026-05-10');
  });

  it('clamps to the last day of a short target month', () => {
    expect(probationEligibleFromDate('2025-11-30', 3)).toBe('2026-02-28');
  });

  it('crosses year boundaries', () => {
    expect(probationEligibleFromDate('2026-10-15', 6)).toBe('2027-04-15');
  });

  it('returns null when probation is 0 or the hire date is missing/invalid', () => {
    expect(probationEligibleFromDate('2026-02-10', 0)).toBeNull();
    expect(probationEligibleFromDate(undefined, 3)).toBeNull();
    expect(probationEligibleFromDate('not-a-date', 3)).toBeNull();
    expect(probationEligibleFromDate('2026-02-30', 3)).toBeNull();
  });
});
