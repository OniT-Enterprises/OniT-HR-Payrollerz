# Production Readiness Audit — February 2026

> Full audit of OniT HR/Payroll for Timor-Leste production deployment.
> Covers calculations, security, data integrity, i18n, and market fit.

---

## Executive Summary

| Area | Grade | Status |
|------|-------|--------|
| Payroll Calculations | A | Decimal.js, correct TL tax law, precise |
| UI/UX Quality | A | Polished, consistent design system |
| Security | B- | Strong foundations, critical input validation gaps |
| Data Architecture | A- | Multi-tenant, typed, well-structured |
| i18n / Localization | B- | UI translated, payslips English-only |
| TL Market Fit (small biz) | B | Monthly payroll works, some workflow gaps |
| TL Market Fit (security co.) | D | Shift scheduling, weekly pay, sites not built |

---

## 1. PAYROLL CALCULATIONS

### What's Correct

- [x] WIT 10% above $500/month for residents — properly pro-rated for weekly/biweekly
- [x] INSS 4% employee + 6% employer — correct base exclusions
- [x] Overtime 150%, holidays/rest days 200% — matches Labor Code Art. 24
- [x] Night shift 125% premium
- [x] Subsidio Anual (13th month) — pro-rated by months worked
- [x] Sick leave tiered: 100% first 6 days, 50% next 6, max 12/year
- [x] Weekly-to-monthly reconciliation prevents rounding drift
- [x] All math uses Decimal.js (precision: 20, ROUND_HALF_UP)
- [x] `sumMoney()`, `subtractMoney()`, `multiplyMoney()` — no raw floating-point
- [x] Minimum wage $115/month defined in constants

### Issues Found

#### CALC-1: Non-Resident Tax Rate Documentation Mismatch
- **Severity:** VERIFY
- **Location:** `constants-tl.ts:6,19`, `calculations-tl.ts:5`
- **Issue:** Code implements 10% (no threshold) for non-residents, which appears correct per Law 8/2008. But some comments reference "20% flat." Need to confirm with ATTL.
- **Action:** Verify with TL tax authority. If 10% is correct, fix the comments. If 20%, update `TL_INCOME_TAX.rate` and add separate non-resident rate.
- **Status:** `[x]` VERIFIED — 10% is correct per Decree Law 8/2008 Part VI / Schedule V, confirmed by ATTL. The "20%" traces to superseded UNTAET Reg. 2000/32. Comments updated.

#### CALC-2: Night Shift Premium in INSS Base
- **Severity:** MEDIUM
- **Location:** `calculations-tl.ts:452`
- **Issue:** Night shift premium (25% extra) is included in INSS base (`isINSSBase: true`). Standard overtime is excluded. Night shift could be considered "extraordinary" and should be excluded.
- **Action:** Verify with INSS guidance whether night shift premiums are contributable.

#### CALC-3: No Deduction Cap
- **Severity:** MEDIUM
- **Location:** `calculations-tl.ts:709`
- **Issue:** If deductions exceed gross pay, net pay goes negative (warning only). TL labor law may limit deductions to a percentage of net pay (e.g., 50%).
- **Action:** Research TL labor code for deduction limits. Implement cap if required.
- **Status:** `[x]` DONE — Implemented 1/6 (~16.67%) cap on voluntary deductions per Portuguese Labour Code Art. 279 precedent (TL Law 4/2012 modeled on it). Statutory deductions (WIT, INSS, court orders) exempt. Proportional reduction with warning.

#### CALC-4: Negative Salary Not Rejected
- **Severity:** LOW
- **Location:** `calculations-tl.ts:890`
- **Issue:** `validateTLPayrollInput()` checks minimum wage but doesn't reject negative salaries.
- **Fix:** Add `if (input.monthlySalary < 0)` check.
- **Status:** `[x]` Done

#### CALC-5: Validation Function Never Called
- **Severity:** HIGH
- **Location:** `RunPayroll.tsx` — `handleProcessPayroll()`
- **Issue:** `validateTLPayrollInput()` exists in `calculations-tl.ts` but is never called before payroll submission.
- **Fix:** Call it in `handleProcessPayroll()` before creating the run.
- **Status:** `[x]` Done — called in both `handleSaveDraft()` and `handleProcessPayroll()`

---

## 2. SECURITY

### What's Strong

