/**
 * Payroll -> double-entry journal cross-check.
 *
 * The write-time guard (normalizeJournalAmounts) refuses to persist an
 * unbalanced entry — but that only proves a bad journal is rejected, not that
 * a healthy payroll produces the RIGHT one. These tests assert the journal the
 * payroll run actually posts: that it balances, and that each account carries
 * the correct amount, across the cases real Timor-Leste payrolls hit.
 */
import { describe, expect, it } from "vitest";
import {
  buildLiabilityPaymentJournalLines,
  buildFixedAssetAcquisitionJournalLines,
  buildPayrollJournalLines,
  buildPayrollSettlementJournalLines,
  normalizeJournalAmounts,
  payrollJournalAccountCodes,
  type PayrollJournalSummary,
} from "@/lib/accounting/calculations";
import { sumMoney } from "@/lib/currency";
import {
  calculateTLPayroll,
  type TLPayrollInput,
  type TLPayrollResult,
} from "@/lib/payroll/calculations-tl";
import { summarizePayrollForAccounting } from "@/lib/payroll/accounting-summary";

function makeJournalInput(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: "emp-j1",
    monthlySalary: 400,
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
    hireDate: "2025-01-01",
    ...overrides,
  };
}

// Stub resolver: every code maps to a stable id/name. The builder never asks
// for a code payrollJournalAccountCodes() didn't list, which this asserts.
const asked: string[] = [];
const resolve = (code: string) => {
  asked.push(code);
  return { id: `acct-${code}`, name: `Account ${code}` };
};

function debitFor(lines: ReturnType<typeof buildPayrollJournalLines>["lines"], code: string) {
  return sumMoney(lines.filter((l) => l.accountCode === code).map((l) => l.debit));
}
function creditFor(lines: ReturnType<typeof buildPayrollJournalLines>["lines"], code: string) {
  return sumMoney(lines.filter((l) => l.accountCode === code).map((l) => l.credit));
}

describe("payroll journal — balance and account correctness", () => {
  it("balances and posts to the right accounts for a normal run", () => {
    // 6-person run: gross 6298.05, WIT 373.89, employee INSS 251.92,
    // employer INSS 377.88 (6%), net = gross - WIT - empINSS.
    const summary: PayrollJournalSummary = {
      totalGrossPay: 6298.05,
      totalINSSEmployer: 377.88,
      totalIncomeTax: 373.89,
      totalINSSEmployee: 251.92,
      totalNetPay: 6298.05 - 373.89 - 251.92,
    };
    const { lines, totalDebit, totalCredit } = buildPayrollJournalLines(summary, resolve);

    // Debits: gross wages + employer INSS expense.
    expect(debitFor(lines, "5110")).toBe(6298.05);
    expect(debitFor(lines, "5150")).toBe(377.88);
    // Credits: net payable, WIT, employee INSS, employer INSS.
    expect(creditFor(lines, "2210")).toBe(summary.totalNetPay);
    expect(creditFor(lines, "2220")).toBe(373.89);
    expect(creditFor(lines, "2230")).toBe(251.92);
    expect(creditFor(lines, "2240")).toBe(377.88);
    // It balances, and passes the production write-time guard.
    expect(totalDebit).toBe(totalCredit);
    expect(() =>
      normalizeJournalAmounts(lines, totalDebit, totalCredit),
    ).not.toThrow();
  });

  it("balances when the run owes no WIT (all residents under the $500 threshold)", () => {
    // The exact case that broke payroll approval before it was fixed: a $0 WIT
    // line the guard rejects. The builder must drop it and still balance.
    const summary: PayrollJournalSummary = {
      totalGrossPay: 900,
      totalINSSEmployer: 54,
      totalIncomeTax: 0,
      totalINSSEmployee: 36,
      totalNetPay: 864,
    };
    const { lines, totalDebit, totalCredit } = buildPayrollJournalLines(summary, resolve);

    expect(lines.some((l) => l.accountCode === "2220")).toBe(false); // no zero WIT line
    expect(creditFor(lines, "2230")).toBe(36);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(954); // gross 900 + employer INSS 54
    expect(() => normalizeJournalAmounts(lines, totalDebit, totalCredit)).not.toThrow();
  });

  it("balances with advance and other deductions on their control accounts", () => {
    const summary: PayrollJournalSummary = {
      totalGrossPay: 2000,
      totalINSSEmployer: 120,
      totalIncomeTax: 150,
      totalINSSEmployee: 80,
      totalAdvanceRepayments: 100,
      totalOtherDeductions: 40,
      totalNetPay: 2000 - 150 - 80 - 100 - 40,
    };
    const { lines, totalDebit, totalCredit } = buildPayrollJournalLines(summary, resolve);

    expect(creditFor(lines, "1220")).toBe(100); // employee advances
    expect(creditFor(lines, "2260")).toBe(40); // other deductions (leaf, not 2200 header)
    expect(creditFor(lines, "2210")).toBe(1630); // net after every deduction
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(2120); // gross 2000 + employer INSS 120
  });

  it("splits gross and employer INSS across project allocations and still balances", () => {
    const summary: PayrollJournalSummary = {
      totalGrossPay: 1000,
      totalINSSEmployer: 60,
      totalIncomeTax: 50,
      totalINSSEmployee: 40,
      totalNetPay: 910,
      allocations: [
        { projectCode: "PROJ-A", fundingSource: "DONOR-1", grossPay: 600, inssEmployer: 36 },
        { projectCode: "PROJ-B", fundingSource: "DONOR-2", grossPay: 300, inssEmployer: 18 },
      ],
    };
    const { lines, totalDebit, totalCredit } = buildPayrollJournalLines(summary, resolve);

    // Two allocated project lines + an "Unassigned" remainder ($100 / $6).
    const grossLines = lines.filter((l) => l.accountCode === "5110");
    expect(grossLines.length).toBe(3);
    expect(debitFor(lines, "5110")).toBe(1000); // allocations + remainder = full gross
    expect(debitFor(lines, "5150")).toBe(60);
    expect(grossLines.some((l) => l.projectId === "PROJ-A")).toBe(true);
    expect(grossLines.some((l) => l.projectId === "Unassigned")).toBe(true);
    expect(totalDebit).toBe(totalCredit);
  });

  it("rejects allocations that exceed the wage expense", () => {
    const summary: PayrollJournalSummary = {
      totalGrossPay: 500,
      totalINSSEmployer: 30,
      totalIncomeTax: 0,
      totalINSSEmployee: 20,
      totalNetPay: 480,
      allocations: [{ projectCode: "P", fundingSource: "F", grossPay: 900, inssEmployer: 30 }],
    };
    expect(() => buildPayrollJournalLines(summary, resolve)).toThrow(/exceed total wages/);
  });

  it("only requests account codes that payrollJournalAccountCodes() declares", () => {
    asked.length = 0;
    const summary: PayrollJournalSummary = {
      totalGrossPay: 1000, totalINSSEmployer: 60, totalIncomeTax: 50,
      totalINSSEmployee: 40, totalNetPay: 910,
      totalAdvanceRepayments: 10, totalOtherDeductions: 5,
    };
    buildPayrollJournalLines(summary, resolve);
    const declared = new Set(payrollJournalAccountCodes(summary));
    for (const code of asked) expect(declared.has(code)).toBe(true);
    // The two control accounts appear only because deductions are present.
    expect(declared.has("1220")).toBe(true);
    expect(declared.has("2260")).toBe(true);
  });
});

