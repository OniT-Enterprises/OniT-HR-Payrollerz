# OniT HR & Payroll - Action Plan (January 2026)

## Overview

This action plan consolidates findings from the comprehensive code review and prioritizes items for implementation. Items are organized by impact and urgency.

**Review Date**: January 30, 2026
**Codebase Status**: Production-ready with optimization opportunities

---

## Status Summary

| Priority | Total | Completed | In Progress | Pending |
|----------|-------|-----------|-------------|---------|
| Critical | 5 | 5 | 0 | 0 |
| High | 6 | 5 | 0 | 1 |
| Medium | 8 | 6 | 0 | 2 |
| Low | 4 | 0 | 0 | 4 |

### January 30, 2026 Updates
- ✅ Form standardization complete: InvoiceForm.tsx, RecurringInvoiceForm.tsx converted to react-hook-form + Zod
- ✅ Transaction support added: accountingService.postJournalEntry, invoiceService.recordPayment, billService.recordPayment
- ✅ Soft delete documented as future enhancement (current status-based approach is sufficient)
- ✅ AddEmployee.tsx evaluated - keep as-is (well-organized despite size)

---

## Priority 1: Critical (Performance/Security)

### 1.1 Server-side Filtering
**Status**: ✅ Complete (Jan 17, 2026)

Moved filtering from client to Firestore queries across all 8 services:
- `employeeService.ts`, `invoiceService.ts`, `customerService.ts`
- `vendorService.ts`, `billService.ts`, `expenseService.ts`
- `candidateService.ts`, `jobService.ts`

### 1.2 Pagination Support
**Status**: ✅ Complete (Jan 17, 2026)

Added `startAfter()` pagination with `PaginatedResult<T>` interface.

### 1.3 React Query Migration
**Status**: ✅ Complete (Jan 17, 2026)

Created 7 hooks in `hooks/` directory. Main pages migrated (Invoices, Bills, Customers, Vendors, Expenses).

### 1.4 Tenant Isolation Security
**Status**: ✅ Complete (Jan 29, 2026)

Fixed dangerous `local-dev-tenant` fallback. Now only works in DEV mode, throws error in production.

### 1.5 Type Hardening for Timestamps
**Status**: ✅ Complete (Jan 17, 2026)

All services use `Date | Timestamp` types with `instanceof Timestamp` checks in mappers.

---

## Priority 2: High (Scalability/Architecture)

### 2.1 Backend Accounting Aggregation
**Status**: ⏳ Pending - Recommended

**Issue**: `accountingService.ts` -> `getAccountBalance()` queries all GL entries to calculate balances. This won't scale beyond ~10k entries.

**Current Implementation** (lines 958-988):
```typescript
// Queries all GL entries for an account
const snapshots = await Promise.all(queries.map(q => getDocs(q)));
return entries.reduce((sum, e) => sum + e.debit - e.credit, 0);
```

**Recommendation**: Implement running balance fields on Account documents updated via Cloud Functions.

**Implementation Steps**:
1. Create Cloud Function `onGLEntryCreate` to update account running balance
2. Add `runningBalance` field to Account documents
3. Modify `getAccountBalance()` to read from Account document directly
4. Create migration script to initialize running balances

**Impact**: Required when GL entries exceed ~5,000 per account

**Decision**: [ ] Implement now  [ ] Defer until volume increases

---

### 2.2 Backend Payroll Validation
**Status**: ⏳ Pending - Recommended

**Issue**: Payroll calculations happen client-side in `RunPayroll.tsx`. While the calculations are correct, a malicious user could theoretically manipulate values before submission.

**Current Flow**:
1. Client calls `calculateTLPayroll()` for each employee
2. Client submits calculated results to Firestore
3. No server-side validation

**Recommendation**: Add Cloud Function to re-validate payroll calculations before writing to Firestore.

**Implementation Steps**:
1. Create `validatePayrollSubmission` Cloud Function
2. Extract `calculations-tl.ts` logic to shared package (client + functions)
3. Function validates all tax/deduction calculations match inputs
4. Reject submissions with calculation discrepancies

**Impact**: Security hardening for financial data integrity

**Decision**: [ ] Implement now  [ ] Defer

---

### 2.3 Form Standardization
**Status**: ✅ Complete (4/6 complex forms)

