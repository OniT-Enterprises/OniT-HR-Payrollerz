import { describe, expect, it } from "vitest";
import {
  calculateTLPayroll,
  calculateSubsidioAnual,
  validateTLPayrollInput,
  type TLPayrollInput,
} from "@/lib/payroll/calculations-tl";
import { getDefaultTLInssOptionalContributionBase } from "@/lib/payroll/constants-tl";

function makeBaseInput(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: "emp-1",
    monthlySalary: 800,
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

// ============================================================
// INSS Optional Registration Band Selection
// ============================================================

describe("TL INSS (optional registration) band selection", () => {
  it("selects the expected band base", () => {
    expect(getDefaultTLInssOptionalContributionBase(0)).toBe(0);
    expect(getDefaultTLInssOptionalContributionBase(1)).toBe(120);
    expect(getDefaultTLInssOptionalContributionBase(120)).toBe(120);
    expect(getDefaultTLInssOptionalContributionBase(121)).toBe(150);
    expect(getDefaultTLInssOptionalContributionBase(800)).toBe(840);
    expect(getDefaultTLInssOptionalContributionBase(6000)).toBe(6000);
    expect(getDefaultTLInssOptionalContributionBase(6001)).toBe(12000);
    expect(getDefaultTLInssOptionalContributionBase(25000)).toBe(12000);
  });
});

// ============================================================
// Core WIT / INSS Calculations
// ============================================================

describe("TL payroll calculations", () => {
  it("calculates resident WIT correctly (monthly)", () => {
    const result = calculateTLPayroll(makeBaseInput({ monthlySalary: 800 }));
    expect(result.taxableIncome).toBe(800);
    // 10% on (800 - 500) = $30
    expect(result.incomeTax).toBe(30);
  });

  it("calculates non-resident WIT correctly (monthly)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 800,
        taxInfo: { isResident: false, hasTaxExemption: false },
      })
    );
    // 10% on full 800 (no threshold)
    expect(result.incomeTax).toBe(80);
  });

  it("applies zero WIT for resident below $500 threshold", () => {
    const result = calculateTLPayroll(makeBaseInput({ monthlySalary: 400 }));
    expect(result.incomeTax).toBe(0);
  });

  it("applies WIT for non-resident below $500 (no threshold)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 400,
        taxInfo: { isResident: false, hasTaxExemption: false },
      })
    );
    // 10% on full 400
    expect(result.incomeTax).toBe(40);
  });

  it("excludes overtime from INSS base (mandatory registration)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 500,
        overtimeHours: 10,
      })
    );
    expect(result.inssBase).toBe(500);
    expect(result.inssEmployee).toBe(20);
  });

  it("excludes bonus from INSS base (mandatory registration)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 500,
        bonus: 100,
      })
    );
    expect(result.inssBase).toBe(500);
    expect(result.inssEmployee).toBe(20);
  });

  it("calculates INSS employer at 6%", () => {
    const result = calculateTLPayroll(makeBaseInput({ monthlySalary: 1000 }));
    // 4% employee + 6% employer on base salary
    expect(result.inssEmployee).toBe(40);
    expect(result.inssEmployer).toBe(60);
  });
});

// ============================================================
// #17: Subsidio Anual (13th Month) Pro-ration
// ============================================================

describe("Subsidio Anual pro-ration", () => {
  it("returns full salary for 12 months worked", () => {
    const result = calculateSubsidioAnual(1000, 12, "2024-01-01", new Date("2025-12-15"));
    expect(result).toBe(1000);
  });

  it("pro-rates for mid-year hire (6 months)", () => {
    // Hired July 2025, as of December 2025 = 6 months
    const result = calculateSubsidioAnual(1200, 12, "2025-07-01", new Date("2025-12-15"));
    // 6/12 * 1200 = 600
    expect(result).toBe(600);
  });

  it("pro-rates for 1 month worked", () => {
    const result = calculateSubsidioAnual(1200, 1, "2025-12-01", new Date("2025-12-15"));
    // 1/12 * 1200 = 100
    expect(result).toBe(100);
  });

  it("returns 0 for future hire date", () => {
    const result = calculateSubsidioAnual(1000, 0, "2026-06-01", new Date("2025-12-15"));
    expect(result).toBe(0);
  });

  it("includes subsidio anual in payroll when flag is set", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 1200,
        monthsWorkedThisYear: 12,
        hireDate: "2024-01-01",
      })
    );
    // Without subsidio, should not have it
    expect(result.subsidioAnual).toBe(0);

    // With subsidio
    const withSubsidio = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 1200,
        monthsWorkedThisYear: 12,
        hireDate: "2024-01-01",
        subsidioAnual: 1200,
      })
    );
    expect(withSubsidio.subsidioAnual).toBe(1200);
    expect(withSubsidio.grossPay).toBeGreaterThan(result.grossPay);
  });
});

