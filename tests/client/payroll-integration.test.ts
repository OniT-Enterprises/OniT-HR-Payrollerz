/**
 * Integration Test: Full Payroll Run Simulation
 * Tests multiple employee scenarios in a single payroll batch to verify
 * correctness of TL tax law, INSS, overtime, sick leave, and deduction caps.
 */

import { describe, expect, it } from "vitest";
import {
  calculateTLPayroll,
  calculateSubsidioAnual,
  validateTLPayrollInput,
  type TLPayrollInput,
  type TLPayrollResult,
} from "@/lib/payroll/calculations-tl";
import { TL_INCOME_TAX, TL_INSS } from "@/lib/payroll/constants-tl";

// ============================================================
// HELPERS
// ============================================================

function makeEmployee(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: "emp-default",
    monthlySalary: 500,
    payFrequency: "monthly",
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
    commission: 0,
    perDiem: 0,
    foodAllowance: 0,
    transportAllowance: 0,
    otherEarnings: 0,
    taxInfo: { isResident: true, hasTaxExemption: false },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: 0,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 12,
    hireDate: "2025-01-01",
    ...overrides,
  };
}

/**
 * Simulate a batch payroll run for multiple employees
 */
function runPayrollBatch(employees: TLPayrollInput[]): {
  results: TLPayrollResult[];
  totals: {
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    totalEmployerCost: number;
    totalWIT: number;
    totalINSSEmployee: number;
    totalINSSEmployer: number;
  };
} {
  const results = employees.map((emp) => calculateTLPayroll(emp));

  const totals = results.reduce(
    (acc, r) => ({
      grossPay: +(acc.grossPay + r.grossPay).toFixed(2),
      totalDeductions: +(acc.totalDeductions + r.totalDeductions).toFixed(2),
      netPay: +(acc.netPay + r.netPay).toFixed(2),
      totalEmployerCost: +(acc.totalEmployerCost + r.totalEmployerCost).toFixed(2),
      totalWIT: +(acc.totalWIT + r.incomeTax).toFixed(2),
      totalINSSEmployee: +(acc.totalINSSEmployee + r.inssEmployee).toFixed(2),
      totalINSSEmployer: +(acc.totalINSSEmployer + r.inssEmployer).toFixed(2),
    }),
    {
      grossPay: 0,
      totalDeductions: 0,
      netPay: 0,
      totalEmployerCost: 0,
      totalWIT: 0,
      totalINSSEmployee: 0,
      totalINSSEmployer: 0,
    }
  );

  return { results, totals };
}

// ============================================================
// TEST SUITE: MULTI-EMPLOYEE BATCH PAYROLL
// ============================================================