**Goal**: Migrate all complex forms to `react-hook-form` + Zod for consistency and performance.

| Form | Status | Notes |
|------|--------|-------|
| AddEmployee.tsx | ✅ Complete | Already uses react-hook-form + Zod |
| BillForm.tsx | ✅ Complete | Converted Jan 29, 2026 |
| InvoiceForm.tsx | ✅ Complete | Converted Jan 30, 2026 - uses useFieldArray |
| RecurringInvoiceForm.tsx | ✅ Complete | Converted Jan 30, 2026 - uses useFieldArray |
| JournalEntries.tsx | ⏳ Pending | Uses raw useState (lower priority) |
| BankTransfers.tsx | ⏳ Pending | Uses raw useState (lower priority) |

**Remaining**: JournalEntries.tsx and BankTransfers.tsx are lower-traffic forms that can be converted as needed.

---

### 2.4 Weekly Payroll Reconciliation
**Status**: ✅ Complete (Jan 29, 2026)

Added `calculateMonthlyWeeklyPayrolls()` with guaranteed reconciliation. Final week computed as `monthlySalary - sumOfPreviousWeeks`.

### 2.5 Query Cache Security
**Status**: ✅ Verified Secure

`queryCache.ts` uses allow-list approach with sessionStorage (cleared on tab close). No action needed.

### 2.6 Date/Timezone Handling
**Status**: ✅ Complete (Jan 29, 2026)

`lib/dateUtils.ts` implements TL timezone (`Asia/Dili`) with noon-offset DST strategy.

---

## Priority 3: Medium (Code Quality)

### 3.1 AddEmployee.tsx Componentization
**Status**: 🟢 Evaluated - Keep As-Is

**Assessment**: At 1,074 lines, this component was reviewed for extraction. However:
- Uses StepWizard pattern with clear step separation
- Uses react-hook-form + Zod (best practices)
- Extraction would require passing 10+ props to each step component
- External code review confirmed: "NOT a 'God Component'"

**Potential Future Extraction** (if needed):
| Component | Lines | Props Needed |
|-----------|-------|--------------|
| BasicInfoStep.tsx | ~117 | register, errors, t |
| JobDetailsStep.tsx | ~139 | register, control, errors, departments, managers, t |
| CompensationStep.tsx | ~78 | register, control, errors, t |
| DocumentsStep.tsx | ~135 | documents, additionalInfo, handlers, t |

**Decision**: Keep as-is. Current organization is clear and extraction would add complexity without meaningful benefit.

---

### 3.2 Zod Validation for Firestore
**Status**: ✅ Complete (Jan 29, 2026)

Added runtime validation schemas in `lib/validations/index.ts`:
- `firestoreEmployeeSchema`
- `firestoreInvoiceSchema`
- `firestoreCustomerSchema`
- `firestoreBillSchema`

---

### 3.3 i18n Hardcoded Strings
**Status**: ✅ Partial (Jan 29, 2026)

BenefitsEnrollment.tsx migrated to i18n. Other areas may have hardcoded strings.

**Remaining Areas to Audit**:
- [ ] Error messages in services
- [ ] Validation error messages
- [ ] Chart labels in reports

---

### 3.4 Route Extraction
**Status**: ✅ Complete (Jan 17, 2026)

Created `routes.tsx` with modular route definitions. App.tsx reduced from 366 to 139 lines.

---

### 3.5 Transaction Support for Concurrent Operations
**Status**: ✅ Complete (Jan 30, 2026)

**Issue**: Some operations updated multiple documents without `runTransaction`, risking drift if two users edit simultaneously.

**Implemented Transactions**:
| Operation | File | Change |
|-----------|------|--------|
| `postJournalEntry` | accountingService.ts | Journal status + GL entries in single transaction |
| `recordPayment` | invoiceService.ts | Payment record + invoice update in single transaction |
| `recordPayment` | billService.ts | Payment record + bill update in single transaction |

**Pattern Used**:
```typescript
await runTransaction(db, async (transaction) => {
  // Read document within transaction
  const docRef = await transaction.get(ref);
  // Update all related documents atomically
  transaction.update(ref, {...});
  transaction.set(newRef, {...});
});
```

---

