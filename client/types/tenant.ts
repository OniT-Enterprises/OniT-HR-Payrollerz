/**
 * TypeScript types for multi-tenant structure and RBAC
 */

import { FirestoreTimestamp } from './firebase';

// Tenant status for SaaS management
export type TenantStatus = 'active' | 'suspended' | 'pending' | 'cancelled';

// Subscription plans
export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';

// Core tenant types
export interface TenantConfig {
  id: string;
  name: string;
  slug?: string;

  // SaaS management fields
  status: TenantStatus;
  plan: TenantPlan;

  // Billing information
  billingEmail?: string;
  stripeCustomerId?: string;

  // Plan limits
  limits?: {
    maxEmployees: number;
    maxUsers: number;
    storageGB: number;
  };

  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  features?: {
    hiring?: boolean;
    timeleave?: boolean;
    performance?: boolean;
    payroll?: boolean;
    money?: boolean;
    accounting?: boolean;
    reports?: boolean;
    ngoReporting?: boolean;
  };
  payrollPolicy?: {
    overtimeThreshold?: number; // hours per week
    overtimeRate?: number; // multiplier (e.g., 1.5)
    payrollCycle?: 'weekly' | 'biweekly' | 'monthly';
  };
  settings?: {
    timezone?: string;
    currency?: string;
    dateFormat?: string;
  };

  // Audit fields
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  createdBy?: string; // uid of creator (superadmin or self-service)

  // Suspension tracking
  suspendedAt?: FirestoreTimestamp;
  suspendedBy?: string;
  suspendedReason?: string;
}

// Default plan limits
export const PLAN_LIMITS: Record<TenantPlan, TenantConfig['limits']> = {
  free: { maxEmployees: 5, maxUsers: 2, storageGB: 1 },
  starter: { maxEmployees: 25, maxUsers: 5, storageGB: 5 },
  professional: { maxEmployees: 100, maxUsers: 20, storageGB: 25 },
  enterprise: { maxEmployees: 999999, maxUsers: 999999, storageGB: 100 },
};

// RBAC types
export type TenantRole = 'owner' | 'hr-admin' | 'manager' | 'viewer';

export type ModulePermission = 
  | 'hiring' 
  | 'staff' 
  | 'timeleave' 
  | 'performance' 
  | 'payroll' 
  | 'money'
  | 'accounting'
  | 'reports';

export interface TenantMember {
  uid: string;
  role: TenantRole;
  modules?: ModulePermission[];
  email?: string;
  displayName?: string;
  employeeId?: string;
  departmentId?: string;
  joinedAt?: FirestoreTimestamp;
  lastActiveAt?: FirestoreTimestamp;
  permissions?: {
    [key: string]: boolean;
  };
}

// Custom claims structure for Firebase Auth
// tenants is a map of { tenantId: role } for firestore.rules fast-path authorization
export interface CustomClaims {
  tenants: Record<string, TenantRole>;
  [key: string]: unknown;
}

// Session context types
export interface TenantSession {
  tid: string;
  role: TenantRole;
  modules: ModulePermission[];
  config: TenantConfig;
  member: TenantMember;
}

// Default RBAC matrix
export const DEFAULT_ROLE_PERMISSIONS: Record<TenantRole, ModulePermission[]> = {
  owner: ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'money', 'accounting', 'reports'],
  'hr-admin': ['hiring', 'staff', 'timeleave', 'payroll', 'performance', 'money', 'accounting', 'reports'],
  manager: ['staff', 'timeleave', 'performance'], // Limited to own team
  viewer: [], // Read-only access, defined by explicit modules
};

// Permission check helpers
export const hasModulePermission = (
  role: TenantRole,
  modules: ModulePermission[] | undefined,
  requiredModule: ModulePermission
): boolean => {
  const effectiveModules =
    modules && modules.length > 0
      ? modules
      : DEFAULT_ROLE_PERMISSIONS[role] ?? [];
  return effectiveModules.includes(requiredModule);
};
