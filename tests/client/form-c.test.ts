import { describe, expect, it } from "vitest";
import {
  buildFormCDepreciationSchedule,
  buildFormCWorkpaper,
  calculateFormCTax,
  EMPTY_FORM_C_MANUAL_INPUTS,
  formCDueDate,
  type BuildFormCWorkpaperInput,
  type FormCAssetInput,
  type FormCGlRow,
} from "@/lib/tax/form-c";

const gl = (
  accountCode: string,
  accountName: string,
  accountType: "revenue" | "expense",
  amount: number,
): FormCGlRow => ({ accountCode, accountName, accountType, amount });

const build = (
  overrides: Partial<BuildFormCWorkpaperInput> = {},
): ReturnType<typeof buildFormCWorkpaper> =>
  buildFormCWorkpaper({
    taxYear: 2025,
    glRows: [],
    assets: [],
    manual: EMPTY_FORM_C_MANUAL_INPUTS,
    ...overrides,
  });

const lineOf = (
  workpaper: ReturnType<typeof buildFormCWorkpaper>,
  code: string,
) => {
  const line = workpaper.lines.find((entry) => entry.line === code);
  if (!line) throw new Error(`line ${code} missing`);
  return line;
};

describe("Form C GL mapping (TADR-IT 1 lines)", () => {
  it("maps built-in chart codes to their official lines", () => {
    const workpaper = build({
      glRows: [
        gl("4100", "Service Revenue", "revenue", 50000),
        gl("4300", "Other Income", "revenue", 1200),
        gl("5110", "Salaries and Wages", "expense", 18000),
        gl("5120", "Overtime Pay", "expense", 900),
        gl("5150", "INSS Employer Contribution", "expense", 1080),
        gl("5200", "Rent Expense", "expense", 6000),
        gl("5510", "Fuel", "expense", 800),
        gl("5800", "Depreciation Expense", "expense", 2400),
        gl("5930", "Training and Development", "expense", 300),
        gl("5310", "Electricity", "expense", 700),
      ],
    });
    expect(lineOf(workpaper, "05").amount).toBe(51200);
    expect(lineOf(workpaper, "35").amount).toBe(18900);
    expect(lineOf(workpaper, "50").amount).toBe(6000);
    expect(lineOf(workpaper, "55").amount).toBe(800);
    expect(lineOf(workpaper, "15").amount).toBe(2400);
    expect(lineOf(workpaper, "70").amount).toBe(300);
    // INSS employer is NOT a payment to the employee — Other, not line 35.
    expect(lineOf(workpaper, "110").amount).toBe(1080 + 700);
  });

  it("maps tenant-added accounts by name keyword, else to Other", () => {
    const workpaper = build({
      glRows: [
        gl("5010", "Purchases - Trading Stock", "expense", 9000),
        gl("5011", "Bad Debts Written Off", "expense", 450),
        gl("5012", "Commission Paid", "expense", 200),
        gl("5013", "Building Repairs", "expense", 350),
        gl("5014", "Completely Unmatched Expense", "expense", 75),
      ],
    });
    expect(lineOf(workpaper, "10").amount).toBe(9000);
    expect(lineOf(workpaper, "25").amount).toBe(450);
    expect(lineOf(workpaper, "45").amount).toBe(200);
    expect(lineOf(workpaper, "60").amount).toBe(350);
    expect(lineOf(workpaper, "110").amount).toBe(75);
  });

  it("excludes interest and income-tax expense with warnings (TDA §31)", () => {
    const workpaper = build({
      glRows: [
        gl("4100", "Service Revenue", "revenue", 10000),
        gl("5940", "Interest Expense", "expense", 1200),
        gl("5950", "Income Tax Expense", "expense", 600),
      ],
    });
    expect(workpaper.excluded).toHaveLength(2);
    expect(workpaper.totals.totalExpenses).toBe(0);
    expect(
      workpaper.warnings.some((w) => w.code === "interest_excluded"),
    ).toBe(true);
    expect(
      workpaper.warnings.some((w) => w.code === "income_tax_expense_excluded"),
    ).toBe(true);
  });

  it("keeps cents on every line, matching e-filed practice", () => {
    const workpaper = build({
      glRows: [
        gl("4100", "Service Revenue", "revenue", 1000.49),
        gl("5200", "Rent Expense", "expense", 100.5),
        gl("5310", "Electricity", "expense", 50.49),
      ],
    });
    expect(lineOf(workpaper, "05").amount).toBe(1000.49);
    expect(lineOf(workpaper, "50").amount).toBe(100.5);
    expect(lineOf(workpaper, "110").amount).toBe(50.49);
    expect(workpaper.totals.totalExpenses).toBe(150.99);
    expect(workpaper.totals.netIncome).toBe(849.5);
  });

  it("lists every Other-expenses account over $1,000 (lines 115–130)", () => {
    const workpaper = build({
      glRows: [
        gl("5310", "Electricity", "expense", 1500),
        gl("5700", "Insurance Expense", "expense", 2500),
        gl("5910", "Bank Charges", "expense", 999),
      ],
    });
    expect(workpaper.otherExpenseDetails).toEqual([
      { accountCode: "5700", accountName: "Insurance Expense", amount: 2500 },
      { accountCode: "5310", accountName: "Electricity", amount: 1500 },
    ]);
  });

  it("applies signed accountant adjustments per line with notes", () => {
    const workpaper = build({
      glRows: [gl("5110", "Salaries and Wages", "expense", 12000)],
      manual: {
        ...EMPTY_FORM_C_MANUAL_INPUTS,
        entityType: "sole_trader",
        adjustments: [
          { line: "35", amount: -6000, note: "Owner drawings not deductible" },
          { line: "25", amount: 450, note: "Bad debt written off" },
        ],
      },
    });
    expect(lineOf(workpaper, "35").amount).toBe(6000);
    expect(lineOf(workpaper, "25").amount).toBe(450);
    expect(lineOf(workpaper, "35").adjustmentNotes).toEqual([
      "Owner drawings not deductible",
    ]);
  });

  it("warns a sole trader with salary mapped (own pay is not deductible)", () => {
    const workpaper = build({
      glRows: [gl("5110", "Salaries and Wages", "expense", 5000)],
      manual: { ...EMPTY_FORM_C_MANUAL_INPUTS, entityType: "sole_trader" },
    });
    expect(
      workpaper.warnings.some((w) => w.code === "sole_trader_own_salary"),
    ).toBe(true);
  });
});

