# Multi-Tenant HR & Payroll SaaS - Architecture Guide

This document describes the complete multi-tenant architecture implementation for the HR & Payroll SaaS application, including security, RBAC, tenant isolation, and migration procedures.

## 🏗️ Architecture Overview

The application has been restructured from a single-tenant to a multi-tenant SaaS platform with the following key features:

- **Complete Tenant Isolation**: All business data is scoped to tenants
- **Role-Based Access Control (RBAC)**: Granular permissions per tenant and module
- **Secure Firestore Rules**: Enforced tenant boundaries and permission checks
- **Tenant Switching**: Users can belong to multiple organizations
- **Clean Data Layer**: Typed hooks and functions for all tenant operations

## 📁 Firestore Structure

### Root Level
```
/tenants/{tid}                           // Tenant root document
/reference/{document}                    // Global read-only data (holidays, tax rates)
```

### Tenant-Scoped Collections
```
/tenants/{tid}/
  ├── settings/config                    // Tenant configuration and branding
  ├── members/{uid}                      // User roles and permissions
  ├── departments/{deptId}               // Department hierarchy
  ├── employees/{empId}                  // Employee records
  ├── positions/{posId}                  // Job positions and grades
  ├── jobs/{jobId}                       // Job postings
  ├── candidates/{candId}                // Hiring candidates
  ├── interviews/{intId}                 // Interview scheduling
  ├── offers/{offerId}                   // Job offers
  ├── contracts/{contractId}             // Employment contracts
  ├── employmentSnapshots/{snapId}       // Immutable employment history
  ├── rosters/{yyyy-mm}/shifts/{shiftId} // Work schedules
  ├── timesheets/{empId_weekIso}         // Time tracking
  ├── leavePolicies/{policyId}           // Leave policies
  ├── leaveRequests/{reqId}              // Leave applications
  ├── leaveBalances/{empId_year}         // Leave balances
  ├── goals/{goalId}                     // Performance goals
  ├── reviews/{reviewId}                 // Performance reviews
  ├── trainings/{trainingId}             // Training records
  ├── discipline/{disciplineId}          // Disciplinary actions
  ├── promotionSignals/{year_q}/{empId}  // Promotion recommendations
  ├── payruns/{yyyymm}/payslips/{empId}  // Payroll data
  └── analytics/{docId}                  // Cached analytics
```

### ID Conventions
- **ULIDs**: Used for most document IDs
- **Period-based**: `{empId}_{weekIso}` for timesheets, `{yyyyMM}` for payruns
- **Hierarchical**: `{yyyy-mm}` for roster periods, `{year_q}` for promotion cycles

## 🔐 Security & RBAC

### Tenant Roles
| Role | Description | Default Modules |
|------|-------------|-----------------|
| `owner` | Full administrative access | All modules |
| `hr-admin` | HR operations and management | hiring, staff, timeleave, payroll, performance, reports |
| `manager` | Team and department management | staff, timeleave, performance (limited scope) |
| `viewer` | Read-only access | Defined by explicit module grants |

### Module Permissions
- `hiring` - Job posting, candidate management, interviews
- `staff` - Employee management, departments, org chart
- `timeleave` - Time tracking, schedules, leave requests
- `performance` - Reviews, goals, training, discipline
- `payroll` - Payroll processing, tax reports, benefits
- `reports` - Analytics and reporting across modules

### Custom Claims Structure
```typescript
{
  tenants: ["tenant-a", "tenant-b"],  // Accessible tenant IDs
  role: "hr-admin"                    // Primary role
}
```

### Member Document Structure
```typescript
{
  uid: "user-id",
  role: "hr-admin",
  modules: ["hiring", "staff", "timeleave"],
  email: "user@company.com",
  displayName: "John Doe",
  joinedAt: Timestamp,
  lastActiveAt: Timestamp
}
```

## 🛡️ Firestore Security Rules

The security rules enforce:

1. **Tenant Isolation**: Users can only access data within their authorized tenants
2. **Role-Based Permissions**: Write operations restricted based on role
3. **Module Access Control**: Read/write permissions per module
4. **Cross-Tenant Prevention**: No data leakage between tenants
5. **Reference Data Access**: Global read-only data available to all

