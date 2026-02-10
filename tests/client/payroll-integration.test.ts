/**
 * Integration Test: Full Payroll Run Simulation
 * Tests multiple employee scenarios in a single payroll batch to verify
 * correctness of TL tax law, INSS, overtime, sick leave, and deduction caps.
 */

import { describe, expect, it } from "vitest";
import {
  calculateTLPayroll,
  calculateSubsidioAnual,
  calculateAbsenceDeduction,
  calculateLateDeduction,
  calculateHourlyRate,
  calculateMonthlyWeeklyPayrolls,
  validateTLPayrollInput,
  type TLPayrollInput,
  type TLPayrollResult,
} from "@/lib/payroll/calculations-tl";
import { TL_INSS, TL_WORKING_HOURS } from "@/lib/payroll/constants-tl";

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

// ============================================================
// TEST SUITE: ABSENCE & LATE ARRIVAL DEDUCTIONS
// ============================================================

describe("Absence and Late Arrival Deductions", () => {
  const monthlySalary = 800;
  const hourlyRate = calculateHourlyRate(monthlySalary);

  // ---- Absence deduction unit tests ----

  it("calculates zero absence deduction for 0 hours", () => {
    const deduction = calculateAbsenceDeduction(hourlyRate, 0);
    expect(deduction).toBe(0);
  });

  it("deducts correctly for a full day absence (8 hours)", () => {
    const deduction = calculateAbsenceDeduction(hourlyRate, TL_WORKING_HOURS.standardDailyHours);
    // One day = hourlyRate * 8
    const expected = hourlyRate * TL_WORKING_HOURS.standardDailyHours;
    expect(deduction).toBeCloseTo(expected, 1);
  });

  it("deducts correctly for partial absence (4 hours)", () => {
    const deduction = calculateAbsenceDeduction(hourlyRate, 4);
    expect(deduction).toBeCloseTo(hourlyRate * 4, 1);
  });

  it("deducts correctly for multi-day absence (3 days = 24 hours)", () => {
    const absenceHours = TL_WORKING_HOURS.standardDailyHours * 3;
    const deduction = calculateAbsenceDeduction(hourlyRate, absenceHours);
    expect(deduction).toBeCloseTo(hourlyRate * absenceHours, 1);
  });

  // ---- Late arrival deduction unit tests ----

  it("calculates zero late deduction for 0 minutes", () => {
    const deduction = calculateLateDeduction(hourlyRate, 0);
    expect(deduction).toBe(0);
  });

  it("rounds up to 15-minute increments by default", () => {
    // 1 minute late → rounds to 15 minutes
    const deduction1 = calculateLateDeduction(hourlyRate, 1);
    const deduction15 = calculateLateDeduction(hourlyRate, 15);
    expect(deduction1).toBe(deduction15);
    expect(deduction1).toBeCloseTo(hourlyRate * (15 / 60), 2);
  });

  it("rounds 16 minutes to 30 minutes", () => {
    const deduction = calculateLateDeduction(hourlyRate, 16);
    expect(deduction).toBeCloseTo(hourlyRate * (30 / 60), 2);
  });

  it("exact 15-minute boundary stays at 15", () => {
    const deduction = calculateLateDeduction(hourlyRate, 15);
    expect(deduction).toBeCloseTo(hourlyRate * (15 / 60), 2);
  });

  it("supports custom rounding (30-minute increments)", () => {
    // 10 minutes late, round to 30 → charges 30 minutes
    const deduction = calculateLateDeduction(hourlyRate, 10, 30);
    expect(deduction).toBeCloseTo(hourlyRate * (30 / 60), 2);
  });

  it("60-minute late equals 1 full hour", () => {
    const deduction = calculateLateDeduction(hourlyRate, 60);
    expect(deduction).toBeCloseTo(hourlyRate, 2);
  });

  // ---- Integration: absence/late in full payroll ----

  it("absence reduces gross and affects WIT/INSS base", () => {
    const base = makeEmployee({
      employeeId: "absence-integration",
      monthlySalary: 800,
    });
    const withAbsence = makeEmployee({
      employeeId: "absence-integration",
      monthlySalary: 800,
      absenceHours: 16, // 2 days absent
    });

    const baseResult = calculateTLPayroll(base);
    const absenceResult = calculateTLPayroll(withAbsence);

    // Absence deduction should appear in result
    expect(absenceResult.absenceDeduction).toBeGreaterThan(0);
    expect(absenceResult.absenceDeduction).toBeCloseTo(hourlyRate * 16, 1);

    // Net pay should be lower
    expect(absenceResult.netPay).toBeLessThan(baseResult.netPay);

    // INSS base should be reduced by absence
    expect(absenceResult.inssBase).toBeLessThan(baseResult.inssBase);
  });

  it("late arrival reduces net pay and appears as deduction", () => {
    const base = makeEmployee({
      employeeId: "late-integration",
      monthlySalary: 600,
    });
    const withLate = makeEmployee({
      employeeId: "late-integration",
      monthlySalary: 600,
      lateArrivalMinutes: 45, // 45 min late (rounds to 45)
    });

    const baseResult = calculateTLPayroll(base);
    const lateResult = calculateTLPayroll(withLate);

    // Late deduction should appear
    expect(lateResult.lateDeduction).toBeGreaterThan(0);

    // Net pay should be lower
    expect(lateResult.netPay).toBeLessThan(baseResult.netPay);

    // Deduction line item should exist
    const lateItem = lateResult.deductions.find(d => d.type === "late_arrival");
    expect(lateItem).toBeDefined();
    expect(lateItem!.amount).toBeGreaterThan(0);
    expect(lateItem!.isStatutory).toBe(false);
  });

  it("combined absence + late arrival deductions accumulate", () => {
    const emp = makeEmployee({
      employeeId: "combined-deductions",
      monthlySalary: 800,
      absenceHours: 8,         // 1 day absent
      lateArrivalMinutes: 30,  // 30 min late
    });

    const result = calculateTLPayroll(emp);

    expect(result.absenceDeduction).toBeGreaterThan(0);
    expect(result.lateDeduction).toBeGreaterThan(0);

    // Both should appear in deductions array
    const absenceItem = result.deductions.find(d => d.type === "absence");
    const lateItem = result.deductions.find(d => d.type === "late_arrival");
    expect(absenceItem).toBeDefined();
    expect(lateItem).toBeDefined();

    // Total deductions should include both
    expect(result.totalDeductions).toBeGreaterThanOrEqual(
      result.absenceDeduction + result.lateDeduction
    );
  });
});

