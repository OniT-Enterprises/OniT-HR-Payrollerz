import { describe, expect, it } from 'vitest';
import {
  calculateSubsidioAnual,
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';
import { subtractMoney } from '@/lib/currency';

/**
 * Real-life scenario: Subsídio Anual (13th month) run.
 *
 * TL Labour Code Art. 44: one month's BASE salary, prorated to months worked
 * in the civil year. The amount is derived from base salary only (not
 * overtime, not bonuses). This test exercises the calculateSubsidioAnual +
 * subsidioAnual input path and pins down its WIT/INSS treatment in the engine.
 *
 * Synthetic data only — invented employees "Domingas" and "Januário".
 */


// A December payroll run for a salaried, resident monthly employee.
function baseInput(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: 'emp-synthetic',
    monthlySalary: 600,
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
    hireDate: '2019-03-15',
    ...overrides,
  };
}

describe('real-life: Subsídio Anual (13th month) prorated', () => {
  const asOfDec = new Date('2026-12-15');

  it('full-year employee (Domingas) gets one full month base salary', () => {
    // Hired years ago, worked all 12 months of the civil year.
    const subsidy = calculateSubsidioAnual(600, 12, '2019-03-15', asOfDec);
    expect(subsidy).toBeCloseTo(600, 2);
  });

  it('mid-year hire (Januário, started May) is prorated to months worked', () => {
    // Started 2026-05-10 -> May..Dec inclusive = 8 months of 12.
    const subsidy = calculateSubsidioAnual(600, 8, '2026-05-10', asOfDec);
    // 600 * 8/12 = 400.00
    expect(subsidy).toBeCloseTo(400, 2);
  });

  it('is based on BASE salary only — overtime & bonus do not change the subsidy', () => {
    // calculateSubsidioAnual only accepts monthlySalary, so it is structurally
    // base-only. Prove the payroll subsidioAnual line equals the base-derived
    // amount even when the same run carries OT and a bonus.
    const subsidy = calculateSubsidioAnual(600, 8, '2026-05-10', asOfDec);
    const result = calculateTLPayroll(
      baseInput({
        hireDate: '2026-05-10',
        monthsWorkedThisYear: 8,
        subsidioAnual: subsidy,
        overtimeHours: 20,
        bonus: 150,
        bonusINSSCategory: 'individual_performance',
      }),
    );
    // The subsidio line is the prorated base month, untouched by OT/bonus.
    expect(result.subsidioAnual).toBeCloseTo(400, 2);
    // A different base salary would change it; OT/bonus never do.
    expect(calculateSubsidioAnual(900, 8, '2026-05-10', asOfDec)).toBeCloseTo(600, 2);
  });

  it('subsidio is fully in the WIT base (resident 10% above $500)', () => {
    // Regular $600 alone already crosses the $500 threshold, so the entire
    // $600 subsidy is taxed at 10% => +$60 WIT.
    const withoutSubsidy = calculateTLPayroll(baseInput());
    const withSubsidy = calculateTLPayroll(baseInput({ subsidioAnual: 600 }));

    expect(withoutSubsidy.incomeTax).toBeCloseTo(10, 2); // (600-500)*10%
    expect(withSubsidy.incomeTax).toBeCloseTo(70, 2); // (1200-500)*10%
    expect(subtractMoney(withSubsidy.incomeTax, withoutSubsidy.incomeTax))
      .toBeCloseTo(60, 2);
    // taxableIncome grows by the full subsidy amount.
    expect(subtractMoney(withSubsidy.taxableIncome, withoutSubsidy.taxableIncome))
      .toBeCloseTo(600, 2);
  });

  it('subsidio is fully in the INSS base (4% employee / 6% employer)', () => {
    const withoutSubsidy = calculateTLPayroll(baseInput());
    const withSubsidy = calculateTLPayroll(baseInput({ subsidioAnual: 600 }));

    // INSS base grows by the full subsidy.
    expect(subtractMoney(withSubsidy.inssBase, withoutSubsidy.inssBase))
      .toBeCloseTo(600, 2);
    // Employee 4% -> +$24, Employer 6% -> +$36.
    expect(subtractMoney(withSubsidy.inssEmployee, withoutSubsidy.inssEmployee))
      .toBeCloseTo(24, 2);
    expect(subtractMoney(withSubsidy.inssEmployer, withoutSubsidy.inssEmployer))
      .toBeCloseTo(36, 2);
  });

  it('net pay reflects the full subsidy less its own WIT+INSS', () => {
    const result = calculateTLPayroll(baseInput({ subsidioAnual: 600 }));
    // cashGross 1200 - WIT 70 - INSS 48 = 1082
    expect(result.cashGrossPay).toBeCloseTo(1200, 2);
    expect(result.netPay).toBeCloseTo(1082, 2);
    // The subsidio earning line is taxable and INSS-bearing.
    const line = result.earnings.find((e) => e.type === 'subsidio_anual');
    expect(line).toBeDefined();
    expect(line?.isTaxable).toBe(true);
    expect(line?.isINSSBase).toBe(true);
    expect(line?.amount).toBeCloseTo(600, 2);
  });
});
