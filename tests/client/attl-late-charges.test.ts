/**
 * Additional tax under UNTAET Reg. 2000/18 Secs. 72.1 and 73.1.
 *
 * The interesting cases are all about the 1%: it is a stamp that falls on the
 * 15th of each month AFTER the due date, not interest that accrues with time.
 * A month-difference shortcut would overcharge every taxpayer who pays in the
 * first half of a month, which is most of them.
 */

import { describe, it, expect } from "vitest";
import {
  attlLatePaymentStampCount,
  estimateATTLLateCharges,
  ATTL_LATE_FORM_ADDITIONAL_TAX,
} from "@/lib/tax/attl-late-charges";

describe("attlLatePaymentStampCount", () => {
  it("is zero on or before the due date", () => {
    expect(attlLatePaymentStampCount("2026-07-15", "2026-07-15")).toBe(0);
    expect(attlLatePaymentStampCount("2026-07-15", "2026-07-01")).toBe(0);
  });

  it("is zero until the NEXT 15th, however late in the month", () => {
    // Due 15 July, paid 14 August: a calendar month late by any rounding, but
    // no 15th has passed since the due date.
    expect(attlLatePaymentStampCount("2026-07-15", "2026-07-16")).toBe(0);
    expect(attlLatePaymentStampCount("2026-07-15", "2026-08-14")).toBe(0);
  });

  it("counts each 15th that has fallen", () => {
    expect(attlLatePaymentStampCount("2026-07-15", "2026-08-15")).toBe(1);
    expect(attlLatePaymentStampCount("2026-07-15", "2026-09-14")).toBe(1);
    expect(attlLatePaymentStampCount("2026-07-15", "2026-09-15")).toBe(2);
    expect(attlLatePaymentStampCount("2026-07-15", "2027-01-15")).toBe(6);
  });

  it("handles a due date that is not the 15th", () => {
    // Due 20 July: the 15 August stamp is the first one after it.
    expect(attlLatePaymentStampCount("2026-07-20", "2026-08-14")).toBe(0);
    expect(attlLatePaymentStampCount("2026-07-20", "2026-08-15")).toBe(1);
    // Due 10 July: the 15 July stamp already falls after it.
    expect(attlLatePaymentStampCount("2026-07-10", "2026-07-15")).toBe(1);
  });

  it("crosses a year boundary", () => {
    expect(attlLatePaymentStampCount("2026-12-15", "2027-02-15")).toBe(2);
  });
});

describe("estimateATTLLateCharges", () => {
  it("charges nothing when the payment is on time", () => {
    const estimate = estimateATTLLateCharges({
      taxUnpaid: 1000,
      dueDate: "2026-07-15",
      asOf: "2026-07-15",
      formWasLate: true,
    });
    expect(estimate.isLate).toBe(false);
    expect(estimate.total).toBe(0);
    expect(estimate.formAdditionalTax).toBe(0);
  });

  it("charges 5% and nothing else before the first 15th", () => {
    const estimate = estimateATTLLateCharges({
      taxUnpaid: 1000,
      dueDate: "2026-07-15",
      asOf: "2026-08-14",
    });
    expect(estimate.initialAdditionalTax).toBe(50);
    expect(estimate.monthlyStamps).toBe(0);
    expect(estimate.monthlyAdditionalTax).toBe(0);
    expect(estimate.total).toBe(50);
  });

  it("adds 1% of the unpaid tax per stamp, without compounding", () => {
    const estimate = estimateATTLLateCharges({
      taxUnpaid: 1000,
      dueDate: "2026-07-15",
      asOf: "2026-10-15",
    });
    expect(estimate.monthlyStamps).toBe(3);
    // 3 × 1% of the ORIGINAL unpaid tax, not of a growing balance.
    expect(estimate.monthlyAdditionalTax).toBe(30);
    expect(estimate.total).toBe(80);
  });

  it("adds the $100 form charge only when the RETURN was late", () => {
    const base = { taxUnpaid: 1000, dueDate: "2026-07-15", asOf: "2026-08-15" };
    expect(estimateATTLLateCharges(base).total).toBe(60);
    expect(
      estimateATTLLateCharges({ ...base, formWasLate: true }).total,
    ).toBe(60 + ATTL_LATE_FORM_ADDITIONAL_TAX);
  });

  it("owes the form charge on a late NIL return, where there is no tax", () => {
    const estimate = estimateATTLLateCharges({
      taxUnpaid: 0,
      dueDate: "2026-07-15",
      asOf: "2026-08-20",
      formWasLate: true,
    });
    expect(estimate.initialAdditionalTax).toBe(0);
    expect(estimate.total).toBe(100);
  });

  it("never includes the carelessness or evasion uplifts", () => {
    // Sec. 73.1(a) 25% and (b) 100% need a finding about the taxpayer's state
    // of mind. On $1,000 six months late the honest estimate is $110, not the
    // $360 or $1,110 those limbs would add.
    const estimate = estimateATTLLateCharges({
      taxUnpaid: 1000,
      dueDate: "2026-07-15",
      asOf: "2027-01-15",
    });
    expect(estimate.total).toBe(110);
  });

  it("cites the regulation, not Lei 8/2008", () => {
    const estimate = estimateATTLLateCharges({
      taxUnpaid: 10,
      dueDate: "2026-07-15",
      asOf: "2026-08-15",
    });
    expect(estimate.legalBasis).toMatch(/2000\/18/);
    expect(estimate.legalBasis).not.toMatch(/8\/2008/);
  });

  it("refuses a negative liability", () => {
    expect(() =>
      estimateATTLLateCharges({
        taxUnpaid: -1,
        dueDate: "2026-07-15",
        asOf: "2026-08-15",
      }),
    ).toThrow(RangeError);
  });
});
