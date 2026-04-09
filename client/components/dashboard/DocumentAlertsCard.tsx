/**
 * Document Alerts — shared utilities for document expiry tracking
 */

import React from "react";
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { type Employee } from "@/services/employeeService";

type DocumentType = "bi" | "passport" | "work_permit" | "work_visa" | "residence_permit" | "electoral" | "inss" | "contract";
type AlertSeverity = "expired" | "critical" | "warning" | "upcoming";

interface DocumentAlert {
  id: string;
  employeeId: string;
  employeeName: string;
  documentType: DocumentType;
  documentLabel: string;
  expiryDate: string;
  daysUntilExpiry: number;
  severity: AlertSeverity;
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  bi: "Bilhete de Identidade",
  passport: "Passport",
  work_permit: "Work Permit",
  work_visa: "Work Visa (Type C)",
  residence_permit: "Residence Permit",
  electoral: "Electoral Card",
  inss: "INSS Card",
  contract: "Employment Contract",
};

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; className: string; icon: React.ReactNode }> = {
  expired: {
    label: "Expired",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: <ShieldAlert className="h-3 w-3" />,
  },
  critical: {
    label: "Critical",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  warning: {
    label: "Warning",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: <Clock className="h-3 w-3" />,
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: <Clock className="h-3 w-3" />,
  },
};

/**
 * Calculate days until expiry and severity
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
 * Check a single document's expiry and push an alert if within the window
 */
function checkDocumentExpiry(
  alerts: DocumentAlert[],
  employeeId: string,
  employeeName: string,
  expiryDate: string | undefined,
  idSuffix: string,
  docType: DocumentType,
  windowDays: number,
) {
  if (!expiryDate) return;
  const { days, severity } = calculateExpiryInfo(expiryDate);
  if (days <= windowDays) {
    alerts.push({
      id: `${employeeId}-${idSuffix}`,
      employeeId: employeeId || "",
      employeeName,
      documentType: docType,
      documentLabel: DOCUMENT_LABELS[docType],
      expiryDate,
      daysUntilExpiry: days,
      severity,
    });
  }
}

/**
 * Extract document alerts from employees
 */
function extractAlerts(employees: Employee[]): DocumentAlert[] {
  const alerts: DocumentAlert[] = [];

  for (const employee of employees) {
    if (employee.status !== "active") continue;

    const employeeName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
    const empId = employee.id || "";

    // Standard documents (60-day window)
    const bi = employee.documents?.bilheteIdentidade || employee.documents?.employeeIdCard;
    checkDocumentExpiry(alerts, empId, employeeName, bi?.expiryDate, "bi", "bi", 60);
    checkDocumentExpiry(alerts, empId, employeeName, employee.documents?.passport?.expiryDate, "passport", "passport", 60);
    checkDocumentExpiry(alerts, empId, employeeName, employee.documents?.workingVisaResidency?.expiryDate, "work_permit", "work_permit", 60);
    checkDocumentExpiry(alerts, empId, employeeName, employee.documents?.electoralCard?.expiryDate, "electoral", "electoral", 60);

    // Foreign worker documents (90-day window for visa renewals)
    if (employee.isForeignWorker && employee.foreignWorker) {
      checkDocumentExpiry(alerts, empId, employeeName, employee.foreignWorker.workVisa?.expiryDate, "work_visa", "work_visa", 90);
      checkDocumentExpiry(alerts, empId, employeeName, employee.foreignWorker.residencePermit?.expiryDate, "residence_permit", "residence_permit", 90);
      checkDocumentExpiry(alerts, empId, employeeName, employee.foreignWorker.workPermit?.expiryDate, "fw_work_permit", "work_permit", 90);
    }

    // Fixed-term contract end date (90-day window for renewal planning)
    checkDocumentExpiry(alerts, empId, employeeName, employee.jobDetails?.contractEndDate, "contract", "contract", 90);
  }

  // Sort by severity (most urgent first), then by days
  const severityOrder: AlertSeverity[] = ["expired", "critical", "warning", "upcoming"];
  return alerts.sort((a, b) => {
    const severityDiff = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
    if (severityDiff !== 0) return severityDiff;
    return a.daysUntilExpiry - b.daysUntilExpiry;
  });
}

// eslint-disable-next-line react-refresh/only-export-components
export { extractAlerts, SEVERITY_CONFIG };
