import { describe, expect, it } from "vitest";
import {
  calculateTLPayroll,
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

describe("TL payroll calculations", () => {
  it("calculates resident WIT correctly (monthly)", () => {
    const result = calculateTLPayroll(makeBaseInput({ monthlySalary: 800 }));
    expect(result.taxableIncome).toBe(800);
    expect(result.incomeTax).toBe(30);
  });

  it("calculates non-resident WIT correctly (monthly)", () => {
    const result = calculateTLPayroll(
      makeBaseInput({
        monthlySalary: 800,
        taxInfo: { isResident: false, hasTaxExemption: false },
      })
    );
    expect(result.incomeTax).toBe(80);
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
});