- [x] Multi-tenant isolation enforced in all service files via `tenantId`
- [x] Production Firestore rules have comprehensive RBAC (member/admin/owner)
- [x] Audit logs are immutable (no update/delete)
- [x] Journal entries are immutable once posted
- [x] Auth context properly manages Firebase auth state
- [x] React escapes all output — no XSS vectors found
- [x] No `dangerouslySetInnerHTML` with user input
- [x] Firestore parameterized queries — no injection

### Issues Found

#### SEC-1: Dev Firestore Rules Deployed to Production
- **Severity:** CRITICAL
- **Location:** `firestore-dev.rules` vs `firestore.rules`
- **Issue:** Per CLAUDE.md, dev rules are currently deployed. Dev rules have:
  - Weaker tenant isolation on legacy collections (lines 356-404)
  - Catch-all `/{collection}/{docId}` allowing access to any future collection
  - No tenant check on root-level employee/payroll queries
- **Fix:** Deploy `firestore.rules` to production immediately.
- **Status:** `[x]` Done — deployed `firestore.rules` to production 2026-02-08

#### SEC-2: No Input Validation on Payroll Inputs
- **Severity:** CRITICAL
- **Location:** `RunPayroll.tsx:520-544` — `handleInputChange()`
- **Issue:** User can enter negative hours, impossibly large bonuses, NaN, Infinity. No validation.
- **Exploits:** Negative OT hours = extra pay. $1M bonus = fraud. "abc" = NaN crash.
- **Fix:** Add field-level validation with range checks.
- **Status:** `[x]` Done — NaN/Infinity rejected, hours capped 0-744, money capped 0-100K

#### SEC-3: No Rate Limiting on Bulk Operations
- **Severity:** HIGH
- **Location:** `payrollService.ts:111-167` — `createPayrollRunWithRecords()`
- **Issue:** No limit on record count. Could exhaust Firestore writes (max 500 per batch anyway, but no app-level check).
- **Fix:** Add `if (records.length > 500) throw` and chunk if needed.
- **Status:** `[x]` Done — 499 record limit enforced

#### SEC-4: Console Logs Leak PII in Production
- **Severity:** MEDIUM
- **Location:** Multiple files — `employeeService.ts:164`, `payrollService.ts:162`, `RunPayroll.tsx:358`
- **Issue:** `console.error()` logs full employee objects, salary totals, validation errors.
- **Fix:** Strip console logs in production build via Vite config, or wrap in `import.meta.env.DEV`.
- **Status:** `[x]` Done — esbuild `drop: ["console", "debugger"]` in vite.config.ts

#### SEC-5: Math.random() for Share Tokens
- **Severity:** LOW
- **Location:** `invoiceService.ts:991-997`
- **Issue:** Predictable tokens for shared invoices. Should use `crypto.getRandomValues()`.
- **Status:** `[x]` Done — switched to crypto.getRandomValues()

#### SEC-6: Date Range Not Validated
- **Severity:** MEDIUM
- **Location:** `RunPayroll.tsx:644-660`
- **Issue:** Payroll dates can be year 2099 or 1900. No overlap check with existing runs.
- **Fix:** Limit to past 2 years → future 1 month. Check for duplicate periods.
- **Status:** `[x]` Done — bounded to past 2 years / future 1 month

#### SEC-7: Compliance Override Reason Not Validated
- **Severity:** LOW
- **Location:** `RunPayroll.tsx:904-915`
- **Issue:** Override reason can be empty or single character. Poor audit trail.
- **Fix:** Require minimum 10 characters when compliance is acknowledged.
- **Status:** `[x]` Done — min 10 chars enforced

#### SEC-8: Impersonation Persists in localStorage
- **Severity:** MEDIUM
- **Location:** `TenantContext.tsx:326-329, 482-501`
- **Issue:** Superadmin impersonation survives browser restart. Risk of accidental wrong-tenant operations.
- **Fix:** Use `sessionStorage` instead, or add 24-hour auto-expire.
- **Status:** `[x]` Done — switched to sessionStorage

---

## 3. i18n & LOCALIZATION

### What's Done

- [x] Tetum (tet) translations: ~2,639 lines covering most UI
- [x] English (en) translations: ~2,631 lines
- [x] Currency correctly USD throughout
- [x] `formatDateTL()` uses Asia/Dili timezone (UTC+9)
- [x] `formatDateTL()` uses dd/mm/yyyy format (correct for TL)

