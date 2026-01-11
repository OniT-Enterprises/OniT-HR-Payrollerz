/**
 * User profile types for platform-level user management
 * Separate from tenant-scoped data - this is for superadmin and platform features
 */

import { Timestamp } from 'firebase/firestore';

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
}

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
