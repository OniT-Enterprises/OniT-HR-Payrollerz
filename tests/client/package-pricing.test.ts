/**
 * Package pricing engine tests.
 *
 * Guards the money math behind admin billing and the public pricing page:
 * - Free plan is always $0
 * - Plan price = included modules + per-head (staff/admin)
 * - The "money" module is billed for Enterprise (regression: it used to be
 *   silently dropped from per-tenant billing)
 * - modulePriceOverrides win over base module prices
 * - normalizeBillingPackagesConfig fills defaults and merges partial input
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PACKAGES_CONFIG,
  calculatePackageEstimate,
  normalizeBillingPackagesConfig,
} from "@/lib/packagePricing";

// Default module prices: people 75, timeleave 45, payroll 95, money 65,
// accounting 85, reports 35. Per-head: staff $2, admin $12.
const DEMO = { staffCount: 25, adminCount: 2 }; // per-head = 50 + 24 = 74

describe("calculatePackageEstimate — plan totals (default config)", () => {
  it("Free is always $0, even with staff and admins", () => {
    const free = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "free", ...DEMO });
    expect(free.monthlyTotal).toBe(0);
    expect(free.moduleTotal).toBe(0);
    expect(free.staffTotal).toBe(0);
    expect(free.adminTotal).toBe(0);
  });

  it("Starter = its modules ($155) + per-head ($74) = $229", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "starter", ...DEMO });
    expect(e.moduleTotal).toBe(155); // people 75 + timeleave 45 + reports 35
    expect(e.staffTotal + e.adminTotal).toBe(74);
    expect(e.monthlyTotal).toBe(229);
  });

  it("Professional = $250 modules + $74 = $324", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "professional", ...DEMO });
    expect(e.moduleTotal).toBe(250); // people 75 + timeleave 45 + payroll 95 + reports 35
    expect(e.monthlyTotal).toBe(324);
  });

  it("Enterprise bills the money module: $400 modules + $74 = $474", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, { planId: "enterprise", ...DEMO });
    // Regression: money ($65) must be part of the Enterprise bundle.
    expect(e.selectedModules).toContain("money");
    expect(e.moduleTotal).toBe(400); // all six modules
    expect(e.monthlyTotal).toBe(474);
  });
});

describe("calculatePackageEstimate — per-head scaling", () => {
  it("scales staff and admin counts", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, {
      planId: "enterprise",
      staffCount: 10,
      adminCount: 1,
    });
    expect(e.staffTotal).toBe(20); // 10 * 2
    expect(e.adminTotal).toBe(12); // 1 * 12
    expect(e.monthlyTotal).toBe(432); // 400 + 32
  });

  it("clamps negative counts to zero", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, {
      planId: "starter",
      staffCount: -5,
      adminCount: -1,
    });
    expect(e.staffTotal).toBe(0);
    expect(e.adminTotal).toBe(0);
    expect(e.monthlyTotal).toBe(155); // modules only
  });

  it("modules-only when there are no people", () => {
    const e = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, {
      planId: "enterprise",
      staffCount: 0,
      adminCount: 0,
    });
    expect(e.monthlyTotal).toBe(400);
  });
});

describe("calculatePackageEstimate — overrides & custom prices", () => {
  it("honors a plan's modulePriceOverrides", () => {
    const config = normalizeBillingPackagesConfig({
      planDefinitions: DEFAULT_PACKAGES_CONFIG.planDefinitions.map((plan) =>
        plan.id === "professional" ? { ...plan, modulePriceOverrides: { payroll: 0 } } : plan,
      ),
    });
    const e = calculatePackageEstimate(config, { planId: "professional", staffCount: 0, adminCount: 0 });
    expect(e.moduleTotal).toBe(155); // payroll overridden 95 -> 0
  });

  it("reflects edited base module prices", () => {
    const config = normalizeBillingPackagesConfig({
      modulePrices: [{ id: "people", label: "People", monthlyPrice: 100 }],
    });
    const e = calculatePackageEstimate(config, { planId: "starter", staffCount: 0, adminCount: 0 });
    expect(e.moduleTotal).toBe(180); // people 100 + timeleave 45 + reports 35
  });
});

describe("normalizeBillingPackagesConfig", () => {
  it("returns the full default shape for empty input", () => {
    const config = normalizeBillingPackagesConfig(undefined);
    expect(config.modulePrices).toHaveLength(6);
    expect(config.planDefinitions).toHaveLength(4);
    expect(config.personPrices).toEqual({ staffMonthlyPrice: 2, adminMonthlyPrice: 12 });
  });

  it("merges partial personPrices with defaults", () => {
    const config = normalizeBillingPackagesConfig({ personPrices: { staffMonthlyPrice: 5 } as never });
    expect(config.personPrices.staffMonthlyPrice).toBe(5);
    expect(config.personPrices.adminMonthlyPrice).toBe(12); // default retained
  });

  it("keeps all six modules even when only one is supplied", () => {
    const config = normalizeBillingPackagesConfig({
      modulePrices: [{ id: "reports", label: "Reports", monthlyPrice: 10 }],
    });
    expect(config.modulePrices).toHaveLength(6);
    expect(config.modulePrices.find((m) => m.id === "reports")?.monthlyPrice).toBe(10);
    expect(config.modulePrices.find((m) => m.id === "people")?.monthlyPrice).toBe(75); // default
  });
});
