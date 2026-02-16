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
    electoral: "Electoral Card",
    inss: "INSS Card",
};
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const alerts = [];
    const employeeName = `${((_a = employee.personalInfo) === null || _a === void 0 ? void 0 : _a.firstName) || ""} ${((_b = employee.personalInfo) === null || _b === void 0 ? void 0 : _b.lastName) || ""}`.trim();
    // Check Bilhete de Identidade
    const bi = ((_c = employee.documents) === null || _c === void 0 ? void 0 : _c.bilheteIdentidade) || ((_d = employee.documents) === null || _d === void 0 ? void 0 : _d.employeeIdCard);
    if (bi === null || bi === void 0 ? void 0 : bi.expiryDate) {
        const { days, severity } = calculateExpiryInfo(bi.expiryDate);
        if (days <= alertThresholdDays) {
            alerts.push({
                tenantId,
                employeeId: employee.id,
                employeeName,
                documentType: "bi",
                documentLabel: DOCUMENT_LABELS.bi,
                expiryDate: bi.expiryDate,
                daysUntilExpiry: days,
                severity,
                acknowledged: false,
            });
        }
    }
    // Check Passport
    if ((_f = (_e = employee.documents) === null || _e === void 0 ? void 0 : _e.passport) === null || _f === void 0 ? void 0 : _f.expiryDate) {
        const { days, severity } = calculateExpiryInfo(employee.documents.passport.expiryDate);
        if (days <= alertThresholdDays) {
            alerts.push({
                tenantId,
                employeeId: employee.id,
                employeeName,
                documentType: "passport",
                documentLabel: DOCUMENT_LABELS.passport,
                expiryDate: employee.documents.passport.expiryDate,
                daysUntilExpiry: days,
                severity,
                acknowledged: false,
            });
        }
    }
    // Check Work Permit/Visa
    if ((_h = (_g = employee.documents) === null || _g === void 0 ? void 0 : _g.workingVisaResidency) === null || _h === void 0 ? void 0 : _h.expiryDate) {
        const { days, severity } = calculateExpiryInfo(employee.documents.workingVisaResidency.expiryDate);
        if (days <= alertThresholdDays) {
            alerts.push({
                tenantId,
                employeeId: employee.id,
                employeeName,
                documentType: "work_permit",
                documentLabel: DOCUMENT_LABELS.work_permit,
                expiryDate: employee.documents.workingVisaResidency.expiryDate,
                daysUntilExpiry: days,
                severity,
                acknowledged: false,
            });
        }
    }
    // Check Electoral Card
    if ((_k = (_j = employee.documents) === null || _j === void 0 ? void 0 : _j.electoralCard) === null || _k === void 0 ? void 0 : _k.expiryDate) {
        const { days, severity } = calculateExpiryInfo(employee.documents.electoralCard.expiryDate);
        if (days <= alertThresholdDays) {
            alerts.push({
                tenantId,
                employeeId: employee.id,
                employeeName,
                documentType: "electoral",
                documentLabel: DOCUMENT_LABELS.electoral,
                expiryDate: employee.documents.electoralCard.expiryDate,
                daysUntilExpiry: days,
                severity,
                acknowledged: false,
            });
        }
    }
    return alerts;
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
                // Get all active employees for this tenant
                const employeesSnapshot = await db
                    .collection(`tenants/${tenantId}/employees`)
                    .where("status", "==", "active")
                    .get();
                if (employeesSnapshot.empty) {
                    v2_1.logger.debug(`No active employees for tenant ${tenantId}`);
                    continue;
                }
                const alerts = [];
                // Extract alerts from each employee
                for (const empDoc of employeesSnapshot.docs) {
                    const employee = Object.assign({ id: empDoc.id }, empDoc.data());
                    const empAlerts = extractEmployeeAlerts(tenantId, employee);
                    alerts.push(...empAlerts);
                }
                // Update alerts collection
                const batch = db.batch();
                const now = firestore_1.FieldValue.serverTimestamp();
                for (const alert of alerts) {
                    const alertId = `${alert.employeeId}_${alert.documentType}`;
                    const alertRef = db.doc(`tenants/${tenantId}/document_alerts/${alertId}`);
                    // Check if alert already exists
                    const existingAlert = await alertRef.get();
                    if (existingAlert.exists) {
                        // Update existing alert (preserve acknowledged status)
                        batch.update(alertRef, {
                            daysUntilExpiry: alert.daysUntilExpiry,
                            severity: alert.severity,
                            updatedAt: now,
                            // Don't overwrite acknowledged status
                        });
                        totalAlertsUpdated++;
                    }
                    else {
                        // Create new alert
                        batch.set(alertRef, Object.assign(Object.assign({}, alert), { id: alertId, createdAt: now, updatedAt: now }));
                        totalAlertsCreated++;
                    }
                }
                // Remove alerts for documents that are no longer expiring
                const existingAlertsSnapshot = await db
                    .collection(`tenants/${tenantId}/document_alerts`)
                    .get();
                const currentAlertIds = new Set(alerts.map(a => `${a.employeeId}_${a.documentType}`));
                for (const alertDoc of existingAlertsSnapshot.docs) {
                    if (!currentAlertIds.has(alertDoc.id)) {
                        // This alert is no longer needed (document was renewed or employee no longer active)
                        batch.delete(alertDoc.ref);
                    }
                }
                await batch.commit();
                tenantsProcessed++;
                v2_1.logger.info(`Processed tenant ${tenantId}`, {
                    employees: employeesSnapshot.size,
                    alertsFound: alerts.length,
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
        // Get all active employees
        const employeesSnapshot = await db
            .collection(`tenants/${tenantId}/employees`)
            .where("status", "==", "active")
            .get();
        const alerts = [];
        for (const empDoc of employeesSnapshot.docs) {
            const employee = Object.assign({ id: empDoc.id }, empDoc.data());
            const empAlerts = extractEmployeeAlerts(tenantId, employee);
            alerts.push(...empAlerts);
        }
        // Update alerts collection
        const batch = db.batch();
        const now = firestore_1.FieldValue.serverTimestamp();
        for (const alert of alerts) {
            const alertId = `${alert.employeeId}_${alert.documentType}`;
            const alertRef = db.doc(`tenants/${tenantId}/document_alerts/${alertId}`);
            batch.set(alertRef, Object.assign(Object.assign({}, alert), { id: alertId, updatedAt: now }), { merge: true });
        }
        await batch.commit();
        // Count by severity
        const counts = {
            expired: alerts.filter(a => a.severity === "expired").length,
            critical: alerts.filter(a => a.severity === "critical").length,
            warning: alerts.filter(a => a.severity === "warning").length,
            upcoming: alerts.filter(a => a.severity === "upcoming").length,
            total: alerts.length,
        };
        v2_1.logger.info(`Document alerts refreshed for tenant ${tenantId}`, counts);
        return {
            success: true,
            message: `Found ${alerts.length} document alerts`,
            counts,
            alerts: alerts.map(a => ({
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