### Key Rule Functions
```javascript
function hasTenant(tid) { 
  return authed() && tid in request.auth.token.tenants; 
}

function isTenantMember(tid) {
  return authed() && 
         exists(/databases/$(database)/documents/tenants/$(tid)/members/$(request.auth.uid));
}

function isOwnerOrAdmin(tid) {
  return isTenantMember(tid) && 
         getTenantRole(tid) in ['owner', 'hr-admin'];
}
```

## 🔄 Data Layer

### Path Helpers (`client/lib/paths.ts`)
Centralized path generation for all Firestore operations:
```typescript
import { paths } from '@/lib/paths';

// ✅ Correct - using path helpers
const depts = await getDocs(collection(db, paths.departments(tid)));

// ❌ Incorrect - inline paths
const depts = await getDocs(collection(db, `tenants/${tid}/departments`));
```

### Typed Data Functions (`client/lib/data.ts`)
```typescript
// Core CRUD operations
export const listEmployees = async (tid: string, options?: ListEmployeesOptions): Promise<Employee[]>
export const createJob = async (tid: string, job: Omit<Job, 'id'>): Promise<string>
export const updateDepartment = async (tid: string, id: string, updates: Partial<Department>): Promise<void>

// React Query hooks
export const useEmployees = (tid?: string, options?: ListEmployeesOptions)
export const useTenantCreateJob = () // Auto-uses current tenant from context
```

### Tenant Context Usage
```typescript
import { useTenant } from '@/contexts/TenantContext';

function MyComponent() {
  const { session, hasModule, canWrite } = useTenant();
  
  // Auto-scoped to current tenant
  const { data: employees } = useTenantEmployees();
  const createJob = useTenantCreateJob();
  
  if (!hasModule('hiring')) return <NoAccess />;
  
  // Component logic...
}
```

## 🚀 Getting Started

### 1. Tenant Provisioning

Create a new tenant using the Cloud Function:

```typescript
// Call the provisionTenant function
const result = await functions.httpsCallable('provisionTenant')({
  name: 'Acme Corporation',
  ownerEmail: 'admin@acme.com',
  slug: 'acme-corp', // Optional
  config: {
    branding: {
      logoUrl: 'https://acme.com/logo.png',
      primaryColor: '#007bff'
    },
    features: {
      hiring: true,
      payroll: true,
      // ... other features
    },
    settings: {
      timezone: 'America/New_York',
      currency: 'USD'
    }
  }
});

console.log('Tenant created:', result.data.tenantId);
```

### 2. Adding Tenant Members

```typescript
// Add a new member to existing tenant
const result = await functions.httpsCallable('addTenantMember')({
  tenantId: 'tenant-123',
  userEmail: 'hr@company.com',
  role: 'hr-admin',
  modules: ['hiring', 'staff', 'timeleave']
});
```

### 3. Migration from Single-Tenant

If you have existing root-level data, use the migration script:

```bash
# Dry run to see what would be migrated
npm run migrate:tenant -- --tenant-id=my-company --dry-run --verbose

# Actual migration
npm run migrate:tenant -- --tenant-id=my-company

# Migration with cleanup (deletes originals)
npm run migrate:tenant -- --tenant-id=my-company --delete-originals
```

## 🧪 Testing

### Emulator Tests

Run security rule tests:
```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# Run tenant isolation tests
npm run emul:rules
```

### Test Coverage

The test suite verifies:
- ✅ Tenant data isolation
- ✅ Cross-tenant access prevention  
- ✅ Role-based permission enforcement
- ✅ Module-level access control
- ✅ Reference data accessibility
- ✅ Write operation restrictions

## 📊 Required Firestore Indexes

Create these composite indexes in the Firebase Console:

