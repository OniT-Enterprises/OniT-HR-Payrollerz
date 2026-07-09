/**
 * Pricing engine tests — single flat per-employee rate.
 *
 * Monthly bill = employees × the one rate. Every account has every feature;
 * a subscription only unlocks finalizing payroll (isTenantSubscribed).
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PACKAGES_CONFIG,
  DEFAULT_PRICE_PER_EMPLOYEE,
  calculatePackageEstimate,
  normalizeBillingPackagesConfig,
  isTenantSubscribed,
} from "@/lib/packagePricing";

describe("calculatePackageEstimate — flat per-employee", () => {
  it("monthly total = rate × employees", () => {
    const e = calculatePackageEstimate({ pricePerEmployee: 4 }, { employeeCount: 20 });
    expect(e.pricePerEmployee).toBe(4);
    expect(e.employeeCount).toBe(20);
    expect(e.monthlyTotal).toBe(80);
  });

  it("uses the default rate config", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { employeeCount: 10 });
    expect(e.monthlyTotal).toBe(DEFAULT_PRICE_PER_EMPLOYEE * 10);
  });

  it("zero employees = $0", () => {
    expect(calculatePackageEstimate({ pricePerEmployee: 4 }, { employeeCount: 0 }).monthlyTotal).toBe(0);
  });

  it("clamps negative and fractional headcount", () => {
    expect(calculatePackageEstimate({ pricePerEmployee: 5 }, { employeeCount: -3 }).monthlyTotal).toBe(0);
    const frac = calculatePackageEstimate({ pricePerEmployee: 5 }, { employeeCount: 10.9 });
    expect(frac.employeeCount).toBe(10);
    expect(frac.monthlyTotal).toBe(50);
  });
});

describe("normalizeBillingPackagesConfig", () => {
  it("defaults the rate when missing", () => {
    expect(normalizeBillingPackagesConfig(undefined).pricePerEmployee).toBe(DEFAULT_PRICE_PER_EMPLOYEE);
    expect(normalizeBillingPackagesConfig({}).pricePerEmployee).toBe(DEFAULT_PRICE_PER_EMPLOYEE);
  });

  it("keeps a valid custom rate", () => {
    expect(normalizeBillingPackagesConfig({ pricePerEmployee: 7.5 }).pricePerEmployee).toBe(7.5);
  });

  it("clamps negative and ignores non-numeric", () => {
    expect(normalizeBillingPackagesConfig({ pricePerEmployee: -2 }).pricePerEmployee).toBe(0);
    expect(normalizeBillingPackagesConfig({ pricePerEmployee: "x" as never }).pricePerEmployee).toBe(
      DEFAULT_PRICE_PER_EMPLOYEE,
    );
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
