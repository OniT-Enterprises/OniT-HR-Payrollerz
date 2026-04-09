import { collection, getDocs, query } from "firebase/firestore";
import { db, getFunctionsLazy } from "@/lib/firebase";
import { paths } from "@/lib/paths";

export type DocumentAlertType =
  | "bi"
  | "passport"
  | "work_permit"
  | "work_visa"
  | "residence_permit"
  | "electoral"
  | "inss"
  | "contract";

export type DocumentAlertSeverity = "expired" | "critical" | "warning" | "upcoming";

export interface DocumentAlertRecord {
  id: string;
  alertKey?: string;
  employeeId: string;
  employeeName: string;
  documentType: DocumentAlertType;
  documentLabel: string;
  expiryDate: string;
  daysUntilExpiry: number;
  severity: DocumentAlertSeverity;
  acknowledged: boolean;
}

const severityOrder: DocumentAlertSeverity[] = ["expired", "critical", "warning", "upcoming"];

class DocumentAlertService {
  async getDocumentAlerts(tenantId: string): Promise<DocumentAlertRecord[]> {
    const snapshot = await getDocs(query(collection(db, paths.documentAlerts(tenantId))));

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as DocumentAlertRecord))
      .sort((left, right) => {
        const severityDiff = severityOrder.indexOf(left.severity) - severityOrder.indexOf(right.severity);
        if (severityDiff !== 0) {
          return severityDiff;
        }
        return left.daysUntilExpiry - right.daysUntilExpiry;
      });
  }

  async refreshDocumentAlerts(tenantId: string): Promise<void> {
    const { httpsCallable } = await import("firebase/functions");
    const refreshAlerts = httpsCallable<{ tenantId: string }, { success: boolean }>(
      await getFunctionsLazy(),
      "refreshDocumentAlerts"
    );
    await refreshAlerts({ tenantId });
  }
}

export const documentAlertService = new DocumentAlertService();
