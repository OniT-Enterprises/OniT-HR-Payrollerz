# Production Readiness Audit — February 2026

> Full audit of OniT HR/Payroll for Timor-Leste production deployment.
> Covers calculations, security, data integrity, i18n, and market fit.

---

## Executive Summary

| Area | Grade | Status |
|------|-------|--------|
| Payroll Calculations | A | Decimal.js, correct TL tax law, 79 tests passing |
| UI/UX Quality | A | Polished, consistent design system |
| Security | B+ | All critical issues resolved, production rules deployed |
| Data Architecture | A- | Multi-tenant, typed, well-structured |
| i18n / Localization | A- | UI + payslips + admin dialogs translated (Tetum/English) |
| Dependencies | A | 0 npm audit vulnerabilities |
| Build & Deploy | B+ | Clean build, console stripping, code-split |
| Test Coverage | B+ | 97 tests (payroll math + integration batch); no E2E/UI tests |
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
- **Status:** `[ ]` Pending — needs INSS guidance verification

#### CALC-3: Deduction Cap
- **Severity:** MEDIUM
- **Status:** `[x]` DONE — Implemented 1/6 (~16.67%) cap on voluntary deductions per Portuguese Labour Code Art. 279 precedent (TL Law 4/2012 modeled on it). Statutory deductions (WIT, INSS, court orders) exempt. Proportional reduction with warning.

#### CALC-4: Negative Salary Rejection
- **Status:** `[x]` Done

#### CALC-5: Validation Function Called
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
- [x] Two-person payroll approval enforced (Firestore rules + service layer + UI)
- [x] Console logs stripped in production builds (esbuild drop)
- [x] Crypto-secure share tokens (crypto.getRandomValues)
- [x] Impersonation uses sessionStorage (expires on browser close)
- [x] 0 npm audit vulnerabilities

### All Issues Resolved

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| SEC-1 | Dev Firestore rules deployed to production | CRITICAL | `[x]` Done — deployed 2026-02-08 |
| SEC-2 | No input validation on payroll inputs | CRITICAL | `[x]` Done — NaN/Infinity rejected, caps enforced |
| SEC-3 | No rate limiting on bulk operations | HIGH | `[x]` Done — 499 record limit |
| SEC-4 | Console logs leak PII in production | MEDIUM | `[x]` Done — esbuild drop (verified in dist/) |
| SEC-5 | Math.random() for share tokens | LOW | `[x]` Done — crypto.getRandomValues() |
| SEC-6 | Date range not validated | MEDIUM | `[x]` Done — past 2y / future 1m |
| SEC-7 | Compliance override reason not validated | LOW | `[x]` Done — min 10 chars |
| SEC-8 | Impersonation persists in localStorage | MEDIUM | `[x]` Done — sessionStorage |
| SEC-9 | Double-submit on Expenses form | HIGH | `[x]` Done — saving state guard added |
| SEC-10 | Vulnerable xlsx dependency (prototype pollution + ReDoS) | HIGH | `[x]` Done — replaced with exceljs |

---

## 3. i18n & LOCALIZATION

### What's Done

- [x] Tetum (tet) translations: ~2,639 lines covering most UI
- [x] English (en) translations: ~2,631 lines
- [x] Currency correctly USD throughout
- [x] `formatDateTL()` uses Asia/Dili timezone (UTC+9)
- [x] `formatDateTL()` uses dd/mm/yyyy format (correct for TL)
- [x] PayslipPDF translated to Tetum (36 strings, language prop)
- [x] PayslipPDF date format fixed to dd/mm/yyyy (en-GB)

### Remaining

#### I18N-3: Hardcoded English in RunPayroll Dialogs
- **Severity:** LOW
- **Location:** `RunPayroll.tsx` — all dialog strings
- **Status:** `[x]` Done — 30 dialog strings extracted to i18n (en + tet)

---

## 4. MISSING FEATURES (Production Blockers)

### Critical — All Resolved

| Feature | Status | Notes |
|---------|--------|-------|
| Deploy production Firestore rules | `[x]` Done | Deployed 2026-02-08 |
| Input validation on payroll | `[x]` Done | NaN/Infinity rejected, caps enforced |
| Minimum wage enforcement | `[x]` Done | Inline warnings in payroll UI |
| Working hours limit warnings | `[x]` Done | Inline warnings in payroll UI |

### High — Blocks Practical Daily Use

