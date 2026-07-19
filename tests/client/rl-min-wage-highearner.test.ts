import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';

/**
 * Real-life regression: both ends of the TL salary range compute sanely.
 *
 * Synthetic employees (invented names/numbers, no real client data):
 *  - "Alino" on the $115 statutory minimum wage (Lei 4/2012; still $115 as of 2026).
 *  - "Berta" as a $5,000/month high earner.
 *
 * TL legal rules asserted:
 *  - Resident WIT: 0% on the first $500/month, 10% on the excess.
 *  - INSS: employee 4%, employer 6% of the contributable base.
 * Both are plain monthly salaried residents with no OT/allowances/benefits, so
 * the contributable base equals base salary and WIT taxable income equals base.
 */

const MONEY_TOLERANCE = 0.02;

function baseInput(overrides: Partial<TLPayrollInput>): TLPayrollInput {
  return {
    employeeId: 'synthetic',
    monthlySalary: 0,
    payFrequency: 'monthly',
    isHourly: false,
    regularHours: 190,
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
    hireDate: '2000-01-01',
    ...overrides,
  };
}

describe('real-life payroll: minimum wage floor and high earner', () => {
  it('minimum-wage resident ($115): WIT is 0 under the $500 band, INSS still applies', () => {
    const r = calculateTLPayroll(baseInput({ monthlySalary: 115 }));

    expect(r.grossPay).toBeCloseTo(115, 2);
    expect(r.taxableIncome).toBeCloseTo(115, 2);

    // 115 <= 500 threshold -> no WIT.
    expect(r.incomeTax).toBe(0);

    // INSS still applies on the full base, even below the WIT threshold.
    expect(r.inssEmployee).toBeCloseTo(4.6, 2); // 4% of 115
    expect(r.inssEmployer).toBeCloseTo(6.9, 2); // 6% of 115
    expect(r.inssBase).toBeCloseTo(115, 2);

    // Net = gross - WIT - employee INSS (employer INSS is not deducted).
    expect(Math.abs(r.netPay - 110.4)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(r.totalEmployerCost).toBeCloseTo(121.9, 2); // 115 + 6.90
  });

  it('high earner resident ($5,000): 10% WIT on the excess over $500, INSS on full base', () => {
    const r = calculateTLPayroll(baseInput({ monthlySalary: 5000 }));

    expect(r.grossPay).toBeCloseTo(5000, 2);
    expect(r.taxableIncome).toBeCloseTo(5000, 2);

    // WIT = 10% x (5000 - 500) = 450.00
    expect(Math.abs(r.incomeTax - 450)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(r.witTaxableAmount).toBeCloseTo(4500, 2);

    // INSS on the full contributable base (no cap in the TL scheme).
    expect(r.inssEmployee).toBeCloseTo(200, 2); // 4% of 5000
    expect(r.inssEmployer).toBeCloseTo(300, 2); // 6% of 5000
    expect(r.inssBase).toBeCloseTo(5000, 2);

    // Net = 5000 - 450 - 200 = 4350.00
    expect(Math.abs(r.netPay - 4350)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(r.totalEmployerCost).toBeCloseTo(5300, 2); // 5000 + 300
  });
});
