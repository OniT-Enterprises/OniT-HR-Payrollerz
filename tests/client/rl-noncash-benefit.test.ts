import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';

/**
 * Real-life scenario: non-cash benefit (benefit-in-kind) and the $20/month WIT
 * threshold (Tax Law 8/2008, Art. 1).
 *
 * A resident salaried worker "Alberto Guterres" earns exactly $500/month base
 * (the resident WIT threshold), so WIT is $0 on wages alone. His employer gives
 * him a benefit in kind (e.g. free lodging / meals).
 *
 * Legal rule under test:
 *  - A benefit worth exactly $20 does NOT enter the WIT base (strict "> $20").
 *  - A benefit of $21 or $50 enters the WIT base IN FULL (not excess-only).
 *  - The benefit is compensation but is never paid out as cash: it must not
 *    inflate cashGrossPay / netPay.
 */


function baseInput(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: 'alberto-guterres',
    monthlySalary: 500, // exactly the resident WIT threshold
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
    subsidioAnual: 0,
    // Expense-allowance benefit stays out of the INSS base for ALL cases, so
    // INSS is held constant and only WIT can move with the benefit value.
    nonCashBenefits: 0,
    nonCashBenefitINSSCategory: 'expense_allowance',
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

describe('real-life: non-cash benefit $20 WIT threshold (Tax Law 8/2008 Art. 1)', () => {
  it('$20 benefit does NOT cross the threshold — WIT stays $0', () => {
    const r = calculateTLPayroll(baseInput({ nonCashBenefits: 20 }));

    // At/below threshold: benefit is not taxable, so WIT base is wages only ($500),
    // which is exactly the threshold -> no tax.
    expect(r.incomeTax).toBeCloseTo(0, 2);
    expect(r.taxableIncome).toBeCloseTo(500, 2);
    expect(r.witTaxableAmount).toBeCloseTo(0, 2);

    // Benefit line exists, is recorded, but is non-cash and non-taxable.
    const benefit = r.earnings.find((e) => e.type === 'non_cash_benefit');
    expect(benefit).toBeDefined();
    expect(benefit!.isTaxable).toBe(false);
    expect(benefit!.isCash).toBe(false);
    expect(r.nonCashBenefits).toBeCloseTo(20, 2);
  });

  it('$21 benefit crosses the threshold — full $21 enters WIT base', () => {
    const r = calculateTLPayroll(baseInput({ nonCashBenefits: 21 }));

    // Full benefit is added to taxable income (not excess-only): 500 + 21 = 521.
    expect(r.taxableIncome).toBeCloseTo(521, 2);
    // WIT = 10% of amount above $500 threshold = 10% * (521 - 500) = $2.10.
    expect(r.incomeTax).toBeCloseTo(2.1, 2);
    expect(r.witTaxableAmount).toBeCloseTo(21, 2);

    const benefit = r.earnings.find((e) => e.type === 'non_cash_benefit');
    expect(benefit!.isTaxable).toBe(true);
    expect(benefit!.isCash).toBe(false);
  });

  it('$50 benefit is taxed in full and is never paid as cash', () => {
    const withBenefit = calculateTLPayroll(baseInput({ nonCashBenefits: 50 }));
    const withoutBenefit = calculateTLPayroll(baseInput({ nonCashBenefits: 0 }));

    // WIT = 10% * (550 - 500) = $5.00.
    expect(withBenefit.taxableIncome).toBeCloseTo(550, 2);
    expect(withBenefit.incomeTax).toBeCloseTo(5.0, 2);
    expect(withBenefit.witTaxableAmount).toBeCloseTo(50, 2);

    // The $50 benefit must NOT be paid as cash: cash gross is unchanged at $500.
    expect(withBenefit.grossPay).toBeCloseTo(500, 2);
    expect(withBenefit.cashGrossPay).toBeCloseTo(500, 2);
    expect(withBenefit.grossPay).toBeCloseTo(withoutBenefit.grossPay, 2);

    // But total compensation DOES include the benefit in kind.
    expect(withBenefit.totalCompensation).toBeCloseTo(550, 2);

    // Net pay is cash gross ($500) less WIT ($5) and INSS employee (4% * $500 = $20).
    // The benefit only reduces net pay via the extra WIT it triggers, never as a cash line.
    expect(withBenefit.inssEmployee).toBeCloseTo(20, 2);
    expect(withBenefit.netPay).toBeCloseTo(500 - 5 - 20, 2);

    // Sanity: adding the benefit lowered net ONLY by the incremental WIT it caused.
    const netDelta = withoutBenefit.netPay - withBenefit.netPay;
    expect(netDelta).toBeCloseTo(5.0, 2);
  });

  it('INSS base is unaffected by the benefit threshold (the $20 rule is WIT-only)', () => {
    const at = calculateTLPayroll(baseInput({ nonCashBenefits: 20 }));
    const over = calculateTLPayroll(baseInput({ nonCashBenefits: 50 }));

    // Expense-allowance benefit is excluded from INSS in both cases;
    // employee INSS = 4% * $500 wages regardless of benefit value.
    expect(at.inssEmployee).toBeCloseTo(20, 2);
    expect(over.inssEmployee).toBeCloseTo(20, 2);
    expect(at.inssBase).toBeCloseTo(500, 2);
    expect(over.inssBase).toBeCloseTo(500, 2);
  });
});