// ============================================================
// TEST SUITE: WEEKLY RECONCILIATION (4 weeks ≈ monthly)
// ============================================================

describe("Weekly Reconciliation: sum of weeks equals monthly salary", () => {
  it("calculateMonthlyWeeklyPayrolls sums exactly to monthly salary", () => {
    const monthlySalary = 1000;
    // Typical month: 4 weeks of 5.5 working days + 1 short week
    const weeklyDays = [5.5, 5.5, 5.5, 5.5, 1];
    const breakdown = calculateMonthlyWeeklyPayrolls(monthlySalary, weeklyDays);

    expect(breakdown).toHaveLength(5);

    // Sum of all weeks must EXACTLY equal monthly salary
    const total = breakdown.reduce((s, w) => s + w.amount, 0);
    expect(total).toBeCloseTo(monthlySalary, 2);

    // Last week should be reconciled
    expect(breakdown[breakdown.length - 1].isReconciled).toBe(true);

    // Non-last weeks should not be reconciled
    for (let i = 0; i < breakdown.length - 1; i++) {
      expect(breakdown[i].isReconciled).toBe(false);
    }
  });

  it("handles even 4-week month (22 working days)", () => {
    const monthlySalary = 800;
    const weeklyDays = [5.5, 5.5, 5.5, 5.5]; // 22 days
    const breakdown = calculateMonthlyWeeklyPayrolls(monthlySalary, weeklyDays);

    const total = breakdown.reduce((s, w) => s + w.amount, 0);
    expect(total).toBeCloseTo(monthlySalary, 2);

    // All weeks should be equal except last (reconciliation)
    expect(breakdown[0].amount).toBeCloseTo(breakdown[1].amount, 2);
    expect(breakdown[0].amount).toBeCloseTo(breakdown[2].amount, 2);
  });

  it("handles empty weeks array", () => {
    const breakdown = calculateMonthlyWeeklyPayrolls(1000, []);
    expect(breakdown).toHaveLength(0);
  });

  it("handles all-zero working days", () => {
    const breakdown = calculateMonthlyWeeklyPayrolls(1000, [0, 0, 0, 0]);
    expect(breakdown).toHaveLength(4);
    const total = breakdown.reduce((s, w) => s + w.amount, 0);
    expect(total).toBe(0);
  });

  it("4 weekly payrolls approximate monthly payroll totals", () => {
    // Run monthly payroll
    const monthlyEmp = makeEmployee({
      employeeId: "reconcile-monthly",
      monthlySalary: 800,
      payFrequency: "monthly",
      regularHours: 190,
    });
    const monthlyResult = calculateTLPayroll(monthlyEmp);

    // Run 4 weekly payrolls (splitting the same salary)
    const weeklyResults = [];
    for (let w = 1; w <= 4; w++) {
      const weeklyEmp = makeEmployee({
        employeeId: "reconcile-weekly",
        monthlySalary: 800,
        payFrequency: "weekly",
        regularHours: 44,
        periodNumber: w,
        totalPeriodsInMonth: 4,
      });
      weeklyResults.push(calculateTLPayroll(weeklyEmp));
    }

    // Sum of weekly gross should equal monthly gross
    const weeklyGrossSum = weeklyResults.reduce((s, r) => s + r.grossPay, 0);
    expect(weeklyGrossSum).toBeCloseTo(monthlyResult.grossPay, 1);

    // Sum of weekly WIT should equal monthly WIT
    const weeklyWITSum = weeklyResults.reduce((s, r) => s + r.incomeTax, 0);
    expect(weeklyWITSum).toBeCloseTo(monthlyResult.incomeTax, 1);

    // Sum of weekly INSS employee should equal monthly INSS
    const weeklyINSSSum = weeklyResults.reduce((s, r) => s + r.inssEmployee, 0);
    expect(weeklyINSSSum).toBeCloseTo(monthlyResult.inssEmployee, 1);

    // Sum of weekly net should equal monthly net
    const weeklyNetSum = weeklyResults.reduce((s, r) => s + r.netPay, 0);
    expect(weeklyNetSum).toBeCloseTo(monthlyResult.netPay, 1);
  });

  it("weekly payroll for below-threshold employee has $0 WIT per week", () => {
    // $400/month is below $500 threshold
    for (let w = 1; w <= 4; w++) {
      const weeklyEmp = makeEmployee({
        employeeId: "below-threshold-weekly",
        monthlySalary: 400,
        payFrequency: "weekly",
        regularHours: 44,
        periodNumber: w,
        totalPeriodsInMonth: 4,
      });
      const result = calculateTLPayroll(weeklyEmp);
      expect(result.incomeTax).toBe(0);
    }
  });
});
