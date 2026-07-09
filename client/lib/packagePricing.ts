import type {
  BillableModuleId,
  PackagesConfig,
  PackagePlanDefinition,
  ModulePrice,
} from "@/types/admin";
import type { TenantPlan } from "@/types/tenant";

export interface PackageEstimateInput {
  planId: TenantPlan;
  staffCount: number;
  adminCount: number;
  selectedModules?: BillableModuleId[];
}

export interface PackageEstimate {
  plan: PackagePlanDefinition;
  monthlyTotal: number;
  moduleTotal: number;
  staffTotal: number;
  adminTotal: number;
  selectedModules: BillableModuleId[];
}

const DEFAULT_MODULE_PRICES: ModulePrice[] = [
  { id: "people", label: "People", monthlyPrice: 75 },
  { id: "timeleave", label: "Time & Leave", monthlyPrice: 45 },
  { id: "payroll", label: "Payroll", monthlyPrice: 95 },
  { id: "money", label: "Money", monthlyPrice: 65 },
  { id: "accounting", label: "Accounting", monthlyPrice: 85 },
  { id: "reports", label: "Reports", monthlyPrice: 35 },
];

export const DEFAULT_PACKAGES_CONFIG: PackagesConfig = {
  modulePrices: DEFAULT_MODULE_PRICES,
  employeePricingTiers: [
    { id: "tier-1-10", minEmployees: 1, maxEmployees: 10, pricePerEmployee: 4 },
    { id: "tier-11-20", minEmployees: 11, maxEmployees: 20, pricePerEmployee: 3.5 },
    { id: "tier-21-30", minEmployees: 21, maxEmployees: 30, pricePerEmployee: 3 },
    { id: "tier-31-50", minEmployees: 31, maxEmployees: 50, pricePerEmployee: 2.5 },
    { id: "tier-51-plus", minEmployees: 51, maxEmployees: null, pricePerEmployee: 2 },
  ],
  personPrices: {
    staffMonthlyPrice: 2,
    adminMonthlyPrice: 12,
  },
  planDefinitions: [
    {
      id: "free",
      label: "Free",
      description: "Start with core people records for a small team.",
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
      includedModules: ["people", "timeleave", "payroll", "money", "accounting", "reports"],
      maxAdmins: null,
      staffAppIncluded: true,
      highlights: ["All modules", "Unlimited admins", "Training support"],
      complianceNotes: { sickDays: true, maternityLeave: true },
    },
  ],
};

export function normalizeBillingPackagesConfig(raw: unknown): PackagesConfig {
  const input = raw && typeof raw === "object" ? raw as Partial<PackagesConfig> : {};
  return {
    ...DEFAULT_PACKAGES_CONFIG,
    ...input,
    modulePrices: normalizeModulePrices(input.modulePrices),
    employeePricingTiers: input.employeePricingTiers ?? DEFAULT_PACKAGES_CONFIG.employeePricingTiers,
    personPrices: {
      ...DEFAULT_PACKAGES_CONFIG.personPrices,
      ...(input.personPrices ?? {}),
    },
    planDefinitions: normalizePlanDefinitions(input.planDefinitions),
  };
}

export function getPackagePlan(config: PackagesConfig, planId: TenantPlan): PackagePlanDefinition {
  return config.planDefinitions.find((plan) => plan.id === planId)
    ?? DEFAULT_PACKAGES_CONFIG.planDefinitions.find((plan) => plan.id === planId)
    ?? DEFAULT_PACKAGES_CONFIG.planDefinitions[0];
}

export function calculatePackageEstimate(
  configInput: PackagesConfig,
  input: PackageEstimateInput,
): PackageEstimate {
  const config = normalizeBillingPackagesConfig(configInput);
  const plan = getPackagePlan(config, input.planId);
  const selectedModules = input.selectedModules ?? plan.includedModules;
  const moduleTotal = selectedModules.reduce((total, moduleId) => {
    const override = plan.modulePriceOverrides?.[moduleId];
    const modulePrice = config.modulePrices.find((item) => item.id === moduleId)?.monthlyPrice ?? 0;
    return total + (override ?? modulePrice);
  }, 0);
  const staffTotal = Math.max(0, input.staffCount) * config.personPrices.staffMonthlyPrice;
  const adminTotal = Math.max(0, input.adminCount) * config.personPrices.adminMonthlyPrice;

  return {
    plan,
    monthlyTotal: moduleTotal + staffTotal + adminTotal,
    moduleTotal,
    staffTotal,
    adminTotal,
    selectedModules,
  };
}

function normalizeModulePrices(modulePrices: PackagesConfig["modulePrices"] | undefined): ModulePrice[] {
  return DEFAULT_MODULE_PRICES.map((defaultPrice) => ({
    ...defaultPrice,
    ...(modulePrices?.find((item) => item.id === defaultPrice.id) ?? {}),
  }));
}

function normalizePlanDefinitions(
  planDefinitions: PackagesConfig["planDefinitions"] | undefined,
): PackagePlanDefinition[] {
  return DEFAULT_PACKAGES_CONFIG.planDefinitions.map((defaultPlan) => {
    const rawPlan = planDefinitions?.find((plan) => plan.id === defaultPlan.id);
    return {
      ...defaultPlan,
      ...(rawPlan ?? {}),
      includedModules: rawPlan?.includedModules ?? defaultPlan.includedModules,
      highlights: rawPlan?.highlights ?? defaultPlan.highlights,
      complianceNotes: {
        ...defaultPlan.complianceNotes,
        ...(rawPlan?.complianceNotes ?? {}),
      },
    };
  });
}
