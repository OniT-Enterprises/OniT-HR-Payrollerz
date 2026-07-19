import { describe, expect, it } from "vitest";
import {
  DEFAULT_BILLING_PRICING,
  calculateBilledSeats,
  calculateSubscriptionAmounts,
  centsToDollars,
  dollarsToCents,
  effectiveAnnualPaidSeats,
  getStripeUnitAmountCents,
  normalizeBillingPricing,
  planAnnualSeatUpdates,
} from "../../functions/src/billingPricing";
import { DEFAULT_PACKAGES_CONFIG } from "@/lib/packagePricing";

describe("Cloud Functions billing price wiring", () => {
  it("uses the same $4, five-seat, ten-month annual defaults as the client", () => {
    expect(normalizeBillingPricing(undefined)).toEqual(DEFAULT_BILLING_PRICING);
    expect(DEFAULT_BILLING_PRICING).toEqual(DEFAULT_PACKAGES_CONFIG);
    expect(calculateBilledSeats(0, DEFAULT_BILLING_PRICING)).toBe(5);
    expect(calculateBilledSeats(4, DEFAULT_BILLING_PRICING)).toBe(5);
    expect(calculateBilledSeats(6, DEFAULT_BILLING_PRICING)).toBe(6);
    expect(getStripeUnitAmountCents(DEFAULT_BILLING_PRICING, "month")).toBe(
      400,
    );
    expect(getStripeUnitAmountCents(DEFAULT_BILLING_PRICING, "year")).toBe(
      4000,
    );
  });

  it("normalizes unsafe configuration before it reaches Stripe", () => {
    expect(
      normalizeBillingPricing({
        pricePerEmployee: -1,
        minimumEmployees: -9,
        annualMonthsCharged: 99,
      }),
    ).toEqual({
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
    expect(
      normalizeBillingPricing({ pricePerEmployee: 4.005 }).pricePerEmployee,
    ).toBe(4.01);
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

describe("Annual seat banking (no double-charge on re-added seasonal staff)", () => {
  it("resolves the paid seat peak per term", () => {
    // First run this term (no stored term): the renewal already paid current qty.
    expect(effectiveAnnualPaidSeats(undefined, undefined, 1000, 10)).toBe(10);
    // Same term, a prior reduction left a lower live qty — the peak is banked.
    expect(effectiveAnnualPaidSeats(10, 1000, 1000, 5)).toBe(10);
    // Same term, an invoiced increase raised the live qty — the peak rises.
    expect(effectiveAnnualPaidSeats(10, 1000, 1000, 12)).toBe(12);
    // New term (renewal): the banked peak resets to the newly paid quantity.
    expect(effectiveAnnualPaidSeats(12, 1000, 2000, 5)).toBe(5);
  });

  it("never charges for seats already paid for this term", () => {
    // No change.
    expect(planAnnualSeatUpdates(10, 10, 10)).toEqual([]);
    // Reduction: no credit, no proration; peer seats stay banked.
    expect(planAnnualSeatUpdates(10, 5, 10)).toEqual([
      { quantity: 5, prorationBehavior: "none" },
    ]);
    // Re-adding seats already paid for (the seasonal-staff bug): NOT re-charged.
    expect(planAnnualSeatUpdates(5, 10, 10)).toEqual([
      { quantity: 10, prorationBehavior: "none" },
    ]);
  });

  it("prorates only the genuinely new seats above the paid peak", () => {
    // Grew past the peak from the full quantity: invoice just the new seats.
    expect(planAnnualSeatUpdates(10, 12, 10)).toEqual([
      { quantity: 12, prorationBehavior: "always_invoice" },
    ]);
    // Grew past the peak after a reduction: re-add the paid seats for free,
    // then invoice only the seats above the peak.
    expect(planAnnualSeatUpdates(5, 15, 10)).toEqual([
      { quantity: 10, prorationBehavior: "none" },
      { quantity: 15, prorationBehavior: "always_invoice" },
    ]);
    // Defensive: a stored paid peak below the live quantity is clamped up.
    expect(planAnnualSeatUpdates(10, 12, 5)).toEqual([
      { quantity: 12, prorationBehavior: "always_invoice" },
    ]);
  });
});
