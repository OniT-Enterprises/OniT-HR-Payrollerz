/**
 * Package pricing engine tests — pure per-employee model.
 *
 * Monthly bill = employees × the plan's per-employee rate. Free = $0.
 * No module or per-admin charges.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PACKAGES_CONFIG,
  calculatePackageEstimate,
  normalizeBillingPackagesConfig,
} from "@/lib/packagePricing";

// Default rates: Free $0, Starter $2, Professional $4, Enterprise $6 /employee.

describe("calculatePackageEstimate — per-employee totals (default config)", () => {
  it("Free is always $0, even with employees", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "free", employeeCount: 50 });
    expect(e.pricePerEmployee).toBe(0);
    expect(e.monthlyTotal).toBe(0);
  });

  it("Starter = $2 × employees", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "starter", employeeCount: 20 });
    expect(e.pricePerEmployee).toBe(2);
    expect(e.monthlyTotal).toBe(40);
  });

  it("Professional = $4 × employees", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "professional", employeeCount: 20 });
    expect(e.pricePerEmployee).toBe(4);
    expect(e.monthlyTotal).toBe(80);
  });

  it("Enterprise = $6 × employees", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "enterprise", employeeCount: 20 });
    expect(e.pricePerEmployee).toBe(6);
    expect(e.monthlyTotal).toBe(120);
  });
});

describe("calculatePackageEstimate — headcount handling", () => {
  it("scales linearly with employee count", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "professional", employeeCount: 100 });
    expect(e.monthlyTotal).toBe(400);
  });

  it("zero employees = $0", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "enterprise", employeeCount: 0 });
    expect(e.monthlyTotal).toBe(0);
  });

  it("clamps negative / fractional counts", () => {
    const neg = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "starter", employeeCount: -5 });
    expect(neg.monthlyTotal).toBe(0);
    const frac = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "starter", employeeCount: 10.9 });
    expect(frac.employeeCount).toBe(10);
    expect(frac.monthlyTotal).toBe(20);
  });
});

describe("calculatePackageEstimate — custom rates", () => {
  it("uses an admin-edited per-employee rate", () => {
    const config = normalizeBillingPackagesConfig({
      planDefinitions: DEFAULT_PACKAGES_CONFIG.planDefinitions.map((plan) =>
        plan.id === "professional" ? { ...plan, pricePerEmployee: 3.5 } : plan,
      ),
    });
    const e = calculatePackageEstimate(config, { planId: "professional", employeeCount: 10 });
    expect(e.pricePerEmployee).toBe(3.5);
    expect(e.monthlyTotal).toBe(35);
  });

  it("free stays $0 even if a rate is set on it", () => {
    const config = normalizeBillingPackagesConfig({
      planDefinitions: DEFAULT_PACKAGES_CONFIG.planDefinitions.map((plan) =>
        plan.id === "free" ? { ...plan, pricePerEmployee: 99 } : plan,
      ),
    });
    const e = calculatePackageEstimate(config, { planId: "free", employeeCount: 10 });
    expect(e.monthlyTotal).toBe(0);
  });
});

describe("normalizeBillingPackagesConfig", () => {
  it("returns the four default plans for empty input", () => {
    const config = normalizeBillingPackagesConfig(undefined);
    expect(config.planDefinitions).toHaveLength(4);
    expect(config.planDefinitions.map((p) => p.id)).toEqual(["free", "starter", "professional", "enterprise"]);
  });

  it("keeps default rates when input omits them", () => {
    const config = normalizeBillingPackagesConfig({});
    expect(config.planDefinitions.find((p) => p.id === "enterprise")?.pricePerEmployee).toBe(6);
  });

  it("clamps negative rates to zero", () => {
    const config = normalizeBillingPackagesConfig({
      planDefinitions: DEFAULT_PACKAGES_CONFIG.planDefinitions.map((plan) =>
        plan.id === "starter" ? { ...plan, pricePerEmployee: -10 } : plan,
      ),
    });
    expect(config.planDefinitions.find((p) => p.id === "starter")?.pricePerEmployee).toBe(0);
  });
});
