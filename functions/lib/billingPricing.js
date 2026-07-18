"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BILLING_PRICING = void 0;
exports.normalizeBillingPricing = normalizeBillingPricing;
exports.calculateBilledSeats = calculateBilledSeats;
exports.dollarsToCents = dollarsToCents;
exports.centsToDollars = centsToDollars;
exports.getStripeUnitAmountCents = getStripeUnitAmountCents;
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
    const minimumEmployees = typeof input.minimumEmployees === "number" && Number.isFinite(input.minimumEmployees)
        ? Math.max(1, Math.floor(input.minimumEmployees))
        : exports.DEFAULT_BILLING_PRICING.minimumEmployees;
    const annualMonthsCharged = typeof input.annualMonthsCharged === "number" && Number.isFinite(input.annualMonthsCharged)
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
function calculateSubscriptionAmounts(unitAmountCents, quantity, interval, annualMonthsCharged) {
    const safeUnitCents = Number.isFinite(unitAmountCents)
        ? Math.max(0, Math.round(unitAmountCents))
        : 0;
    const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
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