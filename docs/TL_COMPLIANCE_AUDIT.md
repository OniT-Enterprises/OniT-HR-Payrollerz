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

---

## 2026-07-11 update — payroll/tax compliance pass (commit `2102cdd`)

A pass over the payroll engine, accounting posting, and statutory-filing aggregation.
All changes are covered by the unit suite (`tests/client/payroll-*.test.ts`,
207 passing) and typecheck/lint clean. Functions were also deployed. A
methodology summary for an external accountant was produced as an Artifact
(rates, formulas, worked examples, GL journal, and the open questions below).

### Rules corrected / clarified

- **Night work → additive +25% premium** (`nightShiftPremium: 0.25`), replacing the
  previous 125% (`1.25`) full-rate treatment. This aligns with the Labor Code
  citation in this document's sources ("night work (+25%)"). *Correct only if
  night hours are already counted within the employee's regular/base hours* — see
  open question 3.
- **Deduction cap → 30% / month** per **Lei 4/2012 Art. 42(3)**, replacing the
  erroneous 1/6 (~16.67%) ratio that traced to Portugal's Código do Trabalho.
  WIT and INSS are withheld in full (protected); court orders and other
  discretionary deductions share what remains of 30% of **wages paid**; unpaid
  absence/late are excluded (loss of pay, not a withheld amount).
- **`wagesPaid`** (gross less unpaid absence/late) is now the basis for statutory
  wages, taxable income, and **total employer cost** — so a salaried employee's
  separate sick-pay line and absent hours no longer overstate cost or the
  employer-INSS expense.
- **Resident vs non-resident WIT** rates are applied separately (resident: 10%
  above the pro-rated $500 threshold; non-resident: 10% from the first dollar).

### Configurability

`calculateTLPayroll()` now accepts a config sourced from tenant `PayrollConfig`,
so a tenant can override WIT resident/non-resident rates + threshold, INSS
employee/employer rates, overtime multipliers (standard + Sunday/holiday),
minimum wage, and max overtime/week. Defaults in `constants-tl.ts` are unchanged.

### Statutory filings & YTD

- Records now persist `wagesPaid`, `taxableIncome`, `witTaxableAmount`,
  `inssBase`, and `isResident`. The INSS monthly declaration and the ATTL wage
  income-tax return prefer these stored values, falling back to a rate-based
  reconstruction only for legacy records. WIT/INSS are summed across **all**
  matching lines on a record (previously only the first match was read).
- The run loads each employee's real **year-to-date** gross/WIT/INSS/sick-days
  from that year's *paid* records (previously hard-coded to 0). YTD sick days
  drive the tiered sick-pay steps; YTD totals feed annual reconciliation.

### Accounting

- Payroll journal posting is **idempotent** — approving the same run twice will
  not double-post (matches an existing posted entry by source).
- Adds ledger lines for loan/advance repayments (**1220**) and residual
  discretionary deductions (**2200** control account); guards against negative
  allocation remainders (refuses to post an unbalanced entry). New default
  account **2260 · Other Payroll Deductions Payable** added to the chart.

### Constant corrections (`taxConfig.ts` / `constants-tl.ts`)

- Maternity leave: **84 days** (14 pre-natal / 70 post-natal).
- Annual leave: flat **12 days** (removed the unsupported 15/18/22 service tiers).
- Removed the stale `severance` config block.
- Corrected the INSS optional (voluntary) contribution band multipliers.

### Functions

- New-tenant default timezone is **`Asia/Dili`** (was `UTC`).
- Overtime warning scales to **16 h/week × weeks-in-period** (was a flat 40 h).
- Weekly overtime threshold reads `payrollConfig.maxWorkHoursPerWeek` (fallback 44).

### VAT

- The VAT Returns screen is now gated behind a **platform-active flag**: it will
  not calculate, save, or mark a return filed until TL activates a national VAT
  regime. This supersedes the earlier concern about the VAT input-credit model —
  there is currently no live VAT math. See `VAT_ARCHITECTURE.md`.

### Open questions — need Nico / accountant sign-off

1. **Scope of the 30% cap** — we treat WIT + INSS as outside the cap (lenient
   reading of Art. 42(3)); a strict reading would count everything toward 30%.
2. **Carry-forward** — when a court order/loan is trimmed to fit the cap, the
   shortfall is simply not taken this period. Should the remainder roll forward,
   and is there a statutory limit?
3. **Night premium** — the additive +25% assumes night hours sit inside base
   pay. If a payroll records night hours as a separate block, 125% would apply.
   Confirm how night hours reach the engine.
4. **Non-resident WIT 10%** — confirm 10% (Law 8/2008) is current for all
   non-resident wage cases, not the superseded 20% flat (UNTAET Reg. 2000/32).
5. **Employer cost net of absence** — confirm wages-paid (not gross) is the right
   basis for cost reporting and the employer-INSS expense.
6. **INSS base exclusions** — confirm the excluded-items list (overtime,
   bonuses, commissions, gratuities, profit-sharing, per-diem/travel/food/
   housing/transport/representation) matches current INSS guidance.

