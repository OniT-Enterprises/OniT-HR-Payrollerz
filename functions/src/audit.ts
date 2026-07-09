import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  isSuperAdmin,
  requireAuth,
  requireSuperAdmin,
  requireTenantAdmin,
} from "./authz";

const db = getFirestore();

const TENANT_AUDIT_ACTIONS = new Set([
  "employee.create",
  "employee.update",
  "employee.terminate",
  "employee.reactivate",
  "employee.delete",
  "accounting.account_create",
  "accounting.account_update",
  "accounting.coa_initialize",
  "accounting.journal_post",
  "accounting.journal_void",
  "accounting.period_create_year",
  "accounting.period_close",
  "accounting.period_reopen",
  "accounting.period_lock",
  "accounting.opening_balances_posted",
  "payroll.run",
  "payroll.approve",
  "payroll.reject",
  "payroll.export",
  "tax.wit_generated",
  "tax.wit_filed",
  "tax.wit_exported",
  "tax.inss_generated",
  "tax.inss_filed",
  "tax.inss_exported",
  "tax.annual_filed",
  "document.upload",
  "document.delete",
  "document.expire_alert",
  "settings.update",
  "settings.company_update",
  "user.login",
  "user.logout",
  "user.password_change",
  "user.permission_change",
  "admin.user_create",
  "admin.user_update",
  "admin.user_delete",
  "archive.create",
  "archive.restore",
  "archive.delete_permanent",
]);

const ADMIN_AUDIT_ACTIONS = new Set([
  "tenant_created",
  "tenant_suspended",
  "tenant_reactivated",
  "tenant_deleted",
  "tenant_updated",
  "impersonation_started",
  "impersonation_ended",
  "user_superadmin_granted",
  "user_superadmin_revoked",
  "user_added_to_tenant",
  "user_removed_from_tenant",
]);

const CRITICAL_TENANT_ACTIONS = new Set([
  "employee.delete",
  "employee.terminate",
  "accounting.journal_void",
  "payroll.approve",
  "admin.user_delete",
  "archive.delete_permanent",
]);

const WARNING_TENANT_ACTIONS = new Set([
  "employee.update",
  "settings.update",
  "settings.company_update",
  "user.password_change",
  "user.permission_change",
  "tax.wit_filed",
]);

function requireString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new HttpsError("invalid-argument", `Invalid ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown, maxLength = 500): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new HttpsError("invalid-argument", "Invalid audit event value");
  }
  return value.trim();
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 2_000);
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [key.slice(0, 100), sanitizeValue(item, depth + 1)]),
    );
  }
  return String(value).slice(0, 2_000);
}

function getTenantAuditSeverity(action: string): "info" | "warning" | "critical" {
  if (CRITICAL_TENANT_ACTIONS.has(action)) return "critical";
  if (WARNING_TENANT_ACTIONS.has(action)) return "warning";
  return "info";
}

function withoutUndefined(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

/**
 * Writes tenant audit events with server-derived actor and timestamp. Clients
 * may describe an operation but cannot impersonate another user or backdate it.
 */
export const recordTenantAuditEvent = onCall(async (request) => {
  const auth = requireAuth(request);
  const data = request.data as Record<string, unknown>;
  const tenantId = requireString(data.tenantId, "tenantId", 128);
  const action = requireString(data.action, "action", 128);

  if (!TENANT_AUDIT_ACTIONS.has(action)) {
    throw new HttpsError("invalid-argument", "Unsupported audit action");
  }

  if (!(await isSuperAdmin(auth.uid, auth.token))) {
    await requireTenantAdmin(tenantId, auth.uid);
  }

  const docRef = await db.collection(`tenants/${tenantId}/auditLogs`).add(withoutUndefined({
    userId: auth.uid,
    userEmail: typeof auth.token.email === "string" ? auth.token.email : "",
    userName: typeof auth.token.name === "string" ? auth.token.name : undefined,
    action,
    module: action.split(".")[0],
    description: requireString(data.description, "description", 2_000),
    timestamp: FieldValue.serverTimestamp(),
    tenantId,
    entityId: optionalString(data.entityId),
    entityType: optionalString(data.entityType),
    oldValue: data.oldValue === undefined ? undefined : sanitizeValue(data.oldValue),
    newValue: data.newValue === undefined ? undefined : sanitizeValue(data.newValue),
    changes: data.changes === undefined ? undefined : sanitizeValue(data.changes),
    metadata: data.metadata === undefined ? undefined : sanitizeValue(data.metadata),
    severity: getTenantAuditSeverity(action),
  }));

  return { id: docRef.id };
});

/** Writes platform audit events with a server-derived superadmin identity. */
export const recordAdminAuditEvent = onCall(async (request) => {
  const auth = requireAuth(request);
  await requireSuperAdmin(auth.uid, auth.token);

  const data = request.data as Record<string, unknown>;
  const action = requireString(data.action, "action", 128);
  if (!ADMIN_AUDIT_ACTIONS.has(action)) {
    throw new HttpsError("invalid-argument", "Unsupported admin audit action");
  }

  const docRef = await db.collection("adminAuditLog").add(withoutUndefined({
    action,
    actorUid: auth.uid,
    actorEmail: typeof auth.token.email === "string" ? auth.token.email : "",
    targetType: requireString(data.targetType, "targetType", 32),
    targetId: requireString(data.targetId, "targetId", 256),
    targetName: optionalString(data.targetName),
    details: data.details === undefined ? undefined : sanitizeValue(data.details),
    timestamp: FieldValue.serverTimestamp(),
    triggeredBy: "user",
  }));

  return { id: docRef.id };
});
