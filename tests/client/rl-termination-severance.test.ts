import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';

/**
 * Real-life regression: termination with Labour Law 4/2012 Art. 56 service
 * compensation ("Kompensasaun Servisu").
 *
 * Legal rule under test:
 *   - One month's base salary per COMPLETED 5-year period of service.
 *   - The Art. 56 payment IS included in the WIT (income tax) base
 *     (Tax Law 8/2008 Art. 1 treats termination compensation as salary).
 *   - It is NOT part of the INSS contributable base (it is not the fixed-term
 *     unlawful-dismissal indemnity added by DL 30/2021).
 *
 * Synthetic employee: "Abilio Sarmento" (invented), $600/month, resident,
 * derived from terminationDate + hireDate via the engine's own input path.
 * All money compared with a <= $0.02 rounding tolerance.
 */


function terminatedInput(overrides: {
  hireDate: string;
  terminationDate: string;
}): TLPayrollInput {
  return {
    employeeId: 'synthetic-abilio-sarmento',
    monthlySalary: 600,
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
    taxInfo: { isResident: true, hasTaxExemption: false, inssExempt: false },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: 0,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 12,
    hireDate: overrides.hireDate,
    terminationDate: overrides.terminationDate,
  };
}

describe('Termination final pay — Art. 56 service compensation', () => {
  it('12 years of service → 2 completed 5-year blocks → 2 months salary', () => {
    // Hire 2013-06-15, terminate 2025-06-15 = exactly 12 completed years.
    const result = calculateTLPayroll(
      terminatedInput({ hireDate: '2013-06-15', terminationDate: '2025-06-15' }),
    );

    // Severance = 2 x $600 = $1200
    expect(result.serviceCompensation).toBeCloseTo(1200, 2);

    // It appears as a taxable, non-INSS earning line.
    const line = result.earnings.find((e) => e.type === 'service_compensation');
    expect(line).toBeDefined();
    expect(line!.amount).toBeCloseTo(1200, 2);
    expect(line!.isTaxable).toBe(true);
    expect(line!.isINSSBase).toBe(false);

    // Severance IS in the WIT base: taxableIncome = regular 600 + severance 1200.
    expect(result.taxableIncome).toBeCloseTo(1800, 2);
    // Resident WIT = ($1800 - $500) x 10% = $130.
    // (If severance were wrongly excluded, WIT would be only ($600-$500)x10% = $10.)
    expect(result.incomeTax).toBeCloseTo(130, 2);

    // Severance is NOT in the INSS base: base = regular pay $600 only.
    expect(result.inssBase).toBeCloseTo(600, 2);
    expect(result.inssEmployee).toBeCloseTo(24, 2);
    expect(result.inssEmployer).toBeCloseTo(36, 2);

    // Cash gross = regular 600 + severance 1200 = 1800.
    expect(result.cashGrossPay).toBeCloseTo(1800, 2);
    // Net = 1800 - WIT 130 - INSS 24 = 1646.
    expect(result.netPay).toBeCloseTo(1646, 2);
  });

  it('4 years of service → 0 completed 5-year blocks → no severance', () => {
    const result = calculateTLPayroll(
      terminatedInput({ hireDate: '2021-06-15', terminationDate: '2025-06-15' }),
    );

    expect(result.serviceCompensation).toBeCloseTo(0, 2);
    expect(
      result.earnings.find((e) => e.type === 'service_compensation'),
    ).toBeUndefined();

    // Only regular pay is taxable/contributable.
    expect(result.taxableIncome).toBeCloseTo(600, 2);
    // Resident WIT = ($600 - $500) x 10% = $10.
    expect(result.incomeTax).toBeCloseTo(10, 2);
    expect(result.cashGrossPay).toBeCloseTo(600, 2);
    // Net = 600 - WIT 10 - INSS 24 = 566.
    expect(result.netPay).toBeCloseTo(566, 2);
  });

  it('5 years of service → 1 completed 5-year block → 1 month salary', () => {
    const result = calculateTLPayroll(
      terminatedInput({ hireDate: '2020-06-15', terminationDate: '2025-06-15' }),
    );

    // Severance = 1 x $600 = $600.
    expect(result.serviceCompensation).toBeCloseTo(600, 2);
    const line = result.earnings.find((e) => e.type === 'service_compensation');
    expect(line).toBeDefined();
    expect(line!.amount).toBeCloseTo(600, 2);

    // WIT base = regular 600 + severance 600 = 1200.
    expect(result.taxableIncome).toBeCloseTo(1200, 2);
    // Resident WIT = ($1200 - $500) x 10% = $70.
    expect(result.incomeTax).toBeCloseTo(70, 2);
    // INSS base still just the $600 salary.
    expect(result.inssBase).toBeCloseTo(600, 2);
    expect(result.cashGrossPay).toBeCloseTo(1200, 2);
    // Net = 1200 - WIT 70 - INSS 24 = 1106.
    expect(result.netPay).toBeCloseTo(1106, 2);
  });

  it('service just short of the 5-year anniversary does not yet earn a block', () => {
    // Hire 2020-06-15, terminate 2025-06-14 = 4 completed years (one day short).
    const result = calculateTLPayroll(
      terminatedInput({ hireDate: '2020-06-15', terminationDate: '2025-06-14' }),
    );
    expect(result.serviceCompensation).toBeCloseTo(0, 2);
  });
});
