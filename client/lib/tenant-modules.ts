import type { TenantConfig } from "@/types/tenant";

export type TenantModuleKey = keyof NonNullable<TenantConfig["features"]>;

/**
 * The modules a tenant's workspace is made of, in nav order. `undefined` means
 * ON — a tenant doc written before a module existed must not read as having it
 * switched off, so only an explicit `false` disables anything.
 */
export const TENANT_MODULES: { key: TenantModuleKey; label: string }[] = [
  { key: "people", label: "People" },
  { key: "hiring", label: "Hiring" },
  { key: "timeleave", label: "Time" },
  { key: "performance", label: "Performance" },
  { key: "payroll", label: "Payroll" },
  { key: "money", label: "Money" },
  { key: "accounting", label: "Accounting" },
  { key: "reports", label: "Reports" },
];

export interface TenantModuleSummary {
  total: number;
  enabledCount: number;
  /** Labels of the modules that are explicitly off — the only part worth reading. */
  offLabels: string[];
  allOn: boolean;
}

/**
 * Summarize a tenant's modules by EXCEPTION. Every module is on for every new
 * tenant, so eight per-module pills on every row spent a column restating
 * "everything is on"; what a superadmin actually needs to spot is the tenant
 * that is missing something.
 */
export function summarizeTenantModules(
  features: TenantConfig["features"],
): TenantModuleSummary {
  const offLabels = TENANT_MODULES.filter(
    (module) => features?.[module.key] === false,
  ).map((module) => module.label);

  return {
    total: TENANT_MODULES.length,
    enabledCount: TENANT_MODULES.length - offLabels.length,
    offLabels,
    allOn: offLabels.length === 0,
  };
}
