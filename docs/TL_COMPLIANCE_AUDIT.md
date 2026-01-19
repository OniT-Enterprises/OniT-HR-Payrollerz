# Timor-Leste Payroll/Tax & Accounting Audit (OniT)

Date: 2026-01-18

This document summarizes the current state of Timor‑Leste payroll/tax/accounting features in this repo, compares them to official guidance, and lists prioritized fixes to reach “best‑in‑Timor” compliance and UX.

## Authoritative sources used

- **ATTL – Wage Income Tax (WIT)**: resident threshold, 10% rate, due date rules (incl. next business day when due date falls on weekend/holiday).
  - https://attl.gov.tl/en/wage-income-tax/
- **INSS – Contribution base + rates + deadlines**: 4% employee, 6% employer; what is included/excluded from the contribution base; reporting/payment windows.
  - https://segurancasocial.gov.tl/contributions/
  - https://segurancasocial.gov.tl/employers/
- **Labor Code (Law 4/2012)**: overtime (+50%), rest day/mandatory holiday work (+100%), night work (+25%), sick leave pay (12 days/year, 6 days 100% + 6 days 50%), annual allowance/13th month (>= 1 month salary by Dec 20).
  - https://www.ilo.org/dyn/travail/docs/1834/Labour%20Code%20Timor%20Leste.pdf

## What’s already implemented (high level)

- **TL payroll calculation engine**: `client/lib/payroll/calculations-tl.ts` + `client/lib/payroll/constants-tl.ts`
  - WIT (10% above $500/mo for residents, 10% from first dollar for non‑residents)
  - INSS employee/employer contributions
  - Overtime multipliers, sick‑pay calculation, 13th month pro‑rata helper
- **Payroll UI flow**: `client/pages/payroll/RunPayroll.tsx`, `client/pages/payroll/PayrollHistory.tsx`, exports, payslip PDF.
- **Accounting module**: chart of accounts + journal entries + general ledger + trial balance
  - Payroll summary posting includes WIT + INSS payables.
- **ATTL Monthly WIT return UX**: `client/pages/reports/ATTLMonthlyWIT.tsx` + PDF/CSV export.
- **Archiving & audit log**: retention helpers and audit logging exist (5‑year defaults).

## Key compliance/feature gaps (must-fix)

### 1) INSS contribution base is mis-modeled in TL payroll engine

INSS guidance explicitly **excludes** items such as **overtime**, many **bonuses/gratuities**, and **subsistence subsidies** (transport/board/lodging/travel). Current TL payroll engine marks several of these as `isINSSBase: true`, which can materially over‑withhold INSS and cause compliance issues.

### 2) Deadlines (INSS) are currently hard-coded incorrectly in the UX

INSS indicates reporting/payment windows (reporting between 1st–10th; payment between 10th–20th of the following month). Current UI shows “due by 10th” in places.

### 3) `/payroll/taxes` points to US forms (941/W‑2) instead of TL filings

The route exists but the page content is not Timor‑Leste specific, which creates risk and confusion.

### 4) Payroll run lifecycle isn’t fully wired to tax filings

Tax filings are generated from **paid** payroll runs, but the current “Process payroll” flow does not reliably mark runs as paid, and some creation APIs override `status` to `draft`.

### 5) Holiday logic is not safe for movable holidays

The current helper maps 2025 holidays by string replacement of the year, which is incorrect for movable feasts (e.g., Good Friday, Corpus Christi) and can affect holiday pay.

### 6) Mixed models (generic payroll vs TL payroll)

There are parallel “generic” payroll types (US‑centric) and TL‑specific ones, and some pages/components still rely on the generic model, which causes mismatched labels and reporting.

## Recommended implementation priorities

1. **Fix TL INSS base classification** (engine + UI inputs) to align with INSS guidance.
2. **Fix payroll run lifecycle** so a processed payroll run:
   - writes run + records atomically
   - marks status correctly (draft/approved/paid)
   - posts a journal entry and stores linkage
3. **Replace `/payroll/taxes` with a TL Tax Center**:
   - Monthly WIT return generation/tracking (reuse ATTL page logic)
   - Monthly INSS contribution report (CSV/PDF) + filing tracking
   - Due date dashboard (WIT 15th; INSS reporting 10th + payment 20th, business-day adjustment)
4. **Make holiday logic deterministic**:
   - compute Easter-based holidays per year
   - allow admin override list in Firestore (preferred) or settings
5. **Clean up defaults** (settings) so new tenants start compliant.
6. **Tenant isolation**: migrate payroll/tax/accounting data to tenant-scoped paths (or at minimum require `tenantId` and enforce in rules).