describe("Form C loss carry-forward (lines 140–155)", () => {
  it("reproduces the official instructions example: $6,000 net, $10,000 loss", () => {
    const workpaper = build({
      glRows: [
        gl("4100", "Service Revenue", "revenue", 10000),
        gl("5200", "Rent Expense", "expense", 4000),
      ],
      manual: { ...EMPTY_FORM_C_MANUAL_INPUTS, lossCarriedForward: 10000 },
    });
    expect(workpaper.totals.netIncome).toBe(6000);
    expect(workpaper.totals.lossApplied).toBe(6000);
    expect(workpaper.totals.taxableIncome).toBe(0);
    expect(workpaper.totals.lossCarryForwardOut).toBe(4000);
    expect(workpaper.totals.tax).toBe(0);
  });

  it("accumulates a loss year onto the carried-forward balance", () => {
    const workpaper = build({
      glRows: [
        gl("4100", "Service Revenue", "revenue", 2000),
        gl("5200", "Rent Expense", "expense", 5000),
      ],
      manual: { ...EMPTY_FORM_C_MANUAL_INPUTS, lossCarriedForward: 4000 },
    });
    expect(workpaper.totals.netIncome).toBe(-3000);
    expect(workpaper.totals.taxableIncome).toBe(-3000);
    expect(workpaper.totals.lossCarryForwardOut).toBe(7000);
    expect(workpaper.totals.tax).toBe(0);
  });
});

describe("Form C tax tables (2023 instructions, e-Tax cent rounding)", () => {
  it("Table A sole trader: 0% to $6,000 then 10%", () => {
    expect(calculateFormCTax(6000, "sole_trader")).toBe(0);
    expect(calculateFormCTax(6001, "sole_trader")).toBe(0.1);
    expect(calculateFormCTax(16000, "sole_trader")).toBe(1000);
  });

  it("Table B company: 10% flat from the first dollar", () => {
    expect(calculateFormCTax(6000, "company")).toBe(600);
    expect(calculateFormCTax(1, "company")).toBe(0.1);
  });

  it("computes to the cent, half-up — the assessed e-Tax behavior", () => {
    // Real Aviso de Avaliação values (2024 tax year, e-filed):
    expect(calculateFormCTax(165819.68, "company")).toBe(16581.97);
    expect(calculateFormCTax(12880.65, "company")).toBe(1288.07);
  });

  it("charges nothing on zero or negative taxable income", () => {
    expect(calculateFormCTax(0, "company")).toBe(0);
    expect(calculateFormCTax(-500, "sole_trader")).toBe(0);
  });
});

