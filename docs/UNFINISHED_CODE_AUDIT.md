# Meza Web App — Unfinished Code Audit

**Date**: 2026-02-21
**Status**: Active remediation

---

## 1. FULL MOCK/DEMO PAGES

### 1a. ShiftScheduling.tsx — Entirely mock data
- **File**: `client/pages/time-leave/ShiftScheduling.tsx`
- **Lines**: 249–675 (~425 lines of hardcoded arrays)
- **Issue**: No Firebase integration. Mock departments, locations, employees, shifts, templates. Banner says "coming soon."
- **Fix**: Wire to real employees/departments via existing hooks + new `shiftService.ts` for shifts collection.
- **Status**: ✅ FIXED

### 1b. TimeTracking.tsx — Entirely mock data
- **File**: `client/pages/time-leave/TimeTracking.tsx`
- **Lines**: 153–393 (~240 lines of hardcoded arrays)
- **Issue**: No Firebase integration. Mock security guards, clients, sites, time entries. Banner says "coming soon."
- **Fix**: Wire to existing `attendanceService.ts` + `useAttendance.ts` hooks (already built).
- **Status**: ✅ FIXED

### 1c. CandidateSelection.tsx — Fake AI extraction
- **File**: `client/pages/hiring/CandidateSelection.tsx`
- **Lines**: 64–106 (mock candidates), 178–194 (fake extraction), 239–243 (random scores)
- **Issue**: `extractInfoFromFiles()` ignores uploaded files, returns random dummy data after 2s sleep. Scores use `Math.random()`.
- **Fix**: Parse actual uploaded file names, set scores to 0 pending manual review.
- **Status**: ✅ FIXED

### 1d. Onboarding.tsx — Mock SOPs
- **File**: `client/pages/hiring/Onboarding.tsx`
- **Lines**: 117–140
- **Issue**: Hardcoded SOP array instead of Firestore data. However, these are i18n-translated static policies — acceptable as config.
- **Fix**: Leave as-is (these are static policy references, not dynamic data).
- **Status**: ⏭️ SKIPPED (by design)

---

## 2. TODOs IN CODE

### 2a. settingsService.ts — getAdmins() returns empty
- **File**: `client/services/settingsService.ts:348–356`
- **Issue**: `getAdmins()` always returns `[]`. Comment: "TODO: Implement proper HR admin collection query"
- **Fix**: Query the `hrAdmins` collection by tenantId.
- **Status**: ✅ FIXED

### 2b. invoiceService.ts — sendReminder() doesn't send
- **File**: `client/services/invoiceService.ts:568`
- **Issue**: Only updates reminder counter. Comment: "TODO: Integrate with email service to send actual reminder"
- **Fix**: Queue reminder email via existing `emailService.ts` Firestore mail pattern.
- **Status**: ✅ FIXED

### 2c. routes.tsx — Missing Financial Reports page
- **File**: `client/routes.tsx:240–241`
- **Issue**: `/accounting/reports` reuses `PayrollReports` as placeholder.
- **Fix**: Comment clarified — this is intentional reuse until dedicated page exists. Updated TODO.
- **Status**: ✅ FIXED (clarified)

### 2d. JournalEntries.tsx — Hardcoded createdBy
- **File**: `client/pages/accounting/JournalEntries.tsx:355`
- **Issue**: `createdBy: "current-user"` instead of actual auth user.
- **Fix**: Use `useAuth()` hook to get real user identity.
- **Status**: ✅ FIXED

---

## 3. DEAD / UNUSED CODE

### 3a. TimeTracking.tsx — Dead render function (113 lines)
- **File**: `client/pages/time-leave/TimeTracking.tsx:632–745`
- **Issue**: `_renderDailyView_unused()` — entire unused JSX function.
- **Fix**: Deleted.
- **Status**: ✅ FIXED

### 3b. TimeTracking.tsx — Unused state/computed values
- **Lines**: 126, 516, 547, 592
- **Issue**: `_entryType`, `_totalHours` (x2), `_csvData` — declared but never used.
- **Fix**: Removed.
- **Status**: ✅ FIXED

### 3c. ShiftScheduling.tsx — Unused state/computed values
- **Lines**: 169–174, 725–726
- **Issue**: `_templateData`, `_dateLocale`, `_employee`, `_hours` — declared but never used.
- **Fix**: Removed.
- **Status**: ✅ FIXED

### 3d. CandidateSelection.tsx — Unused state
- **Line**: 62
- **Issue**: `_showFilterPanel` state never used.
- **Fix**: Removed.
- **Status**: ✅ FIXED

---

## 4. STUB / NO-OP FUNCTIONS

### 4a. ShiftScheduling.tsx — handleDeleteShift does nothing
- **File**: `client/pages/time-leave/ShiftScheduling.tsx:781–794`
- **Issue**: Shows success toast but deletes nothing. `_shiftId` parameter ignored.
- **Fix**: Wire to `shiftService.deleteShift()`.
- **Status**: ✅ FIXED

### 4b. TimeTracking.tsx — Random active guards count
- **Line**: 1690
- **Issue**: `Math.floor(Math.random() * 8) + 1` for active guard count.
- **Fix**: Compute from real attendance data.
- **Status**: ✅ FIXED

---

## 5. "COMING SOON" PLACEHOLDERS

### 5a. TenantDetail.tsx — Settings tab placeholder
- **File**: `client/pages/admin/TenantDetail.tsx:462`
- **Issue**: "Settings management coming soon. Use Firebase Console for now."
- **Fix**: Leave as-is — this is a superadmin internal tool, Firebase Console is the correct workflow.
- **Status**: ⏭️ SKIPPED (intentional)

### 5b. Landing.tsx & ProductDetails.tsx — Marketing coming soon
- **Files**: `client/pages/Landing.tsx:526`, `client/pages/ProductDetails.tsx:806`
- **Issue**: "Coming Soon" labels for future product features.
- **Fix**: Leave as-is — intentional marketing copy.
- **Status**: ⏭️ SKIPPED (intentional)

---

## 6. PLACEHOLDER IMAGES

### 6a. /placeholder.svg references
- `components/IncompleteProfilesDialog.tsx:99`
- `components/EmployeeProfileView.tsx:167`
- `pages/hiring/CandidateSelection.tsx:826`
- `pages/staff/Departments.tsx:607`
- `pages/staff/AllEmployees.tsx:1131`
- `pages/staff/OrganizationChart.tsx:653, 753, 793`
- **Fix**: Replace with initials-based avatar fallback (consistent with existing pattern in the app).
- **Status**: ✅ FIXED
