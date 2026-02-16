"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onLeaveStatusChange = exports.onShiftChange = exports.approveLeaveRequest = exports.recomputeWeekTotals = exports.createOrUpdateShift = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const authz_1 = require("./authz");
const db = (0, firestore_2.getFirestore)();
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Gets the ISO week string for a given date
 */
function getISOWeek(date) {
    // ISO-8601 week number (Monday-based, week 1 contains first Thursday).
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7; // Monday=0 ... Sunday=6
    target.setUTCDate(target.getUTCDate() - dayNr + 3); // Thursday
    const isoYear = target.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
    const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${isoYear}-W${week.toString().padStart(2, "0")}`;
}
/**
 * Gets the year-month string for roster organization
 */
function getYearMonth(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
}
/**
 * Parses time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}
/**
 * Converts minutes since midnight to hours
 */
function minutesToHours(minutes) {
    return minutes / 60;
}
/**
 * Calculates hours between two time strings
 */
function calculateHours(startTime, endTime) {
    const startMinutes = parseTimeToMinutes(startTime);
    let endMinutes = parseTimeToMinutes(endTime);
    // Handle overnight shifts
    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60; // Add 24 hours
    }
    return minutesToHours(endMinutes - startMinutes);
}
/**
 * Checks if two shifts overlap
 */
function shiftsOverlap(shift1, shift2) {
    if (shift1.date !== shift2.date)
        return false;
    const start1 = parseTimeToMinutes(shift1.start);
    const end1 = parseTimeToMinutes(shift1.end);
    const start2 = parseTimeToMinutes(shift2.start);
    const end2 = parseTimeToMinutes(shift2.end);
    return start1 < end2 && start2 < end1;
}
/**
 * Checks if there's adequate rest between shifts (12 hours)
 */
function hasAdequateRest(previousShift, newShift) {
    const prevDate = new Date(previousShift.date);
    const newDate = new Date(newShift.date);
    // Calculate time difference
    const timeDiff = newDate.getTime() - prevDate.getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    if (daysDiff > 1)
        return true; // More than 1 day apart
    if (daysDiff < 0)
        return false; // New shift is before previous
    // Same day or next day - check exact times
    const prevEndMinutes = parseTimeToMinutes(previousShift.end);
    const newStartMinutes = parseTimeToMinutes(newShift.start);
    // If next day, add 24 hours to new shift start
    const adjustedNewStart = daysDiff >= 1 ? newStartMinutes + 24 * 60 : newStartMinutes;
    const restMinutes = adjustedNewStart - prevEndMinutes;
    return restMinutes >= 12 * 60; // 12 hours minimum rest
}
// ============================================================================
// SHIFT MANAGEMENT
// ============================================================================
/**
 * Creates or updates a shift with validation
 */
exports.createOrUpdateShift = (0, https_1.onCall)(async (request) => {
    const auth = (0, authz_1.requireAuth)(request);
    const { data } = request;
    const { tenantId, shiftData, shiftId } = data;
    if (!tenantId || !shiftData) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters");
    }
    await (0, authz_1.requireTenantManagerOrAdmin)(tenantId, auth.uid);
    try {
        const { employeeId, date, start, end, role } = shiftData;
        if (!employeeId || !date || !start || !end) {
            throw new https_1.HttpsError("invalid-argument", "Missing required shift fields");
        }
        // Validate time format and logic
        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
            throw new https_1.HttpsError("invalid-argument", "Invalid time format (use HH:MM)");
        }
        const shiftHours = calculateHours(start, end);
        if (shiftHours <= 0 || shiftHours > 24) {
            throw new https_1.HttpsError("invalid-argument", "Invalid shift duration");
        }
        // Check for overlapping shifts
        const yearMonth = getYearMonth(new Date(date));
        const shiftsQuery = await db
            .collection(`tenants/${tenantId}/rosters/${yearMonth}/shifts`)
            .where("employeeId", "==", employeeId)
            .where("date", "==", date)
            .get();
        for (const shiftDoc of shiftsQuery.docs) {
            // Skip if this is the same shift being updated
            if (shiftId && shiftDoc.id === shiftId)
                continue;
            const existingShift = shiftDoc.data();
            if (shiftsOverlap(shiftData, existingShift)) {
                throw new https_1.HttpsError("failed-precondition", "Shift overlaps with existing shift");
            }
        }
        // Check 12-hour rest window
        const previousDayShifts = await db
            .collection(`tenants/${tenantId}/rosters/${yearMonth}/shifts`)
            .where("employeeId", "==", employeeId)
            .orderBy("date", "desc")
            .orderBy("end", "desc")
            .limit(5) // Check last few shifts
            .get();
        for (const shiftDoc of previousDayShifts.docs) {
            const previousShift = shiftDoc.data();
            if (!hasAdequateRest(previousShift, shiftData)) {
                throw new https_1.HttpsError("failed-precondition", "Insufficient rest period between shifts (minimum 12 hours)");
            }
        }
        // Check for approved leave conflicts
        const leaveQuery = await db
            .collection(`tenants/${tenantId}/leaveRequests`)
            .where("empId", "==", employeeId)
            .where("status", "==", "approved")
            .get();
        const shiftDate = new Date(date);
        for (const leaveDoc of leaveQuery.docs) {
            const leave = leaveDoc.data();
            const leaveStart = leave.from.toDate();
            const leaveEnd = leave.to.toDate();
            if (shiftDate >= leaveStart && shiftDate <= leaveEnd) {
                throw new https_1.HttpsError("failed-precondition", "Shift conflicts with approved leave request");
            }
        }
        // Create or update the shift
        const shiftDocData = {
            employeeId,
            date,
            start,
            end,
            role: role || null,
            hours: shiftHours,
            createdAt: shiftId ? undefined : firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        };
        let resultShiftId = shiftId;
        if (shiftId) {
            // Update existing shift
            await db
                .doc(`tenants/${tenantId}/rosters/${yearMonth}/shifts/${shiftId}`)
                .update(shiftDocData);
        }
        else {
            // Create new shift
            const shiftRef = await db
                .collection(`tenants/${tenantId}/rosters/${yearMonth}/shifts`)
                .add(shiftDocData);
            resultShiftId = shiftRef.id;
        }
        // Trigger timesheet recomputation
        await (0, exports.recomputeWeekTotals)(tenantId, employeeId, getISOWeek(new Date(date)));
        v2_1.logger.info(`Shift ${shiftId ? "updated" : "created"}`, {
            tenantId,
            employeeId,
            shiftId: resultShiftId,
            date,
            hours: shiftHours,
        });
        return {
            success: true,
            shiftId: resultShiftId,
            hours: shiftHours,
            message: `Shift ${shiftId ? "updated" : "created"} successfully`,
        };
    }
    catch (error) {
        v2_1.logger.error("Error creating/updating shift", {
            error,
            tenantId,
            shiftData,
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Failed to create/update shift");
    }
});
/**
 * Recomputes timesheet totals for a specific employee and week
 */
const recomputeWeekTotals = async (tenantId, empId, weekIso) => {
    var _a, _b;
    try {
        // Get all shifts for this employee in this week
        const [yearStr, weekStr] = weekIso.split("-W");
        const year = parseInt(yearStr);
        const weekNum = parseInt(weekStr);
        const weekStart = new Date(year, 0, 1 + (weekNum - 1) * 7);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        const startYM = getYearMonth(weekStart);
        const endYM = getYearMonth(weekEnd);
        let allShifts = [];
        // Handle case where week spans two months
        const monthsToCheck = startYM === endYM ? [startYM] : [startYM, endYM];
        for (const ym of monthsToCheck) {
            const shiftsQuery = await db
                .collection(`tenants/${tenantId}/rosters/${ym}/shifts`)
                .where("employeeId", "==", empId)
                .where("date", ">=", weekStart.toISOString().split("T")[0])
                .where("date", "<=", weekEnd.toISOString().split("T")[0])
                .get();
            allShifts = allShifts.concat(shiftsQuery.docs.map((doc) => doc.data()));
        }
        // Get leave hours for this week
        const leaveQuery = await db
            .collection(`tenants/${tenantId}/leaveRequests`)
            .where("empId", "==", empId)
            .where("status", "==", "approved")
            .get();
        let paidLeaveHours = 0;
        let unpaidLeaveHours = 0;
        for (const leaveDoc of leaveQuery.docs) {
            const leave = leaveDoc.data();
            const leaveStart = leave.from.toDate();
            const leaveEnd = leave.to.toDate();
            // Calculate overlap with this week
            const overlapStart = new Date(Math.max(leaveStart.getTime(), weekStart.getTime()));
            const overlapEnd = new Date(Math.min(leaveEnd.getTime(), weekEnd.getTime()));
            if (overlapStart <= overlapEnd) {
                const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) /
                    (24 * 60 * 60 * 1000)) + 1;
                const hoursPerDay = leave.hours
                    ? leave.hours /
                        Math.ceil((leaveEnd.getTime() - leaveStart.getTime()) /
                            (24 * 60 * 60 * 1000))
                    : 8;
                const totalOverlapHours = overlapDays * hoursPerDay;
                if (["vacation", "sick", "personal", "maternity", "paternity"].includes(leave.type)) {
                    paidLeaveHours += totalOverlapHours;
                }
                else {
                    unpaidLeaveHours += totalOverlapHours;
                }
            }
        }
        // Calculate work hours
        let totalWorkHours = 0;
        let sundayHours = 0;
        for (const shift of allShifts) {
            const shiftDate = new Date(shift.date);
            totalWorkHours += shift.hours || calculateHours(shift.start, shift.end);
            if (shiftDate.getDay() === 0) {
                // Sunday
                sundayHours += shift.hours || calculateHours(shift.start, shift.end);
            }
        }
        // Get tenant overtime policy
        const tenantConfig = await db
            .doc(`tenants/${tenantId}/settings/config`)
            .get();
        const overtimeThreshold = (tenantConfig.exists &&
            ((_b = (_a = tenantConfig.data()) === null || _a === void 0 ? void 0 : _a.payrollPolicy) === null || _b === void 0 ? void 0 : _b.overtimeThreshold)) ||
            40;
        // Calculate regular vs overtime hours
        const regularHours = Math.min(totalWorkHours, overtimeThreshold);
        const overtimeHours = Math.max(0, totalWorkHours - overtimeThreshold);
        // Count number of Sundays worked
        const sundaysWorked = allShifts.filter((shift) => new Date(shift.date).getDay() === 0).length;
        // Create/update timesheet
        const timesheetId = `${empId}_${weekIso}`;
        const timesheetData = {
            empId,
            weekIso,
            regularHours,
            overtimeHours,
            paidLeaveHours,
            unpaidLeaveHours,
            sundays: sundaysWorked,
            computedAt: firestore_2.FieldValue.serverTimestamp(),
        };
        await db
            .doc(`tenants/${tenantId}/timesheets/${timesheetId}`)
            .set(timesheetData, { merge: true });
        v2_1.logger.info("Timesheet recomputed", {
            tenantId,
            empId,
            weekIso,
            regularHours,
            overtimeHours,
            paidLeaveHours,
            unpaidLeaveHours,
            sundaysWorked,
        });
    }
    catch (error) {
        v2_1.logger.error("Error recomputing week totals", {
            error,
            tenantId,
            empId,
            weekIso,
        });
        throw error;
    }
};
exports.recomputeWeekTotals = recomputeWeekTotals;
// ============================================================================
// LEAVE MANAGEMENT
// ============================================================================
/**
 * Approves or rejects a leave request
 */
exports.approveLeaveRequest = (0, https_1.onCall)(async (request) => {
    const auth = (0, authz_1.requireAuth)(request);
    const { data } = request;
    const { tenantId, requestId, approved, note } = data;
    if (!tenantId || !requestId || typeof approved !== "boolean") {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters");
    }
    await (0, authz_1.requireTenantManagerOrAdmin)(tenantId, auth.uid);
    const batch = db.batch();
    try {
        // Get the leave request
        const leaveDoc = await db
            .doc(`tenants/${tenantId}/leaveRequests/${requestId}`)
            .get();
        if (!leaveDoc.exists) {
            throw new https_1.HttpsError("not-found", "Leave request not found");
        }
        const leave = leaveDoc.data();
        if (leave.status !== "pending") {
            throw new https_1.HttpsError("failed-precondition", "Leave request is not in pending status");
        }
        const updateData = {
            status: approved ? "approved" : "rejected",
            approvedBy: auth.uid,
            approvedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        };
        if (note) {
            updateData.approverNote = note;
        }
        batch.update(leaveDoc.ref, updateData);
        if (approved) {
            // Update leave balance
            const year = leave.from.toDate().getFullYear();
            const balanceId = `${leave.empId}_${year}`;
            const balanceDoc = await db
                .doc(`tenants/${tenantId}/leaveBalances/${balanceId}`)
                .get();
            if (balanceDoc.exists) {
                const leaveDays = Math.ceil((leave.to.toDate().getTime() - leave.from.toDate().getTime()) /
                    (24 * 60 * 60 * 1000)) + 1;
                const newMovement = {
                    type: "usage",
                    days: -leaveDays,
                    reason: `Leave request ${requestId} approved`,
                    at: firestore_2.FieldValue.serverTimestamp(),
                };
                batch.update(balanceDoc.ref, {
                    movements: firestore_2.FieldValue.arrayUnion(newMovement),
                    computedBalance: firestore_2.FieldValue.increment(-leaveDays),
                    updatedAt: firestore_2.FieldValue.serverTimestamp(),
                });
            }
            // Cancel overlapping shifts
            const leaveStart = leave.from.toDate();
            const leaveEnd = leave.to.toDate();
            // Find potentially affected months
            const startYM = getYearMonth(leaveStart);
            const endYM = getYearMonth(leaveEnd);
            const monthsToCheck = startYM === endYM ? [startYM] : [startYM, endYM];
            for (const ym of monthsToCheck) {
                const shiftsQuery = await db
                    .collection(`tenants/${tenantId}/rosters/${ym}/shifts`)
                    .where("employeeId", "==", leave.empId)
                    .where("date", ">=", leaveStart.toISOString().split("T")[0])
                    .where("date", "<=", leaveEnd.toISOString().split("T")[0])
                    .get();
                for (const shiftDoc of shiftsQuery.docs) {
                    // Mark shift as cancelled due to leave
                    batch.update(shiftDoc.ref, {
                        status: "cancelled",
                        cancelReason: `Leave request ${requestId} approved`,
                        cancelledAt: firestore_2.FieldValue.serverTimestamp(),
                    });
                }
            }
            // Recompute affected timesheets
            const weeksToRecompute = new Set();
            let currentDate = new Date(leaveStart);
            while (currentDate <= leaveEnd) {
                weeksToRecompute.add(getISOWeek(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            // Note: In a real implementation, you'd want to trigger these recomputations
            // after the batch commit to avoid transaction conflicts
            // For now, we'll log them for manual processing
            v2_1.logger.info("Weeks to recompute after leave approval", {
                tenantId,
                empId: leave.empId,
                weeks: Array.from(weeksToRecompute),
            });
        }
        await batch.commit();
        v2_1.logger.info(`Leave request ${approved ? "approved" : "rejected"}`, {
            tenantId,
            requestId,
            empId: leave.empId,
            approved,
        });
        return {
            success: true,
            message: `Leave request ${approved ? "approved" : "rejected"} successfully`,
        };
    }
    catch (error) {
        v2_1.logger.error("Error approving leave request", {
            error,
            tenantId,
            requestId,
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Failed to approve leave request");
    }
});
// ============================================================================
// FIRESTORE TRIGGERS
// ============================================================================
/**
 * Automatically recompute timesheets when shifts are modified
 */
exports.onShiftChange = (0, firestore_1.onDocumentWritten)("tenants/{tenantId}/rosters/{yearMonth}/shifts/{shiftId}", async (event) => {
    var _a;
    const { tenantId } = event.params;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after.data();
    if (!data) {
        v2_1.logger.warn("No data in shift change trigger");
        return;
    }
    const { employeeId, date } = data;
    const weekIso = getISOWeek(new Date(date));
    try {
        await (0, exports.recomputeWeekTotals)(tenantId, employeeId, weekIso);
        v2_1.logger.info("Timesheet automatically recomputed after shift change", {
            tenantId,
            employeeId,
            weekIso,
        });
    }
    catch (error) {
        v2_1.logger.error("Error in shift change trigger", {
            error,
            tenantId,
            employeeId,
        });
    }
});
/**
 * Handle leave request status changes
 */
exports.onLeaveStatusChange = (0, firestore_1.onDocumentUpdated)("tenants/{tenantId}/leaveRequests/{requestId}", async (event) => {
    var _a, _b;
    const { tenantId, requestId } = event.params;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after) {
        v2_1.logger.warn("Missing before/after data in leave status change trigger");
        return;
    }
    // Check if status changed to approved
    if (before.status !== "approved" && after.status === "approved") {
        v2_1.logger.info(`Leave request ${requestId} was approved, triggering timesheet updates`, {
            tenantId,
            requestId,
            empId: after.empId,
        });
        try {
            // Recompute timesheets for affected weeks
            const leaveStart = after.from.toDate();
            const leaveEnd = after.to.toDate();
            const weeksToRecompute = new Set();
            let currentDate = new Date(leaveStart);
            while (currentDate <= leaveEnd) {
                weeksToRecompute.add(getISOWeek(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            for (const weekIso of weeksToRecompute) {
                await (0, exports.recomputeWeekTotals)(tenantId, after.empId, weekIso);
            }
            v2_1.logger.info("Timesheets recomputed after leave approval", {
                tenantId,
                empId: after.empId,
                weeks: Array.from(weeksToRecompute),
            });
        }
        catch (error) {
            v2_1.logger.error("Error in leave approval trigger", {
                error,
                tenantId,
                requestId,
            });
        }
    }
});
// Functions are exported inline with their declarations above
//# sourceMappingURL=timeleave.js.map