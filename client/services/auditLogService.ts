/**
 * Audit Log Service
 *
 * Tracks user actions and data changes for compliance and security purposes.
 * Supports TL document retention requirements (5-year minimum).
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
  DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";

// ============================================
// TYPES
// ============================================

export type AuditAction =
  // Employee actions
  | "employee.create"
  | "employee.update"
  | "employee.terminate"
  | "employee.reactivate"
  | "employee.delete"
  // Accounting actions
  | "accounting.account_create"
  | "accounting.account_update"
  | "accounting.coa_initialize"
  | "accounting.journal_post"
  | "accounting.journal_void"
  | "accounting.period_create_year"
  | "accounting.period_close"
  | "accounting.period_reopen"
  | "accounting.period_lock"
  | "accounting.opening_balances_posted"
  // Payroll actions
  | "payroll.run"
  | "payroll.approve"
  | "payroll.reject"
  | "payroll.export"
  // Tax filing actions
  | "tax.wit_generated"
  | "tax.wit_filed"
  | "tax.wit_exported"
  | "tax.inss_generated"
  | "tax.inss_filed"
  | "tax.inss_exported"
  | "tax.annual_filed"
  // Document actions
  | "document.upload"
  | "document.delete"
  | "document.expire_alert"
  // Settings actions
  | "settings.update"
  | "settings.company_update"
  // User actions
  | "user.login"
  | "user.logout"
  | "user.password_change"
  | "user.permission_change"
  // Admin actions
  | "admin.user_create"
  | "admin.user_update"
  | "admin.user_delete"
  // Archive actions
  | "archive.create"
  | "archive.restore"
  | "archive.delete_permanent";

export type AuditModule =
  | "employee"
  | "accounting"
  | "payroll"
  | "tax"
  | "document"
  | "settings"
  | "user"
  | "admin"
  | "archive";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditLogEntry {
  id?: string;
  // Who
  userId: string;
  userEmail: string;
  userName?: string;
  // What
  action: AuditAction;
  module: AuditModule;
  description: string;
  // When
  timestamp: Date | Timestamp;
  // Where (context)
  tenantId?: string;
  entityId?: string;
  entityType?: string;
  // Details
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  changes?: {
    field: string;
    from: unknown;
    to: unknown;
  }[];
  metadata?: Record<string, unknown>;
  // Classification
  severity: AuditSeverity;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  // Tenant (required for tenant-scoped queries)
  tenantId: string;
  // Time range
  startDate?: Date;
  endDate?: Date;
  // Specific filters
  userId?: string;
  action?: AuditAction;
  module?: AuditModule;
  entityId?: string;
  entityType?: string;
  severity?: AuditSeverity;
  // Search
  searchTerm?: string;
  // Pagination
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;
}

export interface PaginatedAuditLogs {
  logs: AuditLogEntry[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

// ============================================
// COLLECTION REFERENCE
// ============================================


// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get module from action
 */
function getModuleFromAction(action: AuditAction): AuditModule {
  const prefix = action.split(".")[0];
  const moduleMap: Record<string, AuditModule> = {
    employee: "employee",
    accounting: "accounting",
    payroll: "payroll",
    tax: "tax",
    document: "document",
    settings: "settings",
    user: "user",
    admin: "admin",
    archive: "archive",
  };
  return moduleMap[prefix] || "admin";
}

/**
 * Get severity from action
 */
function getSeverityFromAction(action: AuditAction): AuditSeverity {
  const criticalActions: AuditAction[] = [
    "employee.delete",
    "employee.terminate",
    "accounting.journal_void",
    "payroll.approve",
    "admin.user_delete",
    "archive.delete_permanent",
  ];

  const warningActions: AuditAction[] = [
    "employee.update",
    "settings.update",
    "settings.company_update",
    "user.password_change",
    "user.permission_change",
    "tax.wit_filed",
  ];

  if (criticalActions.includes(action)) return "critical";
  if (warningActions.includes(action)) return "warning";
  return "info";
}

/**
 * Generate description from action and context
 */