### Issues Found

#### I18N-1: Payslips Are English-Only
- **Severity:** HIGH
- **Location:** `components/payroll/PayslipPDF.tsx`
- **Issue:** All labels hardcoded: "EARNINGS STATEMENT", "Employee Information", "Deductions", etc. No i18n integration. Tetum-speaking workers cannot read their payslips.
- **Fix:** Pass language prop and use translation keys.
- **Status:** `[x]` Done — 36 strings translated to Tetum, `language` prop added to PayslipDocument/downloadPayslip/generatePayslipBlob

#### I18N-2: PayslipPDF Uses mm/dd/yyyy
- **Severity:** LOW
- **Location:** `PayslipPDF.tsx` — `toLocaleDateString('en-US')`
- **Issue:** TL uses dd/mm/yyyy. Payslips show American date format.
- **Fix:** Use `formatDateTL()` or `'en-GB'` locale.
- **Status:** `[x]` Done — switched to en-GB locale

#### I18N-3: Hardcoded English in RunPayroll Dialogs
- **Severity:** LOW
- **Location:** `RunPayroll.tsx` — all dialog strings
- **Issue:** "Save Payroll Draft", "Review Payroll", "Confirm Payroll Processing", etc. are hardcoded English.
- **Status:** `[ ]` Backlog — low priority since admin-facing

---

## 4. MISSING FEATURES (Production Blockers)

### Critical — Blocks Any Production Use

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Deploy production Firestore rules | Not done | `firestore.rules` | Dev rules active |
| Input validation on payroll | Not done | `RunPayroll.tsx` | Fraud risk |
| Minimum wage enforcement | Constants only | `constants-tl.ts` | No validation in employee creation or payroll |
| Working hours limit warnings | Constants only | `constants-tl.ts` | No enforcement when scheduling/calculating |

### High — Blocks Practical Daily Use

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Leave request workflow UI | Backend done, UI shell | `LeaveRequests.tsx` | Employees can't request leave |
| Bank transfer file generation | Partial | `lib/bank-transfers/` | TL bank formats (BNU, BNCTL, Mandiri) unclear |
| Payslip Tetum translation | Not done | `PayslipPDF.tsx` | Workers can't read payslips |
| Contract expiry alerts | Types defined | `constants-tl.ts` | No notification system |
| Two-person payroll approval | Not done | — | Single-user approval = fraud risk |
| Setup wizard (company TIN, bank) | Not done | — | Can't configure company details |

### Medium — Limits Compliance Reporting

| Feature | Status | Notes |
|---------|--------|-------|
| ATTL e-Tax portal export | Not done | Manual data entry for WIT returns |
| Annual INSS reconciliation | Not done | Monthly exists, annual missing |
| Employer INSS on payslips | Not shown | Only employee 4% shown, not employer 6% |
| 13th month accrual display | Calculated | Not shown to employees |

### Blocks Security Company Target Market

| Feature | Status | Notes |
|---------|--------|-------|
| Shift scheduling | Not built | Core requirement for security ops |
| Client/site-specific pay rates | Not built | Guards paid by assignment |
| Fingerprint CSV import | Not standardized | "What brand/model?" open question |
| Supervisor mobile interface | Not built | Field access needed |
| Weekly sub-payroll workflow | Calculation done | UI/workflow not complete |
| Late arrival tracking + warnings | Not built | 3-strike system in roadmap |

---

## 5. TEST COVERAGE

### Current Tests

- [x] Resident WIT calculation
- [x] Non-resident WIT calculation
- [x] INSS base exclusions (overtime, bonus)
- [x] INSS optional contribution bands

### Missing Tests

- [ ] Subsidio Anual pro-ration (mid-year hire)
- [ ] Sick leave 50% pay tier
- [ ] Weekly/biweekly threshold pro-ration
- [ ] Negative net pay scenario
- [ ] Overtime rate calculations (150%, 200%)
- [ ] Night shift calculations (125%)
- [ ] Holiday pay calculations
- [ ] Absence/late deductions
- [ ] Edge case: zero salary
- [ ] Edge case: very high salary ($100K+)
- [ ] Weekly reconciliation accuracy (sum = monthly)
- [ ] Integration test: full payroll run end-to-end

---

## 6. QUICKBOOKS COMPARISON

