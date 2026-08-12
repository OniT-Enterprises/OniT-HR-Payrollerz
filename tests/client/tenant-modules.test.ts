import { describe, it, expect } from "vitest";
import {
  TENANT_MODULES,
  summarizeTenantModules,
} from "@/lib/tenant-modules";

describe("summarizeTenantModules — modules by exception", () => {
  it("treats a tenant with no features map as fully enabled", () => {
    const summary = summarizeTenantModules(undefined);
    expect(summary.allOn).toBe(true);
    expect(summary.offLabels).toEqual([]);
    expect(summary.enabledCount).toBe(TENANT_MODULES.length);
  });

  it("only an explicit false disables a module", () => {
    // A tenant doc written before a module existed simply lacks the key. Reading
    // that as "off" would hide working modules from the admin console.
    const summary = summarizeTenantModules({ people: true });
    expect(summary.allOn).toBe(true);
    expect(summary.enabledCount).toBe(TENANT_MODULES.length);
  });

  it("reports the modules that are off, in nav order", () => {
    const summary = summarizeTenantModules({ payroll: false, hiring: false });
    expect(summary.offLabels).toEqual(["Hiring", "Payroll"]);
    expect(summary.enabledCount).toBe(TENANT_MODULES.length - 2);
    expect(summary.allOn).toBe(false);
  });

  it("counts the legacy free-plan tenant whose payroll module was written off", () => {
    // createTenant used to set features.payroll = plan !== "free", so tenants an
    // admin created on the default plan carry payroll: false. That is exactly
    // the exception this column exists to surface.
    const summary = summarizeTenantModules({
      people: true,
      hiring: true,
      timeleave: true,
      performance: true,
      payroll: false,
      money: true,
      accounting: true,
      reports: true,
    });
    expect(summary.offLabels).toEqual(["Payroll"]);
    expect(summary.enabledCount).toBe(7);
  });

  it("handles every module off", () => {
    const allOff = Object.fromEntries(
      TENANT_MODULES.map((module) => [module.key, false]),
    );
    const summary = summarizeTenantModules(allOff);
    expect(summary.enabledCount).toBe(0);
    expect(summary.offLabels).toHaveLength(TENANT_MODULES.length);
    expect(summary.allOn).toBe(false);
  });

  it("ignores feature keys that are not workspace modules", () => {
    const summary = summarizeTenantModules({ ngoReporting: false, staffApp: false });
    expect(summary.allOn).toBe(true);
  });
});
