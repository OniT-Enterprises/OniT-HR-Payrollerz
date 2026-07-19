import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  validateTLPayrollInput,
  type TLPayrollCalculationConfig,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';

/**
 * Real-life scenario: a security guard ("Domingos Sarmento") works 12-hour
 * night shifts. His run carries regular hours plus overtime, plus a block of
 * hours worked at night (21:00-06:00), plus some public-holiday and rest-day
 * cover.
 *
 * TL legal rules asserted here:
 *  - Night work adds a +25% premium ON TOP of base pay for those hours
 *    (Labour Law 4/2012 night-work premium). Night hours are a subset of hours
 *    already covered by base salary, so payroll pays only the 0.25x premium.
 *  - Standard overtime is 1.5x (Art. 27).
 *  - Rest-day and public-holiday work is 2.0x (Art. 27).
 *  - Night hours must NOT cannibalise regular or overtime pay - each premium
 *    line is additive and independent.
 *  - Overtime cap: max 4h/day and 16h/week (TL_WORKING_HOURS), which the engine
 *    enforces as a per-month aggregate (16 * 4 = 64h) in validateTLPayrollInput.
 *
 * All names/numbers are synthetic. A $380/month salary with the accounting
 * ROUNDUP(salary / 190, 2) hourly convention yields an exact $2.00/hour rate,
 * so every expected figure below is exact (no rounding tolerance needed, but we
 * still allow <= $0.02 per the brief).
 */

const HOURLY_CONFIG: TLPayrollCalculationConfig = {
  // 380 / 190 = 2.00 exactly -> hourlyRate = $2.00
  hourlyRate: { monthlyHoursDivisor: 190, rounding: 'up' },
};

const HOURLY_RATE = 2.0;
const MONEY_TOLERANCE = 0.02;

function guardInput(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: 'guard-domingos-sarmento',
    monthlySalary: 380,
    payFrequency: 'monthly',
    isHourly: false,
    hourlyRate: undefined,
    regularHours: 190,
    overtimeHours: 10,
    nightShiftHours: 60,
    holidayHours: 8,
    restDayHours: 8,
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
    subsidioAnual: 0,
    nonCashBenefits: 0,
    nonCashBenefitINSSCategory: null,
    taxInfo: { isResident: true, hasTaxExemption: false, inssExempt: false },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: 0,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 12,
    hireDate: '2015-01-01',
    ...overrides,
  };
}

describe('rl-night-overtime: guard night differential + overtime caps', () => {
  it('pays night hours as a +25% premium on top of base pay', () => {
    const r = calculateTLPayroll(guardInput(), HOURLY_CONFIG);
    // Law: nightShiftHours x hourlyRate x 0.25 = 60 x 2.00 x 0.25 = 30.00
    expect(r.nightShiftPay).toBeCloseTo(60 * HOURLY_RATE * 0.25, 2);
    expect(r.nightShiftPay).toBeCloseTo(30.0, 2);
  });

  it('pays standard overtime at 1.5x', () => {
    const r = calculateTLPayroll(guardInput(), HOURLY_CONFIG);
    // Law: overtimeHours x hourlyRate x 1.5 = 10 x 2.00 x 1.5 = 30.00
    expect(r.overtimePay).toBeCloseTo(10 * HOURLY_RATE * 1.5, 2);
    expect(r.overtimePay).toBeCloseTo(30.0, 2);
  });

  it('pays rest-day and public-holiday work at 2.0x', () => {
    const r = calculateTLPayroll(guardInput(), HOURLY_CONFIG);
    // Law: hours x hourlyRate x 2.0
    expect(r.holidayPay).toBeCloseTo(8 * HOURLY_RATE * 2.0, 2);
    expect(r.holidayPay).toBeCloseTo(32.0, 2);
    expect(r.restDayPay).toBeCloseTo(8 * HOURLY_RATE * 2.0, 2);
    expect(r.restDayPay).toBeCloseTo(32.0, 2);
  });

  it('does NOT let night hours reduce regular or overtime pay', () => {
    const withNight = calculateTLPayroll(guardInput({ nightShiftHours: 60 }), HOURLY_CONFIG);
    const withoutNight = calculateTLPayroll(guardInput({ nightShiftHours: 0 }), HOURLY_CONFIG);

    // Regular pay for a salaried worker is salary / periods, independent of hours.
    expect(withNight.regularPay).toBeCloseTo(380.0, 2);
    expect(withNight.regularPay).toBeCloseTo(withoutNight.regularPay, 2);

    // Overtime depends only on overtimeHours, never reduced by night hours.
    expect(withNight.overtimePay).toBeCloseTo(withoutNight.overtimePay, 2);
    expect(withNight.overtimePay).toBeCloseTo(30.0, 2);

    // The only difference between the two runs is the night premium itself.
    expect(withNight.nightShiftPay).toBeCloseTo(30.0, 2);
    expect(withoutNight.nightShiftPay).toBeCloseTo(0, 2);
    const grossDelta = withNight.grossPay - withoutNight.grossPay;
    expect(grossDelta).toBeCloseTo(30.0, 2);
  });

  it('adds each premium line additively into gross pay', () => {
    const r = calculateTLPayroll(guardInput(), HOURLY_CONFIG);
    // 380 base + 30 OT + 30 night + 32 holiday + 32 rest-day = 504.00
    const expectedGross =
      r.regularPay + r.overtimePay + r.nightShiftPay + r.holidayPay + r.restDayPay;
    expect(r.grossPay).toBeCloseTo(expectedGross, 2);
    expect(r.grossPay).toBeCloseTo(504.0, 2);
    expect(Math.abs(r.grossPay - 504.0)).toBeLessThanOrEqual(MONEY_TOLERANCE);
  });

  it('accepts overtime within the monthly cap and rejects overtime above it', () => {
    // Cap = maxOvertimePerWeek (16) * 4 = 64h/month. 10h is well within it.
    expect(validateTLPayrollInput(guardInput({ overtimeHours: 10 }), HOURLY_CONFIG))
      .toEqual([]);

    const errors = validateTLPayrollInput(
      guardInput({ overtimeHours: 70 }),
      HOURLY_CONFIG,
    );
    expect(errors.some((e) => /exceed maximum allowed per month/i.test(e))).toBe(true);
  });
});