### Where OniT Wins (TL-Specific)

| Feature | OniT | QuickBooks |
|---------|------|------------|
| TL WIT calculation | Built-in, automatic | Manual custom item |
| TL INSS 4%/6% split | Built-in, automatic | Manual calculation |
| $500 threshold pro-ration | Automatic for weekly/biweekly | Not supported |
| Subsidio Anual (13th month) | Pro-rated calculation | Not supported |
| TL overtime rates (150%/200%) | Labor Code compliant | Generic overtime |
| Tetum language | 70% translated | Not available |
| TL contract types | All 4 types | Not supported |
| TL tax returns (WIT/INSS) | Report generation | Not supported |
| TL date/timezone | Asia/Dili, dd/mm/yyyy | Not localized |
| Price for TL market | Custom (affordable) | $$$$ per user/month |

### Where QuickBooks Wins (Maturity)

| Feature | OniT | QuickBooks |
|---------|------|------------|
| Payroll workflow (run→pay) | Gaps in workflow | Complete |
| Bank integrations | Partial | Extensive |
| Payslip delivery | PDF only | Email/portal |
| Leave management | Backend only | Full workflow |
| Mobile app | None | Full app |
| Audit trail | Partial | Complete |
| User base / battle-tested | New | Millions |

---

## 7. REMEDIATION TRACKER

### Week 1 — Critical Security Fixes

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Add input validation to `handleInputChange` | `RunPayroll.tsx` | `[x]` Done |
| 2 | Call `validateTLPayrollInput()` before submission | `RunPayroll.tsx` | `[x]` Done |
| 3 | Add negative salary rejection | `calculations-tl.ts` | `[x]` Done |
| 4 | Add payroll record batch size limit | `payrollService.ts` | `[x]` Done |
| 5 | Add date range validation | `RunPayroll.tsx` | `[x]` Done |
| 6 | Validate compliance override reason length | `RunPayroll.tsx` | `[x]` Done |
| 7 | Deploy production Firestore rules | `firestore.rules` | `[x]` Done — deployed 2026-02-08 |

### Week 2 — Calculation Safety

| # | Task | File | Status |
|---|------|------|--------|
| 8 | Add minimum wage warning in payroll | `RunPayroll.tsx` | `[x]` Done |
| 9 | Add working hours limit warning | `RunPayroll.tsx` | `[x]` Done |
| 10 | Add deduction cap (if required by law) | `calculations-tl.ts` | `[x]` Done — 1/6 cap per Portuguese Art. 279 |
| 11 | Fix non-resident tax rate comments | `constants-tl.ts`, `calculations-tl.ts` | `[x]` Done — Verified 10% correct |

### Week 3 — Production Hardening

| # | Task | File | Status |
|---|------|------|--------|
| 12 | Strip console logs in prod build | `vite.config.ts` | `[x]` Done |
| 13 | Use crypto.getRandomValues for tokens | `invoiceService.ts` | `[x]` Done |
| 14 | Switch impersonation to sessionStorage | `TenantContext.tsx` | `[x]` Done |
| 15 | Add Tetum to PayslipPDF | `PayslipPDF.tsx` | `[x]` Done — 36 strings translated |
| 16 | Fix PayslipPDF date format | `PayslipPDF.tsx` | `[x]` Done |

### Week 4 — Test Coverage

| # | Task | Status |
|---|------|--------|
| 17 | Test: Subsidio Anual pro-ration | `[x]` Done — 5 tests (full year, mid-year, 1 month, future hire, payroll flag) |
| 18 | Test: Sick leave tiers | `[x]` Done — 3 tests (100% tier, 50% tier, mixed straddle) |
| 19 | Test: Weekly threshold pro-ration | `[x]` Done — 3 tests (weekly, biweekly, below-threshold) |
| 20 | Test: Overtime/night/holiday rates | `[x]` Done — 5 tests (OT 150%, night 125%, holiday 200%, rest day 200%, combined) |
| 21 | Test: Edge cases (zero, negative, huge) | `[x]` Done — 6 tests (zero salary, min wage, $100K, employer cost, net pay, deduction cap) |
| 22 | Test: Validation function | `[x]` Done — 6 tests (valid input, negative salary, below min wage, negative hours, excessive OT, sick day limit) |

---

*Last updated: February 2026*
*Audited by: Claude Code*
