/**
 * Document Alerts Cloud Function
 * Scheduled function to check for expiring employee documents
 * Runs daily and updates alerts collection
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

const db = getFirestore();

// ============================================================================
// TYPES
// ============================================================================

type DocumentType = "bi" | "passport" | "work_permit" | "electoral" | "inss";
type AlertSeverity = "expired" | "critical" | "warning" | "upcoming";

interface DocumentAlert {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  documentType: DocumentType;
  documentLabel: string;
  expiryDate: string;
  daysUntilExpiry: number;
  severity: AlertSeverity;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
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
function calculateExpiryInfo(expiryDate: string): { days: number; severity: AlertSeverity } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let severity: AlertSeverity;
  if (days < 0) {
    severity = "expired";
  } else if (days <= 14) {
    severity = "critical";
  } else if (days <= 30) {
    severity = "warning";
  } else {
    severity = "upcoming";
  }

  return { days, severity };
}

/**
 * Extract document expiry alerts from an employee
 */
function extractEmployeeAlerts(
  tenantId: string,
  employee: any,
  alertThresholdDays: number = 60
): Omit<DocumentAlert, "id" | "createdAt" | "updatedAt">[] {
  const alerts: Omit<DocumentAlert, "id" | "createdAt" | "updatedAt">[] = [];
  const employeeName = `${employee.personalInfo?.firstName || ""} ${employee.personalInfo?.lastName || ""}`.trim();

  // Check Bilhete de Identidade
  const bi = employee.documents?.bilheteIdentidade || employee.documents?.employeeIdCard;
  if (bi?.expiryDate) {
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
  if (employee.documents?.passport?.expiryDate) {
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
  if (employee.documents?.workingVisaResidency?.expiryDate) {
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
  if (employee.documents?.electoralCard?.expiryDate) {
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
export const checkDocumentExpiry = onSchedule(
  {
    schedule: "0 6 * * *", // Every day at 6:00 AM UTC
    timeZone: "Asia/Dili", // Timor-Leste timezone (UTC+9)
    region: "asia-southeast1",
  },
  async () => {
    logger.info("Starting daily document expiry check");

    try {
      // Get all active tenants
      const tenantsSnapshot = await db
        .collection("tenants")
        .where("status", "==", "active")
        .get();

      if (tenantsSnapshot.empty) {
        logger.info("No active tenants found");
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
            logger.debug(`No active employees for tenant ${tenantId}`);
            continue;
          }

          const alerts: Omit<DocumentAlert, "id" | "createdAt" | "updatedAt">[] = [];

          // Extract alerts from each employee
          for (const empDoc of employeesSnapshot.docs) {
            const employee = { id: empDoc.id, ...empDoc.data() };
            const empAlerts = extractEmployeeAlerts(tenantId, employee);
            alerts.push(...empAlerts);
          }

          // Update alerts collection
          const batch = db.batch();
          const now = FieldValue.serverTimestamp();

          for (const alert of alerts) {
            const alertId = `${alert.employeeId}_${alert.documentType}`;
            const alertRef = db.doc(`tenants/${tenantId}/document_alerts/${alertId}`);

            // Check if alert already exists
            const existingAlert = await alertRef.get();

            if (existingAlert.exists) {
              // Update existing alert (preserve acknowledged status)
              const existing = existingAlert.data()!;
              batch.update(alertRef, {
                daysUntilExpiry: alert.daysUntilExpiry,
                severity: alert.severity,
                updatedAt: now,
                // Don't overwrite acknowledged status
              });
              totalAlertsUpdated++;
            } else {
              // Create new alert
              batch.set(alertRef, {
                ...alert,
                id: alertId,
                createdAt: now,
                updatedAt: now,
              });
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

          logger.info(`Processed tenant ${tenantId}`, {
            employees: employeesSnapshot.size,
            alertsFound: alerts.length,
          });
        } catch (tenantError) {
          logger.error(`Error processing tenant ${tenantId}`, { error: tenantError });
        }
      }

      logger.info("Document expiry check completed", {
        tenantsProcessed,
        totalAlertsCreated,
        totalAlertsUpdated,
      });
    } catch (error) {
      logger.error("Error in document expiry check", { error });
      throw error;
    }
  }
);

// ============================================================================
// CALLABLE FUNCTION: Manual Alert Check
// ============================================================================

/**
 * Manually trigger document alert check for a specific tenant
 * Can be called by HR admins to refresh alerts immediately
 */
export const refreshDocumentAlerts = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { tenantId } = data;

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "Missing required parameter: tenantId");
  }

  try {
    logger.info(`Manual document alert refresh for tenant ${tenantId}`, { uid: auth.uid });

    // Get all active employees
    const employeesSnapshot = await db
      .collection(`tenants/${tenantId}/employees`)
      .where("status", "==", "active")
      .get();

    const alerts: Omit<DocumentAlert, "id" | "createdAt" | "updatedAt">[] = [];

    for (const empDoc of employeesSnapshot.docs) {
      const employee = { id: empDoc.id, ...empDoc.data() };
      const empAlerts = extractEmployeeAlerts(tenantId, employee);
      alerts.push(...empAlerts);
    }

    // Update alerts collection
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();

    for (const alert of alerts) {
      const alertId = `${alert.employeeId}_${alert.documentType}`;
      const alertRef = db.doc(`tenants/${tenantId}/document_alerts/${alertId}`);

      batch.set(
        alertRef,
        {
          ...alert,
          id: alertId,
          updatedAt: now,
        },
        { merge: true }
      );
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

    logger.info(`Document alerts refreshed for tenant ${tenantId}`, counts);

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
  } catch (error) {
    logger.error("Error refreshing document alerts", { error, tenantId });
    throw new HttpsError("internal", "Failed to refresh document alerts");
  }
});

/**
 * Acknowledge a document alert
 */
export const acknowledgeDocumentAlert = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { tenantId, alertId } = data;

  if (!tenantId || !alertId) {
    throw new HttpsError("invalid-argument", "Missing required parameters");
  }

  try {
    const alertRef = db.doc(`tenants/${tenantId}/document_alerts/${alertId}`);
    const alertDoc = await alertRef.get();

    if (!alertDoc.exists) {
      throw new HttpsError("not-found", "Alert not found");
    }

    await alertRef.update({
      acknowledged: true,
      acknowledgedBy: auth.uid,
      acknowledgedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Alert ${alertId} acknowledged by ${auth.uid}`, { tenantId });

    return { success: true, message: "Alert acknowledged" };
  } catch (error) {
    logger.error("Error acknowledging alert", { error, tenantId, alertId });

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Failed to acknowledge alert");
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export { checkDocumentExpiry, refreshDocumentAlerts, acknowledgeDocumentAlert };
