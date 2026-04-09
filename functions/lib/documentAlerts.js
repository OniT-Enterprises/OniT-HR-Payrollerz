"use strict";
/**
 * Document Alerts Cloud Function
 * Scheduled function to check for expiring employee documents
 * Runs daily and updates alerts collection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acknowledgeDocumentAlert = exports.refreshDocumentAlerts = exports.checkDocumentExpiry = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const authz_1 = require("./authz");
const db = (0, firestore_1.getFirestore)();
const DOCUMENT_LABELS = {
    bi: "Bilhete de Identidade",
    passport: "Passport",
    work_permit: "Work Permit/Visa",
    work_visa: "Work Visa (Type C)",
    residence_permit: "Residence Permit",
    electoral: "Electoral Card",
    inss: "INSS Card",
    contract: "Employment Contract",
};
const BATCH_WRITE_LIMIT = 450;
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Calculate days until expiry and determine severity
 */
function calculateExpiryInfo(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let severity;
    if (days < 0) {
        severity = "expired";
    }
    else if (days <= 14) {
        severity = "critical";
    }
    else if (days <= 30) {
        severity = "warning";
    }
    else {
        severity = "upcoming";
    }
    return { days, severity };
}
/**
 * Extract document expiry alerts from an employee
 */
function extractEmployeeAlerts(tenantId, employee, alertThresholdDays = 60) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    const alerts = [];
    const employeeName = `${((_a = employee.personalInfo) === null || _a === void 0 ? void 0 : _a.firstName) || ""} ${((_b = employee.personalInfo) === null || _b === void 0 ? void 0 : _b.lastName) || ""}`.trim();
    const pushAlert = (alertKey, documentType, expiryDate, windowDays) => {
        if (!expiryDate) {
            return;
        }
        const { days, severity } = calculateExpiryInfo(expiryDate);
        if (days > windowDays) {
            return;
        }
        alerts.push({
            alertKey,
            tenantId,
            employeeId: employee.id,
            employeeName,
            documentType,
            documentLabel: DOCUMENT_LABELS[documentType],
            expiryDate,
            daysUntilExpiry: days,
            severity,
            acknowledged: false,
        });
    };
    // Check Bilhete de Identidade
    const bi = ((_c = employee.documents) === null || _c === void 0 ? void 0 : _c.bilheteIdentidade) || ((_d = employee.documents) === null || _d === void 0 ? void 0 : _d.employeeIdCard);
    pushAlert("bi", "bi", bi === null || bi === void 0 ? void 0 : bi.expiryDate, alertThresholdDays);
    // Check Passport
    pushAlert("passport", "passport", (_f = (_e = employee.documents) === null || _e === void 0 ? void 0 : _e.passport) === null || _f === void 0 ? void 0 : _f.expiryDate, alertThresholdDays);
    // Check Work Permit/Visa
    pushAlert("work_permit", "work_permit", (_h = (_g = employee.documents) === null || _g === void 0 ? void 0 : _g.workingVisaResidency) === null || _h === void 0 ? void 0 : _h.expiryDate, alertThresholdDays);
    // Check Electoral Card
    pushAlert("electoral", "electoral", (_k = (_j = employee.documents) === null || _j === void 0 ? void 0 : _j.electoralCard) === null || _k === void 0 ? void 0 : _k.expiryDate, alertThresholdDays);
    pushAlert("inss", "inss", (_m = (_l = employee.documents) === null || _l === void 0 ? void 0 : _l.socialSecurityNumber) === null || _m === void 0 ? void 0 : _m.expiryDate, alertThresholdDays);
    pushAlert("work_visa", "work_visa", (_p = (_o = employee.foreignWorker) === null || _o === void 0 ? void 0 : _o.workVisa) === null || _p === void 0 ? void 0 : _p.expiryDate, 90);
    pushAlert("residence_permit", "residence_permit", (_r = (_q = employee.foreignWorker) === null || _q === void 0 ? void 0 : _q.residencePermit) === null || _r === void 0 ? void 0 : _r.expiryDate, 90);
    pushAlert("fw_work_permit", "work_permit", (_t = (_s = employee.foreignWorker) === null || _s === void 0 ? void 0 : _s.workPermit) === null || _t === void 0 ? void 0 : _t.expiryDate, 90);
    pushAlert("contract", "contract", (_u = employee.jobDetails) === null || _u === void 0 ? void 0 : _u.contractEndDate, 90);
    return alerts;
}
function sortAlerts(alerts) {
    const severityOrder = ["expired", "critical", "warning", "upcoming"];
    return alerts.sort((left, right) => {
        const severityDiff = severityOrder.indexOf(left.severity) - severityOrder.indexOf(right.severity);
        if (severityDiff !== 0) {
            return severityDiff;
        }
        return left.daysUntilExpiry - right.daysUntilExpiry;
    });
}
async function commitDocumentAlertMutations(mutations) {
    for (let index = 0; index < mutations.length; index += BATCH_WRITE_LIMIT) {
        const batch = db.batch();
        for (const mutate of mutations.slice(index, index + BATCH_WRITE_LIMIT)) {
            mutate(batch);
        }
        await batch.commit();
    }
}
async function syncTenantDocumentAlerts(tenantId, alertThresholdDays = 60) {
    const [employeesSnapshot, existingAlertsSnapshot] = await Promise.all([
        db
            .collection(`tenants/${tenantId}/employees`)
            .where("status", "==", "active")
            .get(),
        db.collection(`tenants/${tenantId}/document_alerts`).get(),
    ]);
    const alerts = [];
    for (const empDoc of employeesSnapshot.docs) {
        const employee = Object.assign({ id: empDoc.id }, empDoc.data());
        alerts.push(...extractEmployeeAlerts(tenantId, employee, alertThresholdDays));
    }
    sortAlerts(alerts);
    const now = firestore_1.FieldValue.serverTimestamp();
    const existingAlertsById = new Map(existingAlertsSnapshot.docs.map((docSnap) => [docSnap.id, docSnap]));
    const currentAlertIds = new Set();
    const mutations = [];
    let created = 0;
    let updated = 0;
    let deleted = 0;
    for (const alert of alerts) {
        const alertId = `${alert.employeeId}_${alert.alertKey}`;
        currentAlertIds.add(alertId);
        const alertRef = db.doc(`tenants/${tenantId}/document_alerts/${alertId}`);
        if (existingAlertsById.has(alertId)) {
            mutations.push((batch) => {
                batch.update(alertRef, {
                    employeeName: alert.employeeName,
                    documentLabel: alert.documentLabel,
                    expiryDate: alert.expiryDate,
                    daysUntilExpiry: alert.daysUntilExpiry,
                    severity: alert.severity,
                    updatedAt: now,
                });
            });
            updated += 1;
        }
        else {
            mutations.push((batch) => {
                batch.set(alertRef, Object.assign(Object.assign({}, alert), { id: alertId, createdAt: now, updatedAt: now }));
            });
            created += 1;
        }
    }
    for (const existingAlert of existingAlertsSnapshot.docs) {
        if (currentAlertIds.has(existingAlert.id)) {
            continue;
        }
        mutations.push((batch) => {
            batch.delete(existingAlert.ref);
        });
        deleted += 1;
    }
    await commitDocumentAlertMutations(mutations);
    return {
        employeesScanned: employeesSnapshot.size,
        alertsFound: alerts.length,
        created,
        updated,
        deleted,
        alerts,
    };
}
// ============================================================================
// SCHEDULED FUNCTION: Daily Document Alert Check
// ============================================================================
/**
 * Runs daily at 6:00 AM UTC to check all employee documents across all tenants
 * Creates or updates alerts in the document_alerts collection
 */
