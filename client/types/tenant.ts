/**
 * TypeScript types for multi-tenant structure and RBAC
 */

import { FirestoreTimestamp } from './firebase';
import type { ForeignWorkerData } from './tax-filing';

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

// Department types
export interface Department {
  id?: string;
  name: string;
  description?: string;
  managerId?: string;
  parentDepartmentId?: string;
  budget?: number;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// Employee types
export interface Employee {
  id?: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    phoneApp: string;
    appEligible: boolean;
    address: string;
    dateOfBirth: string;
    socialSecurityNumber: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
  jobDetails: {
    employeeId: string;
    department: string;
    position: string;
    hireDate: string;
    employmentType: string;
    workLocation: string;
    manager: string;
  };
  compensation: {
    monthlySalary: number;
    annualLeaveDays: number;
    benefitsPackage: string;
  };
  documents: {
    employeeIdCard: { number: string; expiryDate: string; required: boolean };
    socialSecurityNumber: { number: string; expiryDate: string; required: boolean };
    electoralCard: { number: string; expiryDate: string; required: boolean };
    idCard: { number: string; expiryDate: string; required: boolean };
    passport: { number: string; expiryDate: string; required: boolean };
    workContract: { fileUrl: string; uploadDate: string };
    nationality: string;
    workingVisaResidency: { number: string; expiryDate: string; fileUrl: string };
  };
  status: 'active' | 'inactive' | 'terminated';
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  // Tenant-specific fields
  departmentId: string;
  managerId?: string;
  // Foreign worker tracking (optional - only for non-resident employees)
  isForeignWorker?: boolean;
  foreignWorker?: ForeignWorkerData;
}

// Position types
export interface Position {
  id?: string;
  title: string;
  grade?: string;
  baseMonthlyUSD: number;
  leaveDaysPerYear: number;
  departmentId?: string;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// Job posting types
export interface Job {
  id?: string;
  title: string;
  description?: string;
  departmentId: string;
  hiringManagerId: string;
  approverMode: 'department' | 'name';
  approverDepartmentId?: string;
  approverId: string;
  status: 'draft' | 'open' | 'closed';
  positionId?: string;
  requirements?: string[];
  benefits?: string[];
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  location?: string;
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'intern';
  postedDate?: FirestoreTimestamp;
  closingDate?: FirestoreTimestamp;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// Candidate types
export interface Candidate {
  id?: string;
  jobId: string;
  name: string;
  email?: string;
  phone?: string;
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  resume?: {
    fileUrl: string;
    fileName: string;
    uploadDate: FirestoreTimestamp;
  };
  notes?: string;
  appliedDate?: FirestoreTimestamp;
  lastUpdated?: FirestoreTimestamp;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// Contract types
export interface Contract {
  id?: string;
  employeeId: string;
  positionId: string;
  startDate: string;
  endDate?: string;
  weeklyHours: number;
  overtimeRate: number;
  status: 'active' | 'expired' | 'terminated';
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// Filter and query options
export interface ListEmployeesOptions {
  departmentId?: string;
  status?: Employee['status'];
  managerId?: string;
  limit?: number;
  offset?: number;
}

export interface ListJobsOptions {
  departmentId?: string;
  status?: Job['status'];
  hiringManagerId?: string;
  limit?: number;
  offset?: number;
}

export interface ListShiftsOptions {
  employeeId?: string;
  dateRange?: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  limit?: number;
  offset?: number;
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