describe("Form C credits and tax owing (lines 170–220)", () => {
  it("totals credits and computes tax owing", () => {
    const workpaper = build({
      glRows: [gl("4100", "Service Revenue", "revenue", 30000)],
      manual: {
        ...EMPTY_FORM_C_MANUAL_INPUTS,
        installmentsPaid: 600,
        foreignTaxCredits: 100,
        whtCredits: {
          ...EMPTY_FORM_C_MANUAL_INPUTS.whtCredits,
          rentalLandBuildings: { amount: 250, payerTin: "1234567" },
        },
      },
    });
    // Company: 10% of 30,000 = 3,000; credits 950.
    expect(workpaper.totals.tax).toBe(3000);
    expect(workpaper.totals.totalCredits).toBe(950);
    expect(workpaper.totals.taxOwing).toBe(2050);
    expect(workpaper.totals.overpaid).toBe(false);
  });

  it("flags an overpaid year (line 220 negative, circle R)", () => {
    const workpaper = build({
      glRows: [gl("4100", "Service Revenue", "revenue", 5000)],
      manual: { ...EMPTY_FORM_C_MANUAL_INPUTS, installmentsPaid: 900 },
    });
    expect(workpaper.totals.tax).toBe(500);
    expect(workpaper.totals.taxOwing).toBe(-400);
    expect(workpaper.totals.overpaid).toBe(true);
  });
});

describe("Form C depreciation schedule", () => {
  const machine: FormCAssetInput = {
    name: "Espresso machine",
    acquisitionDate: "2024-06-15",
    acquisitionCost: 3600,
    residualValue: 0,
    usefulLifeMonths: 36,
    depreciationStartPeriod: "2024-06",
    status: "active",
  };

  it("computes a full prior-year asset row for the tax year", () => {
    const [row] = buildFormCDepreciationSchedule([machine], 2025);
    // 7 months in 2024 (Jun–Dec) = 700 opening accumulated.
    expect(row.openingValue).toBe(2900);
    expect(row.purchaseCost).toBeUndefined();
    expect(row.yearDepreciation).toBe(1200);
    expect(row.closingValue).toBe(1700);
    expect(row.ratePercent).toBeCloseTo(33.33, 2);
  });

  it("shows in-year purchases with cost and date, opening 0", () => {
    const [row] = buildFormCDepreciationSchedule([machine], 2024);
    expect(row.openingValue).toBe(0);
    expect(row.purchaseCost).toBe(3600);
    expect(row.purchaseDate).toBe("2024-06-15");
    expect(row.yearDepreciation).toBe(700);
    expect(row.closingValue).toBe(2900);
  });

  it("stops depreciation at the cumulative cap (fully depreciated)", () => {
    const old: FormCAssetInput = {
      ...machine,
      depreciationStartPeriod: "2020-01",
      acquisitionDate: "2020-01-10",
      status: "fully_depreciated",
    };
    const [row] = buildFormCDepreciationSchedule([old], 2025);
    expect(row.yearDepreciation).toBe(0);
    expect(row.closingValue).toBe(0);
  });

  it("stops at the disposal month and closes disposed assets at 0", () => {
    const disposed: FormCAssetInput = {
      ...machine,
      status: "disposed",
      disposalDate: "2025-03-20",
      disposalProceeds: 2500,
    };
    const [row] = buildFormCDepreciationSchedule([disposed], 2025);
    // Jan–Mar 2025 = 3 months × 100.
    expect(row.yearDepreciation).toBe(300);
    expect(row.disposalDate).toBe("2025-03-20");
    expect(row.disposalProceeds).toBe(2500);
    expect(row.closingValue).toBe(0);
  });

  it("omits assets outside the tax year entirely", () => {
    const future: FormCAssetInput = {
      ...machine,
      acquisitionDate: "2026-02-01",
      depreciationStartPeriod: "2026-02",
    };
    const past: FormCAssetInput = {
      ...machine,
      status: "disposed",
      disposalDate: "2024-11-30",
    };
    expect(buildFormCDepreciationSchedule([future, past], 2025)).toHaveLength(
      0,
    );
  });

  it("warns when the GL depreciation and the register schedule disagree", () => {
    const workpaper = build({
      glRows: [gl("5800", "Depreciation Expense", "expense", 500)],
      assets: [machine],
    });
    const warning = workpaper.warnings.find(
      (w) => w.code === "depreciation_schedule_mismatch",
    );
    expect(warning).toMatchObject({ glAmount: 500, scheduleAmount: 1200 });
  });

  it("stays quiet when books and schedule agree", () => {
    const workpaper = build({
      glRows: [gl("5800", "Depreciation Expense", "expense", 1200)],
      assets: [machine],
    });
    expect(
      workpaper.warnings.some(
        (w) => w.code === "depreciation_schedule_mismatch",
      ),
    ).toBe(false);
  });
});