exports.checkDocumentExpiry = (0, scheduler_1.onSchedule)({
    schedule: "0 6 * * *", // Every day at 6:00 AM UTC
    timeZone: "Asia/Dili", // Timor-Leste timezone (UTC+9)
    region: "asia-southeast1",
}, async () => {
    v2_1.logger.info("Starting daily document expiry check");
    try {
        // Get all active tenants
        const tenantsSnapshot = await db
            .collection("tenants")
            .where("status", "==", "active")
            .get();
        if (tenantsSnapshot.empty) {
            v2_1.logger.info("No active tenants found");
            return;
        }
        let totalAlertsCreated = 0;
        let totalAlertsUpdated = 0;
        let tenantsProcessed = 0;
        for (const tenantDoc of tenantsSnapshot.docs) {
            const tenantId = tenantDoc.id;
            try {
                const syncResult = await syncTenantDocumentAlerts(tenantId);
                if (syncResult.employeesScanned === 0) {
                    v2_1.logger.debug(`No active employees for tenant ${tenantId}`);
                    continue;
                }
                totalAlertsCreated += syncResult.created;
                totalAlertsUpdated += syncResult.updated;
                tenantsProcessed++;
                v2_1.logger.info(`Processed tenant ${tenantId}`, {
                    employees: syncResult.employeesScanned,
                    alertsFound: syncResult.alertsFound,
                    alertsCreated: syncResult.created,
                    alertsUpdated: syncResult.updated,
                    alertsDeleted: syncResult.deleted,
                });
            }
            catch (tenantError) {
                v2_1.logger.error(`Error processing tenant ${tenantId}`, { error: tenantError });
            }
        }
        v2_1.logger.info("Document expiry check completed", {
            tenantsProcessed,
            totalAlertsCreated,
            totalAlertsUpdated,
        });
    }
    catch (error) {
        v2_1.logger.error("Error in document expiry check", { error });
        throw error;
    }
});
// ============================================================================
// CALLABLE FUNCTION: Manual Alert Check
// ============================================================================
/**
 * Manually trigger document alert check for a specific tenant
 * Can be called by HR admins to refresh alerts immediately
 */