// ============================================================
// #18: Sick Leave Tiers (100% first 6, 50% next 6)
// ============================================================

describe("Sick leave tiers", () => {
  const monthlyHours = (44 * 52) / 12; // ~190.67
  // divideMoney rounds to 2 decimal places (Decimal.js ROUND_HALF_UP)
  const hourlyRate = Math.round((1200 / monthlyHours) * 100) / 100;
  const dailyRate = hourlyRate * 8;

  it("pays 100% for first 6 sick days", () => {
    const result = calculateTLPayroll(
      makeBaseInput({ monthlySalary: 1200, sickDays: 3, sickDaysUsed: 3 })
    );
    // Sick leave earnings should exist
    const sickEarning = result.earnings.find((e) => e.type === "sick_pay");
    expect(sickEarning).toBeDefined();
    if (sickEarning) {
      // 3 days * dailyRate * 100% = 3 * dailyRate
      expect(sickEarning.amount).toBeCloseTo(dailyRate * 3, 0);
    }
  });

  it("pays 50% for sick days 7-12", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 1200,
        sickDaysUsed: 3,
        ytdSickDaysUsed: 6, // already used 6, so these 3 are at 50%
      })
    );
    const sickEarning = result.earnings.find((e) => e.type === "sick_pay");
    expect(sickEarning).toBeDefined();
    if (sickEarning) {
      // 3 days at 50% = 3 * dailyRate * 0.5
      expect(sickEarning.amount).toBeCloseTo(dailyRate * 3 * 0.5, 0);
    }
  });

  it("handles mixed tier sick leave (straddles day 6/7)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 1200,
        sickDaysUsed: 4,
        ytdSickDaysUsed: 4, // 4 already used, so days 5-8 = 2@100% + 2@50%
      })
    );
    const sickEarning = result.earnings.find((e) => e.type === "sick_pay");
    expect(sickEarning).toBeDefined();
    if (sickEarning) {
      const expected = dailyRate * 2 * 1.0 + dailyRate * 2 * 0.5;
      expect(sickEarning.amount).toBeCloseTo(expected, 0);
    }
  });
});

// ============================================================
// #19: Weekly/Biweekly Threshold Pro-ration
// ============================================================

describe("Weekly/biweekly threshold pro-ration", () => {
  it("pro-rates WIT threshold for weekly pay (4 periods)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 800,
        payFrequency: "weekly",
        totalPeriodsInMonth: 4,
        regularHours: 44,
      })
    );
    // Weekly salary = 800/4 = 200. Threshold = 500/4 = 125.
    // Tax = 10% * (200 - 125) = 7.50
    expect(result.incomeTax).toBeCloseTo(7.5, 1);
  });

  it("pro-rates WIT threshold for biweekly pay (2 periods)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 800,
        payFrequency: "biweekly",
        totalPeriodsInMonth: 2,
        regularHours: 88,
      })
    );
    // Biweekly salary = 800/2 = 400. Threshold = 500/2 = 250.
    // Tax = 10% * (400 - 250) = 15
    expect(result.incomeTax).toBeCloseTo(15, 1);
  });

  it("produces zero WIT when weekly pay is below pro-rated threshold", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 400,
        payFrequency: "weekly",
        totalPeriodsInMonth: 4,
        regularHours: 44,
      })
    );
    // Weekly salary = 400/4 = 100. Threshold = 500/4 = 125. Below threshold.
    expect(result.incomeTax).toBe(0);
  });
});

// ============================================================
// #20: Overtime / Night / Holiday Rate Calculations
// ============================================================

describe("Overtime, night shift, and holiday rate calculations", () => {
  const monthlyHours = (44 * 52) / 12;
  const salary = 1000;
  // divideMoney rounds to 2 decimal places (Decimal.js ROUND_HALF_UP)
  const hourlyRate = Math.round((salary / monthlyHours) * 100) / 100;

  it("calculates overtime at 150% (1.5x)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({ monthlySalary: salary, overtimeHours: 10 })
    );
    expect(result.overtimePay).toBeCloseTo(hourlyRate * 10 * 1.5, 1);
  });

  it("calculates night shift at 125% (1.25x)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({ monthlySalary: salary, nightShiftHours: 10 })
    );
    expect(result.nightShiftPay).toBeCloseTo(hourlyRate * 10 * 1.25, 1);
  });

  it("calculates holiday pay at 200% (2x)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({ monthlySalary: salary, holidayHours: 8 })
    );
    expect(result.holidayPay).toBeCloseTo(hourlyRate * 8 * 2.0, 1);
  });

  it("calculates rest day pay at 200% (2x)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({ monthlySalary: salary, restDayHours: 8 })
    );
    const restDayEarning = result.earnings.find((e) => e.type === "rest_day");
    expect(restDayEarning).toBeDefined();
    if (restDayEarning) {
      expect(restDayEarning.amount).toBeCloseTo(hourlyRate * 8 * 2.0, 1);
    }
  });

  it("combines multiple premium types correctly", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: salary,
        overtimeHours: 5,
        nightShiftHours: 3,
        holidayHours: 2,
      })
    );
    const expectedOT = hourlyRate * 5 * 1.5;
    const expectedNight = hourlyRate * 3 * 1.25;
    const expectedHoliday = hourlyRate * 2 * 2.0;

    expect(result.overtimePay).toBeCloseTo(expectedOT, 1);
    expect(result.nightShiftPay).toBeCloseTo(expectedNight, 1);
    expect(result.holidayPay).toBeCloseTo(expectedHoliday, 1);
    expect(result.grossPay).toBeCloseTo(salary + expectedOT + expectedNight + expectedHoliday, 0);
  });
});