function generateDescription(
  action: AuditAction,
  entityType?: string,
  entityName?: string
): string {
  const descriptions: Partial<Record<AuditAction, string>> = {
    "employee.create": `Created new employee${entityName ? `: ${entityName}` : ""}`,
    "employee.update": `Updated employee${entityName ? `: ${entityName}` : ""}`,
    "employee.terminate": `Terminated employee${entityName ? `: ${entityName}` : ""}`,
    "employee.reactivate": `Reactivated employee${entityName ? `: ${entityName}` : ""}`,
    "employee.delete": `Deleted employee${entityName ? `: ${entityName}` : ""}`,
    "accounting.account_create": `Created account${entityName ? `: ${entityName}` : ""}`,
    "accounting.account_update": `Updated account${entityName ? `: ${entityName}` : ""}`,
    "accounting.coa_initialize": `Initialized chart of accounts`,
    "accounting.journal_post": `Posted journal entry${entityName ? `: ${entityName}` : ""}`,
    "accounting.journal_void": `Voided journal entry${entityName ? `: ${entityName}` : ""}`,
    "accounting.period_create_year": `Created fiscal year${entityName ? `: ${entityName}` : ""}`,
    "accounting.period_close": `Closed fiscal period${entityName ? `: ${entityName}` : ""}`,
    "accounting.period_reopen": `Reopened fiscal period${entityName ? `: ${entityName}` : ""}`,
    "accounting.period_lock": `Locked fiscal period${entityName ? `: ${entityName}` : ""}`,
    "accounting.opening_balances_posted": `Posted opening balances${entityName ? ` for ${entityName}` : ""}`,
    "payroll.run": `Generated payroll run`,
    "payroll.approve": `Approved payroll run`,
    "payroll.reject": `Rejected payroll run`,
    "payroll.export": `Exported payroll data`,
    "tax.wit_generated": `Generated WIT return${entityName ? ` for ${entityName}` : ""}`,
    "tax.wit_filed": `Filed WIT return${entityName ? ` for ${entityName}` : ""}`,
    "tax.wit_exported": `Exported WIT return`,
    "tax.inss_generated": `Generated INSS return${entityName ? ` for ${entityName}` : ""}`,
    "tax.inss_filed": `Filed INSS return${entityName ? ` for ${entityName}` : ""}`,
    "tax.inss_exported": `Exported INSS return`,
    "tax.annual_filed": `Filed annual WIT return`,
    "document.upload": `Uploaded document${entityName ? `: ${entityName}` : ""}`,
    "document.delete": `Deleted document${entityName ? `: ${entityName}` : ""}`,
    "document.expire_alert": `Document expiry alert sent`,
    "settings.update": `Updated settings`,
    "settings.company_update": `Updated company details`,
    "user.login": `User logged in`,
    "user.logout": `User logged out`,
    "user.password_change": `User changed password`,
    "user.permission_change": `User permissions updated`,
    "admin.user_create": `Created new user`,
    "admin.user_update": `Updated user`,
    "admin.user_delete": `Deleted user`,
    "archive.create": `Created archive`,
    "archive.restore": `Restored from archive`,
    "archive.delete_permanent": `Permanently deleted archived data`,
  };

  return descriptions[action] || `Action: ${action}`;
}

// ============================================
// SERVICE
// ============================================