exports.refreshDocumentAlerts = (0, https_1.onCall)(async (request) => {
    const auth = (0, authz_1.requireAuth)(request);
    const { data } = request;
    const { tenantId } = data;
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameter: tenantId");
    }
    await (0, authz_1.requireTenantManagerOrAdmin)(tenantId, auth.uid);
    try {
        v2_1.logger.info(`Manual document alert refresh for tenant ${tenantId}`, { uid: auth.uid });
        const syncResult = await syncTenantDocumentAlerts(tenantId);
        // Count by severity
        const counts = {
            expired: syncResult.alerts.filter(a => a.severity === "expired").length,
            critical: syncResult.alerts.filter(a => a.severity === "critical").length,
            warning: syncResult.alerts.filter(a => a.severity === "warning").length,
            upcoming: syncResult.alerts.filter(a => a.severity === "upcoming").length,
            total: syncResult.alerts.length,
            created: syncResult.created,
            updated: syncResult.updated,
            deleted: syncResult.deleted,
        };
        v2_1.logger.info(`Document alerts refreshed for tenant ${tenantId}`, counts);
        return {
            success: true,
            message: `Found ${syncResult.alerts.length} document alerts`,
            counts,
            alerts: syncResult.alerts.map(a => ({
                employeeName: a.employeeName,
                documentType: a.documentType,
                daysUntilExpiry: a.daysUntilExpiry,
                severity: a.severity,
            })),
        };
    }
    catch (error) {
        v2_1.logger.error("Error refreshing document alerts", { error, tenantId });
        throw new https_1.HttpsError("internal", "Failed to refresh document alerts");
    }
});
/**
 * Acknowledge a document alert
 */
exports.acknowledgeDocumentAlert = (0, https_1.onCall)(async (request) => {
    const auth = (0, authz_1.requireAuth)(request);
    const { data } = request;
    const { tenantId, alertId } = data;
    if (!tenantId || !alertId) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters");
    }
    await (0, authz_1.requireTenantManagerOrAdmin)(tenantId, auth.uid);
    try {
        const alertRef = db.doc(`tenants/${tenantId}/document_alerts/${alertId}`);
        const alertDoc = await alertRef.get();
        if (!alertDoc.exists) {
            throw new https_1.HttpsError("not-found", "Alert not found");
        }
        await alertRef.update({
            acknowledged: true,
            acknowledgedBy: auth.uid,
            acknowledgedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        v2_1.logger.info(`Alert ${alertId} acknowledged by ${auth.uid}`, { tenantId });
        return { success: true, message: "Alert acknowledged" };
    }
    catch (error) {
        v2_1.logger.error("Error acknowledging alert", { error, tenantId, alertId });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Failed to acknowledge alert");
    }
});
// Functions are exported inline with their declarations above
//# sourceMappingURL=documentAlerts.js.map