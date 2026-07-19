import { describe, expect, it } from "vitest";
import {
  calculateIncomeTax,
  calculateOvertimePay,
  calculateServiceCompensation,
  calculateServiceCompensationDetails,
  calculateSubsidioAnual,
  calculateTLPayroll,
  validateTLPayrollInput,
  type TLPayrollInput,
} from "@/lib/payroll/calculations-tl";
import {
  getAnnualWITDueDate,
  getMonthlyWITDueDate,
} from "@/lib/tax/compliance";
import { calculateTLWithholding } from "@/lib/tax/withholding-tl";
import {
  calculateTLIncomeTaxInstallment,
  getTLIncomeTaxInstallmentFrequency,
} from "@/lib/tax/income-tax-installment-tl";
import {
  calculateTLServicesTax,
  TL_SERVICES_TAX_THRESHOLD,
} from "@/lib/tax/services-tax-tl";
import {
  MissingStatutoryPayrollDataError,
  MissingStatutorySourceDataError,
  requireStatutoryEmployerIdentity,
  requireStatutoryISODate,
  requireStatutoryPayrollAmount,
  requireStatutoryPayrollEmployeeId,
  requireStatutoryPayrollResidency,
} from "@/lib/tax/statutory-payroll-record";

function payrollInput(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: "synthetic-case",
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
    bonusINSSCategory: null,
    commission: 0,
    perDiem: 0,
    foodAllowance: 0,
    transportAllowance: 0,
    otherEarnings: 0,
    subsidioAnual: 0,
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
    hireDate: "2020-01-01",
    ...overrides,
  };
}

describe("mined TL wage-income-tax cases W1-W7", () => {
  it.each([
    { id: "W1", salary: 450, resident: true, expected: 0 },
    { id: "W2", salary: 500, resident: true, expected: 0 },
    { id: "W3", salary: 800, resident: true, expected: 30 },
    { id: "W4", salary: 10_000, resident: true, expected: 950 },
    { id: "W5", salary: 800, resident: false, expected: 80 },
    { id: "W6", salary: 450, resident: false, expected: 45 },
  ])("$id calculates monthly WIT", ({ salary, resident, expected }) => {
    const result = calculateTLPayroll(
      payrollInput({
        monthlySalary: salary,
        taxInfo: { isResident: resident, hasTaxExemption: false },
      }),
    );
    expect(result.incomeTax).toBe(expected);
  });

  it("W7 taxes all $3,400 of salary, annual subsidy, and termination compensation", () => {
    expect(calculateIncomeTax(3_400, true, "monthly")).toBe(290);
  });
});

describe("mined TL INSS cases I1-I3 and classification boundary", () => {
  it("I1 applies 4% employee and 6% employer to $1,000", () => {
    const result = calculateTLPayroll(payrollInput({ monthlySalary: 1_000 }));
    expect(result.inssEmployee).toBe(40);
    expect(result.inssEmployer).toBe(60);
  });

  it("I2 excludes overtime and expense allowances from the contribution base", () => {
    const result = calculateTLPayroll(
      payrollInput({
        monthlySalary: 1_000,
        overtimeHours: 10,
        perDiem: 200,
        foodAllowance: 100,
        transportAllowance: 50,
      }),
    );
    expect(result.inssBase).toBe(1_000);
    expect(result.inssEmployee).toBe(40);
    expect(result.inssEmployer).toBe(60);
  });

  it("I3 honours an explicit INSS exemption", () => {
    const result = calculateTLPayroll(
      payrollInput({
        monthlySalary: 1_000,
        taxInfo: { isResident: true, hasTaxExemption: false, inssExempt: true },
      }),
    );
    expect(result.inssBase).toBe(0);
    expect(result.inssEmployee).toBe(0);
    expect(result.inssEmployer).toBe(0);
  });

  it("includes performance pay and commission but excludes company-profit awards", () => {
    const performance = calculateTLPayroll(
      payrollInput({
        monthlySalary: 1_000,
        bonus: 100,
        bonusINSSCategory: "individual_performance",
        commission: 50,
      }),
    );
    const companyProfit = calculateTLPayroll(
      payrollInput({
        monthlySalary: 1_000,
        bonus: 100,
        bonusINSSCategory: "company_profit",
        commission: 50,
      }),
    );

    expect(performance.inssBase).toBe(1_150);
    expect(companyProfit.inssBase).toBe(1_050);
  });

  it("refuses to guess the INSS treatment of an unclassified bonus", () => {
    const input = payrollInput({ bonus: 100, bonusINSSCategory: null });
    expect(validateTLPayrollInput(input)).toContain(
      "Bonus INSS category is required: individual performance, company profit, or extraordinary.",
    );
    expect(() => calculateTLPayroll(input)).toThrow(
      /Bonus INSS category is required/,
    );
  });
});