describe("Form C tax depreciation methods", () => {
  const machine: FormCAssetInput = {
    name: "Espresso machine",
    acquisitionDate: "2024-06-15",
    acquisitionCost: 3600,
    residualValue: 0,
    usefulLifeMonths: 36,
    depreciationStartPeriod: "2024-06",
    status: "active",
  };
  const truck: FormCAssetInput = {
    name: "Delivery truck",
    acquisitionDate: "2025-03-01",
    acquisitionCost: 48100,
    residualValue: 0,
    usefulLifeMonths: 60,
    depreciationStartPeriod: "2025-03",
    status: "active",
  };

  it("full expensing: in-year additions at 100% of cost, closing 0", () => {
    // The observed filed treatment (Sch. VII): full cost in acquisition year.
    const rows = buildFormCDepreciationSchedule(
      [machine, truck],
      2025,
      "full_expensing",
    );
    // machine was bought 2024 and is still held — no 2025 tax value/event.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: "Delivery truck",
      openingValue: 0,
      purchaseCost: 48100,
      ratePercent: 100,
      yearDepreciation: 48100,
      closingValue: 0,
    });
  });

  it("full expensing: line 15 = schedule total; books depreciation excluded", () => {
    const workpaper = build({
      glRows: [
        gl("4100", "Service Revenue", "revenue", 100000),
        gl("5800", "Depreciation Expense", "expense", 9620),
      ],
      assets: [truck],
      manual: {
        ...EMPTY_FORM_C_MANUAL_INPUTS,
        taxDepreciationMethod: "full_expensing",
      },
    });
    expect(lineOf(workpaper, "15").amount).toBe(48100);
    expect(
      workpaper.excluded.some(
        (entry) => entry.reason === "books_depreciation_tax_method",
      ),
    ).toBe(true);
    expect(
      workpaper.warnings.some(
        (w) => w.code === "depreciation_schedule_mismatch",
      ),
    ).toBe(false);
    expect(
      workpaper.warnings.some(
        (w) => w.code === "books_depreciation_replaced",
      ),
    ).toBe(true);
    expect(workpaper.totals.totalExpenses).toBe(48100);
  });

  it("full expensing: disposal of an expensed asset warns to add proceeds to income", () => {
    const disposed: FormCAssetInput = {
      ...machine,
      status: "disposed",
      disposalDate: "2025-05-10",
      disposalProceeds: 1200,
    };
    const workpaper = build({
      assets: [disposed],
      manual: {
        ...EMPTY_FORM_C_MANUAL_INPUTS,
        taxDepreciationMethod: "full_expensing",
      },
    });
    // Fully expensed in 2024 → zero-depreciation disposal row, proceeds visible.
    expect(workpaper.depreciationSchedule).toHaveLength(1);
    expect(workpaper.depreciationSchedule[0].yearDepreciation).toBe(0);
    expect(workpaper.depreciationSchedule[0].disposalProceeds).toBe(1200);
    expect(
      workpaper.warnings.some(
        (w) => w.code === "expensed_disposal_proceeds" && w.amount === 1200,
      ),
    ).toBe(true);
  });

  it("useful life stays the default and unchanged", () => {
    const workpaper = build({
      glRows: [gl("5800", "Depreciation Expense", "expense", 1200)],
      assets: [machine],
    });
    expect(workpaper.entityType).toBe("company");
    expect(lineOf(workpaper, "15").amount).toBe(1200);
    expect(workpaper.depreciationSchedule[0].yearDepreciation).toBe(1200);
  });
});

describe("Form C due date", () => {
  it("falls on 31 March of the following year (§62.2)", () => {
    expect(formCDueDate(2025)).toBe("2026-03-31");
  });
});
