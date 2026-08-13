import { describe, expect, it } from "vitest";
import { payrollRunIsPaidInMonth } from "@/lib/payroll/run-payroll-helpers";

describe("payroll tax month", () => {
  it("uses the pay date when a December wage period is paid in January", () => {
    const run = { payDate: "2027-01-05", periodStart: "2026-12-01" };
    expect(payrollRunIsPaidInMonth(run, "2027-01")).toBe(true);
    expect(payrollRunIsPaidInMonth(run, "2026-12")).toBe(false);
  });

  it("fails closed for missing or malformed pay dates", () => {
    expect(payrollRunIsPaidInMonth({}, "2027-01")).toBe(false);
    expect(payrollRunIsPaidInMonth({ payDate: "2027-01" }, "2027-01")).toBe(false);
  });
});