export const auditLogService = {
  /**
   * Log an action
   */
  async log(params: {
    userId: string;
    userEmail: string;
    userName?: string;
    action: AuditAction;
    entityId?: string;
    entityType?: string;
    entityName?: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    changes?: { field: string; from: unknown; to: unknown }[];
    metadata?: Record<string, unknown>;
    tenantId: string; // Required for tenant-scoped logging
    description?: string;
    severity?: AuditSeverity;
  }): Promise<string> {
    try {
      const entry: Omit<AuditLogEntry, "id"> = {
        userId: params.userId,
        userEmail: params.userEmail,
        userName: params.userName,
        action: params.action,
        module: getModuleFromAction(params.action),
        description:
          params.description ||
          generateDescription(params.action, params.entityType, params.entityName),
        timestamp: serverTimestamp() as Timestamp,
        tenantId: params.tenantId,
        entityId: params.entityId,
        entityType: params.entityType,
        oldValue: params.oldValue,
        newValue: params.newValue,
        changes: params.changes,
        metadata: params.metadata,
        severity: params.severity || getSeverityFromAction(params.action),
      };

      // Use tenant-scoped path
      const collectionPath = paths.auditLogs(params.tenantId);
      const docRef = await addDoc(collection(db, collectionPath), entry);
      return docRef.id;
    } catch (error) {
      console.error("Failed to log audit entry:", error);
      throw error;
    }
  },

  /**
   * Log employee action helper
   */
  async logEmployeeAction(params: {
    userId: string;
    userEmail: string;
    userName?: string;
    action: Extract<
      AuditAction,
      | "employee.create"
      | "employee.update"
      | "employee.terminate"
      | "employee.reactivate"
      | "employee.delete"
    >;
    employeeId: string;
    employeeName: string;
    changes?: { field: string; from: unknown; to: unknown }[];
    tenantId: string; // Required
  }): Promise<string> {
    return this.log({
      ...params,
      entityId: params.employeeId,
      entityType: "employee",
      entityName: params.employeeName,
    });
  },

  /**
   * Log payroll action helper
   */
  async logPayrollAction(params: {
    userId: string;
    userEmail: string;
    userName?: string;
    action: Extract<
      AuditAction,
      "payroll.run" | "payroll.approve" | "payroll.reject" | "payroll.export"
    >;
    payrollRunId: string;
    period?: string;
    metadata?: Record<string, unknown>;
    tenantId: string; // Required
  }): Promise<string> {
    return this.log({
      ...params,
      entityId: params.payrollRunId,
      entityType: "payroll_run",
      entityName: params.period,
    });
  },

  /**
   * Log tax filing action helper
   */
  async logTaxAction(params: {
    userId: string;
    userEmail: string;
    userName?: string;
    action: Extract<
      AuditAction,
      | "tax.wit_generated"
      | "tax.wit_filed"
      | "tax.wit_exported"
      | "tax.inss_generated"
      | "tax.inss_filed"
      | "tax.inss_exported"
      | "tax.annual_filed"
    >;
    filingId: string;
    period: string;
    metadata?: Record<string, unknown>;
    tenantId: string; // Required for tenant-scoped logging
  }): Promise<string> {
    return this.log({
      ...params,
      entityId: params.filingId,
      entityType: "tax_filing",
      entityName: params.period,
    });
  },

  /**
   * Get audit logs with filtering and pagination
   */
  async getLogs(filters: AuditLogFilters): Promise<PaginatedAuditLogs> {
    try {
      const constraints: QueryConstraint[] = [];

      // Add filters
      if (filters.userId) {
        constraints.push(where("userId", "==", filters.userId));
      }
      if (filters.action) {
        constraints.push(where("action", "==", filters.action));
      }
      if (filters.module) {
        constraints.push(where("module", "==", filters.module));
      }
      if (filters.entityId) {
        constraints.push(where("entityId", "==", filters.entityId));
      }
      if (filters.entityType) {
        constraints.push(where("entityType", "==", filters.entityType));
      }
      if (filters.severity) {
        constraints.push(where("severity", "==", filters.severity));
      }
      if (filters.startDate) {
        constraints.push(
          where("timestamp", ">=", Timestamp.fromDate(filters.startDate))
        );
      }
      if (filters.endDate) {
        constraints.push(
          where("timestamp", "<=", Timestamp.fromDate(filters.endDate))
        );
      }

      // Always order by timestamp descending
      constraints.push(orderBy("timestamp", "desc"));

      // Pagination
      const pageSize = filters.pageSize || 50;
      constraints.push(limit(pageSize + 1)); // Get one extra to check if there's more

      if (filters.startAfterDoc) {
        constraints.push(startAfter(filters.startAfterDoc));
      }

      // Use tenant-scoped path
      const collectionPath = paths.auditLogs(filters.tenantId);
      const q = query(collection(db, collectionPath), ...constraints);
      const snapshot = await getDocs(q);

      const logs: AuditLogEntry[] = [];
      let lastDoc: DocumentSnapshot | null = null;

      snapshot.docs.slice(0, pageSize).forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        } as AuditLogEntry);
        lastDoc = doc;
      });

      return {
        logs,
        lastDoc,
        hasMore: snapshot.docs.length > pageSize,
      };
    } catch (error) {
      console.error("Failed to get audit logs:", error);
      throw error;
    }
  },

  /**
   * Get a specific audit log entry
   */
  async getLog(tenantId: string, logId: string): Promise<AuditLogEntry | null> {
    try {
      const docRef = doc(db, paths.auditLogs(tenantId), logId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
      } as AuditLogEntry;
    } catch (error) {
      console.error("Failed to get audit log:", error);
      throw error;
    }
  },

  /**
   * Get logs for a specific entity
   */
  async getEntityHistory(
    tenantId: string,
    entityType: string,
    entityId: string,
    limit_ = 50
  ): Promise<AuditLogEntry[]> {
    const result = await this.getLogs({
      tenantId,
      entityType,
      entityId,
      pageSize: limit_,
    });
    return result.logs;
  },

  /**
   * Get recent logs for a user
   */
  async getUserActivity(tenantId: string, userId: string, limit_ = 20): Promise<AuditLogEntry[]> {
    const result = await this.getLogs({
      tenantId,
      userId,
      pageSize: limit_,
    });
    return result.logs;
  },

  /**
   * Get critical security events
   */
  async getSecurityEvents(tenantId: string, days = 7): Promise<AuditLogEntry[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.getLogs({
      tenantId,
      severity: "critical",
      startDate,
      pageSize: 100,
    });
    return result.logs;
  },

  /**
   * Export audit logs as CSV
   */
  async exportAsCSV(filters: AuditLogFilters): Promise<string> {
    // Get all matching logs (no pagination)
    const allLogs: AuditLogEntry[] = [];
    let lastDoc: DocumentSnapshot | null = null;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getLogs({
        ...filters,
        pageSize: 500,
        startAfterDoc: lastDoc || undefined,
      });
      allLogs.push(...result.logs);
      lastDoc = result.lastDoc;
      hasMore = result.hasMore;

      // Safety limit
      if (allLogs.length >= 10000) break;
    }

    // Build CSV
    const headers = [
      "Timestamp",
      "User",
      "Email",
      "Action",
      "Module",
      "Description",
      "Entity Type",
      "Entity ID",
      "Severity",
    ];

    const rows = allLogs.map((log) => [
      log.timestamp instanceof Date
        ? log.timestamp.toISOString()
        : new Date(log.timestamp as unknown as number).toISOString(),
      log.userName || "",
      log.userEmail,
      log.action,
      log.module,
      log.description,
      log.entityType || "",
      log.entityId || "",
      log.severity,
    ]);

    return [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
  },
};
