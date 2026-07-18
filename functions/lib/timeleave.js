"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onLeaveRequestWrite = exports.onShiftChange = exports.approveLeaveRequest = exports.createLeaveRequest = exports.createOrUpdateShift = void 0;
exports.calculateHours = calculateHours;
exports.getBalanceContribution = getBalanceContribution;
exports.recomputeWeekTotals = recomputeWeekTotals;
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const authz_1 = require("./authz");
const db = (0, firestore_1.getFirestore)();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_ENTITLEMENTS = {
    annual: 12,
    sick: 12,
    maternity: 84,
    paternity: 5,
    unpaid: 30,
    bereavement: 5,
    marriage: 5,
    study: 0,
    custom: 0,
};
const ANNOUNCED_VARIABLE_HOLIDAYS = {
    2026: ["2026-03-20", "2026-05-27"],
};
function parseDateISO(value) {
    if (!DATE_RE.test(value)) {
        throw new https_1.HttpsError("invalid-argument", "Dates must use YYYY-MM-DD");
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new https_1.HttpsError("invalid-argument", "Invalid calendar date");
    }
    return date;
}
function formatDateISO(date) {
    return date.toISOString().slice(0, 10);
}
function addDaysISO(value, days) {
    const date = parseDateISO(value);
    date.setUTCDate(date.getUTCDate() + days);
    return formatDateISO(date);
}
function getEasterSundayUTC(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
}
function getTLHolidayDates(year) {
    var _a;
    const fixed = [
        "01-01", "03-03", "05-01", "05-20", "08-30", "11-01", "11-02",
        "11-03", "11-12", "11-28", "12-07", "12-08", "12-25", "12-31",
    ].map((monthDay) => `${year}-${monthDay}`);
    const easter = getEasterSundayUTC(year);
    const easterDate = (days) => formatDateISO(new Date(easter.getTime() + days * 24 * 60 * 60 * 1000));
    return [
        ...fixed,
        easterDate(-2),
        easterDate(60),
        ...((_a = ANNOUNCED_VARIABLE_HOLIDAYS[year]) !== null && _a !== void 0 ? _a : []),
    ];
}
async function getLeaveHolidayDates(tenantId, startDate, endDate) {
    const startYear = Number(startDate.slice(0, 4));
    const endYear = Number(endDate.slice(0, 4));
    const dates = new Set();
    for (let year = startYear; year <= endYear; year += 1) {
        for (const date of getTLHolidayDates(year))
            dates.add(date);
    }
    const overrides = await db.collection(`tenants/${tenantId}/holidays`).get();
    for (const override of overrides.docs) {
        const data = override.data();
        const date = typeof data.date === "string" ? data.date : override.id;
        if (date < startDate || date > endDate || !DATE_RE.test(date))
            continue;
        if (data.isHoliday === true)
            dates.add(date);
        else
            dates.delete(date);
    }
    return dates;
}
function calculateWorkingDays(startDate, endDate, holidays) {
    let count = 0;
    for (let date = startDate; date <= endDate; date = addDaysISO(date, 1)) {
        const weekday = parseDateISO(date).getUTCDay();
        if (weekday !== 0 && weekday !== 6 && !holidays.has(date))
            count += 1;
    }
    return count;
}
async function calculateCanonicalLeaveDuration(tenantId, data) {
    if (!data.startDate || !data.endDate) {
        throw new https_1.HttpsError("invalid-argument", "Start and end dates are required");
    }
    const start = parseDateISO(data.startDate);
    const end = parseDateISO(data.endDate);
    const calendarDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (calendarDays <= 0 || calendarDays > 366) {
        throw new https_1.HttpsError("invalid-argument", "Leave must be between 1 and 366 calendar days");
    }
    const holidays = await getLeaveHolidayDates(tenantId, data.startDate, data.endDate);
    if (data.halfDay === true) {
        if (data.startDate !== data.endDate) {
            throw new https_1.HttpsError("invalid-argument", "Half-day leave must use one date");
        }
        return calculateWorkingDays(data.startDate, data.endDate, holidays) === 1 ? 0.5 : 0;
    }
    return calculateWorkingDays(data.startDate, data.endDate, holidays);
}
function getTodayTL() {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function minutesFromTime(value) {
    if (!TIME_RE.test(value)) {
        throw new https_1.HttpsError("invalid-argument", "Times must use 24-hour HH:MM");
    }
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
}
function calculateHours(startTime, endTime) {
    const start = minutesFromTime(startTime);
    let end = minutesFromTime(endTime);
    if (end <= start)
        end += 24 * 60;
    return (end - start) / 60;
}
function shiftInterval(date, startTime, endTime) {
    const dayStartMinutes = parseDateISO(date).getTime() / 60000;
    const start = dayStartMinutes + minutesFromTime(startTime);
    let end = dayStartMinutes + minutesFromTime(endTime);
    if (end <= start)
        end += 24 * 60;
    return [start, end];
}
function shiftsOverlap(left, right) {
    const [leftStart, leftEnd] = shiftInterval(left.date, left.startTime, left.endTime);
    const [rightStart, rightEnd] = shiftInterval(right.date, right.startTime, right.endTime);
    return leftStart < rightEnd && rightStart < leftEnd;
}
function hasTwelveHoursRest(left, right) {
    const [leftStart, leftEnd] = shiftInterval(left.date, left.startTime, left.endTime);
    const [rightStart, rightEnd] = shiftInterval(right.date, right.startTime, right.endTime);
    if (leftStart <= rightStart)
        return rightStart - leftEnd >= 12 * 60;
    return leftStart - rightEnd >= 12 * 60;
}
function getISOWeek(date) {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - day + 3);
    const isoYear = target.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstDay = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
    const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${isoYear}-W${String(week).padStart(2, "0")}`;
}
function getISOWeekRange(weekIso) {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekIso);
    if (!match)
        throw new Error(`Invalid ISO week: ${weekIso}`);
    const year = Number(match[1]);
    const week = Number(match[2]);
    const januaryFourth = new Date(Date.UTC(year, 0, 4));
    const januaryFourthDay = (januaryFourth.getUTCDay() + 6) % 7;
    const monday = new Date(januaryFourth);
    monday.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + (week - 1) * 7);
    return { startDate: formatDateISO(monday), endDate: addDaysISO(formatDateISO(monday), 6) };
}
function countWeekdays(startDate, endDate) {
    let count = 0;
    for (let date = startDate; date <= endDate; date = addDaysISO(date, 1)) {
        const day = parseDateISO(date).getUTCDay();
        if (day !== 0 && day !== 6)
            count += 1;
    }
    return count;
}
function getBalanceContribution(data) {
    if (!(data === null || data === void 0 ? void 0 : data.tenantId) || !data.employeeId || !data.leaveType || !data.startDate)
        return null;
    if (!DATE_RE.test(data.startDate))
        return null;
    if (!/^[a-zA-Z0-9_-]+$/.test(data.leaveType))
        return null;
    const duration = Number(data.duration);
    if (!Number.isFinite(duration) || duration <= 0)
        return null;
    const pending = data.status === "pending" ? duration : 0;
    const used = data.status === "approved" ? duration : 0;
    if (pending === 0 && used === 0)
        return null;
    return {
        tenantId: data.tenantId,
        employeeId: data.employeeId,
        departmentId: data.departmentId,
        year: Number(data.startDate.slice(0, 4)),
        leaveType: data.leaveType,
        pending,
        used,
    };
}
async function loadEntitlements(tenantId) {
    var _a;
    const entitlements = Object.assign({}, DEFAULT_ENTITLEMENTS);
    const config = await db.doc(`tenants/${tenantId}/settings/config`).get();
    const policies = (_a = config.data()) === null || _a === void 0 ? void 0 : _a.timeOffPolicies;
    if (!policies)
        return entitlements;
    const policyKeys = [
        "annualLeave",
        "sickLeave",
        "maternityLeave",
        "paternityLeave",
        "unpaidLeave",
    ];
    for (const key of policyKeys) {
        const policy = policies[key];
        const id = typeof (policy === null || policy === void 0 ? void 0 : policy.id) === "string" ? policy.id : key.replace("Leave", "");
        const days = Number(policy === null || policy === void 0 ? void 0 : policy.daysPerYear);
        if (Number.isFinite(days) && days >= 0)
            entitlements[id] = days;
    }
    const custom = Array.isArray(policies.customLeaveTypes) ? policies.customLeaveTypes : [];
    for (const raw of custom) {
        const policy = raw;
        const id = typeof policy.id === "string" ? policy.id : "";
        const days = Number(policy.daysPerYear);
        if (/^[a-zA-Z0-9_-]+$/.test(id) && Number.isFinite(days) && days >= 0) {
            entitlements[id] = days;
        }
    }
    return entitlements;
}
async function resolveBalanceRef(tenantId, employeeId, year) {
    const existing = await db.collection("leave_balances")
        .where("tenantId", "==", tenantId)
        .where("employeeId", "==", employeeId)
        .where("year", "==", year)
        .limit(1)
        .get();
    if (!existing.empty)
        return existing.docs[0].ref;
    return db.doc(`leave_balances/${tenantId}_${employeeId}_${year}`);
}
function requestYears(data) {
    if (!(data === null || data === void 0 ? void 0 : data.startDate) || !DATE_RE.test(data.startDate))
        return [];
    const startYear = Number(data.startDate.slice(0, 4));
    const endYear = data.endDate && DATE_RE.test(data.endDate)
        ? Number(data.endDate.slice(0, 4))
        : startYear;
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear)
        return [];
    // A leave request spanning more than two calendar years is invalid product
    // data; cap here so a corrupt record cannot fan out unbounded work.
    return Array.from({ length: Math.min(endYear - startYear + 1, 2) }, (_, index) => startYear + index);
}
function requestDurationInYear(data, year) {
    return requestDurationInRange(data, `${year}-01-01`, `${year}-12-31`);
}
function requestDurationInRange(data, rangeStart, rangeEnd) {
    const duration = Number(data.duration);
    if (!data.startDate || !data.endDate || !Number.isFinite(duration) || duration <= 0)
        return 0;
    const segmentStart = data.startDate > rangeStart ? data.startDate : rangeStart;
    const segmentEnd = data.endDate < rangeEnd ? data.endDate : rangeEnd;
    if (segmentStart > segmentEnd)
        return 0;
    if (segmentStart === data.startDate && segmentEnd === data.endDate)
        return duration;
    const totalWeekdays = countWeekdays(data.startDate, data.endDate);
    const segmentWeekdays = countWeekdays(segmentStart, segmentEnd);
    if (totalWeekdays <= 0)
        return 0;
    return Math.round((duration * segmentWeekdays / totalWeekdays) * 100) / 100;
}
function leavePayFraction(leaveType, config) {
    var _a;
    if (!leaveType)
        return 0;
    const policies = config === null || config === void 0 ? void 0 : config.timeOffPolicies;
    const configured = policies
        ? [
            policies.annualLeave,
            policies.sickLeave,
            policies.maternityLeave,
            policies.paternityLeave,
            policies.unpaidLeave,
            ...(Array.isArray(policies.customLeaveTypes) ? policies.customLeaveTypes : []),
        ]
            .map((policy) => policy)
            .find((policy) => (policy === null || policy === void 0 ? void 0 : policy.id) === leaveType)
        : undefined;
    if (configured) {
        if (configured.isPaid !== true)
            return 0;
        const percentage = Number((_a = configured.paidPercentage) !== null && _a !== void 0 ? _a : 100);
        return Number.isFinite(percentage) ? Math.min(1, Math.max(0, percentage / 100)) : 1;
    }
    return leaveType === "unpaid" ? 0 : 1;
}
async function recomputeLeaveBalance(tenantId, employeeId, year, fallbackDepartmentId) {
    var _a, _b, _c, _d, _e, _f, _g;
    const [entitlements, balanceRef, requestSnapshot] = await Promise.all([
        loadEntitlements(tenantId),
        resolveBalanceRef(tenantId, employeeId, year),
        db.collection("leave_requests")
            .where("tenantId", "==", tenantId)
            .where("employeeId", "==", employeeId)
            .get(),
    ]);
    const currentSnapshot = await balanceRef.get();
    const current = (_a = currentSnapshot.data()) !== null && _a !== void 0 ? _a : {};
    const totals = new Map();
    let employeeName = String((_b = current.employeeName) !== null && _b !== void 0 ? _b : "");
    let departmentId = fallbackDepartmentId !== null && fallbackDepartmentId !== void 0 ? fallbackDepartmentId : String((_c = current.departmentId) !== null && _c !== void 0 ? _c : "");
    for (const document of requestSnapshot.docs) {
        const request = document.data();
        if (!request.leaveType || !/^[a-zA-Z0-9_-]+$/.test(request.leaveType))
            continue;
        if (request.status !== "pending" && request.status !== "approved")
            continue;
        const duration = requestDurationInYear(request, year);
        if (duration <= 0)
            continue;
        const total = (_d = totals.get(request.leaveType)) !== null && _d !== void 0 ? _d : { pending: 0, used: 0 };
        if (request.status === "pending")
            total.pending += duration;
        else
            total.used += duration;
        totals.set(request.leaveType, total);
        if (request.employeeName)
            employeeName = request.employeeName;
        if (request.departmentId)
            departmentId = request.departmentId;
    }
    const carryOver = Number((_e = current.carryOver) !== null && _e !== void 0 ? _e : 0);
    const leaveTypes = new Set([
        "annual",
        "sick",
        "maternity",
        "paternity",
        "unpaid",
        ...Object.keys(entitlements),
        ...totals.keys(),
    ]);
    const items = {};
    for (const leaveType of leaveTypes) {
        const entitled = Number((_f = entitlements[leaveType]) !== null && _f !== void 0 ? _f : 0);
        const total = (_g = totals.get(leaveType)) !== null && _g !== void 0 ? _g : { pending: 0, used: 0 };
        const available = entitled + (leaveType === "annual" ? carryOver : 0);
        items[leaveType] = {
            entitled,
            pending: Math.round(total.pending * 100) / 100,
            used: Math.round(total.used * 100) / 100,
            remaining: Math.max(0, Math.round((available - total.pending - total.used) * 100) / 100),
        };
    }
    await balanceRef.set(Object.assign(Object.assign(Object.assign(Object.assign({ tenantId,
        employeeId }, (departmentId ? { departmentId } : {})), { employeeName,
        year }), items), { carryOver, updatedAt: firestore_1.FieldValue.serverTimestamp() }));
}
async function syncLeaveBalance(before, after) {
    const targets = new Map();
    for (const request of [before, after]) {
        if (!(request === null || request === void 0 ? void 0 : request.tenantId) || !request.employeeId)
            continue;
        for (const year of requestYears(request)) {
            targets.set(`${request.tenantId}|${request.employeeId}|${year}`, {
                tenantId: request.tenantId,
                employeeId: request.employeeId,
                departmentId: request.departmentId,
                year,
            });
        }
    }
    for (const target of targets.values()) {
        await recomputeLeaveBalance(target.tenantId, target.employeeId, target.year, target.departmentId);
    }
}
async function cancelShiftsForLeave(leave, requestId) {
    if (!leave.tenantId || !leave.employeeId || !leave.startDate || !leave.endDate)
        return;
    const shifts = await db.collection(`tenants/${leave.tenantId}/shifts`)
        .where("employeeId", "==", leave.employeeId)
        .where("date", ">=", leave.startDate)
        .where("date", "<=", leave.endDate)
        .get();
    let batch = db.batch();
    let count = 0;
    for (const shift of shifts.docs) {
        if (shift.data().status === "cancelled")
            continue;
        batch.update(shift.ref, {
            status: "cancelled",
            cancelReason: `Approved leave ${requestId}`,
            cancelledAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        count += 1;
        if (count % 450 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 450 !== 0)
        await batch.commit();
}
exports.createOrUpdateShift = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const auth = (0, authz_1.requireAuth)(request);
    const data = request.data;
    const tenantId = data.tenantId;
    const shiftData = data.shiftData;
    if (!tenantId || !shiftData) {
        throw new https_1.HttpsError("invalid-argument", "Missing tenantId or shiftData");
    }
    const member = await (0, authz_1.requireTenantManagerOrAdmin)(tenantId, auth.uid);
    const employeeId = shiftData.employeeId;
    const date = shiftData.date;
    const startTime = (_a = shiftData.startTime) !== null && _a !== void 0 ? _a : shiftData.start;
    const endTime = (_b = shiftData.endTime) !== null && _b !== void 0 ? _b : shiftData.end;
    if (!employeeId || !date || !startTime || !endTime) {
        throw new https_1.HttpsError("invalid-argument", "Employee, date, start, and end are required");
    }
    parseDateISO(date);
    const hours = calculateHours(startTime, endTime);
    if (hours <= 0 || hours >= 24) {
        throw new https_1.HttpsError("invalid-argument", "Invalid shift duration");
    }
    const ref = data.shiftId
        ? db.doc(`tenants/${tenantId}/shifts/${data.shiftId}`)
        : db.collection(`tenants/${tenantId}/shifts`).doc();
    const [employeeSnapshot, existingSnapshot] = await Promise.all([
        db.doc(`tenants/${tenantId}/employees/${employeeId}`).get(),
        data.shiftId ? ref.get() : Promise.resolve(null),
    ]);
    if (!employeeSnapshot.exists) {
        throw new https_1.HttpsError("not-found", "Employee not found");
    }
    if (data.shiftId && !(existingSnapshot === null || existingSnapshot === void 0 ? void 0 : existingSnapshot.exists)) {
        throw new https_1.HttpsError("not-found", "Shift not found");
    }
    const employee = (_c = employeeSnapshot.data()) !== null && _c !== void 0 ? _c : {};
    const jobDetails = employee.jobDetails;
    const departmentId = typeof (jobDetails === null || jobDetails === void 0 ? void 0 : jobDetails.departmentId) === "string"
        ? jobDetails.departmentId
        : "";
    const department = typeof (jobDetails === null || jobDetails === void 0 ? void 0 : jobDetails.department) === "string"
        ? jobDetails.department
        : (_d = shiftData.department) !== null && _d !== void 0 ? _d : "";
    if (member.role === "manager") {
        const existingDepartmentId = (_e = existingSnapshot === null || existingSnapshot === void 0 ? void 0 : existingSnapshot.data()) === null || _e === void 0 ? void 0 : _e.departmentId;
        if (!member.departmentId ||
            departmentId !== member.departmentId ||
            (existingSnapshot && existingDepartmentId !== member.departmentId)) {
            throw new https_1.HttpsError("permission-denied", "Managers can only schedule their own department");
        }
    }
    const status = (_f = shiftData.status) !== null && _f !== void 0 ? _f : "draft";
    if (!["draft", "published", "confirmed", "cancelled"].includes(status)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid shift status");
    }
    if (status !== "cancelled") {
        const nearby = await db.collection(`tenants/${tenantId}/shifts`)
            .where("employeeId", "==", employeeId)
            .where("date", ">=", addDaysISO(date, -1))
            .where("date", "<=", addDaysISO(date, 1))
            .get();
        const proposed = { date, startTime, endTime };
        for (const snapshot of nearby.docs) {
            if (data.shiftId && snapshot.id === data.shiftId)
                continue;
            const existing = snapshot.data();
            if (existing.status === "cancelled")
                continue;
            if (!existing.date || !existing.startTime || !existing.endTime)
                continue;
            const candidate = {
                date: String(existing.date),
                startTime: String(existing.startTime),
                endTime: String(existing.endTime),
            };
            if (shiftsOverlap(proposed, candidate)) {
                throw new https_1.HttpsError("failed-precondition", "This shift overlaps another shift");
            }
            if (!hasTwelveHoursRest(proposed, candidate)) {
                throw new https_1.HttpsError("failed-precondition", "Employees need 12 hours between shifts");
            }
        }
        const approvedLeave = await db.collection("leave_requests")
            .where("tenantId", "==", tenantId)
            .where("employeeId", "==", employeeId)
            .where("status", "==", "approved")
            .get();
        if (approvedLeave.docs.some((item) => {
            const leave = item.data();
            return leave.startDate <= date && leave.endDate >= date;
        })) {
            throw new https_1.HttpsError("failed-precondition", "This employee is on approved leave");
        }
    }
    await ref.set(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ tenantId,
        employeeId, employeeName: (_g = shiftData.employeeName) !== null && _g !== void 0 ? _g : [
            (_h = employee.personalInfo) === null || _h === void 0 ? void 0 : _h.firstName,
            (_j = employee.personalInfo) === null || _j === void 0 ? void 0 : _j.lastName,
        ].filter(Boolean).join(" "), department }, (departmentId ? { departmentId } : {})), { position: (_l = (_k = shiftData.position) !== null && _k !== void 0 ? _k : shiftData.role) !== null && _l !== void 0 ? _l : String((_m = jobDetails === null || jobDetails === void 0 ? void 0 : jobDetails.position) !== null && _m !== void 0 ? _m : ""), date,
        startTime,
        endTime,
        hours,
        status, location: (_o = shiftData.location) !== null && _o !== void 0 ? _o : "", notes: (_p = shiftData.notes) !== null && _p !== void 0 ? _p : "" }), (shiftData.slotId ? { slotId: shiftData.slotId } : {})), (data.shiftId ? {} : {
        createdBy: auth.uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    })), { updatedAt: firestore_1.FieldValue.serverTimestamp() }), { merge: Boolean(data.shiftId) });
    return { success: true, shiftId: ref.id, hours };
});
exports.createLeaveRequest = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d;
    const auth = (0, authz_1.requireAuth)(request);
    const data = request.data;
    const tenantId = data.tenantId;
    const employeeId = data.employeeId;
    const leaveType = data.leaveType;
    const reason = (_b = (_a = data.reason) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : "";
    if (!tenantId || !employeeId || !leaveType || !data.startDate || !data.endDate) {
        throw new https_1.HttpsError("invalid-argument", "Tenant, employee, leave type, and dates are required");
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(leaveType)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid leave type");
    }
    if (!reason || reason.length > 1000) {
        throw new https_1.HttpsError("invalid-argument", "Reason must be between 1 and 1000 characters");
    }
    if (data.halfDay === true &&
        data.halfDayType !== "morning" &&
        data.halfDayType !== "afternoon") {
        throw new https_1.HttpsError("invalid-argument", "Select morning or afternoon for half-day leave");
    }
    const member = await (0, authz_1.requireTenantMember)(tenantId, auth.uid);
    const [employeeSnapshot, configSnapshot] = await Promise.all([
        db.doc(`tenants/${tenantId}/employees/${employeeId}`).get(),
        db.doc(`tenants/${tenantId}/settings/config`).get(),
    ]);
    if (!employeeSnapshot.exists)
        throw new https_1.HttpsError("not-found", "Employee not found");
    const employee = (_c = employeeSnapshot.data()) !== null && _c !== void 0 ? _c : {};
    if (typeof employee.status === "string" && employee.status !== "active") {
        throw new https_1.HttpsError("failed-precondition", "Leave can only be requested for active employees");
    }
    const jobDetails = employee.jobDetails;
    const personalInfo = employee.personalInfo;
    const departmentId = typeof (jobDetails === null || jobDetails === void 0 ? void 0 : jobDetails.departmentId) === "string" ? jobDetails.departmentId : "";
    const department = typeof (jobDetails === null || jobDetails === void 0 ? void 0 : jobDetails.department) === "string" ? jobDetails.department : "";
    const role = member.role;
    const canCreateForEmployee = role === "owner" || role === "hr-admin" || (role === "manager"
        ? Boolean(member.departmentId && member.departmentId === departmentId)
        : role !== "accountant" && member.employeeId === employeeId);
    if (!canCreateForEmployee) {
        throw new https_1.HttpsError("permission-denied", "You cannot request leave for this employee");
    }
    const policies = (_d = configSnapshot.data()) === null || _d === void 0 ? void 0 : _d.timeOffPolicies;
    const configuredPolicies = policies
        ? [
            policies.annualLeave,
            policies.sickLeave,
            policies.maternityLeave,
            policies.paternityLeave,
            policies.unpaidLeave,
            ...(Array.isArray(policies.customLeaveTypes) ? policies.customLeaveTypes : []),
        ].map((policy) => policy)
        : [];
    const configuredPolicy = configuredPolicies.find((policy) => (policy === null || policy === void 0 ? void 0 : policy.id) === leaveType);
    if (!(leaveType in DEFAULT_ENTITLEMENTS) && !configuredPolicy) {
        throw new https_1.HttpsError("invalid-argument", "Unknown leave type");
    }
    if ((configuredPolicy === null || configuredPolicy === void 0 ? void 0 : configuredPolicy.isActive) === false) {
        throw new https_1.HttpsError("failed-precondition", "This leave type is not active");
    }
    const canonicalLeave = {
        startDate: data.startDate,
        endDate: data.endDate,
        halfDay: data.halfDay === true,
    };
    const duration = await calculateCanonicalLeaveDuration(tenantId, canonicalLeave);
    if (duration <= 0) {
        throw new https_1.HttpsError("invalid-argument", "Leave must include at least one working day");
    }
    const existing = await db.collection("leave_requests")
        .where("tenantId", "==", tenantId)
        .where("employeeId", "==", employeeId)
        .get();
    const overlaps = existing.docs.some((document) => {
        const leave = document.data();
        return (leave.status === "pending" || leave.status === "approved") &&
            Boolean(leave.startDate && leave.endDate) &&
            leave.startDate <= data.endDate && leave.endDate >= data.startDate;
    });
    if (overlaps) {
        throw new https_1.HttpsError("already-exists", "This employee already has overlapping leave");
    }
    const ref = db.collection("leave_requests").doc();
    const attachmentUrl = typeof data.attachmentUrl === "string" && data.attachmentUrl.length <= 2048
        ? data.attachmentUrl
        : "";
    const configuredName = typeof (configuredPolicy === null || configuredPolicy === void 0 ? void 0 : configuredPolicy.name) === "string" ? configuredPolicy.name : "";
    const requestedLabel = typeof data.leaveTypeLabel === "string"
        ? data.leaveTypeLabel.trim().slice(0, 120)
        : "";
    await ref.set(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ tenantId,
        employeeId, employeeName: [personalInfo === null || personalInfo === void 0 ? void 0 : personalInfo.firstName, personalInfo === null || personalInfo === void 0 ? void 0 : personalInfo.lastName]
            .filter((value) => typeof value === "string" && Boolean(value))
            .join(" "), department,
        departmentId,
        leaveType, leaveTypeLabel: configuredName || requestedLabel || leaveType, startDate: data.startDate, endDate: data.endDate, duration, halfDay: data.halfDay === true }, (data.halfDay === true && data.halfDayType
        ? { halfDayType: data.halfDayType }
        : {})), { reason }), (attachmentUrl ? { attachmentUrl } : {})), { hasCertificate: Boolean(attachmentUrl) }), (typeof data.certificateType === "string" && data.certificateType
        ? { certificateType: data.certificateType.slice(0, 120) }
        : {})), { status: "pending", requestDate: getTodayTL(), createdBy: auth.uid, createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp() }));
    return { success: true, requestId: ref.id, duration };
});
async function recomputeWeekTotals(tenantId, employeeId, weekIso) {
    var _a, _b, _c;
    const { startDate, endDate } = getISOWeekRange(weekIso);
    const [shiftSnapshot, leaveSnapshot, configSnapshot] = await Promise.all([
        db.collection(`tenants/${tenantId}/shifts`)
            .where("employeeId", "==", employeeId)
            .where("date", ">=", startDate)
            .where("date", "<=", endDate)
            .get(),
        db.collection("leave_requests")
            .where("tenantId", "==", tenantId)
            .where("employeeId", "==", employeeId)
            .where("status", "==", "approved")
            .get(),
        db.doc(`tenants/${tenantId}/settings/config`).get(),
    ]);
    const shifts = shiftSnapshot.docs
        .map((item) => item.data())
        .filter((shift) => shift.status !== "cancelled");
    const workHours = shifts.reduce((total, shift) => {
        const hours = Number(shift.hours);
        if (Number.isFinite(hours))
            return total + hours;
        if (shift.startTime && shift.endTime)
            return total + calculateHours(shift.startTime, shift.endTime);
        return total;
    }, 0);
    const overtimeThreshold = Number((_c = (_b = (_a = configSnapshot.data()) === null || _a === void 0 ? void 0 : _a.payrollConfig) === null || _b === void 0 ? void 0 : _b.maxWorkHoursPerWeek) !== null && _c !== void 0 ? _c : 44);
    let paidLeaveHours = 0;
    let unpaidLeaveHours = 0;
    for (const leaveDocument of leaveSnapshot.docs) {
        const leave = leaveDocument.data();
        if (!leave.startDate || !leave.endDate)
            continue;
        const hours = requestDurationInRange(leave, startDate, endDate) * 8;
        if (hours <= 0)
            continue;
        const paidFraction = leavePayFraction(leave.leaveType, configSnapshot.data());
        paidLeaveHours += hours * paidFraction;
        unpaidLeaveHours += hours * (1 - paidFraction);
    }
    const regularHours = Math.min(workHours, overtimeThreshold);
    const overtimeHours = Math.max(0, workHours - overtimeThreshold);
    const sundays = shifts.filter((shift) => parseDateISO(String(shift.date)).getUTCDay() === 0).length;
    await db.doc(`tenants/${tenantId}/timesheets/${employeeId}_${weekIso}`).set({
        tenantId,
        employeeId,
        empId: employeeId,
        weekIso,
        weekStartDate: startDate,
        weekEndDate: endDate,
        regularHours,
        overtimeHours,
        paidLeaveHours,
        unpaidLeaveHours,
        sundays,
        computedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
exports.approveLeaveRequest = (0, https_1.onCall)(async (request) => {
    const auth = (0, authz_1.requireAuth)(request);
    const data = request.data;
    if (!data.tenantId || !data.requestId || typeof data.approved !== "boolean") {
        throw new https_1.HttpsError("invalid-argument", "Missing tenantId, requestId, or decision");
    }
    const member = await (0, authz_1.requireTenantManagerOrAdmin)(data.tenantId, auth.uid);
    const ref = db.doc(`leave_requests/${data.requestId}`);
    const initialSnapshot = await ref.get();
    if (!initialSnapshot.exists)
        throw new https_1.HttpsError("not-found", "Leave request not found");
    const initialLeave = initialSnapshot.data();
    if (initialLeave.tenantId !== data.tenantId) {
        throw new https_1.HttpsError("not-found", "Leave request not found");
    }
    const duration = data.approved
        ? await calculateCanonicalLeaveDuration(data.tenantId, initialLeave)
        : undefined;
    if (data.approved && (!duration || duration <= 0)) {
        throw new https_1.HttpsError("failed-precondition", "Leave no longer includes a working day");
    }
    await db.runTransaction(async (transaction) => {
        var _a;
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "Leave request not found");
        const leave = snapshot.data();
        if (leave.tenantId !== data.tenantId)
            throw new https_1.HttpsError("not-found", "Leave request not found");
        if (leave.status !== "pending") {
            throw new https_1.HttpsError("failed-precondition", "Leave request is no longer pending");
        }
        if (member.role === "manager") {
            if (!member.departmentId || leave.departmentId !== member.departmentId) {
                throw new https_1.HttpsError("permission-denied", "Managers can only decide requests for their team");
            }
        }
        transaction.update(ref, Object.assign(Object.assign(Object.assign(Object.assign({ status: data.approved ? "approved" : "rejected" }, (duration ? { duration } : {})), { approverId: auth.uid, approverName: (_a = data.approverName) !== null && _a !== void 0 ? _a : "", approvedDate: data.approved ? getTodayTL() : firestore_1.FieldValue.delete() }), (data.note
            ? data.approved
                ? { approverComment: data.note }
                : { rejectionReason: data.note }
            : {})), { updatedAt: firestore_1.FieldValue.serverTimestamp() }));
    });
    return { success: true };
});
exports.onShiftChange = (0, firestore_2.onDocumentWritten)("tenants/{tenantId}/shifts/{shiftId}", async (event) => {
    var _a, _b;
    const affected = new Map();
    for (const snapshot of [(_a = event.data) === null || _a === void 0 ? void 0 : _a.before, (_b = event.data) === null || _b === void 0 ? void 0 : _b.after]) {
        if (!(snapshot === null || snapshot === void 0 ? void 0 : snapshot.exists))
            continue;
        const data = snapshot.data();
        if (!(data === null || data === void 0 ? void 0 : data.employeeId) || !data.date)
            continue;
        const employeeId = String(data.employeeId);
        const weekIso = getISOWeek(parseDateISO(String(data.date)));
        affected.set(`${employeeId}|${weekIso}`, { employeeId, weekIso });
    }
    for (const item of affected.values()) {
        await recomputeWeekTotals(event.params.tenantId, item.employeeId, item.weekIso);
    }
});
exports.onLeaveRequestWrite = (0, firestore_2.onDocumentWritten)("leave_requests/{requestId}", async (event) => {
    var _a, _b, _c, _d;
    const before = ((_a = event.data) === null || _a === void 0 ? void 0 : _a.before.exists)
        ? event.data.before.data()
        : undefined;
    const after = ((_b = event.data) === null || _b === void 0 ? void 0 : _b.after.exists)
        ? event.data.after.data()
        : undefined;
    await syncLeaveBalance(before, after);
    const newlyApproved = (before === null || before === void 0 ? void 0 : before.status) !== "approved" && (after === null || after === void 0 ? void 0 : after.status) === "approved";
    if (newlyApproved && after) {
        await cancelShiftsForLeave(after, event.params.requestId);
    }
    const affected = [before, after].filter((leave) => Boolean((leave === null || leave === void 0 ? void 0 : leave.tenantId) && leave.employeeId && leave.startDate && leave.endDate && leave.status === "approved"));
    const weeks = new Map();
    for (const leave of affected) {
        for (let date = leave.startDate; date <= leave.endDate; date = addDaysISO(date, 1)) {
            const weekIso = getISOWeek(parseDateISO(date));
            const key = `${leave.tenantId}|${leave.employeeId}|${weekIso}`;
            weeks.set(key, {
                tenantId: leave.tenantId,
                employeeId: leave.employeeId,
                weekIso,
            });
        }
    }
    for (const week of weeks.values()) {
        await recomputeWeekTotals(week.tenantId, week.employeeId, week.weekIso);
    }
    v2_1.logger.info("Leave request synchronized", {
        requestId: event.params.requestId,
        beforeStatus: (_c = before === null || before === void 0 ? void 0 : before.status) !== null && _c !== void 0 ? _c : null,
        afterStatus: (_d = after === null || after === void 0 ? void 0 : after.status) !== null && _d !== void 0 ? _d : null,
    });
});
//# sourceMappingURL=timeleave.js.map