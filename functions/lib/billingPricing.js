"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BILLING_PRICING = void 0;
exports.normalizeBillingPricing = normalizeBillingPricing;
exports.calculateBilledSeats = calculateBilledSeats;
exports.dollarsToCents = dollarsToCents;
exports.centsToDollars = centsToDollars;
exports.getStripeUnitAmountCents = getStripeUnitAmountCents;
exports.effectiveAnnualPaidSeats = effectiveAnnualPaidSeats;
exports.planAnnualSeatUpdates = planAnnualSeatUpdates;
exports.calculateSubscriptionAmounts = calculateSubscriptionAmounts;
exports.DEFAULT_BILLING_PRICING = {
    pricePerEmployee: 4,
    minimumEmployees: 5,
    annualMonthsCharged: 10,
};
function normalizeBillingPricing(raw) {
    const input = raw && typeof raw === "object"
        ? raw
        : {};
    const pricePerEmployee = typeof input.pricePerEmployee === "number" &&
        Number.isFinite(input.pricePerEmployee) &&
        input.pricePerEmployee > 0
        ? centsToDollars(dollarsToCents(input.pricePerEmployee))
        : exports.DEFAULT_BILLING_PRICING.pricePerEmployee;
    const minimumEmployees = typeof input.minimumEmployees === "number" &&
        Number.isFinite(input.minimumEmployees)
        ? Math.max(1, Math.floor(input.minimumEmployees))
        : exports.DEFAULT_BILLING_PRICING.minimumEmployees;
    const annualMonthsCharged = typeof input.annualMonthsCharged === "number" &&
        Number.isFinite(input.annualMonthsCharged)
        ? Math.min(12, Math.max(1, Math.floor(input.annualMonthsCharged)))
        : exports.DEFAULT_BILLING_PRICING.annualMonthsCharged;
    return { pricePerEmployee, minimumEmployees, annualMonthsCharged };
}
function calculateBilledSeats(employeeCount, pricing) {
    const activeEmployees = Number.isFinite(employeeCount)
        ? Math.max(0, Math.floor(employeeCount))
        : 0;
    return Math.max(pricing.minimumEmployees, activeEmployees, 1);
}
/** Convert a decimal-dollar configuration value to Stripe's integer cents. */
function dollarsToCents(amount) {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    // Compensate for binary floating-point representations such as 4.005 while
    // enforcing Stripe's integer-cent boundary with currency half-up rounding.
    const roundingGuard = Number.EPSILON * Math.max(1, safeAmount);
    return Math.round((safeAmount + roundingGuard) * 100);
}
function centsToDollars(cents) {
    return Math.round(cents) / 100;
}
function getStripeUnitAmountCents(pricing, interval) {
    const monthlyCents = dollarsToCents(pricing.pricePerEmployee);
    return interval === "year"
        ? monthlyCents * pricing.annualMonthsCharged
        : monthlyCents;
}
/**
 * Resolve how many seats have already been PAID FOR within the current annual
 * (prepaid) term. This is the peak seat count invoiced during the term, banked
 * so seasonal staff who are removed and later re-added are never billed twice
 * (see docs/BILLING.md — "Added annual seats are prorated and invoiced
 * immediately; annual seat reductions apply at renewal").
 *
 * - On a NEW term (the stored term start differs from the subscription's current
 *   period start) the renewal invoice already paid for the current quantity, so
 *   that becomes the fresh paid baseline.
 * - Within the SAME term the paid peak is max(banked peak, current quantity):
 *   an increase raises the peak, a reduction never lowers what was already paid.
 */
function effectiveAnnualPaidSeats(storedPaidSeats, storedTermStart, currentTermStart, currentQuantity) {
    const current = Math.max(1, Math.floor(currentQuantity));
    const sameTerm = typeof storedTermStart === "number" &&
        Number.isFinite(storedTermStart) &&
        typeof currentTermStart === "number" &&
        Number.isFinite(currentTermStart) &&
        storedTermStart === currentTermStart &&
        typeof storedPaidSeats === "number" &&
        Number.isFinite(storedPaidSeats);
    if (!sameTerm)
        return current;
    return Math.max(Math.floor(storedPaidSeats), current);
}
/**
 * Plan the Stripe quantity update(s) for an ANNUAL subscription so that seats
 * already paid for within the current prepaid term are never billed twice when
 * re-added (the seasonal-staff double-charge, docs/BILLING.md finding 5).
 *
 * - Reduction: change the quantity with no proration — annual reductions carry
 *   no credit and take effect at renewal; the removed seats stay banked in
 *   `paidSeats` for a free re-add later this term.
 * - Increase up to the paid peak: re-adding already-paid seats — never charge.
 * - Increase past the paid peak: re-add the paid seats for free, then invoice
 *   (prorate) ONLY the genuinely new seats above the peak.
 */
function planAnnualSeatUpdates(currentQuantity, desiredQuantity, paidSeats) {
    const current = Math.max(0, Math.floor(currentQuantity));
    const desired = Math.max(1, Math.floor(desiredQuantity));
    // Invariant: seats already paid for is never less than the live quantity.
    const paid = Math.max(current, Math.floor(paidSeats));
    if (desired === current)
        return [];
    if (desired < current) {
        // Reduction: no credit; already-paid seats stay banked for free re-add.
        return [{ quantity: desired, prorationBehavior: "none" }];
    }
    if (desired <= paid) {
        // Re-adding seats already paid for this term — never charge again.
        return [{ quantity: desired, prorationBehavior: "none" }];
    }
    // Crosses above the paid peak: re-add the paid seats for free (if we had
    // dropped below), then invoice only the seats above the peak.
    const updates = [];
    if (paid > current)
        updates.push({ quantity: paid, prorationBehavior: "none" });
    updates.push({ quantity: desired, prorationBehavior: "always_invoice" });
    return updates;
}
function calculateSubscriptionAmounts(unitAmountCents, quantity, interval, annualMonthsCharged) {
    const safeUnitCents = Number.isFinite(unitAmountCents)
        ? Math.max(0, Math.round(unitAmountCents))
        : 0;
    const safeQuantity = Number.isFinite(quantity)
        ? Math.max(1, Math.floor(quantity))
        : 1;
    const billingAmountCents = safeUnitCents * safeQuantity;
    const billingAmount = centsToDollars(billingAmountCents);
    const normalizedAnnualMonths = Number.isFinite(annualMonthsCharged)
        ? Math.min(12, Math.max(1, Math.floor(annualMonthsCharged)))
        : exports.DEFAULT_BILLING_PRICING.annualMonthsCharged;
    return {
        billingAmount,
        monthlyAmount: interval === "year"
            ? centsToDollars(billingAmountCents / normalizedAnnualMonths)
            : billingAmount,
        billingMonths: interval === "year" ? 12 : 1,
    };
}
//# sourceMappingURL=billingPricing.js.map