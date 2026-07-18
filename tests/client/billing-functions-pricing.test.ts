import { describe, expect, it } from "vitest";
import {
  DEFAULT_BILLING_PRICING,
  calculateBilledSeats,
  calculateSubscriptionAmounts,
  centsToDollars,
  dollarsToCents,
  getStripeUnitAmountCents,
  normalizeBillingPricing,
} from "../../functions/src/billingPricing";
import { DEFAULT_PACKAGES_CONFIG } from "@/lib/packagePricing";

describe("Cloud Functions billing price wiring", () => {
  it("uses the same $4, five-seat, ten-month annual defaults as the client", () => {
    expect(normalizeBillingPricing(undefined)).toEqual(DEFAULT_BILLING_PRICING);
    expect(DEFAULT_BILLING_PRICING).toEqual(DEFAULT_PACKAGES_CONFIG);
    expect(calculateBilledSeats(0, DEFAULT_BILLING_PRICING)).toBe(5);
    expect(calculateBilledSeats(4, DEFAULT_BILLING_PRICING)).toBe(5);
    expect(calculateBilledSeats(6, DEFAULT_BILLING_PRICING)).toBe(6);
    expect(getStripeUnitAmountCents(DEFAULT_BILLING_PRICING, "month")).toBe(400);
    expect(getStripeUnitAmountCents(DEFAULT_BILLING_PRICING, "year")).toBe(4000);
  });

  it("normalizes unsafe configuration before it reaches Stripe", () => {
    expect(normalizeBillingPricing({
      pricePerEmployee: -1,
      minimumEmployees: -9,
      annualMonthsCharged: 99,
    })).toEqual({
      pricePerEmployee: 4,
      minimumEmployees: 1,
      annualMonthsCharged: 12,
    });
  });

  it("converts decimal prices through integer cents", () => {
    expect(dollarsToCents(4.25)).toBe(425);
    expect(dollarsToCents(4.005)).toBe(401);
    expect(dollarsToCents(4.999)).toBe(500);
    expect(centsToDollars(2125)).toBe(21.25);
    expect(normalizeBillingPricing({ pricePerEmployee: 4.005 }).pricePerEmployee).toBe(4.01);
  });

  it("records monthly and annual Stripe amounts without losing the discount", () => {
    expect(calculateSubscriptionAmounts(400, 5, "month", 10)).toEqual({
      billingAmount: 20,
      monthlyAmount: 20,
      billingMonths: 1,
    });
    expect(calculateSubscriptionAmounts(4000, 5, "year", 10)).toEqual({
      billingAmount: 200,
      monthlyAmount: 20,
      billingMonths: 12,
    });
  });
});