```javascript
// Employees by department
Collection: tenants/{tid}/employees
Fields: departmentId (asc), personalInfo.lastName (asc)

// Jobs by status and department  
Collection: tenants/{tid}/jobs
Fields: status (asc), departmentId (asc), createdAt (desc)

// Shifts by employee and date
Collection: tenants/{tid}/rosters/{yyyy-mm}/shifts  
Fields: employeeId (asc), date (asc)

// Timesheets by employee
Collection: tenants/{tid}/timesheets
Fields: empId (asc), weekIso (asc)

// Leave requests by employee and status
Collection: tenants/{tid}/leaveRequests
Fields: empId (asc), status (asc), createdAt (desc)

// Candidates by job and stage
Collection: tenants/{tid}/candidates
Fields: jobId (asc), stage (asc), appliedDate (desc)
```

## 🔧 Development Workflow

### 1. Adding New Features

When adding tenant-scoped features:

1. **Define types** in `client/types/tenant.ts`
2. **Add paths** in `client/lib/paths.ts`  
3. **Create data functions** in `client/lib/data.ts`
4. **Update security rules** in `firestore.rules`
5. **Add tests** in `tests/rules/`

### 2. Component Development

```typescript
// ✅ Recommended pattern
import { useTenant } from '@/contexts/TenantContext';
import { useTenantEmployees } from '@/lib/data';

function EmployeeList() {
  const { session, hasModule } = useTenant();
  const { data: employees, isLoading } = useTenantEmployees();
  
  if (!hasModule('staff')) {
    return <PermissionDenied module="staff" />;
  }
  
  // Component implementation
}
```

### 3. Permission Checks

```typescript
// Check module access
if (!hasModule('hiring')) return <NoAccess />;

// Check write permissions  
if (!canWrite()) return <ReadOnlyView />;

// Check management permissions
if (!canManage()) return <LimitedAccess />;
```

## 🚢 Deployment

### 1. Deploy Security Rules

```bash
# Deploy updated Firestore rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

### 2. Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific functions
firebase deploy --only functions:provisionTenant,addTenantMember
```

### 3. Environment Variables

Set up the following environment variables:

```bash
# Firebase project configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key

# Optional: Custom domain for tenant switching
TENANT_DOMAIN=your-domain.com
```

## 🔍 Monitoring & Analytics

### Key Metrics to Track

1. **Tenant Activity**: Active tenants, user sessions per tenant
2. **Permission Denials**: Security rule violations, unauthorized access attempts
3. **Data Growth**: Documents per tenant, storage usage
4. **Performance**: Query latency, function execution time

### Logging

The application logs:
- Tenant switching events
- Permission checks and denials
- Data access patterns
- Migration progress

## 🛠️ Troubleshooting

### Common Issues

**Permission Denied Errors**
```bash
# Check custom claims
firebase auth:export users.json
# Verify tenants array in custom claims

# Redeploy security rules
firebase deploy --only firestore:rules
```

**Migration Issues**
```bash
# Run with verbose logging
npm run migrate:tenant -- --tenant-id=my-tenant --dry-run --verbose

# Check source data
firebase firestore:get /departments --limit 5
```

**Missing Data Access**
```typescript
// Verify tenant context
const { session } = useTenant();
console.log('Current tenant:', session?.tid);
console.log('User modules:', session?.modules);
```

### Performance Optimization

1. **Use pagination** for large collections
2. **Implement caching** for frequently accessed data
3. **Optimize queries** with proper indexing
4. **Batch operations** for bulk updates

## 🚧 Future Enhancements

### Planned Features

1. **Tenant Subddomains**: `acme.yourapp.com` routing
2. **Advanced RBAC**: Custom roles and fine-grained permissions
3. **Data Export**: Tenant data portability and GDPR compliance
4. **Audit Logging**: Complete action history per tenant
5. **White-labeling**: Full customization per tenant
6. **Multi-region**: Tenant data residency options

### Migration Path

The current architecture supports:
- Seamless scaling to thousands of tenants
- Role-based feature flags
- Incremental permission model updates
- Zero-downtime tenant provisioning

## 📚 Additional Resources

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Custom Claims Guide](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Multi-tenant SaaS Best Practices](https://firebase.google.com/docs/firestore/solutions/shard-timestamp)
- [React Query Documentation](https://tanstack.com/query/latest)

---

For technical support or questions about the multi-tenant implementation, please refer to the development team or create an issue in the project repository.