describe("payroll and statutory cash settlement", () => {
  it("clears net salaries payable against the selected payroll bank account", () => {
    const result = buildPayrollSettlementJournalLines(
      5_672.24,
      "1130",
      "BNU-OT-42/2026",
      resolve,
    );

    expect(debitFor(result.lines, "2210")).toBe(5_672.24);
    expect(creditFor(result.lines, "1130")).toBe(5_672.24);
    expect(result.totalDebit).toBe(result.totalCredit);
    expect(() => normalizeJournalAmounts(
      result.lines,
      result.totalDebit,
      result.totalCredit,
    )).not.toThrow();
  });

  it("clears both INSS liabilities with one bank credit", () => {
    const result = buildLiabilityPaymentJournalLines(
      [
        { accountCode: "2230", amount: 40, description: "Employee INSS" },
        { accountCode: "2240", amount: 60, description: "Employer INSS" },
      ],
      "1120",
      "INSS payment",
      resolve,
    );

    expect(debitFor(result.lines, "2230")).toBe(40);
    expect(debitFor(result.lines, "2240")).toBe(60);
    expect(creditFor(result.lines, "1120")).toBe(100);
    expect(result.totalDebit).toBe(100);
    expect(result.totalCredit).toBe(100);
  });

  it("refuses a payment with no liability or no payroll reference", () => {
    expect(() => buildLiabilityPaymentJournalLines(
      [{ accountCode: "2220", amount: 0, description: "WIT" }],
      "1120",
      "WIT payment",
      resolve,
    )).toThrow(/at least/);
    expect(() => buildPayrollSettlementJournalLines(100, "1130", "   ", resolve))
      .toThrow(/reference/);
  });
});

