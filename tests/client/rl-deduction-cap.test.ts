import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';

/**
 * Real-life regression: Lei 4/2012, Art. 42(3) — total monthly wage deductions
 * may not exceed 30% of the remuneration received. Synthetic data only.
 *
 * Scenario: "Domingas Boavida", a resident salaried worker on $1,000/month, has
 * a company loan and a wage advance whose combined repayments would strip more
 * than 30% of her pay. Statutory WIT and INSS are also withheld. Xefe must keep
 * total deductions at or below the 30% ceiling.
 */

const MONEY_TOLERANCE = 0.02;

function baseInput(overrides: Partial<TLPayrollInput>): TLPayrollInput {
  return {
    employeeId: 'emp-domingas',
    monthlySalary: 1000,
    payFrequency: 'monthly',
    isHourly: false,
    hourlyRate: undefined,
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
    hireDate: '2018-01-01',
    ...overrides,
  };
}

describe('Lei 4/2012 Art. 42(3): 30% monthly wage-deduction cap', () => {
  it('caps loan + advance repayments so total deductions never exceed 30% of pay', () => {
    // $1,000 salary. Statutory: WIT (1000-500)*10% = $50; INSS employee 4% = $40.
    // Requested discretionary repayments: loan $200 + advance $200 = $400.
    // Uncapped total would be $490 (49% of pay) — well over the 30% ceiling.
    const result = calculateTLPayroll(
      baseInput({ loanRepayment: 200, advanceRepayment: 200 }),
    );

    expect(result.wagesPaid).toBeCloseTo(1000, 2);
    expect(result.incomeTax).toBeCloseTo(50, 2);
    expect(result.inssEmployee).toBeCloseTo(40, 2);

    // Legal ceiling: 30% of $1,000 = $300.
    const cap = result.wagesPaid * 0.3;
    expect(result.totalDeductions).toBeLessThanOrEqual(cap + MONEY_TOLERANCE);
    // Engine lands exactly on the ceiling: statutory $90 + discretionary $210.
    expect(result.totalDeductions).toBeCloseTo(300, 2);

    // Discretionary lines share the remaining $210 cap proportionally (50/50).
    expect(result.loanRepayment).toBeCloseTo(105, 2);
    expect(result.advanceRepayment).toBeCloseTo(105, 2);

    expect(result.netPay).toBeCloseTo(700, 2);
    expect(result.warnings.some((w) => /30% cap/.test(w))).toBe(true);
  });

  it('does not touch deductions that already sit within the 30% ceiling', () => {
    // Statutory $90 + a single $100 loan = $190 (19% of pay) — under the ceiling.
    const result = calculateTLPayroll(baseInput({ loanRepayment: 100 }));

    expect(result.loanRepayment).toBeCloseTo(100, 2);
    expect(result.totalDeductions).toBeCloseTo(190, 2);
    expect(result.netPay).toBeCloseTo(810, 2);
    expect(result.warnings.some((w) => /30% cap/.test(w))).toBe(false);
    expect(result.totalDeductions).toBeLessThanOrEqual(result.wagesPaid * 0.3 + MONEY_TOLERANCE);
  });

  it('withholds a court order in full even past 30%, while still capping voluntary lines', () => {
    // Court order $250 + loan $100 requested; statutory $90 on top. A court order
    // is OUTSIDE the 30% cap (Art. 42(2) + CPC Arts. 702/737 — the judge fixes the
    // amount, the employer just deposits it), so it is withheld in full. The
    // voluntary loan still shares only what's left of the 30% ceiling.
    const result = calculateTLPayroll(
      baseInput({ courtOrders: 250, loanRepayment: 100 }),
    );

    // Court order untouched at its full $250.
    expect(result.courtOrders).toBeCloseTo(250, 2);
    // Protected = WIT $50 + INSS $40 + court $250 = $340, already past the $300
    // (30%) ceiling, so the voluntary loan is squeezed to $0.
    expect(result.loanRepayment).toBeCloseTo(0, 2);
    // Total therefore lawfully exceeds 30% because of the court order.
    expect(result.totalDeductions).toBeCloseTo(340, 2);
    // A court-order notice fires (not the generic "reduced proportionally" one).
    expect(result.warnings.some((w) => /court/i.test(w))).toBe(true);
  });
});
