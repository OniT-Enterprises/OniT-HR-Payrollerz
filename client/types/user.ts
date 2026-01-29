/**
 * User profile types for platform-level user management
 * Separate from tenant-scoped data - this is for superadmin and platform features
 */

import { Timestamp } from 'firebase/firestore';

// Denormalized tenant access info for quick loading
export interface TenantAccessInfo {
  name: string;
  role: 'owner' | 'hr-admin' | 'manager' | 'viewer';
}

// Platform-level user profile stored in /users/{uid}
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;

  // Superadmin flag - grants access to all tenants
  isSuperAdmin: boolean;

  // List of tenant IDs user belongs to (denormalized for quick access)
  tenantIds: string[];

  // Denormalized tenant access data - reduces N×2 Firestore reads to 1
  // Key: tenantId, Value: { name, role }
  // Updated by membership management functions
  tenantAccess?: Record<string, TenantAccessInfo>;

  // Audit fields
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;

  // Impersonation state (superadmin only)
  // When set, the superadmin is viewing as this tenant
  impersonating?: {
    tenantId: string;
    tenantName?: string;
    startedAt: Timestamp;
  } | null;
}

// Admin audit log entry
export interface AdminAuditEntry {
  id?: string;
  action: AdminAuditAction;
  actorUid: string;
  actorEmail: string;
  targetType: 'tenant' | 'user';
  targetId: string;
  targetName?: string;
  details?: Record<string, any>;
  timestamp: Timestamp;
  ipAddress?: string;
  // Additional fields for UI compatibility
  performedBy?: string;
  performedByEmail?: string;
  tenantId?: string;
  tenantName?: string;
  targetUserId?: string;
  targetEmail?: string;
  triggeredBy?: 'system' | 'user';
}

// Alias for audit log viewer
export type AuditLogEntry = AdminAuditEntry;

export type AdminAuditAction =
  | 'tenant_created'
  | 'tenant_suspended'
  | 'tenant_reactivated'
  | 'tenant_deleted'
  | 'tenant_updated'
  | 'impersonation_started'
  | 'impersonation_ended'
  | 'user_superadmin_granted'
  | 'user_superadmin_revoked'
  | 'user_added_to_tenant'
  | 'user_removed_from_tenant';

// Helper to create initial user profile
export function createUserProfile(
  uid: string,
  email: string,
  displayName?: string
): Omit<UserProfile, 'createdAt' | 'updatedAt'> {
  return {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    isSuperAdmin: false,
    tenantIds: [],
    impersonating: null,
  };
}

// Type guard for checking if user is superadmin
export function isSuperAdmin(profile: UserProfile | null): boolean {
  return profile?.isSuperAdmin === true;
}
