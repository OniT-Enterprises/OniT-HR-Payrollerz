import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  type TLPayrollInput,
  type TLPayrollResult,
} from '@/lib/payroll/calculations-tl';
import { sumMoney } from '@/lib/currency';

/**
 * Real-life scenario: a single monthly payroll batch for a construction company
 * mixing resident local staff with non-resident expat foreign nationals.
 *
 * TL law under test (Decree Law 8/2008, Schedule V; DL 20/2017 for INSS):
 *  - Resident WIT: 0% on the first $500/month, 10% on the excess above $500.
 *  - Non-resident WIT: 10% flat from the first dollar (no threshold), even
 *    when the salary is below $500.
 *  - INSS: employee 4% + employer 6% of contributable base, for residents AND
 *    non-residents alike (residency is irrelevant to INSS enrolment).
 *
 * All names and figures are synthetic.
 */

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
    nonCashBenefits: 0,
    nonCashBenefitINSSCategory: null,
    taxInfo: { isResident: true, hasTaxExemption: false },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: 0,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 12,
    hireDate: '2020-01-01',
    ...overrides,
  };
}


interface Expectation {
  employeeId: string;
  monthlySalary: number;
  isResident: boolean;
  expectedWit: number;
  expectedInssEmployee: number;
  expectedInssEmployer: number;
}

// Six synthetic staff straddling the $500 resident threshold.
const roster: Expectation[] = [
  // Residents: 0% up to $500, 10% above.
  { employeeId: 'res-below', monthlySalary: 400, isResident: true, expectedWit: 0, expectedInssEmployee: 16, expectedInssEmployer: 24 },
  { employeeId: 'res-at-threshold', monthlySalary: 500, isResident: true, expectedWit: 0, expectedInssEmployee: 20, expectedInssEmployer: 30 },
  { employeeId: 'res-above', monthlySalary: 800, isResident: true, expectedWit: 30, expectedInssEmployee: 32, expectedInssEmployer: 48 },
  // Non-residents: 10% from the first dollar, even below $500.
  { employeeId: 'nonres-below', monthlySalary: 400, isResident: false, expectedWit: 40, expectedInssEmployee: 16, expectedInssEmployer: 24 },
  { employeeId: 'nonres-mid', monthlySalary: 600, isResident: false, expectedWit: 60, expectedInssEmployee: 24, expectedInssEmployer: 36 },
  { employeeId: 'nonres-high', monthlySalary: 1200, isResident: false, expectedWit: 120, expectedInssEmployee: 48, expectedInssEmployer: 72 },
];

describe('mixed resident + non-resident monthly payroll batch', () => {
  const results = new Map<string, TLPayrollResult>(
    roster.map((e) => [
      e.employeeId,
      calculateTLPayroll(
        baseInput({
          employeeId: e.employeeId,
          monthlySalary: e.monthlySalary,
          taxInfo: { isResident: e.isResident, hasTaxExemption: false },
        }),
      ),
    ]),
  );

  it.each(roster)(
    'applies the correct WIT residency rule for $employeeId',
    (e) => {
      const r = results.get(e.employeeId)!;
      expect(r.incomeTax).toBeCloseTo(e.expectedWit, 2);
    },
  );

  it('taxes residents 0% up to $500 and 10% on the excess', () => {
    expect(results.get('res-below')!.incomeTax).toBeCloseTo(0, 2);
    expect(results.get('res-at-threshold')!.incomeTax).toBeCloseTo(0, 2);
    // $800 - $500 = $300 * 10% = $30
    expect(results.get('res-above')!.incomeTax).toBeCloseTo(30, 2);
  });

  it('taxes non-residents 10% from the first dollar, including below $500', () => {
    // $400 non-resident is BELOW the resident threshold but still owes 10%.
    expect(results.get('nonres-below')!.incomeTax).toBeCloseTo(40, 2);
    expect(results.get('nonres-mid')!.incomeTax).toBeCloseTo(60, 2);
    expect(results.get('nonres-high')!.incomeTax).toBeCloseTo(120, 2);
  });

  it('applies INSS 4%/6% to residents and non-residents alike', () => {
    for (const e of roster) {
      const r = results.get(e.employeeId)!;
      expect(r.inssEmployee).toBeCloseTo(e.expectedInssEmployee, 2);
      expect(r.inssEmployer).toBeCloseTo(e.expectedInssEmployer, 2);
    }
  });

  it('sums run-level totals correctly across the mixed batch', () => {
    const totalWit = sumMoney([...results.values()].map((r) => r.incomeTax));
    const totalInssEmployee = sumMoney([...results.values()].map((r) => r.inssEmployee));
    const totalInssEmployer = sumMoney([...results.values()].map((r) => r.inssEmployer));
    const totalGross = sumMoney([...results.values()].map((r) => r.grossPay));

    expect(totalWit).toBeCloseTo(250, 2); // 0 + 0 + 30 + 40 + 60 + 120
    expect(totalInssEmployee).toBeCloseTo(156, 2); // 16+20+32+16+24+48
    expect(totalInssEmployer).toBeCloseTo(234, 2); // 24+30+48+24+36+72
    expect(totalGross).toBeCloseTo(3900, 2); // 400+500+800+400+600+1200
  });

  it('confirms a below-threshold non-resident is taxed but an equal-salary resident is not', () => {
    const resident = results.get('res-below')!; // $400 resident
    const nonResident = results.get('nonres-below')!; // $400 non-resident
    expect(resident.incomeTax).toBeCloseTo(0, 2);
    expect(nonResident.incomeTax).toBeCloseTo(40, 2);
    // Identical gross, divergent WIT -> residency is the only differentiator.
    expect(resident.grossPay).toBeCloseTo(nonResident.grossPay, 2);
  });
});