| Feature | Status | Notes |
|---------|--------|-------|
| Leave request workflow UI | `[x]` Done | Self-service leave requests |
| Bank transfer file generation | `[x]` Done | TL bank formats supported |
| Payslip Tetum translation | `[x]` Done | 36 strings translated |
| Two-person payroll approval | `[x]` Done | UI + service + Firestore rules |
| Setup wizard (company TIN, bank) | `[x]` Done | Multi-step wizard |
| Contract expiry alerts | `[x]` Done | Integrated into DocumentAlertsCard, 90-day window |

### Medium — Limits Compliance Reporting

| Feature | Status | Notes |
|---------|--------|-------|
| ATTL e-Tax portal export | `[x]` Done | Excel export matching ATTL form format |
| Annual INSS reconciliation | `[x]` Done | `/reports/inss-annual` page with CSV export |
| Employer INSS on payslips | `[x]` Done | Employer contributions section on PayslipPDF |
| 13th month accrual display | `[x]` Done | Monthly accrual shown on TL payslips |

### Blocks Security Company Target Market

| Feature | Status | Notes |
|---------|--------|-------|
| Shift scheduling | `[ ]` Not built | Core requirement for security ops |
| Client/site-specific pay rates | `[ ]` Not built | Guards paid by assignment |
| Fingerprint CSV import | `[ ]` Not standardized | "What brand/model?" open question |
| Supervisor mobile interface | `[ ]` Not built | Field access needed |
| Weekly sub-payroll workflow | `[ ]` Partial | Calculation done, UI not complete |
| Late arrival tracking + warnings | `[ ]` Not built | 3-strike system in roadmap |

---

## 5. TEST COVERAGE

### Current Tests — 97 passing (3 test files)

- [x] Resident WIT calculation
- [x] Non-resident WIT calculation
- [x] INSS base exclusions (overtime, bonus)
- [x] INSS optional contribution bands
- [x] Subsidio Anual pro-ration (full year, mid-year, 1 month, future hire, payroll flag)
- [x] Sick leave tiers (100% tier, 50% tier, mixed straddle)
- [x] Weekly/biweekly threshold pro-ration
- [x] Overtime rate calculations (150%, 200%)
- [x] Night shift calculations (125%)
- [x] Holiday pay calculations
- [x] Edge cases (zero salary, min wage, $100K, employer cost, net pay, deduction cap)
- [x] Validation function (valid input, negative salary, below min wage, negative hours, excessive OT, sick day limit)

### Missing Tests

- [ ] Absence/late deductions
- [ ] Weekly reconciliation accuracy (sum = monthly)
- [x] Integration test: multi-employee batch payroll (18 tests)
- [ ] UI/component tests
- [ ] E2E tests (Playwright/Cypress)

---

## 6. BUILD & DEPENDENCIES

### Build Output (Feb 10, 2026)

| Chunk | Size | Gzipped | Notes |
|-------|------|---------|-------|
| `index` | 471KB | 129KB | Main app bundle |
| `vendor-firebase` | 527KB | 124KB | Firebase SDK (lazy candidates limited) |
| `vendor-ui` | 191KB | 55KB | Radix UI components |
| `vendor-react` | 144KB | 46KB | React runtime |
| `react-pdf.browser` | 1,591KB | 526KB | Lazy-loaded (only on payslip download) |
| `ATTLMonthlyWIT` | 971KB | 278KB | Lazy-loaded (only on ATTL export page) |
| `RunPayroll` | 94KB | 27KB | Code-split payroll page |

### Dependencies — 0 Vulnerabilities

- `xlsx` replaced with `exceljs` (actively maintained, no known vulns)
- All Vite/tooling vulnerabilities patched via `npm audit fix`
- npm audit: **0 vulnerabilities** as of 2026-02-10

### Build Configuration

- [x] Console/debugger stripped in production (esbuild `drop`, verified in dist/)
- [x] Vite mode-based detection (reliable `mode === "production"` check)
- [x] No source maps in production
- [x] Code-split with manual chunks (react, router, firebase, radix, tanstack)
- [x] PayslipPDF lazy-loaded via dynamic import() in all consumers
- [x] PayslipPDF removed from barrel export to prevent accidental static import
- [x] Package name corrected from "fusion-starter" to "onit-hr-payroll" v1.0.0

---

## 7. QUICKBOOKS COMPARISON

### Where OniT Wins (TL-Specific)

