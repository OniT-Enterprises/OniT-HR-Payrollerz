import type {
  BillableModuleId,
  PackagesConfig,
  PackagePlanDefinition,
} from "@/types/admin";
import type { TenantPlan } from "@/types/tenant";

export interface PackageEstimateInput {
  planId: TenantPlan;
  employeeCount: number;
}

export interface PackageEstimate {
  plan: PackagePlanDefinition;
  /** employees * pricePerEmployee (0 for the free plan). */
  monthlyTotal: number;
  pricePerEmployee: number;
  employeeCount: number;
}

// The "free" plan is always $0 regardless of headcount.
export const FREE_PLAN_ID: TenantPlan = "free";

export const DEFAULT_PACKAGES_CONFIG: PackagesConfig = {
  planDefinitions: [
    {
      id: "free",
      label: "Free",
      description: "Core people records for a small team.",
      pricePerEmployee: 0,
      includedModules: ["people"],
      maxAdmins: 1,
      staffAppIncluded: false,
      highlights: ["People directory", "Basic employee records"],
      complianceNotes: { sickDays: false, maternityLeave: false },
    },
    {
      id: "starter",
      label: "Starter",
      description: "People operations with leave and reporting basics.",
      pricePerEmployee: 2,
      includedModules: ["people", "timeleave", "reports"],
      maxAdmins: 2,
      staffAppIncluded: true,
      highlights: ["Leave tracking", "Reports", "Staff app"],
      complianceNotes: { sickDays: true, maternityLeave: true },
    },
    {
      id: "professional",
      label: "Professional",
      description: "Payroll, time, and business reporting for growing teams.",
      pricePerEmployee: 4,
      includedModules: ["people", "timeleave", "payroll", "reports"],
      maxAdmins: 5,
      staffAppIncluded: true,
      highlights: ["Payroll", "Compliance reporting", "Staff app"],
      complianceNotes: { sickDays: true, maternityLeave: true },
    },
    {
      id: "enterprise",
      label: "Enterprise",
      description: "Full HR, payroll, money, accounting, and reporting suite.",
      pricePerEmployee: 6,
      includedModules: ["people", "timeleave", "payroll", "money", "accounting", "reports"],
      maxAdmins: null,
      staffAppIncluded: true,
      highlights: ["All modules", "Unlimited admins", "Training support"],
      complianceNotes: { sickDays: true, maternityLeave: true },
    },
  ],
};

export function normalizeBillingPackagesConfig(raw: unknown): PackagesConfig {
  const input = raw && typeof raw === "object" ? (raw as Partial<PackagesConfig>) : {};
  return {
    planDefinitions: normalizePlanDefinitions(input.planDefinitions),
  };
}

export function getPackagePlan(config: PackagesConfig, planId: TenantPlan): PackagePlanDefinition {
  return (
    config.planDefinitions.find((plan) => plan.id === planId) ??
    DEFAULT_PACKAGES_CONFIG.planDefinitions.find((plan) => plan.id === planId) ??
    DEFAULT_PACKAGES_CONFIG.planDefinitions[0]
  );
}

export function calculatePackageEstimate(
  configInput: PackagesConfig,
  input: PackageEstimateInput,
): PackageEstimate {
  const config = normalizeBillingPackagesConfig(configInput);
  const plan = getPackagePlan(config, input.planId);
  const employeeCount = Math.max(0, Math.floor(input.employeeCount || 0));
  const pricePerEmployee = plan.id === FREE_PLAN_ID ? 0 : Math.max(0, plan.pricePerEmployee);

  return {
    plan,
    pricePerEmployee,
    employeeCount,
    monthlyTotal: pricePerEmployee * employeeCount,
  };
}

function normalizePlanDefinitions(
  planDefinitions: PackagesConfig["planDefinitions"] | undefined,
): PackagePlanDefinition[] {
  return DEFAULT_PACKAGES_CONFIG.planDefinitions.map((defaultPlan) => {
    const rawPlan = planDefinitions?.find((plan) => plan.id === defaultPlan.id);
    return {
      ...defaultPlan,
      ...(rawPlan ?? {}),
      pricePerEmployee:
        typeof rawPlan?.pricePerEmployee === "number" && Number.isFinite(rawPlan.pricePerEmployee)
          ? Math.max(0, rawPlan.pricePerEmployee)
          : defaultPlan.pricePerEmployee,
      includedModules: rawPlan?.includedModules ?? defaultPlan.includedModules,
      highlights: rawPlan?.highlights ?? defaultPlan.highlights,
      complianceNotes: {
        ...defaultPlan.complianceNotes,
        ...(rawPlan?.complianceNotes ?? {}),
      },
    };
  });
}

export type { BillableModuleId };
