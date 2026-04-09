/**
 * Document Alerts Cloud Function
 * Scheduled function to check for expiring employee documents
 * Runs daily and updates alerts collection
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { requireAuth, requireTenantManagerOrAdmin } from "./authz";

const db = getFirestore();

// ============================================================================
// TYPES
// ============================================================================

type DocumentType =
  | "bi"
  | "passport"
  | "work_permit"
  | "work_visa"
  | "residence_permit"
  | "electoral"
  | "inss"
  | "contract";
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

type PendingAlert = Omit<DocumentAlert, "id" | "createdAt" | "updatedAt"> & {
  alertKey: string;
};

type TenantAlertSyncResult = {
  employeesScanned: number;
  alertsFound: number;
  created: number;
  updated: number;
  deleted: number;
  alerts: PendingAlert[];
};

const DOCUMENT_LABELS: Record<DocumentType, string> = {
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
): PendingAlert[] {
  const alerts: PendingAlert[] = [];
  const employeeName = `${employee.personalInfo?.firstName || ""} ${employee.personalInfo?.lastName || ""}`.trim();
  const pushAlert = (
    alertKey: string,
    documentType: DocumentType,
    expiryDate: string | undefined,
    windowDays: number
  ) => {
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
  const bi = employee.documents?.bilheteIdentidade || employee.documents?.employeeIdCard;
  pushAlert("bi", "bi", bi?.expiryDate, alertThresholdDays);

  // Check Passport
  pushAlert("passport", "passport", employee.documents?.passport?.expiryDate, alertThresholdDays);

  // Check Work Permit/Visa
  pushAlert(
    "work_permit",
    "work_permit",
    employee.documents?.workingVisaResidency?.expiryDate,
    alertThresholdDays
  );

  // Check Electoral Card
  pushAlert("electoral", "electoral", employee.documents?.electoralCard?.expiryDate, alertThresholdDays);
  pushAlert("inss", "inss", employee.documents?.socialSecurityNumber?.expiryDate, alertThresholdDays);
  pushAlert("work_visa", "work_visa", employee.foreignWorker?.workVisa?.expiryDate, 90);
  pushAlert(
    "residence_permit",
    "residence_permit",
    employee.foreignWorker?.residencePermit?.expiryDate,
    90
  );
  pushAlert("fw_work_permit", "work_permit", employee.foreignWorker?.workPermit?.expiryDate, 90);
  pushAlert("contract", "contract", employee.jobDetails?.contractEndDate, 90);

  return alerts;
}

function sortAlerts(alerts: PendingAlert[]): PendingAlert[] {
  const severityOrder: AlertSeverity[] = ["expired", "critical", "warning", "upcoming"];
  return alerts.sort((left, right) => {
    const severityDiff = severityOrder.indexOf(left.severity) - severityOrder.indexOf(right.severity);
    if (severityDiff !== 0) {
      return severityDiff;
    }

    return left.daysUntilExpiry - right.daysUntilExpiry;
  });
}

async function commitDocumentAlertMutations(
  mutations: Array<(batch: FirebaseFirestore.WriteBatch) => void>
): Promise<void> {
  for (let index = 0; index < mutations.length; index += BATCH_WRITE_LIMIT) {
    const batch = db.batch();
    for (const mutate of mutations.slice(index, index + BATCH_WRITE_LIMIT)) {
      mutate(batch);
    }
    await batch.commit();
  }
}

async function syncTenantDocumentAlerts(
  tenantId: string,
  alertThresholdDays: number = 60
): Promise<TenantAlertSyncResult> {
  const [employeesSnapshot, existingAlertsSnapshot] = await Promise.all([
    db
      .collection(`tenants/${tenantId}/employees`)
      .where("status", "==", "active")
      .get(),
    db.collection(`tenants/${tenantId}/document_alerts`).get(),
  ]);

  const alerts: PendingAlert[] = [];
  for (const empDoc of employeesSnapshot.docs) {
    const employee = { id: empDoc.id, ...empDoc.data() };
    alerts.push(...extractEmployeeAlerts(tenantId, employee, alertThresholdDays));
  }
  sortAlerts(alerts);

  const now = FieldValue.serverTimestamp();
  const existingAlertsById = new Map(
    existingAlertsSnapshot.docs.map((docSnap) => [docSnap.id, docSnap])
  );
  const currentAlertIds = new Set<string>();
  const mutations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

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
    } else {
      mutations.push((batch) => {
        batch.set(alertRef, {
          ...alert,
          id: alertId,
          createdAt: now,
          updatedAt: now,
        });
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
          const syncResult = await syncTenantDocumentAlerts(tenantId);

          if (syncResult.employeesScanned === 0) {
            logger.debug(`No active employees for tenant ${tenantId}`);
            continue;
          }

          totalAlertsCreated += syncResult.created;
          totalAlertsUpdated += syncResult.updated;
          tenantsProcessed++;

          logger.info(`Processed tenant ${tenantId}`, {
            employees: syncResult.employeesScanned,
            alertsFound: syncResult.alertsFound,
            alertsCreated: syncResult.created,
            alertsUpdated: syncResult.updated,
            alertsDeleted: syncResult.deleted,
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
  const auth = requireAuth(request);
  const { data } = request;

  const { tenantId } = data;

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "Missing required parameter: tenantId");
  }

  await requireTenantManagerOrAdmin(tenantId, auth.uid);

  try {
    logger.info(`Manual document alert refresh for tenant ${tenantId}`, { uid: auth.uid });
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

    logger.info(`Document alerts refreshed for tenant ${tenantId}`, counts);

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
  } catch (error) {
    logger.error("Error refreshing document alerts", { error, tenantId });
    throw new HttpsError("internal", "Failed to refresh document alerts");
  }
});

/**
 * Acknowledge a document alert
 */
export const acknowledgeDocumentAlert = onCall(async (request) => {
  const auth = requireAuth(request);
  const { data } = request;

  const { tenantId, alertId } = data;

  if (!tenantId || !alertId) {
    throw new HttpsError("invalid-argument", "Missing required parameters");
  }

  await requireTenantManagerOrAdmin(tenantId, auth.uid);

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

// Functions are exported inline with their declarations above
