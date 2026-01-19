/**
 * Archive Service
 *
 * Manages document retention and archival for Timor-Leste compliance.
 * TL requires 5-year minimum retention for tax and employment records.
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import { auditLogService } from "./auditLogService";

// ============================================
// TYPES
// ============================================

export type ArchiveType =
  | "employee"
  | "payroll_run"
  | "payroll_record"
  | "tax_filing"
  | "document"
  | "report"
  | "contract";

export type ArchiveStatus = "active" | "archived" | "pending_deletion" | "deleted";

export type RetentionPeriod = "5_years" | "7_years" | "10_years" | "permanent";

export interface ArchiveRecord {
  id?: string;
  // Classification
  type: ArchiveType;
  status: ArchiveStatus;
  // Original data reference
  originalId: string;
  originalCollection: string;
  // Archived data
  data: Record<string, unknown>;
  // Retention
  retentionPeriod: RetentionPeriod;
  retentionYears: number;
  archiveDate: Date | Timestamp;
  retentionEndDate: Date | Timestamp;
  // Metadata
  archivedBy: string;
  archivedByEmail: string;
  reason?: string;
  tags?: string[];
  // Deletion tracking
  markedForDeletionDate?: Date | Timestamp;
  markedForDeletionBy?: string;
  deletedDate?: Date | Timestamp;
  deletedBy?: string;
  // Tenant
  tenantId?: string;
  // Timestamps
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface ArchiveFilters {
  type?: ArchiveType;
  status?: ArchiveStatus;
  retentionPeriod?: RetentionPeriod;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

export interface ArchiveStats {
  totalRecords: number;
  byType: Record<ArchiveType, number>;
  byStatus: Record<ArchiveStatus, number>;
  expiringWithin30Days: number;
  expiringWithin90Days: number;
  permanentRecords: number;
}

// ============================================
// CONSTANTS
// ============================================

// TL compliance: 5 years minimum for tax records
const DEFAULT_RETENTION_YEARS: Record<ArchiveType, number> = {
  employee: 5,
  payroll_run: 5,
  payroll_record: 5,
  tax_filing: 5,
  document: 5,
  report: 5,
  contract: 7,
};

const RETENTION_PERIODS: Record<RetentionPeriod, number> = {
  "5_years": 5,
  "7_years": 7,
  "10_years": 10,
  permanent: 9999, // Effectively permanent
};

// ============================================
// SERVICE
// ============================================

export const archiveService = {
  /**
   * Archive a record
   */
  async archive(params: {
    type: ArchiveType;
    originalId: string;
    originalCollection: string;
    data: Record<string, unknown>;
    archivedBy: string;
    archivedByEmail: string;
    reason?: string;
    tags?: string[];
    retentionPeriod?: RetentionPeriod;
    tenantId: string;
  }): Promise<string> {
    try {
      const retentionPeriod = params.retentionPeriod || "5_years";
      const retentionYears =
        RETENTION_PERIODS[retentionPeriod] || DEFAULT_RETENTION_YEARS[params.type];

      const archiveDate = new Date();
      const retentionEndDate = new Date(archiveDate);
      retentionEndDate.setFullYear(retentionEndDate.getFullYear() + retentionYears);

      const record: Omit<ArchiveRecord, "id"> = {
        type: params.type,
        status: "archived",
        originalId: params.originalId,
        originalCollection: params.originalCollection,
        data: params.data,
        retentionPeriod,
        retentionYears,
        archiveDate: Timestamp.fromDate(archiveDate),
        retentionEndDate: Timestamp.fromDate(retentionEndDate),
        archivedBy: params.archivedBy,
        archivedByEmail: params.archivedByEmail,
        reason: params.reason,
        tags: params.tags,
        tenantId: params.tenantId,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };

      const docRef = await addDoc(collection(db, paths.archives(params.tenantId)), record);

      // Log the archive action
      await auditLogService.log({
        userId: params.archivedBy,
        userEmail: params.archivedByEmail,
        action: "archive.create",
        entityId: docRef.id,
        entityType: "archive",
        metadata: {
          type: params.type,
          originalId: params.originalId,
          retentionPeriod,
          retentionEndDate: retentionEndDate.toISOString(),
        },
        tenantId: params.tenantId,
      });

      return docRef.id;
    } catch (error) {
      console.error("Failed to archive record:", error);
      throw error;
    }
  },

  /**
   * Archive an employee (on termination)
   */
  async archiveEmployee(params: {
    employeeId: string;
    employeeData: Record<string, unknown>;
    archivedBy: string;
    archivedByEmail: string;
    reason: string;
    tenantId: string;
  }): Promise<string> {
    return this.archive({
      type: "employee",
      originalId: params.employeeId,
      originalCollection: "employees",
      data: {
        ...params.employeeData,
        _archivedAt: new Date().toISOString(),
      },
      archivedBy: params.archivedBy,
      archivedByEmail: params.archivedByEmail,
      reason: params.reason,
      tags: ["terminated_employee"],
      tenantId: params.tenantId,
    });
  },

  /**
   * Archive a payroll run
   */
  async archivePayrollRun(params: {
    payrollRunId: string;
    payrollData: Record<string, unknown>;
    records: Record<string, unknown>[];
    archivedBy: string;
    archivedByEmail: string;
    tenantId: string;
  }): Promise<string> {
    return this.archive({
      type: "payroll_run",
      originalId: params.payrollRunId,
      originalCollection: "payroll_runs",
      data: {
        run: params.payrollData,
        records: params.records,
        _archivedAt: new Date().toISOString(),
      },
      archivedBy: params.archivedBy,
      archivedByEmail: params.archivedByEmail,
      reason: "Annual payroll archive",
      tags: ["payroll", "annual_archive"],
      tenantId: params.tenantId,
    });
  },

  /**
   * Archive a tax filing
   */
  async archiveTaxFiling(params: {
    filingId: string;
    filingData: Record<string, unknown>;
    archivedBy: string;
    archivedByEmail: string;
    tenantId: string;
  }): Promise<string> {
    return this.archive({
      type: "tax_filing",
      originalId: params.filingId,
      originalCollection: "tax_filings",
      data: {
        ...params.filingData,
        _archivedAt: new Date().toISOString(),
      },
      archivedBy: params.archivedBy,
      archivedByEmail: params.archivedByEmail,
      reason: "Tax filing archive - TL compliance",
      tags: ["tax", "attl", "compliance"],
      retentionPeriod: "5_years", // TL requirement
      tenantId: params.tenantId,
    });
  },

  /**
   * Get archived records with filtering
   */
  async getArchives(tenantId: string, filters: ArchiveFilters = {}): Promise<ArchiveRecord[]> {
    try {
      const constraints: QueryConstraint[] = [];

      if (filters.type) {
        constraints.push(where("type", "==", filters.type));
      }
      if (filters.status) {
        constraints.push(where("status", "==", filters.status));
      }
      if (filters.retentionPeriod) {
        constraints.push(where("retentionPeriod", "==", filters.retentionPeriod));
      }
      if (filters.startDate) {
        constraints.push(
          where("archiveDate", ">=", Timestamp.fromDate(filters.startDate))
        );
      }
      if (filters.endDate) {
        constraints.push(
          where("archiveDate", "<=", Timestamp.fromDate(filters.endDate))
        );
      }

      constraints.push(orderBy("archiveDate", "desc"));
      constraints.push(limit(500));

      const q = query(collection(db, paths.archives(tenantId)), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          archiveDate: data.archiveDate?.toDate() || new Date(),
          retentionEndDate: data.retentionEndDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ArchiveRecord;
      });
    } catch (error) {
      console.error("Failed to get archives:", error);
      throw error;
    }
  },

  /**
   * Get a specific archive record
   */
  async getArchive(tenantId: string, archiveId: string): Promise<ArchiveRecord | null> {
    try {
      const docRef = doc(db, paths.archive(tenantId, archiveId));
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        archiveDate: data.archiveDate?.toDate() || new Date(),
        retentionEndDate: data.retentionEndDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as ArchiveRecord;
    } catch (error) {
      console.error("Failed to get archive:", error);
      throw error;
    }
  },

  /**
   * Restore an archived record
   */
  async restore(params: {
    tenantId: string;
    archiveId: string;
    restoredBy: string;
    restoredByEmail: string;
    reason?: string;
  }): Promise<Record<string, unknown>> {
    try {
      const archive = await this.getArchive(params.tenantId, params.archiveId);
      if (!archive) {
        throw new Error("Archive record not found");
      }

      // Mark as restored (don't delete the archive for audit trail)
      const docRef = doc(db, paths.archive(params.tenantId, params.archiveId));
      await updateDoc(docRef, {
        status: "active" as ArchiveStatus,
        updatedAt: serverTimestamp(),
      });

      // Log restoration
      await auditLogService.log({
        userId: params.restoredBy,
        userEmail: params.restoredByEmail,
        action: "archive.restore",
        entityId: params.archiveId,
        entityType: "archive",
        description: `Restored ${archive.type} from archive`,
        tenantId: params.tenantId,
        metadata: {
          type: archive.type,
          originalId: archive.originalId,
          reason: params.reason,
        },
      });

      return archive.data;
    } catch (error) {
      console.error("Failed to restore archive:", error);
      throw error;
    }
  },

  /**
   * Mark an archive for deletion (after retention period)
   */
  async markForDeletion(params: {
    tenantId: string;
    archiveId: string;
    markedBy: string;
    markedByEmail: string;
  }): Promise<void> {
    try {
      const archive = await this.getArchive(params.tenantId, params.archiveId);
      if (!archive) {
        throw new Error("Archive record not found");
      }

      // Check if retention period has passed
      const now = new Date();
      const retentionEnd =
        archive.retentionEndDate instanceof Date
          ? archive.retentionEndDate
          : new Date(archive.retentionEndDate as unknown as number);

      if (now < retentionEnd) {
        throw new Error(
          `Cannot delete - retention period ends ${retentionEnd.toLocaleDateString()}`
        );
      }

      const docRef = doc(db, paths.archive(params.tenantId, params.archiveId));
      await updateDoc(docRef, {
        status: "pending_deletion" as ArchiveStatus,
        markedForDeletionDate: serverTimestamp(),
        markedForDeletionBy: params.markedBy,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to mark for deletion:", error);
      throw error;
    }
  },

  /**
   * Permanently delete an archive (requires approval workflow in production)
   */
  async deletePermanently(params: {
    tenantId: string;
    archiveId: string;
    deletedBy: string;
    deletedByEmail: string;
    confirmationCode?: string;
  }): Promise<void> {
    try {
      const archive = await this.getArchive(params.tenantId, params.archiveId);
      if (!archive) {
        throw new Error("Archive record not found");
      }

      if (archive.status !== "pending_deletion") {
        throw new Error("Record must be marked for deletion first");
      }

      // Log before deletion (important for compliance)
      await auditLogService.log({
        userId: params.deletedBy,
        userEmail: params.deletedByEmail,
        action: "archive.delete_permanent",
        entityId: params.archiveId,
        entityType: "archive",
        description: `Permanently deleted ${archive.type} archive after retention period`,
        tenantId: params.tenantId,
        metadata: {
          type: archive.type,
          originalId: archive.originalId,
          archiveDate: archive.archiveDate,
          retentionEndDate: archive.retentionEndDate,
        },
        severity: "critical",
      });

      // Delete the record
      const docRef = doc(db, paths.archive(params.tenantId, params.archiveId));
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Failed to delete archive:", error);
      throw error;
    }
  },

  /**
   * Get archive statistics
   */
  async getStats(tenantId: string): Promise<ArchiveStats> {
    try {
      const archives = await this.getArchives(tenantId);
      const now = new Date();

      const stats: ArchiveStats = {
        totalRecords: archives.length,
        byType: {
          employee: 0,
          payroll_run: 0,
          payroll_record: 0,
          tax_filing: 0,
          document: 0,
          report: 0,
          contract: 0,
        },
        byStatus: {
          active: 0,
          archived: 0,
          pending_deletion: 0,
          deleted: 0,
        },
        expiringWithin30Days: 0,
        expiringWithin90Days: 0,
        permanentRecords: 0,
      };

      for (const archive of archives) {
        stats.byType[archive.type]++;
        stats.byStatus[archive.status]++;

        if (archive.retentionPeriod === "permanent") {
          stats.permanentRecords++;
        } else {
          const retentionEnd =
            archive.retentionEndDate instanceof Date
              ? archive.retentionEndDate
              : new Date(archive.retentionEndDate as unknown as number);
          const daysUntilExpiry = Math.ceil(
            (retentionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
            stats.expiringWithin30Days++;
          } else if (daysUntilExpiry <= 90 && daysUntilExpiry > 30) {
            stats.expiringWithin90Days++;
          }
        }
      }

      return stats;
    } catch (error) {
      console.error("Failed to get archive stats:", error);
      throw error;
    }
  },

  /**
   * Get records past retention period (for cleanup)
   */
  async getExpiredRecords(tenantId: string): Promise<ArchiveRecord[]> {
    const archives = await this.getArchives(tenantId, { status: "archived" });

    const now = new Date();
    return archives.filter((archive) => {
      if (archive.retentionPeriod === "permanent") return false;

      const retentionEnd =
        archive.retentionEndDate instanceof Date
          ? archive.retentionEndDate
          : new Date(archive.retentionEndDate as unknown as number);

      return now > retentionEnd;
    });
  },

  /**
   * Export archive manifest as CSV (for compliance audits)
   */
  async exportManifest(tenantId: string, filters: ArchiveFilters = {}): Promise<string> {
    const archives = await this.getArchives(tenantId, filters);

    const headers = [
      "Archive ID",
      "Type",
      "Status",
      "Original ID",
      "Archive Date",
      "Retention Period",
      "Retention End Date",
      "Archived By",
      "Tags",
    ];

    const rows = archives.map((archive) => [
      archive.id || "",
      archive.type,
      archive.status,
      archive.originalId,
      archive.archiveDate instanceof Date
        ? archive.archiveDate.toISOString()
        : "",
      archive.retentionPeriod,
      archive.retentionEndDate instanceof Date
        ? archive.retentionEndDate.toISOString()
        : "",
      archive.archivedByEmail,
      (archive.tags || []).join(";"),
    ]);

    return [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
  },
};
