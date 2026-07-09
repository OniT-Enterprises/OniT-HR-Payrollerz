import type { PackagesConfig } from "@/types/admin";

export interface PackageEstimateInput {
  employeeCount: number;
}

export interface PackageEstimate {
  pricePerEmployee: number;
  employeeCount: number;
  monthlyTotal: number;
}

// Single flat per-employee rate (USD/month). Tuned for Timor-Leste; editable in
// the admin price editor.
export const DEFAULT_PRICE_PER_EMPLOYEE = 4;

export const DEFAULT_PACKAGES_CONFIG: PackagesConfig = {
  pricePerEmployee: DEFAULT_PRICE_PER_EMPLOYEE,
};

// Everything the product includes — shown on pricing surfaces. All accounts,
// free or paid, get all of it. Paying only unlocks finalizing a payroll run.
export const ALL_FEATURES: string[] = [
  "People & org directory",
  "Hiring & onboarding",
  "Time & leave",
  "Performance reviews",
  "Payroll — INSS, WIT, subsídio",
  "Money — invoices, bills, expenses",
  "Accounting & general ledger",
  "Reports & compliance",
  "Ekipa staff mobile app",
];

export function normalizeBillingPackagesConfig(raw: unknown): PackagesConfig {
  const input = raw && typeof raw === "object" ? (raw as Partial<PackagesConfig>) : {};
  const rate =
    typeof input.pricePerEmployee === "number" && Number.isFinite(input.pricePerEmployee)
      ? Math.max(0, input.pricePerEmployee)
      : DEFAULT_PRICE_PER_EMPLOYEE;
  return { pricePerEmployee: rate };
}

export function calculatePackageEstimate(
  configInput: PackagesConfig,
  input: PackageEstimateInput,
): PackageEstimate {
  const { pricePerEmployee } = normalizeBillingPackagesConfig(configInput);
  const employeeCount = Math.max(0, Math.floor(input.employeeCount || 0));
  return {
    pricePerEmployee,
    employeeCount,
    monthlyTotal: pricePerEmployee * employeeCount,
  };
}

/**
 * A tenant can finalize payroll only when it has an active paid subscription.
 * The webhook sets stripeSubscriptionId on subscribe and clears it on cancel;
 * subscriptionPaidUntil (if present) must not be in the past.
 */
export function isTenantSubscribed(tenant: {
  stripeSubscriptionId?: string | null;
  subscriptionPaidUntil?: { toDate?: () => Date } | Date | null;
}): boolean {
  if (!tenant.stripeSubscriptionId) return false;
  const paidUntil = tenant.subscriptionPaidUntil;
  if (paidUntil) {
    const date =
      paidUntil instanceof Date
        ? paidUntil
        : typeof paidUntil.toDate === "function"
          ? paidUntil.toDate()
          : null;
    if (date && date.getTime() < Date.now()) return false;
  }
  return true;
}
