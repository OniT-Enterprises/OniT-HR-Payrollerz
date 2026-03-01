# Accounting Module Audit — March 2026

Full review of the accounting interface from a professional accountant's perspective. Each issue is categorized by severity and tagged with the files that need changes.

---

## Current State Summary

The accounting module is a **double-entry bookkeeping system** with:
- Chart of Accounts (COA) with ~50 TL-specific default accounts
- Journal entries (manual + auto-posted from payroll/invoices/bills/expenses)
- General Ledger per account with running balances
- Trial Balance with balance check
- Dashboard with payroll posting status and pending items
- NGO reporting integration (payroll allocation, donor export)

**Files:**
| Component | File | Lines |
|-----------|------|-------|
| Dashboard | `client/pages/AccountingDashboard.tsx` | 630 |
| Chart of Accounts | `client/pages/accounting/ChartOfAccounts.tsx` | 787 |
| Journal Entries | `client/pages/accounting/JournalEntries.tsx` | ~850 |
| General Ledger | `client/pages/accounting/GeneralLedger.tsx` | 434 |
| Trial Balance | `client/pages/accounting/TrialBalance.tsx` | 522 |
| Types | `client/types/accounting.ts` | 654 |
| Service | `client/services/accountingService.ts` | ~1520 |
| Hooks | `client/hooks/useAccounting.ts` | ~350 |
| Default COA | `client/lib/accounting/chart-of-accounts.ts` | ~300 |
| Routes | `routes.tsx` (accounting section) | — |

---

## CRITICAL — Issues that would prevent accountant sign-off

### C1. Trial Balance only shows closing columns

**Problem:** The `TrialBalanceRow` type defines 6 balance fields: `openingDebit`, `openingCredit`, `periodDebit`, `periodCredit`, `closingDebit`, `closingCredit`. But the UI (`TrialBalance.tsx:384-485`) only renders `closingDebit` and `closingCredit`. A proper trial balance should use the **3-column format**: Opening Balance | Period Movement | Closing Balance.

**Impact:** Accountants cannot verify period activity vs. prior balances. This is fundamental to month-end close procedures.

**Files:** `client/pages/accounting/TrialBalance.tsx`, `client/services/accountingService.ts` (generateTrialBalance needs to compute opening vs. period splits)

**Fix:** Add Opening and Period columns to the table. Update `generateTrialBalance` to separate pre-period entries (opening) from in-period entries (movement). CSV export must also include all 6 columns.

---

### C2. No Income Statement (P&L) page

**Problem:** Types are fully defined (`IncomeStatement`, `IncomeStatementRow` in `types/accounting.ts:239-268`) but there is no page, service method, or hook to generate one. This is one of the two most essential financial statements.

**Impact:** Accountants cannot report profit/loss for any period. Business owners cannot answer "did we make money this month?"

**Files to create:**
- `client/pages/accounting/IncomeStatement.tsx` — new page
- `client/services/accountingService.ts` — add `generateIncomeStatement` method
- `client/hooks/useAccounting.ts` — add `useGenerateIncomeStatement` hook
- `routes.tsx` — add `/accounting/income-statement` route

**Requirements:**
- Date range selector (period start → end)
- Revenue section grouped by account
- Expense section grouped by account
- Subtotals for each section
- Net Income / Net Loss bottom line
- Comparison with prior period (optional)
- CSV export + Print

---

### C3. No Balance Sheet page

**Problem:** Types are fully defined (`BalanceSheet`, `BalanceSheetRow` in `types/accounting.ts:270-301`) but there is no page. The fundamental accounting equation (Assets = Liabilities + Equity) cannot be verified.

**Impact:** Cannot produce the second core financial statement. Required for audits, bank loans, donor compliance.

**Files to create:**
- `client/pages/accounting/BalanceSheet.tsx` — new page
- `client/services/accountingService.ts` — add `generateBalanceSheet` method
- `client/hooks/useAccounting.ts` — add `useGenerateBalanceSheet` hook
- `routes.tsx` — add `/accounting/balance-sheet` route

**Requirements:**
- "As of" date selector
- Assets section (current assets, fixed assets, subtotals)
- Liabilities section (current, long-term, subtotals)
- Equity section (capital, retained earnings, current year earnings)
- Balance check: Assets = Liabilities + Equity
- CSV export + Print

