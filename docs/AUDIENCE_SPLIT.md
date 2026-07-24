# Audience split — accountant vs simple flow (`showAdvancedTax`)

Xefe serves two audiences: **first-time, non-accountant TL small businesses**
(the default — "simplicity is a hard requirement", see `DASHBOARD_DESIGN.md`)
and **accountants/bookkeepers** (power users, e.g. an accounting firm running
books for many clients). Accountant-grade tax machinery exists in the engine
for everyone, but its *controls and filing screens* are hidden from the simple
flow. This doc is the map. Shipped 2026-07-17.

## The primitive

`useAdvancedTax()` / `useTenant().showAdvancedTax` (client/contexts/TenantContext.tsx):

```
showAdvancedTax = session.role === 'accountant'
               || session.config.advancedTaxMode !== false   // TEMPORARY default-ON
```

> **TEMPORARY (2026-07-21, Tony's call):** the mode currently defaults **ON** —
> advanced controls show unless a tenant explicitly flips the Settings toggle
> off. Tenants that turned it off keep the simple flow. The original opt-in
> default (`=== true`) should be restored when the audience split is
> re-tightened for launch; `AdvancedTaxModeCard` mirrors the same default so
> the switch reflects reality.

- **`accountant`** is a new `TenantRole` (types/tenant.ts): full
  money/accounting/payroll control, **no administration** (members, employees,
  tenant doc, settings/integrations). Default modules:
  `staff, timeleave, payroll, money, accounting, reports` (staff/timeleave are
  read-paths payroll needs). `canManage()`/`canWrite()` include it.
- **`advancedTaxMode`** is a tenant-doc boolean — a UX mode, not a security
  boundary. Owner-only toggle in Settings (`AdvancedTaxModeCard`), for owners
  who do their own books. Superadmins can flip it while impersonating.
- Deliberately **not** `role ∈ {owner, hr-admin}` ⇒ advanced: every BillForm
  viewer is manage-capable, so that formula would make the split dead code and
  re-expose complexity to exactly the audience it protects.

## firestore.rules

`isTenantFinanceAdmin(tenantId)` = role ∈ {owner, hr-admin, accountant}. Used
for **writes** in the finance domain (payruns+payslips, accounts,
journalEntries, generalLedger, fiscal*, balanceSnapshots, qbExportLogs,
customers, invoices, payments_received, recurring_invoices, vendors, bills,
bill_payments, supplierWithholding*, taxClearanceRequests, cashAdvance*,
transactions, products, customerTabs, receiptCounters, vatReturns,
bankTransactions, invoice_links, mail create, settings except
`integrations`). Everything administrative stays `isTenantAdmin`.
Tests: `tests/rules/accountant-role.test.ts`.

## Gated surfaces (accountant-only)

Route gate: `<FeatureRoute requireAdvancedTax="money"|"payroll"|"accounting">` renders
`AccountantGate` (friendly explainer + link back + "owners can enable in
Settings" hint) instead of the screen. Nav gate: `advancedTaxOnly: true`
entries in `moduleNav.ts`; `filterModuleNavConfigByPermissions` hides them
unless its 5th arg is true (defaults to hidden).

| Surface | Gate |
|---|---|
| `/payroll/tax/monthly-wit` (ATTL WIT form + SupplierWithholdingRemittancePanel) | route + nav only — the deadline itself is never gated (see below) |
| `/accounting/tax/clearance` | route + nav |
| `/accounting/tax/vat-returns`, `/accounting/tax/vat-settings` | route + nav + Sitemap |
| `InstallmentTaxEtaxFiling` panel on the Accounting Income Statement | inline `showAdvancedTax` |

Monthly/Annual INSS stay visible to every manage user — INSS declarations are
every employer's obligation, and the tax-deadline info cards remain for all.

**Deadlines are never gated, only the forms are.** The WIT *screen* is
accountant-only, but the monthly wage-withholding *deadline* is every
employer's duty, so the PayrollDashboard attention row shows it to every manage
user (`showAdvancedTax` must not gate it) and links straight to
`/payroll/tax/monthly-wit`, where `AccountantGate` explains who files it. The
old `/payroll/tax` hub that simple-flow users were bounced to is gone: the
route now redirects to the most urgent filing the user can act on
(`pages/payroll/TaxReports.tsx`), so WIT-labelled entry points must link to
`/payroll/tax/monthly-wit` directly — routing them through `/payroll/tax`
lands a simple-flow tenant on the INSS return instead.
Annual business income tax also has a short preparation checklist for the
simple Accounting flow; advanced mode expands the same page into the full
GL-mapped workpaper. Wage WIT/INSS stay in Payroll, while the annual income
tax (TADR-IT 1), tax clearance, and VAT live in Accounting.

## Mixed screens — simple flow behavior (safe defaults)

- **BillForm**: "Supplier withholding" select hidden; default `'none'` ⇒ no
  withholding instruction. Values set by an accountant survive normalo edits
  (react-hook-form keeps unmounted field state). View mode + payment-dialog
  withholding breakdowns stay visible to everyone (money math, not controls).
- **Vendors**: "Supplier tax details" section hidden; simple saves never
  rebuild/re-validate `taxProfile` — new vendors get `null` ("not
  configured" ⇒ calculator yields no withholding), edits preserve the stored
  profile verbatim.
- **RunPayrollWizard / PayrollEmployeeRow**: bonus INSS category select
  hidden; a positive bonus auto-classifies as `individual_performance`
  (DL 20/2017 Art. 8 — the contributable, never-under-remits default; cleared
  back to null when the bonus is zeroed). Advanced mode must classify manually.
- **Offboarding**: Article 56 already auto-computes from tenure (frozen
  source-derived snapshot); engine `RangeError`s now surface under a
  "needs review" title.

## Soft-fail guards

`getStatutoryReviewFlag(error)` (lib/tax/statutory-payroll-record.ts)
classifies `MissingStatutoryPayrollDataError` / `MissingStatutorySourceDataError`
without throwing. Normalo-visible generation points (INSS monthly generate +
DR-Excel export) map it to `common.needsReviewTitle/Desc` ("fix that payroll,
ask your accountant") instead of a generic failure. Generation still refuses —
Xefe never infers compliance values. Accountant screens keep raw errors.

## Gotchas

- `AccountantGate` must stay **lazily** imported in FeatureRoute — FeatureRoute
  is in the entry graph and the gate pulls MainNavigation → firestore, which
  blows `scripts/check-entry-budget.mjs`. Same reason `AdvancedTaxModeCard`
  imports firestore dynamically.
- Accountants can still open a few screens whose writes rules deny (Add
  Employee, shift edits, QuickBooks connect is hidden). Non-crashing 403s;
  tighten per-member `modules` in the admin console if it bothers a real
  tenant. No real tenants existed at ship time.
- i18n: gate strings live at `accounting.dashboard.accountantGate*`; edit
  `client/i18n/locales/{en,pt,tet}.ts` then `pnpm i18n:rebuild-master`.
