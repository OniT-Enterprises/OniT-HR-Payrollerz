import type { PackagesConfig } from "@/types/admin";
import { multiplyMoney, roundMoney, subtractMoney } from "@/lib/currency";

export type BillingInterval = "month" | "year";

export interface PackageEstimateInput {
  employeeCount: number;
}

export interface PackageEstimate {
  pricePerEmployee: number;
  minimumEmployees: number;
  annualMonthsCharged: number;
  employeeCount: number;
  billedEmployees: number;
  monthlyTotal: number;
  annualTotal: number;
  annualSavings: number;
}

// One simple price with a small-company minimum and a two-month annual discount.
// All three values remain editable by a superadmin in the pricing screen.
export const DEFAULT_PRICE_PER_EMPLOYEE = 4;
export const DEFAULT_MINIMUM_EMPLOYEES = 5;
export const DEFAULT_ANNUAL_MONTHS_CHARGED = 10;

export const DEFAULT_PACKAGES_CONFIG: PackagesConfig = {
  pricePerEmployee: DEFAULT_PRICE_PER_EMPLOYEE,
  minimumEmployees: DEFAULT_MINIMUM_EMPLOYEES,
  annualMonthsCharged: DEFAULT_ANNUAL_MONTHS_CHARGED,
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
    typeof input.pricePerEmployee === "number" &&
    Number.isFinite(input.pricePerEmployee) &&
    input.pricePerEmployee > 0
      ? input.pricePerEmployee
      : DEFAULT_PRICE_PER_EMPLOYEE;
  const minimumEmployees =
    typeof input.minimumEmployees === "number" && Number.isFinite(input.minimumEmployees)
      ? Math.max(1, Math.floor(input.minimumEmployees))
      : DEFAULT_MINIMUM_EMPLOYEES;
  const annualMonthsCharged =
    typeof input.annualMonthsCharged === "number" && Number.isFinite(input.annualMonthsCharged)
      ? Math.min(12, Math.max(1, Math.floor(input.annualMonthsCharged)))
      : DEFAULT_ANNUAL_MONTHS_CHARGED;
  return {
    pricePerEmployee: roundMoney(rate),
    minimumEmployees,
    annualMonthsCharged,
  };
}

export function calculatePackageEstimate(
  configInput: PackagesConfig,
  input: PackageEstimateInput,
): PackageEstimate {
  const { pricePerEmployee, minimumEmployees, annualMonthsCharged } =
    normalizeBillingPackagesConfig(configInput);
  const employeeCount = Math.max(0, Math.floor(input.employeeCount || 0));
  const billedEmployees = Math.max(minimumEmployees, employeeCount, 1);
  const monthlyTotal = multiplyMoney(pricePerEmployee, billedEmployees);
  const annualTotal = multiplyMoney(monthlyTotal, annualMonthsCharged);
  return {
    pricePerEmployee,
    minimumEmployees,
    annualMonthsCharged,
    employeeCount,
    billedEmployees,
    monthlyTotal,
    annualTotal,
    annualSavings: subtractMoney(multiplyMoney(monthlyTotal, 12), annualTotal),
  };
}

export function getPackageBillingAmount(
  estimate: PackageEstimate,
  interval: BillingInterval,
): number {
  return interval === "year" ? estimate.annualTotal : estimate.monthlyTotal;
}

function toDateMaybe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/**
 * A tenant can finalize payroll only when it has an active paid subscription.
 * Two ways to be subscribed (mirrored by tenantHasActiveSubscription in
 * firestore.rules — keep them in sync):
 *
 * - Stripe: the webhook sets stripeSubscriptionId on subscribe and clears it
 *   on cancel; subscriptionPaidUntil (if present) must not be in the past.
 * - Manual (bank transfer / cash, recorded by a superadmin in Admin):
 *   manualSubscription === true AND an unexpired subscriptionPaidUntil is
 *   REQUIRED — manual subs are never open-ended.
 */
export function isTenantSubscribed(tenant: {
  stripeSubscriptionId?: string | null;
  manualSubscription?: boolean | null;
  // Accepts Date, Firestore Timestamp, or any unknown shape (duck-typed)
  // so admin TenantConfig docs can be passed straight in.
  subscriptionPaidUntil?: unknown;
}): boolean {
  const paidUntil = toDateMaybe(tenant.subscriptionPaidUntil);
  const lapsed = paidUntil !== null && paidUntil.getTime() < Date.now();
  if (tenant.stripeSubscriptionId) {
    // Stripe tolerates a missing paidUntil (webhook fills it in shortly).
    return !lapsed;
  }
  if (tenant.manualSubscription === true) {
    return paidUntil !== null && !lapsed;
  }
  return false;
}