// ============================================================
// #21: Edge Cases (zero, negative, huge)
// ============================================================

describe("Edge cases", () => {
  it("handles zero salary (generates warning)", () => {
    const result = calculateTLPayroll(makeBaseInput({ monthlySalary: 0 }));
    expect(result.grossPay).toBe(0);
    expect(result.netPay).toBe(0);
    expect(result.incomeTax).toBe(0);
    expect(result.inssEmployee).toBe(0);
  });

  it("handles minimum wage exactly ($115)", () => {
    const result = calculateTLPayroll(makeBaseInput({ monthlySalary: 115 }));
    expect(result.grossPay).toBe(115);
    // Below $500 threshold, no WIT
    expect(result.incomeTax).toBe(0);
    // INSS 4% of 115 = 4.60
    expect(result.inssEmployee).toBeCloseTo(4.6, 1);
  });

  it("handles very high salary ($100K)", () => {
    const result = calculateTLPayroll(makeBaseInput({ monthlySalary: 100000 }));
    expect(result.grossPay).toBe(100000);
    // WIT: 10% * (100000 - 500) = 9950
    expect(result.incomeTax).toBeCloseTo(9950, 0);
    // INSS: 4% of 100000 = 4000
    expect(result.inssEmployee).toBeCloseTo(4000, 0);
    // Net = 100000 - 9950 - 4000 = 86050
    expect(result.netPay).toBeCloseTo(86050, 0);
  });

  it("calculates totalEmployerCost = grossPay + INSS employer", () => {
    const result = calculateTLPayroll(makeBaseInput({ monthlySalary: 1000 }));
    expect(result.totalEmployerCost).toBeCloseTo(result.grossPay + result.inssEmployer, 1);
  });

  it("net pay = gross - total deductions", () => {
    const result = calculateTLPayroll(
      makeBaseInput({ monthlySalary: 800, bonus: 200, loanRepayment: 50 })
    );
    expect(result.netPay).toBeCloseTo(result.grossPay - result.totalDeductions, 1);
  });

  it("caps voluntary deductions at 30% of gross pay", () => {
    // Gross pay = 800. 30% = 240. Voluntary deductions = 300 (should be capped)
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 800,
        loanRepayment: 150,
        advanceRepayment: 150,
      })
    );
    // Voluntary deductions should be capped at 30% of gross
    const voluntaryDeductions = result.deductions
      .filter((d) => !d.isStatutory)
      .reduce((sum, d) => sum + d.amount, 0);
    const cap = result.grossPay * 0.30;
    expect(voluntaryDeductions).toBeLessThanOrEqual(cap + 0.01);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("30% cap"))).toBe(true);
  });
});

// ============================================================
// Validation Function
// ============================================================

describe("validateTLPayrollInput", () => {
  it("returns no errors for valid input", () => {
    const errors = validateTLPayrollInput(makeBaseInput());
    expect(errors).toEqual([]);
  });

  it("rejects negative salary", () => {
    const errors = validateTLPayrollInput(makeBaseInput({ monthlySalary: -100 }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("negative");
  });

  it("warns about salary below minimum wage", () => {
    const errors = validateTLPayrollInput(makeBaseInput({ monthlySalary: 50 }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("minimum wage");
  });

  it("rejects negative regular hours", () => {
    const errors = validateTLPayrollInput(makeBaseInput({ regularHours: -10 }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("negative");
  });

  it("warns about excessive overtime", () => {
    // Max overtime = 16hrs/week * 4 = 64 per month
    const errors = validateTLPayrollInput(makeBaseInput({ overtimeHours: 100 }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("exceed");
  });

  it("warns about sick days exceeding annual limit", () => {
    const errors = validateTLPayrollInput(
      makeBaseInput({ sickDaysUsed: 5, ytdSickDaysUsed: 10 })
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("sick days");
  });
});
