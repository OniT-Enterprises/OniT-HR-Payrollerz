"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePayrunInputs = exports.getPayrunInputs = exports.compilePayrunInputs = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const v2_1 = require("firebase-functions/v2");
const db = (0, firestore_1.getFirestore)();
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Validates that the user has access to the specified tenant
 */
async function validateTenantAccess(uid, tenantId) {
    const userRecord = await (0, auth_1.getAuth)().getUser(uid);
    const customClaims = userRecord.customClaims || {};
    const tenants = customClaims.tenants || [];
    if (!tenants.includes(tenantId)) {
        throw new https_1.HttpsError("permission-denied", "User does not have access to this tenant");
    }
}
/**
 * Gets all weeks in a given month
 */
function getWeeksInMonth(year, month) {
    const weeks = new Set();
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const week = getISOWeek(date);
        weeks.add(week);
    }
    return Array.from(weeks).sort();
}
/**
 * Gets the ISO week string for a given date
 */
function getISOWeek(date) {
    // Use ISO-8601 week logic (week starts Monday, week 1 has first Thursday).
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
 * Gets the most recent employment snapshot for an employee as of a specific date
 */
async function getLatestEmploymentSnapshot(tenantId, employeeId, asOfDate) {
    const snapshotsQuery = await db
        .collection(`tenants/${tenantId}/employmentSnapshots`)
        .where("employeeId", "==", employeeId)
        .where("asOf", "<=", asOfDate)
        .orderBy("asOf", "desc")
        .limit(1)
        .get();
    if (snapshotsQuery.empty) {
        return null;
    }
    return snapshotsQuery.docs[0].data();
}
// ============================================================================
// PAYROLL COMPILATION
// ============================================================================
/**
 * Compiles payroll inputs for a specific month
 * Gathers employment snapshots and timesheet totals for all active employees
 */
exports.compilePayrunInputs = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c;
    const { auth, data } = request;
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated");
    }
    const { tenantId, yyyymm } = data;
    if (!tenantId || !yyyymm) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters: tenantId, yyyymm");
    }
    // Validate month format
    if (!/^\d{4}(0[1-9]|1[0-2])$/.test(yyyymm)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid month format (use YYYYMM)");
    }
    // Validate tenant access
    await validateTenantAccess(auth.uid, tenantId);
    // Check user has payroll permissions
    const memberDoc = await db
        .doc(`tenants/${tenantId}/members/${auth.uid}`)
        .get();
    if (!memberDoc.exists) {
        throw new https_1.HttpsError("permission-denied", "User is not a member of this tenant");
    }
    const member = memberDoc.data();
    if (!["owner", "hr-admin"].includes(member.role)) {
        // Check if user has explicit payroll module access
        const hasPayrollAccess = (_a = member.modules) === null || _a === void 0 ? void 0 : _a.includes("payroll");
        if (!hasPayrollAccess) {
            throw new https_1.HttpsError("permission-denied", "User does not have payroll access");
        }
    }
    try {
        const year = parseInt(yyyymm.substring(0, 4));
        const month = parseInt(yyyymm.substring(4, 6));
        // Get the last day of the month for snapshot lookup
        const lastDayOfMonth = new Date(year, month, 0);
        v2_1.logger.info(`Compiling payroll inputs for ${yyyymm}`, {
            tenantId,
            year,
            month,
        });
        // Get all active employees
        const employeesQuery = await db
            .collection(`tenants/${tenantId}/employees`)
            .where("status", "==", "active")
            .get();
        if (employeesQuery.empty) {
            v2_1.logger.info("No active employees found", { tenantId, yyyymm });
            return {
                success: true,
                employeesProcessed: 0,
                message: "No active employees to process",
            };
        }
        const employees = employeesQuery.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
        v2_1.logger.info(`Found ${employees.length} active employees`, {
            tenantId,
            yyyymm,
        });
        // Get all weeks in this month
        const weeksInMonth = getWeeksInMonth(year, month);
        v2_1.logger.info(`Processing weeks: ${weeksInMonth.join(", ")}`, {
            tenantId,
            yyyymm,
        });
        const results = [];
        const errors = [];
        // Process each employee
        for (const employee of employees) {
            try {
                v2_1.logger.info(`Processing employee: ${employee.id}`, {
                    tenantId,
                    yyyymm,
                });
                // Get the latest employment snapshot for this employee
                const snapshot = await getLatestEmploymentSnapshot(tenantId, employee.id, lastDayOfMonth);
                if (!snapshot) {
                    errors.push({
                        employeeId: employee.id,
                        error: "No employment snapshot found",
                    });
                    continue;
                }
                // Aggregate timesheet data for all weeks in the month
                const timesheetTotals = {
                    regularHours: 0,
                    overtimeHours: 0,
                    paidLeaveHours: 0,
                    unpaidLeaveHours: 0,
                };
                for (const weekIso of weeksInMonth) {
                    const timesheetId = `${employee.id}_${weekIso}`;
                    const timesheetDoc = await db
                        .doc(`tenants/${tenantId}/timesheets/${timesheetId}`)
                        .get();
                    if (timesheetDoc.exists) {
                        const timesheet = timesheetDoc.data();
                        timesheetTotals.regularHours += timesheet.regularHours || 0;
                        timesheetTotals.overtimeHours += timesheet.overtimeHours || 0;
                        timesheetTotals.paidLeaveHours += timesheet.paidLeaveHours || 0;
                        timesheetTotals.unpaidLeaveHours += timesheet.unpaidLeaveHours || 0;
                    }
                }
                // Create payroll input record
                const payrollInput = {
                    empId: employee.id,
                    month: `${year}-${month.toString().padStart(2, "0")}`,
                    snapshot,
                    timesheetTotals,
                    computedAt: firestore_1.FieldValue.serverTimestamp(),
                };
                // Save the payroll input
                const inputId = `${yyyymm}_${employee.id}`;
                await db
                    .doc(`tenants/${tenantId}/payrunInputs/${yyyymm}/${inputId}`)
                    .set(payrollInput);
                results.push({
                    employeeId: employee.id,
                    snapshot: {
                        position: (_b = snapshot.position) === null || _b === void 0 ? void 0 : _b.title,
                        baseMonthlyUSD: (_c = snapshot.position) === null || _c === void 0 ? void 0 : _c.baseMonthlyUSD,
                        asOf: snapshot.asOf,
                    },
                    timesheetTotals,
                });
                v2_1.logger.info(`Payroll input created for employee ${employee.id}`, {
                    tenantId,
                    yyyymm,
                    inputId,
                    timesheetTotals,
                });
            }
            catch (employeeError) {
                v2_1.logger.error(`Error processing employee ${employee.id}`, {
                    error: employeeError,
                    tenantId,
                    yyyymm,
                    employeeId: employee.id,
                });
                errors.push({
                    employeeId: employee.id,
                    error: employeeError instanceof Error
                        ? employeeError.message
                        : "Unknown error",
                });
            }
        }
        // Create summary record
        const summaryData = {
            tenantId,
            month: yyyymm,
            employeesProcessed: results.length,
            employeesWithErrors: errors.length,
            totalEmployees: employees.length,
            compiledBy: auth.uid,
            compiledAt: firestore_1.FieldValue.serverTimestamp(),
            results,
            errors,
        };
        await db
            .doc(`tenants/${tenantId}/payrunInputs/${yyyymm}/_summary`)
            .set(summaryData);
        v2_1.logger.info(`Payroll compilation completed`, {
            tenantId,
            yyyymm,
            employeesProcessed: results.length,
            errors: errors.length,
        });
        return {
            success: true,
            employeesProcessed: results.length,
            employeesWithErrors: errors.length,
            totalEmployees: employees.length,
            weeksProcessed: weeksInMonth,
            errors: errors.length > 0 ? errors : undefined,
            message: `Payroll inputs compiled for ${results.length}/${employees.length} employees`,
        };
    }
    catch (error) {
        v2_1.logger.error("Error compiling payroll inputs", { error, tenantId, yyyymm });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Failed to compile payroll inputs");
    }
});
/**
 * Gets payroll inputs for a specific month
 */
