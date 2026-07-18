export type BillingInterval = "month" | "year";

export interface BillingPricingConfig {
  pricePerEmployee: number;
  minimumEmployees: number;
  annualMonthsCharged: number;
}

export const DEFAULT_BILLING_PRICING: BillingPricingConfig = {
  pricePerEmployee: 4,
  minimumEmployees: 5,
  annualMonthsCharged: 10,
};

export function normalizeBillingPricing(raw: unknown): BillingPricingConfig {
  const input = raw && typeof raw === "object"
    ? raw as Partial<BillingPricingConfig>
    : {};
  const pricePerEmployee =
    typeof input.pricePerEmployee === "number" &&
    Number.isFinite(input.pricePerEmployee) &&
    input.pricePerEmployee > 0
      ? centsToDollars(dollarsToCents(input.pricePerEmployee))
      : DEFAULT_BILLING_PRICING.pricePerEmployee;
  const minimumEmployees =
    typeof input.minimumEmployees === "number" && Number.isFinite(input.minimumEmployees)
      ? Math.max(1, Math.floor(input.minimumEmployees))
      : DEFAULT_BILLING_PRICING.minimumEmployees;
  const annualMonthsCharged =
    typeof input.annualMonthsCharged === "number" && Number.isFinite(input.annualMonthsCharged)
      ? Math.min(12, Math.max(1, Math.floor(input.annualMonthsCharged)))
      : DEFAULT_BILLING_PRICING.annualMonthsCharged;

  return { pricePerEmployee, minimumEmployees, annualMonthsCharged };
}

export function calculateBilledSeats(
  employeeCount: number,
  pricing: BillingPricingConfig,
): number {
  const activeEmployees = Number.isFinite(employeeCount)
    ? Math.max(0, Math.floor(employeeCount))
    : 0;
  return Math.max(pricing.minimumEmployees, activeEmployees, 1);
}

/** Convert a decimal-dollar configuration value to Stripe's integer cents. */
export function dollarsToCents(amount: number): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  // Compensate for binary floating-point representations such as 4.005 while
  // enforcing Stripe's integer-cent boundary with currency half-up rounding.
  const roundingGuard = Number.EPSILON * Math.max(1, safeAmount);
  return Math.round((safeAmount + roundingGuard) * 100);
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

export function getStripeUnitAmountCents(
  pricing: BillingPricingConfig,
  interval: BillingInterval,
): number {
  const monthlyCents = dollarsToCents(pricing.pricePerEmployee);
  return interval === "year"
    ? monthlyCents * pricing.annualMonthsCharged
    : monthlyCents;
}

export function calculateSubscriptionAmounts(
  unitAmountCents: number,
  quantity: number,
  interval: BillingInterval,
  annualMonthsCharged: number,
): { billingAmount: number; monthlyAmount: number; billingMonths: number } {
  const safeUnitCents = Number.isFinite(unitAmountCents)
    ? Math.max(0, Math.round(unitAmountCents))
    : 0;
  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
  const billingAmountCents = safeUnitCents * safeQuantity;
  const billingAmount = centsToDollars(billingAmountCents);
  const normalizedAnnualMonths = Number.isFinite(annualMonthsCharged)
    ? Math.min(12, Math.max(1, Math.floor(annualMonthsCharged)))
    : DEFAULT_BILLING_PRICING.annualMonthsCharged;

  return {
    billingAmount,
    monthlyAmount: interval === "year"
      ? centsToDollars(billingAmountCents / normalizedAnnualMonths)
      : billingAmount,
    billingMonths: interval === "year" ? 12 : 1,
  };
}