describe("mined annual-subsidy cases S1-S2", () => {
  it("S1 uses one month of base salary for a full year", () => {
    expect(
      calculateSubsidioAnual(600, "2025-01-01", new Date("2025-12-15")),
    ).toBe(600);
  });

  it("S2 prorates six months of service", () => {
    expect(
      calculateSubsidioAnual(600, "2025-07-01", new Date("2025-12-15")),
    ).toBe(300);
  });
});

describe("mined overtime cases O1-O3", () => {
  it("O1 pays ten ordinary overtime hours at 1.5x", () => {
    expect(calculateOvertimePay(5, 10, 0, 0, 0).overtime).toBe(75);
  });

  it("O2 pays eight public-holiday hours at 2x", () => {
    expect(calculateOvertimePay(5, 0, 0, 8, 0).holiday).toBe(80);
  });

  it("O3 pays eight weekly-rest-day hours at 2x", () => {
    expect(calculateOvertimePay(5, 0, 0, 0, 8).restDay).toBe(80);
  });
});

const domesticBusinessPayment = {
  recipientHasTimorLestePermanentEstablishment: false,
  payerIsIndividual: false,
  taxRegime: "domestic" as const,
};

describe("mined non-payroll withholding cases H1-H3", () => {
  it("H1 withholds 10% from a general non-resident service payment", () => {
    const result = calculateTLWithholding({
      ...domesticBusinessPayment,
      grossAmount: 1_000,
      category: "general_service",
      recipientResidence: "non_resident",
    });
    expect(result.withholdingTax).toBe(100);
    expect(result.netPayment).toBe(900);
    expect(result.legalBasis).toContain("Art. 57");
  });

  it("H2 applies an explicitly documented 5% treaty rate", () => {
    const result = calculateTLWithholding({
      ...domesticBusinessPayment,
      grossAmount: 1_000,
      category: "general_service",
      recipientResidence: "non_resident",
      treatyRate: 0.05,
    });
    expect(result.withholdingTax).toBe(50);
    expect(result.netPayment).toBe(950);
  });

  it("H3 does not withhold exempt dividend income", () => {
    const result = calculateTLWithholding({
      ...domesticBusinessPayment,
      grossAmount: 1_000,
      category: "dividend",
      recipientResidence: "resident",
    });
    expect(result.withholdingTax).toBe(0);
    expect(result.netPayment).toBe(1_000);
  });
});

describe("mined filing-deadline cases D1-D3", () => {
  it("D1 places June WIT on 15 July", () => {
    expect(getMonthlyWITDueDate("2025-06", (date) => date)).toBe("2025-07-15");
  });

  it("D2 places tax-year 2025 annual WIT on 31 March 2026", () => {
    expect(getAnnualWITDueDate(2025, (date) => date)).toBe("2026-03-31");
  });

  it("D3 passes the statutory date through the TL business-day adjustment", () => {
    const adjusted: string[] = [];
    const result = getMonthlyWITDueDate("2026-07", (date) => {
      adjusted.push(date);
      return "2026-08-17";
    });
    expect(adjusted).toEqual(["2026-08-15"]);
    expect(result).toBe("2026-08-17");
  });
});