| Feature | OniT | QuickBooks |
|---------|------|------------|
| TL WIT calculation | Built-in, automatic | Manual custom item |
| TL INSS 4%/6% split | Built-in, automatic | Manual calculation |
| $500 threshold pro-ration | Automatic for weekly/biweekly | Not supported |
| Subsidio Anual (13th month) | Pro-rated calculation | Not supported |
| TL overtime rates (150%/200%) | Labor Code compliant | Generic overtime |
| Tetum language | UI + payslips translated | Not available |
| TL contract types | All 4 types | Not supported |
| TL tax returns (WIT/INSS) | ATTL Excel export | Not supported |
| TL date/timezone | Asia/Dili, dd/mm/yyyy | Not localized |
| Price for TL market | Custom (affordable) | $$$$ per user/month |

### Where QuickBooks Wins (Maturity)

| Feature | OniT | QuickBooks |
|---------|------|------------|
| Payroll workflow (run→pay) | Complete (with 2-person approval) | Complete |
| Bank integrations | TL banks supported | Extensive global |
| Payslip delivery | PDF only | Email/portal |
| Leave management | Self-service workflow | Full workflow |
| Mobile app | None | Full app |
| Audit trail | Comprehensive | Complete |
| User base / battle-tested | New | Millions |

---

## 8. REMEDIATION TRACKER

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
| 17 | Test: Subsidio Anual pro-ration | `[x]` Done — 5 tests |
| 18 | Test: Sick leave tiers | `[x]` Done — 3 tests |
| 19 | Test: Weekly threshold pro-ration | `[x]` Done — 3 tests |
| 20 | Test: Overtime/night/holiday rates | `[x]` Done — 5 tests |
| 21 | Test: Edge cases (zero, negative, huge) | `[x]` Done — 6 tests |
| 22 | Test: Validation function | `[x]` Done — 6 tests |

### Feb 10 Review — Additional Fixes

| # | Task | File | Status |
|---|------|------|--------|
| 23 | Replace vulnerable xlsx with exceljs | `attlExport.ts` | `[x]` Done — 0 npm vulns |
| 24 | Fix barrel export defeating PDF lazy-load | `payroll/index.ts` | `[x]` Done — removed static re-export |
| 25 | Add double-submit protection to Expenses | `Expenses.tsx` | `[x]` Done — saving state guard |
| 26 | Fix esbuild console drop reliability | `vite.config.ts` | `[x]` Done — uses Vite `mode` param |
| 27 | Fix package name and version | `package.json` | `[x]` Done — onit-hr-payroll v1.0.0 |
| 28 | Patch dependency vulnerabilities | `package.json` | `[x]` Done — npm audit fix |

### Feb 10 Review — Feature Additions

| # | Task | File | Status |
|---|------|------|--------|
| 29 | Deploy production Firestore rules | `firestore.rules` | `[x]` Done — deployed via `firebase deploy` |
| 30 | Add employer INSS (6%) to PayslipPDF | `PayslipPDF.tsx` | `[x]` Done — employer contributions section with i18n |
| 31 | Add Sentry error reporting | `main.tsx`, `ErrorBoundary.tsx`, `queryCache.ts` | `[x]` Done — @sentry/react, DSN via env var |
| 32 | Translate RunPayroll dialog strings (I18N-3) | `RunPayroll.tsx`, `translations.ts` | `[x]` Done — 30 strings in en + tet |
| 33 | Add contract expiry alerts | `DocumentAlertsCard.tsx`, `employeeService.ts` | `[x]` Done — 90-day window, contractEndDate field |
| 34 | Add integration test (multi-employee batch) | `payroll-integration.test.ts` | `[x]` Done — 18 tests (97 total) |
| 35 | Add annual INSS reconciliation report | `INSSAnnual.tsx`, `routes.tsx` | `[x]` Done — aggregates monthly filings, CSV export |
| 36 | Add 13th month accrual display | `PayslipPDF.tsx` | `[x]` Done — informational accrual on TL payslips |

---

## 9. REMAINING ITEMS (Non-Blocking)

| Item | Severity | Notes |
|------|----------|-------|
| CALC-2: Night shift premium in INSS base | MEDIUM | Needs INSS guidance verification |
| Security company features | N/A | Separate target market |
| E2E test suite (Playwright/Cypress) | MEDIUM | Unit/integration done, no browser tests |
| 726 `as any` type assertions | LOW | Gradual improvement over time |
| TypeScript strict mode | LOW | `strict: false` in tsconfig |

---

*Last updated: February 10, 2026*
*Audited by: Claude Code*
