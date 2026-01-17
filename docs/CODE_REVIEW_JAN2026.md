# OniT HR & Payroll - Code Review (January 2026)

## Executive Summary

**Overall Health**: 🟢 Good / Solid

The application is well-structured, modular, and utilizes modern React patterns. The UI/UX implementation using Shadcn/Tailwind is polished, and the domain-specific logic (Timor-Leste tax/labor laws) is exceptionally well-isolated and implemented.

---

## Action Items Tracker

### 🔴 Critical (Performance/Scalability)

- [x] **Server-side filtering** - Move filtering from client to Firestore queries
  - [x] `employeeService.ts` - Added `getEmployees()` with filters
  - [x] `invoiceService.ts` - Added `getInvoices()` with filters
  - [x] `customerService.ts` - Added `getCustomers()` with filters
  - [x] `vendorService.ts` - Added `getVendors()` with filters
  - [x] `billService.ts` - Added `getBills()` with filters
  - [x] `expenseService.ts` - Added `getExpenses()` with filters
  - [x] `candidateService.ts` - Added `getCandidates()` with filters
  - [x] `jobService.ts` - Added `getJobs()` with filters

- [x] **Pagination** - Add `startAfter()` pagination for large datasets
  - [x] All services now support `startAfterDoc` and `pageSize` in filters
  - [x] `PaginatedResult<T>` interface with `lastDoc`, `hasMore`, `totalFetched`

- [x] **React Query adoption** - Replace `useEffect` + `useState` fetching
  - [x] Created `hooks/useEmployees.ts` with query hooks
  - [x] Created `hooks/useInvoices.ts` with query hooks
  - [x] Created `hooks/useCustomers.ts` with query hooks
  - [x] Created `hooks/useVendors.ts` with query hooks
  - [x] Created `hooks/useBills.ts` with query hooks
  - [x] Created `hooks/useExpenses.ts` with query hooks
  - [x] Migrated AllEmployees.tsx to use `useAllEmployees` hook

### 🟡 Medium (Code Quality)

- [x] **Type hardening** - Replace `any` types for timestamps
  - [x] All services now use `Date | Timestamp` types
  - [x] All mapper functions use `instanceof Timestamp` checks
  - [x] Timestamps converted to Date immediately in mappers

- [x] **Route extraction** - Clean up App.tsx
  - [x] Created `routes.tsx` with modular route definitions
  - [x] App.tsx reduced from 366 to 139 lines
  - [x] Routes grouped by module (people, payroll, money, accounting, reports, admin)

- [x] **Remove manual caching** - Replace CacheService with React Query
  - [x] Audit CacheService usage
  - [x] Migrate to React Query caching
  - [x] Delete `cacheService.ts` (no longer needed)

### 🟢 Verified Good

- [x] Service layer abstraction
- [x] TL tax/payroll logic isolation (`calculations-tl.ts`, `constants-tl.ts`)
- [x] UI componentization (Shadcn + custom components)
- [x] Context usage (TenantContext, AuthContext)
- [x] StepWizard component
- [x] Type definitions (`payroll-tl.ts`)
- [x] "Point of no return" UX in RunPayroll

---

## Detailed Findings

### 1. Architecture & Patterns

#### ✅ Strengths

- **Service Layer Pattern**: The abstraction in `services/` is excellent. Decouples UI from Firebase logic.
- **Domain Logic Isolation**: `lib/payroll/calculations-tl.ts` and `constants-tl.ts` are standout files. Tax logic is testable and maintainable.
- **Context Usage**: TenantContext, AuthContext implemented correctly for global state.
- **UI Componentization**: Good atomic design with `components/ui/` (Shadcn) and higher-level components.

#### ⚠️ Areas for Improvement

- **Routing**: App.tsx is massive. Move route definitions to separate configuration.
- **Type Safety**: Several instances of `any` in service layers (e.g., `createdAt?: any`).

### 2. Performance & Scalability

#### 🔴 Critical: Unbounded Reads

**Problem Location**: `employeeService.ts`, `invoiceService.ts`, and similar services.

```typescript
// CURRENT (problematic)
async getAllEmployees(maxResults: number = 500): Promise<Employee[]> {
  const querySnapshot = await getDocs(
    query(this.collectionRef, orderBy("createdAt", "desc"), limit(maxResults))
  );
  // ...
}
```

**Issues**:
1. **Cost**: Reads 500 documents every page load (unless cached)
2. **Functionality**: 501st employee is never searchable
3. **Client filtering**: UI filters via JavaScript `filter()` after fetching all

**Solution**:
```typescript
// FIXED (server-side filtering)
async getEmployees(filters: EmployeeFilters): Promise<Employee[]> {
  let q = query(this.collectionRef);

  if (filters.department) {
    q = query(q, where("departmentId", "==", filters.department));
  }
  if (filters.status) {
    q = query(q, where("status", "==", filters.status));
  }
  // ... pagination with startAfter()
}
```

#### 🟡 Caching Strategy

`CacheService.ts` is a manual implementation. Since `@tanstack/react-query` is installed, should use it instead for:
- Automatic caching
- Deduplication
- Background refetching
- Stale-while-revalidate

### 3. Code Quality Notes

#### RunPayroll.tsx
- ✅ "Point of no return" dialogs are great UX
- ✅ Clean separation of `EmployeePayrollData` from raw `Employee`
- ⚠️ `useEffect` recalculating on every input change - consider debouncing

#### calculations-tl.ts
- ✅ Pure logic, no side effects
- ✅ Highly unit-testable
- ✅ Tax brackets handle residents vs non-residents correctly (TL Law 8/2008)

#### adminService.ts
- ✅ Impersonation implementation is solid
- ⚠️ Ensure Firestore rules allow impersonation reads/writes

### 4. Recommendations

#### Immediate Actions
1. Type hardening for timestamps
2. Server-side filtering in services

#### Short Term
1. Adopt React Query for data fetching
2. Refactor filtering to accept query parameters

#### Long Term
1. Create Firestore composite indexes as needed
2. Ensure firestore.rules enforce all RBAC (client checks are UX only)

---

## Implementation Progress

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Document created | ✅ | Jan 2026 | This file |
| Server-side filtering | ✅ | Jan 17, 2026 | All 8 services refactored with filters & pagination |
| Type hardening | ✅ | Jan 17, 2026 | Timestamp types fixed in all services |
| Pagination support | ✅ | Jan 17, 2026 | PaginatedResult<T> added to all services |
| React Query migration | ✅ | Jan 17, 2026 | 7 hooks created, AllEmployees migrated |
| Route extraction | ✅ | Jan 17, 2026 | App.tsx reduced 366→139 lines |
| CacheService removal | ✅ | Jan 17, 2026 | All 6 report pages migrated to React Query, cacheService.ts deleted |

---

*Review conducted: January 2026*
*Last updated: January 2026*