exports.getPayrunInputs = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated");
    }
    const { tenantId, yyyymm } = data;
    if (!tenantId || !yyyymm) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters");
    }
    // Validate tenant access
    await validateTenantAccess(auth.uid, tenantId);
    try {
        // Get summary
        const summaryDoc = await db
            .doc(`tenants/${tenantId}/payrunInputs/${yyyymm}/_summary`)
            .get();
        if (!summaryDoc.exists) {
            throw new https_1.HttpsError("not-found", "Payroll inputs not found for this month");
        }
        // Get all input records
        const inputsQuery = await db
            .collection(`tenants/${tenantId}/payrunInputs/${yyyymm}`)
            .get();
        const inputs = inputsQuery.docs
            .filter((doc) => doc.id !== "_summary")
            .map((doc) => (Object.assign({ id: doc.id }, doc.data())));
        return {
            summary: summaryDoc.data(),
            inputs,
        };
    }
    catch (error) {
        v2_1.logger.error("Error getting payroll inputs", { error, tenantId, yyyymm });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Failed to get payroll inputs");
    }
});
/**
 * Validates payroll inputs before payrun execution
 */
exports.validatePayrunInputs = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated");
    }
    const { tenantId, yyyymm } = data;
    if (!tenantId || !yyyymm) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters");
    }
    // Validate tenant access
    await validateTenantAccess(auth.uid, tenantId);
    try {
        // Get all input records for validation
        const summaryDoc = await db
            .doc(`tenants/${tenantId}/payrunInputs/${yyyymm}/_summary`)
            .get();
        if (!summaryDoc.exists) {
            throw new https_1.HttpsError("not-found", "Payroll inputs not found for this month");
        }
        const inputsQuery = await db
            .collection(`tenants/${tenantId}/payrunInputs/${yyyymm}`)
            .get();
        const inputs = inputsQuery.docs
            .filter((doc) => doc.id !== "_summary")
            .map((doc) => (Object.assign({ id: doc.id }, doc.data())));
        const validationErrors = [];
        const warnings = [];
        for (const input of inputs) {
            const { empId, snapshot, timesheetTotals } = input;
            // Check for missing employment snapshot
            if (!snapshot) {
                validationErrors.push({
                    employeeId: empId,
                    type: "missing_snapshot",
                    message: "No employment snapshot found",
                });
                continue;
            }
            // Check for missing position data
            if (!snapshot.position || !snapshot.position.baseMonthlyUSD) {
                validationErrors.push({
                    employeeId: empId,
                    type: "missing_position_data",
                    message: "Position or salary information missing",
                });
            }
            // Warn about employees with no work hours
            const totalHours = (timesheetTotals.regularHours || 0) +
                (timesheetTotals.overtimeHours || 0);
            if (totalHours === 0 && (timesheetTotals.paidLeaveHours || 0) === 0) {
                warnings.push({
                    employeeId: empId,
                    type: "no_hours",
                    message: "Employee has no work hours or paid leave",
                });
            }
            // Warn about excessive overtime
            if ((timesheetTotals.overtimeHours || 0) > 40) {
                warnings.push({
                    employeeId: empId,
                    type: "excessive_overtime",
                    message: `Excessive overtime hours: ${timesheetTotals.overtimeHours}`,
                });
            }
        }
        const isValid = validationErrors.length === 0;
        return {
            valid: isValid,
            employeesValidated: inputs.length,
            errors: validationErrors,
            warnings,
            message: isValid
                ? "Payroll inputs are valid and ready for processing"
                : `${validationErrors.length} validation errors found`,
        };
    }
    catch (error) {
        v2_1.logger.error("Error validating payroll inputs", {
            error,
            tenantId,
            yyyymm,
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Failed to validate payroll inputs");
    }
});
// Functions are exported inline with their declarations above
//# sourceMappingURL=payroll.js.map