describe("fixed-asset acquisition posting", () => {
  it("debits the asset and credits the selected funding account", () => {
    const result = buildFixedAssetAcquisitionJournalLines(
      12_345.67,
      "1540",
      "2100",
      "Delivery truck",
      resolve,
    );

    expect(debitFor(result.lines, "1540")).toBe(12_345.67);
    expect(creditFor(result.lines, "2100")).toBe(12_345.67);
    expect(result.totalDebit).toBe(result.totalCredit);
    expect(() => normalizeJournalAmounts(
      result.lines,
      result.totalDebit,
      result.totalCredit,
    )).not.toThrow();
  });

  it("rejects missing or self-funding acquisition accounts", () => {
    expect(() => buildFixedAssetAcquisitionJournalLines(
      100,
      "1530",
      "1530",
      "Laptop",
      resolve,
    )).toThrow(/differ/);
    expect(() => buildFixedAssetAcquisitionJournalLines(
      0,
      "1530",
      "1120",
      "Laptop",
      resolve,
    )).toThrow(/positive/);
  });
});

// ============================================================
// End-to-end: engine output must always post a BALANCED journal
// ============================================================

/**
 * The gap that let a regression through. The tests above hand
 * buildPayrollJournalLines a hand-written summary, so they prove the builder
 * balances what it is given — not that the ENGINE produces a summary that can
 * balance. A change that floored netPay without shrinking the deduction lines
 * broke exactly that seam: gross - deductions = net stopped holding, so
 * Dr(wages + employer INSS) != Cr(net + each deduction) and the run's journal
 * could not post. This walks the real chain the app walks —
 * calculateTLPayroll -> summarizePayrollForAccounting -> buildPayrollJournalLines.
 */
describe("engine -> accounting summary -> journal always balances", () => {
  const journalFor = (result: TLPayrollResult) => {
    const totals = summarizePayrollForAccounting([
      {
        totalGrossPay: result.cashGrossPay,
        totalDeductions: result.totalDeductions,
        netPay: result.netPay,
        deductions: result.deductions,
        employerTaxes: [{ type: "inss_employer", amount: result.inssEmployer }],
      },
    ]);
    // Same mapping accountingService.createFromPayrollRun uses.
    return buildPayrollJournalLines(
      {
        totalGrossPay: totals.totalWagesExpense,
        totalINSSEmployer: totals.totalINSSEmployer,
        totalIncomeTax: totals.totalIncomeTax,
        totalINSSEmployee: totals.totalINSSEmployee,
        totalNetPay: totals.totalNetPay,
        totalAdvanceRepayments: totals.totalAdvanceRepayments,
        totalOtherDeductions: totals.totalOtherDeductions,
      } as PayrollJournalSummary,
      resolve,
    );
  };

  const cases: { name: string; input: Partial<TLPayrollInput> }[] = [
    { name: "ordinary salaried month", input: {} },
    { name: "partial absence", input: { absenceHours: 16 } },
    // A full month of absence: gross is entirely consumed, so the wage expense
    // and every base fall to zero.
    { name: "full-month absence", input: { absenceHours: 190.67 } },
    // The case that broke the identity: absence eats the whole wage while a
    // court order (Art. 42(2), outside the 30% cap) still wants to be withheld.
    {
      name: "full-month absence PLUS a court order",
      input: { absenceHours: 190.67, courtOrders: 100 },
    },
    {
      name: "full-month absence PLUS an advance repayment",
      input: { absenceHours: 190.67, advanceRepayment: 50 },
    },
    {
      name: "full-month absence PLUS court order AND advance",
      input: { absenceHours: 190.67, courtOrders: 100, advanceRepayment: 50 },
    },
    { name: "late arrival on top of a full absence", input: { absenceHours: 190.67, lateArrivalMinutes: 120 } },
    { name: "court order larger than the whole wage", input: { courtOrders: 5000 } },
  ];

  for (const { name, input } of cases) {
    it(`balances: ${name}`, () => {
      const result = calculateTLPayroll(
        makeJournalInput({ monthlySalary: 400, ...input }),
      );
      // The engine invariant the journal depends on.
      expect(result.netPay).toBeGreaterThanOrEqual(0);
      expect(result.totalDeductions).toBeLessThanOrEqual(result.cashGrossPay + 0.001);
      expect(
        sumMoney(result.deductions.map((d) => d.amount)),
      ).toBeCloseTo(result.totalDeductions, 2);
      expect(result.cashGrossPay - result.totalDeductions).toBeCloseTo(result.netPay, 2);

      // ...and the journal that follows from it.
      const journal = journalFor(result);
      expect(journal.totalDebit).toBeCloseTo(journal.totalCredit, 2);
      if (journal.lines.length === 0) {
        // A run in which the wage was entirely consumed posts nothing, which is
        // correct — there is no expense and no liability. (normalizeJournalAmounts
        // rejects an empty entry, so accountingService must not try to post one;
        // that guard is a pre-existing concern, not part of this invariant.)
        expect(journal.totalDebit).toBe(0);
        expect(journal.totalCredit).toBe(0);
        return;
      }
      // Throws if the entry is unbalanced or malformed at write time.
      normalizeJournalAmounts(journal.lines, journal.totalDebit, journal.totalCredit);
    });
  }
});