---

### C4. Void entry does not create reversing GL entries

**Problem:** `voidJournalEntry` (standalone, `accountingService.ts:333-349`) only updates the journal entry status to `void` but does NOT write reversing GL entries. Meanwhile, `voidJournalEntryInTransaction` (used when deleting source documents) DOES create reversals. This means:
- Manually voiding a posted entry leaves the GL impact in place
- Trial balance will include voided entry amounts
- GL and journal entries go out of sync

**Impact:** The General Ledger becomes unreliable. An accountant reconciling GL to journal entries would find unexplainable balances from voided entries.

**Files:** `client/services/accountingService.ts` — `voidJournalEntry` method (line 333)

**Fix:** The standalone `voidJournalEntry` must also create reversing GL entries (swap debit/credit for each line), identical to what `voidJournalEntryInTransaction` does. Should use a transaction to update status + write reversals atomically.

---

### C5. GL running balance ignores normal balance direction

**Problem:** `GeneralLedgerService.getEntriesByAccount` (`accountingService.ts`) computes running balance as cumulative `debit - credit` for all accounts. But:
- **Asset & Expense accounts**: normal balance = debit (debit - credit is correct)
- **Liability, Equity & Revenue accounts**: normal balance = credit (should be credit - debit)

**Impact:** An accountant viewing the GL for "Accounts Payable" (liability) would see negative running balances when the account has a normal credit balance. Confusing and incorrect presentation.

**Files:** `client/services/accountingService.ts` — `getEntriesByAccount` method, `client/pages/accounting/GeneralLedger.tsx`

**Fix:** Pass the account type to the balance calculation. For liability/equity/revenue accounts, compute balance as `credit - debit`. Display direction should match normal balance.

---

## HIGH — Significantly degrades the accounting experience

### H1. Account type labels are raw English strings everywhere

**Problem:** Multiple pages display account types as hardcoded English strings instead of using i18n translations. Examples:

| File | Line(s) | What it shows |
|------|---------|---------------|
| `TrialBalance.tsx` | 353 | Summary cards: `{type}` → "asset" |
| `TrialBalance.tsx` | 404-406 | Group headers: `{type}` uppercase → "ASSET" |
| `TrialBalance.tsx` | 441 | Subtotal labels: `type.charAt(0).toUpperCase()` → "Asset" |
| `ChartOfAccounts.tsx` | 321 | Type badges: `account.type.charAt(0).toUpperCase()` → "Asset" |
| `GeneralLedger.tsx` | 312 | Account summary: `selectedAccount.type.charAt(0).toUpperCase()` → "Asset" |
| `GeneralLedger.tsx` | 252 | Account dropdown group headers: `{type}` → "asset" |

**Impact:** In Portuguese or Tetum mode, accountants see a mix of translated UI and English type labels. Looks unprofessional and confusing.

**Fix:** Replace all `{type}` / `type.charAt(0).toUpperCase() + type.slice(1)` with `t("accounting.chartOfAccounts." + type)` or similar i18n key. Translation keys already exist: `t("accounting.chartOfAccounts.asset")`, etc.

---

### H2. General Ledger lacks opening balance row

**Problem:** The GL page shows transactions for a date range with a running balance. But there is no "Opening Balance" row at the top showing the cumulative balance of all transactions before the `startDate`.

**Impact:** If an account has $10,000 in prior-period activity and the user views just the current month, the running balance starts at the first transaction's amount rather than adding to the $10,000 opening. The ending balance shown is wrong.

**Files:** `client/services/accountingService.ts` — `getEntriesByAccount`, `client/pages/accounting/GeneralLedger.tsx`

**Fix:** Query all GL entries before `startDate` for the selected account, compute the opening balance, and insert a synthetic "Opening Balance" row at the top of the list. Running balance should start from this amount.

---

### H3. No period closing / locking UI

**Problem:** `FiscalPeriodService` has `closePeriod` and `createFiscalYear` methods in the service layer, but there is no UI anywhere to:
- Create a fiscal year
- View fiscal periods (months)
- Close a period (preventing further entries)
- Lock a period (permanent)