describe("verified payroll gaps", () => {
  it("calculates one salary month for every completed five-year service block", () => {
    expect(calculateServiceCompensation(700, "2020-07-17", "2025-07-16")).toBe(
      0,
    );
    expect(calculateServiceCompensation(700, "2020-07-17", "2025-07-17")).toBe(
      700,
    );
    expect(calculateServiceCompensation(700, "2015-07-17", "2025-07-17")).toBe(
      1_400,
    );
  });

  it("returns the frozen service facts needed by offboarding", () => {
    expect(calculateServiceCompensationDetails(700, "2014-07-18", "2026-07-17")).toEqual({
      monthlySalary: 700,
      hireDate: "2014-07-18",
      terminationDate: "2026-07-17",
      completedYears: 11,
      completedFiveYearPeriods: 2,
      salaryMonths: 2,
      amount: 1_400,
    });
  });

  it("derives service compensation and includes it in WIT but not the INSS base", () => {
    const result = calculateTLPayroll(
      payrollInput({
        monthlySalary: 700,
        hireDate: "2015-07-17",
        terminationDate: "2025-07-17",
      }),
    );
    expect(result.serviceCompensation).toBe(1_400);
    expect(result.taxableIncome).toBe(2_100);
    expect(result.incomeTax).toBe(160);
    expect(result.inssBase).toBe(700);
  });

  it("uses a strict greater-than-$20 threshold without treating benefits as cash", () => {
    const atThreshold = calculateTLPayroll(
      payrollInput({
        monthlySalary: 700,
        nonCashBenefits: 20,
        nonCashBenefitINSSCategory: "regular_remuneration",
      }),
    );
    const aboveThreshold = calculateTLPayroll(
      payrollInput({
        monthlySalary: 700,
        nonCashBenefits: 20.01,
        nonCashBenefitINSSCategory: "regular_remuneration",
      }),
    );

    expect(atThreshold.taxableIncome).toBe(700);
    expect(aboveThreshold.taxableIncome).toBe(720.01);
    expect(atThreshold.inssBase).toBe(720);
    expect(aboveThreshold.inssBase).toBe(720.01);
    expect(aboveThreshold.totalCompensation).toBe(720.01);
    expect(aboveThreshold.grossPay).toBe(700);
    expect(aboveThreshold.cashGrossPay).toBe(700);
  });

  it("requires the separate INSS classification for a non-cash benefit", () => {
    const unclassified = payrollInput({
      nonCashBenefits: 30,
      nonCashBenefitINSSCategory: null,
    });
    expect(validateTLPayrollInput(unclassified)).toContain(
      "Non-cash benefit INSS category is required: regular remuneration, expense allowance, or extraordinary.",
    );
    expect(() => calculateTLPayroll(unclassified)).toThrow(
      /Non-cash benefit INSS category/,
    );

    const expenseBenefit = calculateTLPayroll(
      payrollInput({
        monthlySalary: 700,
        nonCashBenefits: 30,
        nonCashBenefitINSSCategory: "expense_allowance",
      }),
    );
    expect(expenseBenefit.taxableIncome).toBe(730);
    expect(expenseBenefit.inssBase).toBe(700);
  });

  it("refuses to calculate the separate petroleum-contractor regime", () => {
    expect(() =>
      calculateTLWithholding({
        grossAmount: 1_000,
        category: "general_service",
        recipientResidence: "non_resident",
        recipientHasTimorLestePermanentEstablishment: false,
        payerIsIndividual: false,
        taxRegime: "petroleum",
      }),
    ).toThrow(/petroleum-contractor tax regime is outside Xefe/i);
  });
});

describe("additional primary-law improvement: Art. 64 income-tax installments", () => {
  it("uses quarterly filing through the $1 million prior-year turnover boundary", () => {
    expect(getTLIncomeTaxInstallmentFrequency(0)).toBe("quarterly");
    expect(getTLIncomeTaxInstallmentFrequency(1_000_000)).toBe("quarterly");
  });

  it("uses monthly filing only above $1 million prior-year turnover", () => {
    expect(getTLIncomeTaxInstallmentFrequency(1_000_000.01)).toBe("monthly");
  });

  it("calculates 0.5% of the applicable month or quarter turnover", () => {
    expect(calculateTLIncomeTaxInstallment(80_000)).toBe(400);
  });
});

