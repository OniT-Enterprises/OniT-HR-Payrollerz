 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Multi-Tenancy SaaS Implementation Plan

 Overview

 Add superadmin capabilities to transform OniT HR/Payroll into a multi-tenant
 SaaS platform with:
 - Superadmin users identified by database flag (isSuperAdmin: true)
 - Tenant management (CRUD, suspend/activate)
 - Impersonation (superadmin can switch into any tenant)
 - Self-service + admin tenant creation

 Current State (Already Implemented)

 - TenantContext with roles: owner, hr-admin, manager, viewer
 - TenantConfig, TenantMember types in client/types/tenant.ts
 - Firestore paths helper in client/lib/paths.ts
 - Basic admin route at /admin/seed

 ---
 Phase 1: Foundation

 1.1 Create User Profile Type

 File: client/types/user.ts (NEW)
 export interface UserProfile {
   uid: string;
   email: string;
   displayName?: string;
   isSuperAdmin: boolean;
   tenantIds: string[];
   createdAt: Timestamp;
   impersonating?: { tenantId: string; startedAt: Timestamp } | null;
 }

 1.2 Update AuthContext

 File: client/contexts/AuthContext.tsx
 - Add isSuperAdmin: boolean to context
 - Fetch /users/{uid} document on auth state change
 - Check custom claims superadmin: true (fast path)
 - Add refreshUserProfile() method

 1.3 Enhance TenantConfig for SaaS

 File: client/types/tenant.ts
 - Add: status: 'active' | 'suspended' | 'pending'
 - Add: plan: 'free' | 'starter' | 'professional' | 'enterprise'
 - Add: createdBy: string, createdAt, suspendedAt?, suspendedReason?

 1.4 Update Firestore Paths

 File: client/lib/paths.ts
 - Add: users: () => 'users'
 - Add: user: (uid) => 'users/${uid}'
 - Add: adminAuditLog: () => 'adminAuditLog'

 ---
 Phase 2: Route Protection

 2.1 Create ProtectedRoute Component

 File: client/components/auth/ProtectedRoute.tsx (NEW)
 - Wraps routes requiring authentication
 - Checks auth state, redirects to login if not authenticated
 - Optionally checks tenant membership and module permissions

 2.2 Create SuperadminRoute Component

 File: client/components/auth/SuperadminRoute.tsx (NEW)
 - Wraps admin routes
 - Checks isSuperAdmin from AuthContext
 - Redirects non-superadmins to /unauthorized

 2.3 Update App.tsx Routes

 File: client/App.tsx
 - Wrap all protected routes with <ProtectedRoute>
 - Wrap /admin/* routes with <SuperadminRoute>
 - Add new admin routes (see Phase 3)

 ---
 Phase 3: Admin Pages

 3.1 Admin Layout

 File: client/components/layout/AdminLayout.tsx (NEW)
 - Admin-specific sidebar navigation
 - Impersonation banner (when active)

 3.2 Admin Pages

 Directory: client/pages/admin/
 Page: SuperadminDashboard.tsx
 Route: /admin
 Purpose: Stats overview, quick actions
 ────────────────────────────────────────
 Page: TenantList.tsx
 Route: /admin/tenants
 Purpose: List all tenants with search/filter
 ────────────────────────────────────────
 Page: TenantDetail.tsx
 Route: /admin/tenants/:id
 Purpose: View/edit tenant, impersonate button
 ────────────────────────────────────────
 Page: CreateTenant.tsx
 Route: /admin/tenants/new
 Purpose: Create new tenant form
 ────────────────────────────────────────
 Page: UserList.tsx
 Route: /admin/users
 Purpose: All users across tenants
 ────────────────────────────────────────
 Page: AuditLog.tsx
 Route: /admin/audit
 Purpose: Admin action history
 3.3 Update Navigation

 File: client/components/layout/MainNavigation.tsx
 - Add "Admin Console" link in user menu (visible only to superadmins)

 ---
 Phase 4: Impersonation

 4.1 Update TenantContext

 File: client/contexts/TenantContext.tsx
 - Add state: isImpersonating, impersonatedTenantId
 - Add methods: startImpersonation(tenantId), stopImpersonation()
 - When superadmin, bypass membership checks for impersonated tenant
 - Store impersonation state in user profile document

 4.2 Impersonation Banner

 File: client/components/layout/ImpersonationBanner.tsx (NEW)
 - Warning banner shown when impersonating
 - Shows tenant name, "Exit Impersonation" button
 - Fixed at top of page

 4.3 Update useTenantId Hook

 File: client/contexts/TenantContext.tsx
 - Return impersonated tenant ID when superadmin is impersonating

 ---
 Phase 5: Firestore Security Rules

 5.1 Update Security Rules

 File: firestore.rules

 Key rules:
 function isSuperAdmin() {
   return request.auth.token.superadmin == true ||
     get(/users/$(request.auth.uid)).data.isSuperAdmin == true;
 }

 function isTenantMember(tenantId) {
   return exists(/tenants/$(tenantId)/members/$(request.auth.uid));
 }

 // Superadmins can access all tenant data
 // Regular users can only access their tenant's data
 // Users cannot modify their own isSuperAdmin flag

 ---
 Phase 6: Service Updates

 6.1 Create Admin Service

 File: client/services/adminService.ts (NEW)
 - getAllTenants(), getTenantById(), createTenant(), updateTenant()
 - suspendTenant(), reactivateTenant()
 - getAllUsers(), setUserSuperadmin()
 - logAdminAction(), getAuditLog()

 6.2 Update Existing Services to Use Tenant Paths

 Services to update (add tenantId parameter, use paths.ts):
 - client/services/employeeService.ts
 - client/services/departmentService.ts
 - client/services/candidateService.ts
 - client/services/payrollService.ts
 - client/services/attendanceService.ts
 - client/services/settingsService.ts
 - client/services/accountingService.ts

 ---
 Phase 7: Self-Service Signup (Optional)

 7.1 Signup Page

 File: client/pages/auth/Signup.tsx (NEW)
 - Create Firebase Auth account
 - Create tenant document
 - Create owner membership
 - Redirect to dashboard

 ---
 Critical Files Summary
 ┌──────────────────────────────────────────────────┬──────────────────┐
 │                       File                       │      Action      │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/types/user.ts                             │ CREATE           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/types/tenant.ts                           │ MODIFY           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/contexts/AuthContext.tsx                  │ MODIFY           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/contexts/TenantContext.tsx                │ MODIFY           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/lib/paths.ts                              │ MODIFY           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/components/auth/ProtectedRoute.tsx        │ CREATE           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/components/auth/SuperadminRoute.tsx       │ CREATE           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/components/layout/AdminLayout.tsx         │ CREATE           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/components/layout/ImpersonationBanner.tsx │ CREATE           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/components/layout/MainNavigation.tsx      │ MODIFY           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/pages/admin/*.tsx                         │ CREATE (6 files) │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/services/adminService.ts                  │ CREATE           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ client/App.tsx                                   │ MODIFY           │
 ├──────────────────────────────────────────────────┼──────────────────┤
 │ firestore.rules                                  │ MODIFY           │
 └──────────────────────────────────────────────────┴──────────────────┘
 ---
 Verification Plan

 1. Create superadmin user: Manually set isSuperAdmin: true in Firestore
 2. Test admin access: Login as superadmin, verify admin pages load
 3. Test tenant list: Verify all tenants are listed
 4. Test create tenant: Create new tenant, verify it appears
 5. Test impersonation: Impersonate a tenant, verify banner shows, verify data
 loads
 6. Test exit impersonation: Return to admin view
 7. Test regular user: Login as non-superadmin, verify admin routes blocked
 8. Test Firestore rules: Verify regular users cannot access other tenants'
 data

 ---
 Implementation Order

 1. User types + paths (foundation)
 2. AuthContext updates (superadmin detection)
 3. Route protection components
 4. Firestore security rules (CRITICAL for security)
 5. Admin pages (TenantList first)
 6. Impersonation feature
 7. Service updates (parallel with above)
 8. Self-service signup (after core is stable)
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