**Impact:** Anyone can backdate journal entries to any prior period. This is a fundamental internal control issue. Auditors would flag this immediately.

**Files to create/modify:**
- Add period management to Accounting Dashboard or create `client/pages/accounting/FiscalPeriods.tsx`
- Add route `/accounting/fiscal-periods`
- Link from dashboard Accounting Tools section

**Requirements:**
- View all fiscal periods for current year (12 months)
- Status badges: Open / Closed / Locked
- Close period button (prevents new entries in that period)
- Create fiscal year for next year
- Warning when trying to post to a closed period

---

### H4. No opening balance entry workflow

**Problem:** `FiscalYear` has an `openingBalancesPosted` flag and `openingBalanceEntryId` reference, but there is no UI to:
- Enter opening balances when first setting up the system
- Carry forward closing balances to a new fiscal year

**Impact:** When a company starts using the system mid-year, there's no way to enter existing account balances. The trial balance and financial statements would be incomplete.

**Files:** Would need a new dialog or page in the accounting section.

**Requirements:**
- Form to enter debit/credit for each account as of a specific date
- Auto-creates a journal entry with source = `opening`
- Links to fiscal year via `openingBalanceEntryId`
- Can only be done once per fiscal year (or re-done by voiding the prior one)

---

### H5. Trial Balance dark mode colors broken

**Problem:** `TrialBalance.tsx:309` — The balance status card uses:
```tsx
className={isBalanced ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}
```
No `dark:` variants. In dark mode, these render as bright white/green/red boxes against the dark background.

**Files:** `client/pages/accounting/TrialBalance.tsx` (line 309)

**Fix:** Add dark variants:
```tsx
isBalanced
  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
```
Also fix text colors on lines 317-320 and 325-329 (green-800/red-800 need dark variants).

---

### H6. CSV export headers are English-only

**Problem:** Both GL and Trial Balance CSV exports use hardcoded English column headers:
- `GeneralLedger.tsx:109`: `['Date', 'Entry #', 'Description', 'Debit', 'Credit', 'Balance']`
- `TrialBalance.tsx:135`: `['Account Code', 'Account Name', 'Type', 'Debit', 'Credit']`

**Impact:** Portuguese or Tetum users export a CSV and see English headers. Minor but inconsistent with the i18n effort.

**Files:** `client/pages/accounting/GeneralLedger.tsx`, `client/pages/accounting/TrialBalance.tsx`

**Fix:** Use `t()` for all CSV headers, e.g., `[t("accounting.generalLedger.date"), t("accounting.generalLedger.entryNumber"), ...]`

---

## MEDIUM — Functional gaps that limit usability

### M1. No recurring journal entries

**Problem:** Many accounting entries repeat monthly: rent accrual, depreciation, insurance amortization. There is no way to create a template journal entry and auto-post it each period.

**Impact:** Accountants must manually re-create the same entries every month. Error-prone and tedious.

**Future feature** — lower priority than the Critical/High items.

---

### M2. No depreciation schedule

**Problem:** Accounts 1500-1590 (fixed assets, accumulated depreciation) and 5800 (depreciation expense) exist in the COA, but there is no:
- Fixed asset register
- Depreciation calculation (straight-line, declining balance)
- Auto-generated monthly depreciation entries

**Impact:** Businesses with fixed assets must manually calculate and post depreciation entries.

**Future feature** — would need a new `FixedAsset` type and service.

---

### M3. No audit trail viewer

**Problem:** `AccountingAuditLog` type is fully defined (`types/accounting.ts:592-615`) with actions like `account_created`, `journal_posted`, `journal_voided`, `period_closed`, etc. But there is no UI to view these logs and no service writing them.

**Impact:** No visibility into who changed what and when. Required for audits.

**Files to create:** `client/pages/accounting/AuditTrail.tsx` or add to admin section.

---

### M4. Bank reconciliation not in accounting section

**Problem:** Bank reconciliation exists in the Money module (`bankReconciliationService.ts`) but is not accessible from the Accounting dashboard or tools. Accountants would expect to find it under Accounting.

**Fix:** Add a link in the Accounting Tools section to the existing bank reconciliation page.

---

### M5. Journal entry — no reversal action