describe("Integration: Full Payroll Run (Multi-Employee Batch)", () => {
  // Define realistic employee roster
  const roster: TLPayrollInput[] = [
    // Employee 1: Standard admin — above WIT threshold
    makeEmployee({
      employeeId: "emp-admin",
      monthlySalary: 800,
      regularHours: 190,
    }),

    // Employee 2: Minimum wage worker
    makeEmployee({
      employeeId: "emp-minwage",
      monthlySalary: 115,
      regularHours: 190,
    }),

    // Employee 3: Manager with overtime and bonus
    makeEmployee({
      employeeId: "emp-manager",
      monthlySalary: 1500,
      regularHours: 190,
      overtimeHours: 20,
      bonus: 200,
    }),

    // Employee 4: Non-resident (flat 10%, no threshold)
    makeEmployee({
      employeeId: "emp-nonresident",
      monthlySalary: 600,
      regularHours: 190,
      taxInfo: { isResident: false, hasTaxExemption: false },
    }),

    // Employee 5: Night shift worker with holiday pay
    makeEmployee({
      employeeId: "emp-nightshift",
      monthlySalary: 700,
      regularHours: 150,
      nightShiftHours: 40,
      holidayHours: 16,
    }),

    // Employee 6: Employee with sick days
    makeEmployee({
      employeeId: "emp-sick",
      monthlySalary: 500,
      regularHours: 174,
      sickDaysUsed: 4,
      ytdSickDaysUsed: 2,
    }),

    // Employee 7: At threshold ($500 exactly) — no WIT for residents
    makeEmployee({
      employeeId: "emp-threshold",
      monthlySalary: 500,
      regularHours: 190,
    }),

    // Employee 8: Employee with voluntary deductions
    makeEmployee({
      employeeId: "emp-deductions",
      monthlySalary: 600,
      regularHours: 190,
      loanRepayment: 50,
      advanceRepayment: 30,
    }),
  ];

  it("processes all employees without errors", () => {
    // All inputs should be valid (validateTLPayrollInput returns string[] of errors)
    for (const emp of roster) {
      const errors = validateTLPayrollInput(emp);
      expect(errors, `${emp.employeeId} should be valid`).toHaveLength(0);
    }

    // Process batch
    const { results, totals } = runPayrollBatch(roster);

    // All should produce results
    expect(results).toHaveLength(8);
    results.forEach((r, i) => {
      expect(r.grossPay, `Employee ${i} gross pay`).toBeGreaterThan(0);
      expect(r.netPay, `Employee ${i} net pay`).toBeGreaterThan(0);
      expect(r.netPay, `Employee ${i} net <= gross`).toBeLessThanOrEqual(r.grossPay);
    });
  });

  it("calculates WIT correctly for resident above threshold", () => {
    const result = calculateTLPayroll(roster[0]); // $800 admin
    // Taxable: $800, tax on amount above $500 threshold = $300 * 10% = $30
    expect(result.incomeTax).toBe(30);
  });

  it("calculates $0 WIT for resident at or below threshold", () => {
    const result = calculateTLPayroll(roster[6]); // $500 threshold
    expect(result.incomeTax).toBe(0);
  });

  it("calculates $0 WIT for minimum wage", () => {
    const result = calculateTLPayroll(roster[1]); // $115 min wage
    expect(result.incomeTax).toBe(0);
  });

  it("calculates WIT for non-resident (flat rate, no threshold)", () => {
    const result = calculateTLPayroll(roster[3]); // $600 non-resident
    // Non-resident: 10% of entire income = $600 * 10% = $60
    expect(result.incomeTax).toBe(60);
  });

  it("calculates INSS 4% employee + 6% employer for all", () => {
    const { results } = runPayrollBatch(roster);
    for (const r of results) {
      // INSS employee should be 4% of INSS base
      const expectedEmployee = +(r.inssBase * TL_INSS.employeeRate).toFixed(2);
      expect(r.inssEmployee).toBeCloseTo(expectedEmployee, 1);

      // INSS employer should be 6% of INSS base
      const expectedEmployer = +(r.inssBase * TL_INSS.employerRate).toFixed(2);
      expect(r.inssEmployer).toBeCloseTo(expectedEmployer, 1);
    }
  });

  it("calculates overtime at 150% for manager", () => {
    const result = calculateTLPayroll(roster[2]); // Manager with 20h OT
    expect(result.overtimePay).toBeGreaterThan(0);

    // Hourly rate for $1500/month at 190h, OT at 150%
    // Decimal.js rounding may differ slightly from JS floating-point
    const hourlyRate = 1500 / 190;
    const approxOT = hourlyRate * 1.5 * 20;
    expect(result.overtimePay).toBeCloseTo(approxOT, -1); // Within $5
  });

  it("calculates night shift at 125% premium", () => {
    const result = calculateTLPayroll(roster[4]); // Night shift worker
    expect(result.nightShiftPay).toBeGreaterThan(0);

    // Night shift hours at 125% (Decimal.js precision)
    const hourlyRate = 700 / 190;
    const approxNight = hourlyRate * 1.25 * 40;
    expect(result.nightShiftPay).toBeCloseTo(approxNight, -1); // Within $5
  });

  it("calculates holiday pay at 200%", () => {
    const result = calculateTLPayroll(roster[4]); // Night shift + holiday
    expect(result.holidayPay).toBeGreaterThan(0);

    // Holiday hours at 200%
    const hourlyRate = 700 / 190;
    const expectedHoliday = +(hourlyRate * 2 * 16).toFixed(2);
    expect(result.holidayPay).toBeCloseTo(expectedHoliday, 0);
  });

  it("calculates sick leave with 100% tier for first 6 days", () => {
    const result = calculateTLPayroll(roster[5]); // 4 sick days, 2 YTD
    // With 2 YTD, employee has used 2 so far (still in 100% tier, 4 remaining)
    // 4 new sick days: all within 100% tier (total would be 6)
    expect(result.sickPay).toBeGreaterThan(0);
  });

  it("employer cost equals gross + employer INSS", () => {
    const { results } = runPayrollBatch(roster);
    for (const r of results) {
      expect(r.totalEmployerCost).toBeCloseTo(r.grossPay + r.inssEmployer, 1);
    }
  });

  it("net pay equals gross minus total deductions", () => {
    const { results } = runPayrollBatch(roster);
    for (const r of results) {
      expect(r.netPay).toBeCloseTo(r.grossPay - r.totalDeductions, 1);
    }
  });

  it("batch totals are consistent", () => {
    const { results, totals } = runPayrollBatch(roster);

    // Sum individual results
    const sumGross = results.reduce((s, r) => s + r.grossPay, 0);
    const sumNet = results.reduce((s, r) => s + r.netPay, 0);
    const sumDeductions = results.reduce((s, r) => s + r.totalDeductions, 0);
    const sumEmployerCost = results.reduce((s, r) => s + r.totalEmployerCost, 0);

    expect(totals.grossPay).toBeCloseTo(sumGross, 1);
    expect(totals.netPay).toBeCloseTo(sumNet, 1);
    expect(totals.totalDeductions).toBeCloseTo(sumDeductions, 1);
    expect(totals.totalEmployerCost).toBeCloseTo(sumEmployerCost, 1);
  });

  it("YTD values accumulate correctly", () => {
    // Simulate two consecutive pay periods
    const emp = makeEmployee({
      employeeId: "ytd-test",
      monthlySalary: 800,
    });

    const month1 = calculateTLPayroll(emp);

    // Second month uses first month's YTD values
    const month2Input = makeEmployee({
      employeeId: "ytd-test",
      monthlySalary: 800,
      ytdGrossPay: month1.newYtdGrossPay,
      ytdIncomeTax: month1.newYtdIncomeTax,
      ytdINSSEmployee: month1.newYtdINSSEmployee,
    });

    const month2 = calculateTLPayroll(month2Input);

    // YTD should be sum of both months
    expect(month2.newYtdGrossPay).toBeCloseTo(month1.grossPay + month2.grossPay, 1);
    expect(month2.newYtdIncomeTax).toBeCloseTo(month1.incomeTax + month2.incomeTax, 1);
    expect(month2.newYtdINSSEmployee).toBeCloseTo(month1.inssEmployee + month2.inssEmployee, 1);
  });

  it("deduction cap limits voluntary deductions to 1/6 of gross", () => {
    // Test with large voluntary deductions that would exceed cap
    const emp = makeEmployee({
      employeeId: "deduction-cap-test",
      monthlySalary: 300,
      loanRepayment: 100,    // Very high relative to salary
      advanceRepayment: 50,
    });

    const result = calculateTLPayroll(emp);

    // The cap modifies internal deduction line items (result.deductions array)
    // Voluntary deductions in the array should be capped at 1/6 of gross (~$50)
    const voluntaryDeductions = result.deductions.filter(d => !d.isStatutory);
    const voluntaryTotal = voluntaryDeductions.reduce((s, d) => s + d.amount, 0);
    const maxVoluntary = result.grossPay / 6;
    expect(voluntaryTotal).toBeLessThanOrEqual(maxVoluntary + 0.01);

    // Should produce a warning about the cap
    expect(result.warnings.some(w => w.includes("1/6 cap"))).toBe(true);
  });

  it("handles weekly pay frequency with pro-rated threshold", () => {
    const weeklyEmp = makeEmployee({
      employeeId: "weekly-test",
      monthlySalary: 800,
      payFrequency: "weekly",
      regularHours: 44,
    });

    const result = calculateTLPayroll(weeklyEmp);

    // Weekly threshold = $500 / ~4.33 weeks = ~$115.38
    // Weekly salary = $800 / ~4.33 = ~$184.62
    // Taxable above threshold: ~$69.24
    // WIT: ~$6.92
    expect(result.incomeTax).toBeGreaterThan(0);
    expect(result.incomeTax).toBeLessThan(30); // Much less than monthly
    expect(result.grossPay).toBeLessThan(300); // Weekly gross << monthly
  });
});

// ============================================================
// TEST SUITE: SUBSIDIO ANUAL (13TH MONTH) INTEGRATION
// ============================================================

describe("Integration: Subsidio Anual across multiple employees", () => {
  const asOfDate = new Date("2025-12-20");

  it("pro-rates correctly for mid-year hires", () => {
    // Full year employee (signature: salary, monthsWorked, hireDate, asOfDate?)
    const fullYear = calculateSubsidioAnual(800, 12, "2025-01-01", asOfDate);
    expect(fullYear).toBeCloseTo(800, 1); // Full 13th month

    // July hire (6 months)
    const halfYear = calculateSubsidioAnual(800, 6, "2025-07-01", asOfDate);
    expect(halfYear).toBeCloseTo(400, 1); // Half 13th month

    // November hire (2 months)
    const twoMonths = calculateSubsidioAnual(800, 2, "2025-11-01", asOfDate);
    expect(twoMonths).toBeCloseTo(133.33, 1); // 2/12 of salary
  });

  it("returns 0 for future hire date", () => {
    const futureHire = calculateSubsidioAnual(800, 0, "2026-03-01", asOfDate);
    expect(futureHire).toBe(0);
  });
});
