"use strict";
/**
 * Pure leave-policy logic shared by the Time & Leave Cloud Functions
 * (timeleave.ts) and unit tests. No Firebase imports — importable without an
 * initialized Admin app, so the code under test is the exact code that runs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.annualCarryOverPolicyFromConfig = annualCarryOverPolicyFromConfig;
exports.computeAnnualCarryOver = computeAnnualCarryOver;
exports.firstTrackedAnnualYear = firstTrackedAnnualYear;
exports.probationEligibleFromDate = probationEligibleFromDate;
/**
 * Carry-over policy for annual leave from the tenant settings config doc.
 * Defaults mirror TL_DEFAULT_LEAVE_POLICIES (client/types/settings.ts):
 * carry-over allowed, capped at 6 days.
 */
function annualCarryOverPolicyFromConfig(configData) {
    const policies = configData === null || configData === void 0 ? void 0 : configData.timeOffPolicies;
    const annual = policies === null || policies === void 0 ? void 0 : policies.annualLeave;
    const allowed = (annual === null || annual === void 0 ? void 0 : annual.carryOverAllowed) !== false;
    const perType = Number(annual === null || annual === void 0 ? void 0 : annual.maxCarryOverDays);
    const topLevel = Number(policies === null || policies === void 0 ? void 0 : policies.maxCarryOverDays);
    const maxDays = Number.isFinite(perType) && perType >= 0
        ? perType
        : Number.isFinite(topLevel) && topLevel >= 0
            ? topLevel
            : 6;
    return { allowed, maxDays };
}
/**
 * Annual-leave days carried into `targetYear`, derived purely from tracked
 * request history so the balance projection stays idempotent (no dependence on
 * previously stored carry-over values).
 *
 * The chain starts at the earliest year with any tracked annual-leave request
 * (`firstTrackedYear`) and rolls forward: each year's unused entitlement
 * (entitlement + carried-in − committed) carries over, clamped to
 * [0, policy.maxDays]. Years before any tracked history contribute nothing —
 * we refuse to fabricate carry-over for time we have no data about.
 *
 * `committedInYear` must return pending+approved annual-leave days for a year,
 * matching recomputeLeaveBalance's accounting.
 */
function computeAnnualCarryOver(options) {
    const { targetYear, firstTrackedYear, annualEntitlement, committedInYear, policy } = options;
    if (!policy.allowed || policy.maxDays <= 0)
        return 0;
    if (!Number.isInteger(targetYear))
        return 0;
    if (firstTrackedYear === null || !Number.isInteger(firstTrackedYear))
        return 0;
    if (firstTrackedYear >= targetYear)
        return 0;
    if (!Number.isFinite(annualEntitlement) || annualEntitlement < 0)
        return 0;
    let carry = 0;
    for (let year = firstTrackedYear; year < targetYear; year += 1) {
        const committed = Number(committedInYear(year));
        const used = Number.isFinite(committed) && committed > 0 ? committed : 0;
        const unused = annualEntitlement + carry - used;
        carry = Math.min(policy.maxDays, Math.max(0, Math.round(unused * 100) / 100));
    }
    return carry;
}
/**
 * Earliest year with any pending/approved annual-leave request, or null when
 * there is no tracked history. Feeds computeAnnualCarryOver's chain start.
 */
function firstTrackedAnnualYear(requests) {
    let first = null;
    for (const request of requests) {
        if (request.leaveType !== "annual")
            continue;
        if (request.status !== "pending" && request.status !== "approved")
            continue;
        if (!request.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(request.startDate))
            continue;
        const year = Number(request.startDate.slice(0, 4));
        if (!Number.isInteger(year))
            continue;
        if (first === null || year < first)
            first = year;
    }
    return first;
}
/**
 * First date (YYYY-MM-DD) an employee may START annual leave under the
 * tenant's probation policy: hire date + `probationMonths` calendar months,
 * clamping to the last day of the target month (e.g. hired Nov 30 + 3 months →
 * Feb 28/29). Returns null when there is nothing to enforce (no valid hire
 * date, or probation not configured).
 */
function probationEligibleFromDate(hireDate, probationMonths) {
    if (!Number.isFinite(probationMonths) || probationMonths <= 0)
        return null;
    if (!hireDate || !/^\d{4}-\d{2}-\d{2}$/.test(hireDate))
        return null;
    const parsed = new Date(`${hireDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== hireDate) {
        return null;
    }
    const months = Math.floor(probationMonths);
    const targetMonthIndex = parsed.getUTCMonth() + months;
    const targetYear = parsed.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
    const targetMonth = targetMonthIndex % 12;
    const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const day = Math.min(parsed.getUTCDate(), lastDayOfTargetMonth);
    const result = new Date(Date.UTC(targetYear, targetMonth, day));
    return result.toISOString().slice(0, 10);
}
//# sourceMappingURL=leave-logic.js.map