**Problem:** You can void an entry (which should mark it as void + create reversals per C4). But there is no explicit "Create Reversing Entry" action that creates a new journal entry with debits and credits swapped. This is standard practice for period-end accruals that need to be reversed at the start of the next period.

**Impact:** Accountants must manually create reversal entries by re-entering all the lines with amounts swapped.

**Fix:** Add a "Reverse" action on posted journal entries that pre-populates a new entry dialog with all lines swapped (debit ↔ credit).

---

### M6. SubType field not selectable in COA form

**Problem:** The COA add/edit form collects `subType` in the form data (`ChartOfAccounts.tsx:94`) with a default of `"other_asset"`, but there is no dropdown/selector in the dialog for the user to choose the correct subType. It silently defaults.

**Impact:** All custom accounts get a generic subType regardless of what they actually are. This matters for financial statement presentation (current vs. fixed assets, current vs. long-term liabilities).

**Fix:** Add a subType selector to the add/edit dialog, filtered by the selected account type.

---

### M7. No multi-period comparison on Trial Balance

**Problem:** The trial balance generates for a single point in time. There is no option to compare with a prior period or prior year side-by-side.

**Impact:** Accountants reviewing month-over-month or year-over-year trends must manually export and compare in Excel.

**Future feature** — nice-to-have after the core column fix (C1).

---

## LOW — Polish items

### L1. Dashboard "Accounting Tools" defaults to expanded

**Problem:** `AccountingDashboard.tsx:151` — `useState(true)` means the tools section starts expanded. The comment on line 190 says "collapsed by default" but the code does the opposite.

**Fix:** Change to `useState(false)` to match the intended behavior.

---

### L2. Account dropdown in GL/JE doesn't show account codes prominently

**Problem:** The account selector in General Ledger and Journal Entries shows `{code} - {name}` but uses a generic `SelectItem` with no visual grouping beyond the type header. For 50+ accounts this gets unwieldy.

**Improvement:** Consider showing the code in a monospace font with the account type color-coded, or add a search/filter capability to the dropdown.

---

### L3. Journal entry "Optional" placeholder not translated

**Problem:** `JournalEntries.tsx:578` — Line description input has `placeholder="Optional"` hardcoded in English.

**Fix:** Use `t("common.optional")` or similar.

---

### L4. No keyboard shortcuts for common actions

**Problem:** The Journal Entry form requires mouse clicks for adding lines, selecting accounts, etc. Power users (accountants entering many entries) would benefit from Tab-to-next-field and keyboard shortcuts.

**Future improvement.**

---

### L5. Print CSS only on Trial Balance

**Problem:** Only `TrialBalance.tsx` has `@media print` CSS rules. The General Ledger, Journal Entries, and future financial statements would also benefit from print-optimized layouts.

**Fix:** Add consistent print styles across all accounting pages.

---

## Fix Priority Order

### Phase 1 — Critical fixes (do first)
1. **C4** — Fix void to create reversing GL entries
2. **C5** — Fix GL running balance for credit-normal accounts
3. **C1** — Add opening/period/closing columns to Trial Balance
4. **H1** — Replace all hardcoded English type labels with i18n

### Phase 2 — Core financial statements
5. **C2** — Build Income Statement (P&L) page
6. **C3** — Build Balance Sheet page
7. **H2** — Add opening balance row to General Ledger

### Phase 3 — Internal controls & workflow
8. **H3** — Build fiscal period management UI
9. **H4** — Build opening balance entry workflow
10. **M5** — Add "Reverse Entry" action on journal entries
11. **M6** — Add subType selector to COA form

### Phase 4 — Polish & exports
12. **H5** — Fix Trial Balance dark mode colors
13. **H6** — Translate CSV export headers
14. **L1** — Fix dashboard tools collapsed state
15. **L3** — Translate "Optional" placeholder
16. **L5** — Add print CSS to all accounting pages

### Phase 5 — Future enhancements
17. **M1** — Recurring journal entries
18. **M2** — Depreciation schedules
19. **M3** — Audit trail viewer
20. **M4** — Link bank reconciliation from accounting
21. **M7** — Multi-period comparison on Trial Balance
22. **L2** — Improve account selector UX
23. **L4** — Keyboard shortcuts

---

*Audit date: March 1, 2026*
*Reviewer: Claude Code (Opus 4.6)*
