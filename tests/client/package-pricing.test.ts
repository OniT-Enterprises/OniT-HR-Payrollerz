/**
 * Pricing engine tests — single flat per-employee rate.
 *
 * Monthly bill = max(active employees, minimum seats) × the one rate. Annual
 * access charges a configurable number of monthly payments. Every account has
 * every feature; a subscription only unlocks finalizing payroll.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PACKAGES_CONFIG,
  DEFAULT_ANNUAL_MONTHS_CHARGED,
  DEFAULT_MINIMUM_EMPLOYEES,
  DEFAULT_PRICE_PER_EMPLOYEE,
  calculatePackageEstimate,
  getPackageBillingAmount,
  normalizeBillingPackagesConfig,
  isTenantSubscribed,
} from "@/lib/packagePricing";

describe("calculatePackageEstimate — flat per-employee with minimum", () => {
  it("monthly total = rate × billed employees above the minimum", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { employeeCount: 20 });
    expect(e.pricePerEmployee).toBe(4);
    expect(e.employeeCount).toBe(20);
    expect(e.billedEmployees).toBe(20);
    expect(e.monthlyTotal).toBe(80);
  });

  it("uses the default minimum and annual discount", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { employeeCount: 10 });
    expect(e.monthlyTotal).toBe(DEFAULT_PRICE_PER_EMPLOYEE * 10);
    expect(e.annualTotal).toBe(400);
    expect(e.annualSavings).toBe(80);
    expect(getPackageBillingAmount(e, "month")).toBe(40);
    expect(getPackageBillingAmount(e, "year")).toBe(400);
  });

  it("bills the five-seat minimum for small and empty teams", () => {
    const empty = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { employeeCount: 0 });
    const small = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { employeeCount: 3 });
    expect(empty.billedEmployees).toBe(5);
    expect(empty.monthlyTotal).toBe(20);
    expect(small.billedEmployees).toBe(5);
    expect(small.monthlyTotal).toBe(20);
  });

  it("clamps negative and fractional headcount", () => {
    const custom = { pricePerEmployee: 5, minimumEmployees: 0, annualMonthsCharged: 10 };
    expect(calculatePackageEstimate(custom, { employeeCount: -3 }).monthlyTotal).toBe(5);
    const frac = calculatePackageEstimate(custom, { employeeCount: 10.9 });
    expect(frac.employeeCount).toBe(10);
    expect(frac.monthlyTotal).toBe(50);
  });
});

describe("normalizeBillingPackagesConfig", () => {
  it("defaults the rate when missing", () => {
    expect(normalizeBillingPackagesConfig(undefined)).toEqual(DEFAULT_PACKAGES_CONFIG);
    expect(normalizeBillingPackagesConfig({})).toEqual(DEFAULT_PACKAGES_CONFIG);
  });

  it("keeps a valid custom rate", () => {
    expect(normalizeBillingPackagesConfig({
      pricePerEmployee: 7.5,
      minimumEmployees: 8.9,
      annualMonthsCharged: 9.8,
    })).toEqual({
      pricePerEmployee: 7.5,
      minimumEmployees: 8,
      annualMonthsCharged: 9,
    });
    expect(normalizeBillingPackagesConfig({ pricePerEmployee: 4.005 }).pricePerEmployee).toBe(4.01);
  });

  it("clamps negative and ignores non-numeric", () => {
    expect(normalizeBillingPackagesConfig({ pricePerEmployee: -2 }).pricePerEmployee)
      .toBe(DEFAULT_PRICE_PER_EMPLOYEE);
    expect(normalizeBillingPackagesConfig({ pricePerEmployee: "x" as never }).pricePerEmployee).toBe(
      DEFAULT_PRICE_PER_EMPLOYEE,
    );
    expect(normalizeBillingPackagesConfig({ minimumEmployees: -2 }).minimumEmployees).toBe(1);
    expect(normalizeBillingPackagesConfig({ annualMonthsCharged: 99 }).annualMonthsCharged).toBe(12);
    expect(normalizeBillingPackagesConfig({ annualMonthsCharged: 0 }).annualMonthsCharged).toBe(1);
    expect(normalizeBillingPackagesConfig({}).minimumEmployees).toBe(DEFAULT_MINIMUM_EMPLOYEES);
    expect(normalizeBillingPackagesConfig({}).annualMonthsCharged)
      .toBe(DEFAULT_ANNUAL_MONTHS_CHARGED);
  });
});

describe("isTenantSubscribed — payroll unlock gate", () => {
  it("false without a subscription id", () => {
    expect(isTenantSubscribed({})).toBe(false);
    expect(isTenantSubscribed({ stripeSubscriptionId: "" })).toBe(false);
  });

  it("true with a sub id and no paid-until", () => {
    expect(isTenantSubscribed({ stripeSubscriptionId: "sub_123" })).toBe(true);
  });

  it("true when paid-until is in the future", () => {
    const future = new Date(Date.now() + 30 * 86400_000);
    expect(isTenantSubscribed({ stripeSubscriptionId: "sub_123", subscriptionPaidUntil: future })).toBe(true);
  });

  it("false when paid-until has lapsed", () => {
    const past = new Date(Date.now() - 86400_000);
    expect(isTenantSubscribed({ stripeSubscriptionId: "sub_123", subscriptionPaidUntil: past })).toBe(false);
  });

  it("supports Firestore Timestamp-like objects", () => {
    const future = { toDate: () => new Date(Date.now() + 86400_000) };
    expect(isTenantSubscribed({ stripeSubscriptionId: "sub_123", subscriptionPaidUntil: future })).toBe(true);
  });
});
