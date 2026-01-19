/**
 * Document Alerts Dashboard Card
 * Shows expiring/expired employee documents on the main dashboard
 */

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Clock,
  FileWarning,
  ChevronRight,
  ShieldAlert,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";
import { employeeService, type Employee } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";

export type DocumentType = "bi" | "passport" | "work_permit" | "work_visa" | "residence_permit" | "electoral" | "inss";
export type AlertSeverity = "expired" | "critical" | "warning" | "upcoming";

export interface DocumentAlert {
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
  }

  // Sort by severity (most urgent first), then by days
  const severityOrder: AlertSeverity[] = ["expired", "critical", "warning", "upcoming"];
  return alerts.sort((a, b) => {
    const severityDiff = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
    if (severityDiff !== 0) return severityDiff;
    return a.daysUntilExpiry - b.daysUntilExpiry;
  });
}

interface DocumentAlertsCardProps {
  maxItems?: number;
  className?: string;
}

export default function DocumentAlertsCard({ maxItems = 5, className = "" }: DocumentAlertsCardProps) {
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const result = await employeeService.getAllEmployees(tenantId);
        setEmployees(result);
      } catch (error) {
        console.error("Failed to load employees:", error);
      } finally {
        setLoading(false);
      }
    };
    loadEmployees();
  }, [tenantId]);

  const alerts = useMemo(() => extractAlerts(employees), [employees]);
  const displayAlerts = alerts.slice(0, maxItems);

  const counts = useMemo(() => ({
    expired: alerts.filter(a => a.severity === "expired").length,
    critical: alerts.filter(a => a.severity === "critical").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    total: alerts.length,
  }), [alerts]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileWarning className="h-5 w-5" />
            Document Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileWarning className="h-5 w-5 text-amber-600" />
            Document Alerts
          </CardTitle>
          <div className="flex gap-1">
            {counts.expired > 0 && (
              <Badge className={SEVERITY_CONFIG.expired.className}>
                {counts.expired} expired
              </Badge>
            )}
            {counts.critical > 0 && (
              <Badge className={SEVERITY_CONFIG.critical.className}>
                {counts.critical} critical
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileWarning className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No document alerts</p>
            <p className="text-xs">All employee documents are up to date</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayAlerts.map((alert) => {
              const config = SEVERITY_CONFIG[alert.severity];
              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-1.5 rounded-full ${config.className}`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{alert.employeeName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.documentLabel}
                      {" - "}
                      {alert.daysUntilExpiry < 0
                        ? `Expired ${Math.abs(alert.daysUntilExpiry)} days ago`
                        : alert.daysUntilExpiry === 0
                        ? "Expires today"
                        : `Expires in ${alert.daysUntilExpiry} days`}
                    </p>
                  </div>
                  <Badge variant="outline" className={config.className}>
                    {config.label}
                  </Badge>
                </div>
              );
            })}

            <Link to="/admin/document-alerts">
              <Button variant="ghost" className="w-full mt-2 text-sm">
                {alerts.length > maxItems
                  ? `View all ${alerts.length} alerts`
                  : "Manage alerts"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export for use in alerts page
export { extractAlerts, DOCUMENT_LABELS, SEVERITY_CONFIG, calculateExpiryInfo };
