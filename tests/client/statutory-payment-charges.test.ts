/**
 * Which GL account a tax remittance charges. Getting this wrong is a money
 * error in two directions at once: an income-tax instalment expensed instead
 * of held as prepaid tax understates profit AND loses the Sec. 64.4 credit, and
 * a penalty booked to an ordinary expense account quietly claims a deduction
 * Sec. 31(j) forbids.
 */

import { describe, it, expect } from "vitest";
import {
  buildStatutoryPaymentChargeLines,
  statutoryPaymentChargeCodes,
  isStatutoryPaymentType,
  isBusinessTaxPaymentType,
  PENALTY_ACCOUNT_CODE,
} from "@/lib/tax/statutory-payment-charges";

describe("statutory payment charge lines", () => {
  it("clears the WIT liability payroll accrued", () => {
    expect(
      buildStatutoryPaymentChargeLines({
        type: "monthly_wit",
        period: "2026-06",
        totalWITWithheld: 974.54,
      }),
    ).toEqual([
      {
        accountCode: "2220",
        amount: 974.54,
        description: "Clear WIT payable - 2026-06",
      },
    ]);
  });

  it("clears both INSS liabilities separately", () => {
    const lines = buildStatutoryPaymentChargeLines({
      type: "inss_monthly",
      period: "2026-06",
      totalINSSEmployee: 40,
      totalINSSEmployer: 60,
    });
    expect(lines.map((l) => l.accountCode)).toEqual(["2230", "2240"]);
    expect(lines.map((l) => l.amount)).toEqual([40, 60]);
  });

  it("holds an income-tax instalment as PREPAID TAX, never an expense", () => {
    const lines = buildStatutoryPaymentChargeLines({
      type: "installment_tax",
      period: "2026-06",
      taxDue: 11.1,
    });
    expect(lines).toEqual([
      {
        accountCode: "1330",
        amount: 11.1,
        description: "Income tax instalment - 2026-06",
      },
    ]);
  });

  it("expenses services tax, which the business really bears", () => {
    const lines = buildStatutoryPaymentChargeLines({
      type: "services_tax",
      period: "2026-06",
      taxDue: 143.4,
    });
    expect(lines[0].accountCode).toBe("5940");
    expect(lines[0].amount).toBe(143.4);
  });

  it("puts assessed penalty and interest on the non-deductible account, as one line", () => {
    const lines = buildStatutoryPaymentChargeLines({
      type: "installment_tax",
      period: "2026-06",
      taxDue: 11.1,
      assessedPenalty: 200.15,
      assessedInterest: 16.75,
    });
    expect(lines).toHaveLength(2);
    expect(lines[1].accountCode).toBe(PENALTY_ACCOUNT_CODE);
    expect(lines[1].amount).toBe(216.9);
    // The tax itself is untouched by the surcharge.
    expect(lines[0].amount).toBe(11.1);
  });

  it("adds no penalty line when nothing was assessed", () => {
    const lines = buildStatutoryPaymentChargeLines({
      type: "services_tax",
      period: "2026-06",
      taxDue: 100,
      assessedPenalty: 0,
      assessedInterest: 0,
    });
    expect(lines).toHaveLength(1);
  });

  it("refuses to post a business tax with no as-filed figure", () => {
    expect(() =>
      buildStatutoryPaymentChargeLines({
        type: "installment_tax",
        period: "2026-06",
      }),
    ).toThrow(/as-filed tax due is missing/);
    expect(() =>
      buildStatutoryPaymentChargeLines({
        type: "installment_tax",
        period: "2026-06",
        taxDue: -1,
      }),
    ).toThrow(/as-filed tax due is missing/);
  });

  it("resolves exactly the codes it can post, and no others", () => {
    for (const type of [
      "monthly_wit",
      "inss_monthly",
      "installment_tax",
      "services_tax",
    ] as const) {
      const codes = statutoryPaymentChargeCodes(type);
      const posted = new Set(
        buildStatutoryPaymentChargeLines({
          type,
          period: "2026-06",
          totalWITWithheld: 1,
          totalINSSEmployee: 1,
          totalINSSEmployer: 1,
          taxDue: 1,
          assessedPenalty: 1,
        }).map((line) => line.accountCode),
      );
      for (const code of posted) expect(codes).toContain(code);
    }
  });

  it("recognises which filing types can pay at all", () => {
    expect(isStatutoryPaymentType("annual_wit")).toBe(false);
    expect(isStatutoryPaymentType("installment_tax")).toBe(true);
    expect(isBusinessTaxPaymentType("monthly_wit")).toBe(false);
    expect(isBusinessTaxPaymentType("services_tax")).toBe(true);
  });
});
