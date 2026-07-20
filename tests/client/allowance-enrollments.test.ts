/**
 * Allowances register → payroll run wiring (allowance-enrollments.ts) plus
 * the engine's treatment of the mapped inputs. Pins the statutory
 * classification: expense allowances are WIT-taxable but INSS-excluded
 * (DL 20/2017 Art. 9), while hardship-style recurring supplements are
 * contributable (Art. 8).
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateAllowanceInputs,
  perPeriodAllowances,
  type BenefitEnrollmentLike,
} from '@/lib/payroll/allowance-enrollments';
import {
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';

const PERIOD = { periodStart: '2026-07-01', periodEnd: '2026-07-31' };

const enrollment = (
  overrides: Partial<BenefitEnrollmentLike>,
): BenefitEnrollmentLike => ({
  employeeId: 'emp-1',
  benefitType: 'transport',
  employerContribution: 20,
  effectiveDate: '2026-01-01',
  status: 'active',
  ...overrides,
});

describe('aggregateAllowanceInputs', () => {
  it('maps each allowance type to its statutory engine slot', () => {
    const inputs = aggregateAllowanceInputs(
      [
        enrollment({ benefitType: 'meal', employerContribution: 30 }),
        enrollment({ benefitType: 'transport', employerContribution: 20 }),
        enrollment({ benefitType: 'fuel', employerContribution: 15 }),
        enrollment({ benefitType: 'housing', employerContribution: 50 }),
        enrollment({ benefitType: 'hardship', employerContribution: 25 }),
      ],
      PERIOD,
    );
    expect(inputs['emp-1']).toEqual({
      foodAllowance: 30,
      transportAllowance: 35, // transport + fuel
      otherEarnings: 50, // housing → Art. 9 expense-allowance treatment
      regularAllowances: 25, // hardship → contributable supplement
    });
  });

  it('handles legacy benefitType values (food/health/life)', () => {
    const inputs = aggregateAllowanceInputs(
      [
        enrollment({ benefitType: 'food', employerContribution: 10 }),
        enrollment({ benefitType: 'health', employerContribution: 40 }),
      ],
      PERIOD,
    );
    expect(inputs['emp-1'].foodAllowance).toBe(10);
    expect(inputs['emp-1'].otherEarnings).toBe(40);
  });

  it('skips non-active, out-of-window, and non-positive enrollments', () => {
    const inputs = aggregateAllowanceInputs(
      [
        enrollment({ status: 'terminated' }),
        enrollment({ status: 'pending' }),
        enrollment({ effectiveDate: '2026-08-01' }), // starts after period
        enrollment({ terminationDate: '2026-06-30' }), // ended before period
        enrollment({ employerContribution: 0 }),
        enrollment({ employerContribution: -5 }),
        enrollment({ employeeId: '' }),
      ],
      PERIOD,
    );
    expect(inputs).toEqual({});
  });

  it('keeps an enrollment that starts or ends mid-period', () => {
    const inputs = aggregateAllowanceInputs(
      [
        enrollment({ effectiveDate: '2026-07-15', employerContribution: 20 }),
        enrollment({
          benefitType: 'meal',
          terminationDate: '2026-07-10',
          employerContribution: 30,
        }),
      ],
      PERIOD,
    );
    expect(inputs['emp-1'].transportAllowance).toBe(20);
    expect(inputs['emp-1'].foodAllowance).toBe(30);
  });

  it('aggregates per employee, keeping employees separate', () => {
    const inputs = aggregateAllowanceInputs(
      [
        enrollment({ employerContribution: 20 }),
        enrollment({ employerContribution: 10 }),
        enrollment({ employeeId: 'emp-2', benefitType: 'meal', employerContribution: 30 }),
      ],
      PERIOD,
    );
    expect(inputs['emp-1'].transportAllowance).toBe(30);
    expect(inputs['emp-2'].foodAllowance).toBe(30);
  });
});

describe('perPeriodAllowances', () => {
  const MONTHLY = {
    foodAllowance: 30,
    transportAllowance: 20,
    otherEarnings: 50,
    regularAllowances: 25,
  };

  it('passes monthly amounts through for monthly runs (undefined periods)', () => {
    expect(perPeriodAllowances(MONTHLY, undefined)).toEqual(MONTHLY);
  });

  it('splits monthly amounts across the month for weekly runs', () => {
    const weekly = perPeriodAllowances(MONTHLY, 4);
    expect(weekly.foodAllowance).toBe(7.5);
    expect(weekly.transportAllowance).toBe(5);
  });

  it('returns zeros when the employee has no enrollments', () => {
    expect(perPeriodAllowances(undefined, undefined)).toEqual({
      foodAllowance: 0,
      transportAllowance: 0,
      otherEarnings: 0,
      regularAllowances: 0,
    });
  });
});

// ─── Engine treatment of the mapped inputs ──────────────────────────

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

describe('regularAllowances engine input (hardship-style supplements)', () => {
  it('is taxable AND contributable (DL 20/2017 Art. 8)', () => {
    const result = calculateTLPayroll(baseInput({ regularAllowances: 25 }));
    const line = result.earnings.find((e) => e.type === 'regular_allowance');
    expect(line?.amount).toBe(25);
    expect(line?.isTaxable).toBe(true);
    expect(line?.isINSSBase).toBe(true);
    expect(result.inssEmployee).toBe(21); // (500 + 25) × 4%
  });

  it('is absent when zero', () => {
    const result = calculateTLPayroll(baseInput());
    expect(result.earnings.some((e) => e.type === 'regular_allowance')).toBe(false);
  });

  it('expense allowances stay outside the INSS base while taxed for WIT', () => {
    const result = calculateTLPayroll(
      baseInput({ foodAllowance: 30, transportAllowance: 20, otherEarnings: 50 }),
    );
    // INSS on salary only
    expect(result.inssEmployee).toBe(20); // 500 × 4%
    // WIT on everything above the $500 threshold
    expect(result.incomeTax).toBe(10); // (600 − 500) × 10%
  });
});
