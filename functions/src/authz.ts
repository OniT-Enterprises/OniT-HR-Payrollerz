import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

export type TenantRole = "owner" | "hr-admin" | "manager" | "viewer";

export interface TenantMemberData {
  role?: string;
  modules?: string[];
  [key: string]: unknown;
}

export interface AuthContext {
  uid: string;
  token: Record<string, unknown>;
}

export interface CallableRequestLike {
  auth?: {
    uid?: string;
    token?: Record<string, unknown>;
  } | null;
}

export function requireAuth(request: CallableRequestLike): AuthContext {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  return {
    uid: request.auth.uid,
    token: (request.auth.token ?? {}) as Record<string, unknown>,
  };
}

export async function requireTenantMember(
  tenantId: string,
  uid: string,
): Promise<TenantMemberData> {
  const memberDoc = await getFirestore()
    .doc(`tenants/${tenantId}/members/${uid}`)
    .get();

  if (!memberDoc.exists) {
    throw new HttpsError("permission-denied", "User is not a member of this tenant");
  }

  return memberDoc.data() as TenantMemberData;
}

export async function requireTenantRoles(
  tenantId: string,
  uid: string,
  allowedRoles: TenantRole[],
  errorMessage: string = "Insufficient permissions for this tenant operation",
): Promise<TenantMemberData> {
  const member = await requireTenantMember(tenantId, uid);
  const role = member.role;

  if (typeof role !== "string" || !allowedRoles.includes(role as TenantRole)) {
    throw new HttpsError("permission-denied", errorMessage);
  }

  return member;
}

export async function requireTenantAdmin(
  tenantId: string,
  uid: string,
): Promise<TenantMemberData> {
  return requireTenantRoles(
    tenantId,
    uid,
    ["owner", "hr-admin"],
    "Only tenant owners or HR admins can perform this action",
  );
}

export async function requireTenantManagerOrAdmin(
  tenantId: string,
  uid: string,
): Promise<TenantMemberData> {
  return requireTenantRoles(
    tenantId,
    uid,
    ["owner", "hr-admin", "manager"],
    "Only tenant managers or admins can perform this action",
  );
}

export function hasModuleAccess(
  member: TenantMemberData,
  moduleName: string,
): boolean {
  if (!Array.isArray(member.modules)) {
    return false;
  }

  return member.modules.some(
    (module) => typeof module === "string" && module === moduleName,
  );
}

export async function isSuperAdmin(
  uid: string,
  token: Record<string, unknown> = {},
): Promise<boolean> {
  if (token.superadmin === true) {
    return true;
  }

  const userDoc = await getFirestore().collection("users").doc(uid).get();
  return userDoc.data()?.isSuperAdmin === true;
}

export async function requireSuperAdmin(
  uid: string,
  token: Record<string, unknown> = {},
): Promise<void> {
  const superadmin = await isSuperAdmin(uid, token);
  if (!superadmin) {
    throw new HttpsError("permission-denied", "Only superadmins can perform this action");
  }
}
