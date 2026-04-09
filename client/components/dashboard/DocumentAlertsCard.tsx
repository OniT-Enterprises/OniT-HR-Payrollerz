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
 * Extract document alerts from employees
 */
function extractAlerts(employees: Employee[]): DocumentAlert[] {
  const alerts: DocumentAlert[] = [];

  for (const employee of employees) {
    if (employee.status !== "active") continue;

    const employeeName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;

    // Check Bilhete de Identidade
    const bi = employee.documents?.bilheteIdentidade || employee.documents?.employeeIdCard;
    if (bi?.expiryDate) {
      const { days, severity } = calculateExpiryInfo(bi.expiryDate);
      if (days <= 60) {
        alerts.push({
          id: `${employee.id}-bi`,
          employeeId: employee.id || "",
          employeeName,
          documentType: "bi",
          documentLabel: DOCUMENT_LABELS.bi,
          expiryDate: bi.expiryDate,
          daysUntilExpiry: days,
          severity,
        });
      }
    }

    // Check Passport
    if (employee.documents?.passport?.expiryDate) {
      const { days, severity } = calculateExpiryInfo(employee.documents.passport.expiryDate);
      if (days <= 60) {
        alerts.push({
          id: `${employee.id}-passport`,
          employeeId: employee.id || "",
          employeeName,
          documentType: "passport",
          documentLabel: DOCUMENT_LABELS.passport,
          expiryDate: employee.documents.passport.expiryDate,
          daysUntilExpiry: days,
          severity,
        });
      }
    }

    // Check Work Permit/Visa (legacy field)
    if (employee.documents?.workingVisaResidency?.expiryDate) {
      const { days, severity } = calculateExpiryInfo(employee.documents.workingVisaResidency.expiryDate);
      if (days <= 60) {
        alerts.push({
          id: `${employee.id}-work_permit`,
          employeeId: employee.id || "",
          employeeName,
          documentType: "work_permit",
          documentLabel: DOCUMENT_LABELS.work_permit,
          expiryDate: employee.documents.workingVisaResidency.expiryDate,
          daysUntilExpiry: days,
          severity,
        });
      }
    }

    // Check Foreign Worker Documents (new comprehensive tracking)
    if (employee.isForeignWorker && employee.foreignWorker) {
      // Work Visa
      if (employee.foreignWorker.workVisa?.expiryDate) {
        const { days, severity } = calculateExpiryInfo(employee.foreignWorker.workVisa.expiryDate);
        if (days <= 90) { // Extended window for visa renewals
          alerts.push({
            id: `${employee.id}-work_visa`,
            employeeId: employee.id || "",
            employeeName,
            documentType: "work_visa",
            documentLabel: DOCUMENT_LABELS.work_visa,
            expiryDate: employee.foreignWorker.workVisa.expiryDate,
            daysUntilExpiry: days,
            severity,
          });
        }
      }

      // Residence Permit
      if (employee.foreignWorker.residencePermit?.expiryDate) {
        const { days, severity } = calculateExpiryInfo(employee.foreignWorker.residencePermit.expiryDate);
        if (days <= 90) {
          alerts.push({
            id: `${employee.id}-residence_permit`,
            employeeId: employee.id || "",
            employeeName,
            documentType: "residence_permit",
            documentLabel: DOCUMENT_LABELS.residence_permit,
            expiryDate: employee.foreignWorker.residencePermit.expiryDate,
            daysUntilExpiry: days,
            severity,
          });
        }
      }

      // Work Permit (separate from visa)
      if (employee.foreignWorker.workPermit?.expiryDate) {
        const { days, severity } = calculateExpiryInfo(employee.foreignWorker.workPermit.expiryDate);
        if (days <= 90) {
          alerts.push({
            id: `${employee.id}-fw_work_permit`,
            employeeId: employee.id || "",
            employeeName,
            documentType: "work_permit",
            documentLabel: DOCUMENT_LABELS.work_permit,
            expiryDate: employee.foreignWorker.workPermit.expiryDate,
            daysUntilExpiry: days,
            severity,
          });
        }
      }
    }

    // Check Electoral Card
    if (employee.documents?.electoralCard?.expiryDate) {
      const { days, severity } = calculateExpiryInfo(employee.documents.electoralCard.expiryDate);
      if (days <= 60) {
        alerts.push({
          id: `${employee.id}-electoral`,
          employeeId: employee.id || "",
          employeeName,
          documentType: "electoral",
          documentLabel: DOCUMENT_LABELS.electoral,
          expiryDate: employee.documents.electoralCard.expiryDate,
          daysUntilExpiry: days,
          severity,
        });
      }
    }

    // Check fixed-term contract end date (90 day window for renewal planning)
    if (employee.jobDetails?.contractEndDate) {
      const { days, severity } = calculateExpiryInfo(employee.jobDetails.contractEndDate);
      if (days <= 90) {
        alerts.push({
          id: `${employee.id}-contract`,
          employeeId: employee.id || "",
          employeeName,
          documentType: "contract",
          documentLabel: DOCUMENT_LABELS.contract,
          expiryDate: employee.jobDetails.contractEndDate,
          daysUntilExpiry: days,
          severity,
        });
      }
    }
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