describe("additional primary-law improvement: domestic services tax", () => {
  it("charges no services tax below $500 of combined designated receipts", () => {
    const result = calculateTLServicesTax({
      hotelServices: 300,
      restaurantBarServices: 199.99,
      telecommunicationsServices: 0,
    });
    expect(result.totalDesignatedReceipts).toBe(499.99);
    expect(result.rate).toBe(0);
    expect(result.taxDue).toBe(0);
  });

  it("charges 5% on the entire combined total at the exact $500 boundary", () => {
    const result = calculateTLServicesTax({
      hotelServices: 300,
      restaurantBarServices: 150,
      telecommunicationsServices: 50,
    });
    expect(result.totalDesignatedReceipts).toBe(TL_SERVICES_TAX_THRESHOLD);
    expect(result.rate).toBe(0.05);
    expect(result.taxDue).toBe(25);
    expect(result.taxByService).toEqual({
      hotelServices: 15,
      restaurantBarServices: 7.5,
      telecommunicationsServices: 2.5,
    });
  });

  it("uses Decimal-based cent rounding above the threshold", () => {
    const result = calculateTLServicesTax({
      hotelServices: 500.1,
      restaurantBarServices: 0,
      telecommunicationsServices: 0,
    });
    expect(result.taxDue).toBe(25.01);
  });

  it("refuses invalid or negative receipt amounts", () => {
    expect(() =>
      calculateTLServicesTax({
        hotelServices: -1,
        restaurantBarServices: 0,
        telecommunicationsServices: 0,
      }),
    ).toThrow(/non-negative finite amount/);
  });
});

describe("statutory filing inputs fail closed instead of reconstructing payroll", () => {
  const storedRecord = {
    employeeId: "synthetic-case",
    wagesPaid: 700,
    witTaxableAmount: 200,
    inssBase: 700,
    incomeTax: 20,
    inssEmployee: 28,
    inssEmployer: 42,
    netPay: 652,
    isResident: true,
  };

  it("accepts explicitly stored statutory fields", () => {
    expect(requireStatutoryPayrollEmployeeId(storedRecord)).toBe(
      "synthetic-case",
    );
    expect(
      requireStatutoryPayrollAmount(storedRecord, "witTaxableAmount"),
    ).toBe(200);
    expect(requireStatutoryPayrollResidency(storedRecord)).toBe(true);
  });

  it("does not derive a missing taxable base from WIT divided by a rate", () => {
    const { witTaxableAmount: _removed, ...incomplete } = storedRecord;
    expect(() =>
      requireStatutoryPayrollAmount(incomplete, "witTaxableAmount"),
    ).toThrow(MissingStatutoryPayrollDataError);
  });

  it("does not accept negative or non-finite statutory amounts", () => {
    expect(() =>
      requireStatutoryPayrollAmount(
        { ...storedRecord, inssBase: -1 },
        "inssBase",
      ),
    ).toThrow(/will not infer compliance values/);
    expect(() =>
      requireStatutoryPayrollAmount(
        { ...storedRecord, incomeTax: Number.NaN },
        "incomeTax",
      ),
    ).toThrow(MissingStatutoryPayrollDataError);
  });

  it("requires explicit employee and residency classifications", () => {
    expect(() =>
      requireStatutoryPayrollEmployeeId({ ...storedRecord, employeeId: "" }),
    ).toThrow(MissingStatutoryPayrollDataError);
    expect(() =>
      requireStatutoryPayrollResidency({
        ...storedRecord,
        isResident: undefined,
      }),
    ).toThrow(MissingStatutoryPayrollDataError);
  });

  it("requires the statutory employer identity instead of exporting blanks", () => {
    expect(
      requireStatutoryEmployerIdentity({
        tinNumber: " 1234567 ",
        legalName: " Example Employer, Lda ",
        registeredAddress: " Dili ",
      }),
    ).toEqual({
      employerTIN: "1234567",
      employerName: "Example Employer, Lda",
      employerAddress: "Dili",
    });

    expect(() =>
      requireStatutoryEmployerIdentity({
        tinNumber: "",
        legalName: "Trading Name Is Not A Legal-Name Fallback",
        registeredAddress: "Dili",
      }),
    ).toThrow(MissingStatutorySourceDataError);
  });

  it("requires real ISO calendar dates for statutory employment periods", () => {
    expect(requireStatutoryISODate("2026-07-17", "employment end date")).toBe(
      "2026-07-17",
    );
    expect(() =>
      requireStatutoryISODate("2026-02-30", "employment end date"),
    ).toThrow(MissingStatutorySourceDataError);
    expect(() =>
      requireStatutoryISODate(undefined, "employment end date"),
    ).toThrow(/will not substitute a blank or inferred value/);
  });
});