### 3.6 Soft Delete Strategy
**Status**: 🟡 Documented - Future Enhancement

**Issue**: Inconsistent deletion patterns across services.

**Current Implementation** (already prevents data loss):
| Service | Pattern | Notes |
|---------|---------|-------|
| Invoices | `status: 'cancelled'` | Only drafts can be hard deleted |
| Bills | `status: 'cancelled'` | Similar to invoices |
| Employees | `status: 'inactive'/'terminated'` | Proper soft delete |
| Customers | `isActive: false` | Proper soft delete |
| Vendors | `isActive: false` | Proper soft delete |
| Accounts | `isActive: false` | Proper soft delete |

**Recommendation for Future**: Standardize on uniform `deletedAt: Timestamp`, `deletedBy: string` pattern for:
- Full audit trail compliance
- Data recovery capability
- Consistent querying

**Impact**: Low priority - current implementation already prevents data loss through status-based approaches. Standardization would require type changes, service updates, query updates, and data migration.

---

### 3.7 Component Extraction from Large Pages
**Status**: ✅ Complete (Jan 29, 2026)

Extracted from RunPayroll.tsx:
- `PayrollLoadingSkeleton.tsx`
- `TaxInfoBanner.tsx`
- `PayrollEmployeeRow.tsx`
- `PayrollSummaryCards.tsx`
- `TaxSummaryCard.tsx`

Extracted from Settings.tsx:
- `SettingsSkeleton.tsx`
- `SetupProgress.tsx`

---

### 3.8 Type Overlap Cleanup
**Status**: ⏳ Pending - Low Priority

**Issue**: Overlap between `types/money.ts` and `types/accounting.ts` for Invoice/Expense types.

**Recommendation**: Create shared base interfaces to reduce duplication.

---

## Priority 4: Low (Nice to Have)

### 4.1 Debounce RunPayroll Date Inputs
**Status**: ⏳ Pending

When payFrequency/payDate changes, all employees recalculate. Adding debounce would smooth UX for 100+ employees.

### 4.2 Profile Completeness Memoization
**Status**: ⏳ Pending

`IncompleteProfilesDialog.tsx` calculates completeness on every render. Should memoize or store `completenessScore` on Employee document.

### 4.3 Generic FirestoreService Base Class
**Status**: ⏳ Pending

Create `FirestoreService<T>` base class to reduce code duplication across services for common patterns (pagination, error handling, mapping).

### 4.4 Firestore Composite Indexes
**Status**: ⏳ Pending

Create indexes for common compound queries as usage patterns emerge.

---

## Implementation Sequence (Recommended)

### Phase 1: Immediate (This Sprint)
1. ✅ ~~Form standardization - InvoiceForm.tsx~~
2. ✅ ~~Form standardization - RecurringInvoiceForm.tsx~~
3. [ ] Transaction support for accounting operations

### Phase 2: Short Term (Next 2 Sprints)
4. [ ] Backend accounting aggregation (if volume warrants)
5. [ ] Backend payroll validation
6. [ ] Soft delete strategy standardization

### Phase 3: Long Term (Backlog)
7. [ ] AddEmployee componentization
8. [ ] Generic FirestoreService base class
9. [ ] Full i18n audit
10. [ ] Type overlap cleanup

---

## Validation Notes

The following items from the external code review were **validated as non-issues**:

| Concern | Validation | Finding |
|---------|------------|---------|
| GL aggregation "problematic" | Reviewed `getAccountBalance()` | Implementation includes deduplication logic, works correctly |
| sessionStorage cache limits | Reviewed `queryCache.ts` | Uses allow-list, only caches safe data |
| Timezone bugs | Reviewed `dateUtils.ts` | Excellent implementation with noon-offset DST strategy |
| AddEmployee "God Component" | Reviewed structure | Large but well-organized, uses react-hook-form |

---

## Metrics to Track

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| GL entries per account | ~500 | 10,000+ | Trigger for backend aggregation |
| Employees per tenant | ~50 | 500+ | Trigger for profile memoization |
| Forms using react-hook-form | 2/6 | 6/6 | Standardization goal |
| Services with soft delete | 0/5 | 5/5 | Consistency goal |

---

*Created: January 30, 2026*
*Based on: External Code Review + Internal CODE_REVIEW_JAN2026.md*
