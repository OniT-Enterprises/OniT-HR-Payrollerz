# QuickBooks Export Implementation Plan

## Overview

Add the ability to export payroll journal entries from OniT in QuickBooks-compatible formats, enabling seamless integration between OniT (payroll/HR/compliance) and QuickBooks (general accounting).

---

## Feature Scope

### In Scope
1. **CSV Export** - Universal format for QuickBooks Online import
2. **IIF Export** - QuickBooks Desktop format (still widely used in TL)
3. **Account Mapping** - User-configurable mapping to their QB chart of accounts
4. **Export History** - Log of exports for audit trail

### Out of Scope (Future)
- Direct QuickBooks API integration (requires OAuth, Intuit partnership)
- Real-time sync
- Two-way data flow

---

## Technical Design

### 1. Data Model

#### Account Mapping Type
```typescript
// client/types/quickbooks.ts

export interface QBAccountMapping {
  id?: string;
  onitAccount: string;           // OniT account code
  onitAccountName: string;       // Display name
  qbAccountNumber?: string;      // User's QB account number
  qbAccountName: string;         // User's QB account name
  accountType: 'expense' | 'liability' | 'asset';
  isDefault: boolean;            // Use default if no custom mapping
}

export interface QBExportSettings {
  defaultFormat: 'csv' | 'iif';
  includeEmployeeDetail: boolean;
  groupByDepartment: boolean;
  accountMappings: QBAccountMapping[];
}

export interface QBExportLog {
  id?: string;
  payrunId: string;
  payrunDate: string;
  exportDate: string;
  exportedBy: string;
  format: 'csv' | 'iif';
  fileName: string;
  recordCount: number;
  totalDebits: number;
  totalCredits: number;
}
```

#### Default Account Mappings (Timor-Leste Payroll)
```typescript
const DEFAULT_MAPPINGS: QBAccountMapping[] = [
  // Expenses
  { onitAccount: '6100', onitAccountName: 'Salary Expense', qbAccountName: 'Payroll Expenses', accountType: 'expense', isDefault: true },
  { onitAccount: '6110', onitAccountName: 'INSS Employer Expense', qbAccountName: 'Payroll Expenses:Employer Taxes', accountType: 'expense', isDefault: true },
  { onitAccount: '6120', onitAccountName: 'Overtime Expense', qbAccountName: 'Payroll Expenses:Overtime', accountType: 'expense', isDefault: true },
  { onitAccount: '6130', onitAccountName: '13th Month Expense', qbAccountName: 'Payroll Expenses:13th Month', accountType: 'expense', isDefault: true },

  // Liabilities
  { onitAccount: '2100', onitAccountName: 'WIT Payable', qbAccountName: 'Payroll Liabilities:WIT Payable', accountType: 'liability', isDefault: true },
  { onitAccount: '2110', onitAccountName: 'INSS Employee Payable', qbAccountName: 'Payroll Liabilities:INSS Employee', accountType: 'liability', isDefault: true },
  { onitAccount: '2120', onitAccountName: 'INSS Employer Payable', qbAccountName: 'Payroll Liabilities:INSS Employer', accountType: 'liability', isDefault: true },
  { onitAccount: '2130', onitAccountName: 'Net Payroll Payable', qbAccountName: 'Payroll Liabilities:Wages Payable', accountType: 'liability', isDefault: true },
  { onitAccount: '2140', onitAccountName: '13th Month Accrual', qbAccountName: 'Payroll Liabilities:13th Month Accrual', accountType: 'liability', isDefault: true },

  // Assets (for bank payment)
  { onitAccount: '1000', onitAccountName: 'Cash/Bank', qbAccountName: 'Checking', accountType: 'asset', isDefault: true },
];
```

### 2. Export Service

```typescript
// client/services/quickbooksExportService.ts

class QuickBooksExportService {
  // Generate CSV for QuickBooks Online
  generateCSV(payrun: Payrun, mappings: QBAccountMapping[]): string

  // Generate IIF for QuickBooks Desktop
  generateIIF(payrun: Payrun, mappings: QBAccountMapping[]): string

  // Build journal entry lines from payrun
  buildJournalLines(payrun: Payrun): JournalLine[]

  // Apply account mappings
  mapAccounts(lines: JournalLine[], mappings: QBAccountMapping[]): MappedLine[]

  // Log export for audit
  logExport(log: QBExportLog): Promise<void>

  // Get export history
  getExportHistory(payrunId?: string): Promise<QBExportLog[]>
}
```

### 3. CSV Format (QuickBooks Online)

QuickBooks Online accepts journal entries via CSV with this structure:

```csv
*TRNS,DATE,ACCNT,NAME,CLASS,AMOUNT,DOCNUM,MEMO
TRNS,01/31/2026,Payroll Expenses,,Payroll,45000.00,PAY-2026-01,January 2026 Payroll
SPL,01/31/2026,Payroll Liabilities:WIT Payable,,Payroll,-4500.00,PAY-2026-01,WIT 10%
SPL,01/31/2026,Payroll Liabilities:INSS Employee,,Payroll,-1800.00,PAY-2026-01,INSS 4%
SPL,01/31/2026,Payroll Liabilities:INSS Employer,,Payroll,-2700.00,PAY-2026-01,INSS 6%
SPL,01/31/2026,Payroll Expenses:Employer Taxes,,Payroll,2700.00,PAY-2026-01,INSS Employer
SPL,01/31/2026,Payroll Liabilities:Wages Payable,,Payroll,-38700.00,PAY-2026-01,Net Pay
ENDTRNS
```

**Alternative simple CSV format** (for Transaction Pro Importer):
```csv
RefNumber,TxnDate,Account,Debit,Credit,Memo,Name,Class
PAY-2026-01,01/31/2026,Payroll Expenses,45000.00,,January 2026 Payroll,,Payroll
PAY-2026-01,01/31/2026,WIT Payable,,4500.00,WIT 10%,,Payroll
PAY-2026-01,01/31/2026,INSS Employee Payable,,1800.00,INSS 4%,,Payroll
PAY-2026-01,01/31/2026,INSS Employer Payable,,2700.00,INSS 6%,,Payroll
PAY-2026-01,01/31/2026,INSS Employer Expense,2700.00,,INSS Employer,,Payroll
PAY-2026-01,01/31/2026,Wages Payable,,38700.00,Net Pay,,Payroll
```

### 4. IIF Format (QuickBooks Desktop)

```
!TRNS	TRNSID	TRNSTYPE	DATE	ACCNT	NAME	CLASS	AMOUNT	DOCNUM	MEMO
!SPL	SPLID	TRNSTYPE	DATE	ACCNT	NAME	CLASS	AMOUNT	DOCNUM	MEMO
!ENDTRNS
TRNS		GENERAL JOURNAL	01/31/2026	Payroll Expenses			45000.00	PAY-2026-01	January 2026 Payroll
SPL		GENERAL JOURNAL	01/31/2026	Payroll Liabilities:WIT Payable			-4500.00	PAY-2026-01	WIT 10%
SPL		GENERAL JOURNAL	01/31/2026	Payroll Liabilities:INSS Employee			-1800.00	PAY-2026-01	INSS 4%
SPL		GENERAL JOURNAL	01/31/2026	Payroll Liabilities:INSS Employer			-2700.00	PAY-2026-01	INSS 6%
SPL		GENERAL JOURNAL	01/31/2026	Payroll Expenses:Employer Taxes			2700.00	PAY-2026-01	INSS Employer
SPL		GENERAL JOURNAL	01/31/2026	Payroll Liabilities:Wages Payable			-38700.00	PAY-2026-01	Net Pay
ENDTRNS
```

---

## UI Design

### 1. Export Button Location

**Payroll History Page** (`/payroll/history`)

Add to each payrun row's action menu:
```
[View] [Download Payslips] [Export to QuickBooks ▾]
                              ├── Export as CSV (QuickBooks Online)
                              └── Export as IIF (QuickBooks Desktop)
```

### 2. Export Dialog

When user clicks export:

```
┌─────────────────────────────────────────────────────────────┐
│ Export to QuickBooks                                    [X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Payroll: January 2026                                       │
│ Pay Date: January 31, 2026                                  │
│ Employees: 45                                               │
│ Total: $48,200.00                                           │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Export Format                                           │ │
│ │ ○ CSV (QuickBooks Online)  ◉ Recommended               │ │
│ │ ○ IIF (QuickBooks Desktop)                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Options                                                 │ │
│ │ ☑ Include employee detail in memo                      │ │
│ │ ☐ Group by department                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Account Mapping: Using defaults [Configure →]               │
│                                                             │
│ Preview:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Account                    │ Debit      │ Credit       │ │
│ ├────────────────────────────┼────────────┼──────────────┤ │
│ │ Payroll Expenses           │ $45,000.00 │              │ │
│ │ INSS Employer Expense      │ $2,700.00  │              │ │
│ │ WIT Payable                │            │ $4,500.00    │ │
│ │ INSS Employee Payable      │            │ $1,800.00    │ │
│ │ INSS Employer Payable      │            │ $2,700.00    │ │
│ │ Wages Payable              │            │ $38,700.00   │ │
│ ├────────────────────────────┼────────────┼──────────────┤ │
│ │ TOTAL                      │ $47,700.00 │ $47,700.00   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                        [Cancel]  [Download Export File]     │
└─────────────────────────────────────────────────────────────┘
```

### 3. Account Mapping Settings

**Location**: Settings → Integrations → QuickBooks Export

```
┌─────────────────────────────────────────────────────────────┐
│ QuickBooks Export Settings                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Default Export Format: [CSV (QuickBooks Online) ▾]          │
│                                                             │
│ Account Mappings                                            │
│ Map OniT payroll accounts to your QuickBooks chart of       │
│ accounts. Leave blank to use default names.                 │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ EXPENSES                                              │   │
│ ├───────────────────────────────────────────────────────┤   │
│ │ Salary Expense                                        │   │
│ │ OniT: 6100                                            │   │
│ │ QuickBooks: [Payroll Expenses________________] [▾]    │   │
│ │                                                       │   │
│ │ INSS Employer Expense                                 │   │
│ │ OniT: 6110                                            │   │
│ │ QuickBooks: [Payroll Expenses:Employer Taxes_] [▾]    │   │
│ │                                                       │   │
│ │ Overtime Expense                                      │   │
│ │ OniT: 6120                                            │   │
│ │ QuickBooks: [Payroll Expenses:Overtime_______] [▾]    │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ LIABILITIES                                           │   │
│ ├───────────────────────────────────────────────────────┤   │
│ │ WIT Payable                                           │   │
│ │ OniT: 2100                                            │   │
│ │ QuickBooks: [Payroll Liabilities:WIT_________] [▾]    │   │
│ │                                                       │   │
│ │ INSS Employee Payable                                 │   │
│ │ OniT: 2110                                            │   │
│ │ QuickBooks: [Payroll Liabilities:INSS Emp____] [▾]    │   │
│ │                                                       │   │
│ │ Net Payroll Payable                                   │   │
│ │ OniT: 2130                                            │   │
│ │ QuickBooks: [Payroll Liabilities:Wages Payable] [▾]   │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ [Reset to Defaults]                          [Save Changes] │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
client/
├── services/
│   └── quickbooksExportService.ts    # NEW: Export logic
├── types/
│   └── quickbooks.ts                  # NEW: QB types
├── components/
│   └── payroll/
│       └── QuickBooksExportDialog.tsx # NEW: Export dialog
├── pages/
│   ├── payroll/
│   │   └── PayrollHistory.tsx         # MODIFY: Add export action
│   └── settings/
│       └── Settings.tsx               # MODIFY: Add integrations tab
└── i18n/
    └── translations.ts                # MODIFY: Add QB translations
```

---

## Implementation Steps

### Step 1: Types & Service (30 min)
- Create `client/types/quickbooks.ts`
- Create `client/services/quickbooksExportService.ts`
- Implement CSV and IIF generators
- Unit test the format outputs

### Step 2: Export Dialog (45 min)
- Create `QuickBooksExportDialog.tsx`
- Preview table showing journal lines
- Format selection (CSV/IIF)
- Download trigger

### Step 3: Payroll History Integration (30 min)
- Add export action to payrun row menu
- Wire up dialog to payrun data
- Test export flow

### Step 4: Account Mapping Settings (45 min)
- Add Integrations tab to Settings
- Build mapping form
- Save/load from Firestore
- Apply mappings in export

### Step 5: i18n & Polish (30 min)
- Add translations (EN, PT, TET)
- Error handling
- Loading states
- Success toasts

---

## Journal Entry Logic

### From Payrun to Journal Lines

```typescript
function buildJournalLines(payrun: Payrun): JournalLine[] {
  const lines: JournalLine[] = [];

  // Aggregate totals from all payslips
  let totalGross = 0;
  let totalWIT = 0;
  let totalINSSEmployee = 0;
  let totalINSSEmployer = 0;
  let totalNet = 0;
  let totalOvertime = 0;

  for (const payslip of payrun.payslips) {
    totalGross += payslip.grossPay;
    totalWIT += payslip.deductions.wit || 0;
    totalINSSEmployee += payslip.deductions.inssEmployee || 0;
    totalINSSEmployer += payslip.employerContributions?.inss || 0;
    totalNet += payslip.netPay;
    totalOvertime += payslip.earnings.overtime || 0;
  }

  // DEBIT: Expenses
  if (totalGross - totalOvertime > 0) {
    lines.push({
      account: '6100',
      accountName: 'Salary Expense',
      debit: totalGross - totalOvertime,
      credit: 0,
      memo: 'Base salaries'
    });
  }

  if (totalOvertime > 0) {
    lines.push({
      account: '6120',
      accountName: 'Overtime Expense',
      debit: totalOvertime,
      credit: 0,
      memo: 'Overtime pay'
    });
  }

  if (totalINSSEmployer > 0) {
    lines.push({
      account: '6110',
      accountName: 'INSS Employer Expense',
      debit: totalINSSEmployer,
      credit: 0,
      memo: 'INSS employer 6%'
    });
  }

  // CREDIT: Liabilities
  if (totalWIT > 0) {
    lines.push({
      account: '2100',
      accountName: 'WIT Payable',
      debit: 0,
      credit: totalWIT,
      memo: 'WIT 10% withholding'
    });
  }

  if (totalINSSEmployee > 0) {
    lines.push({
      account: '2110',
      accountName: 'INSS Employee Payable',
      debit: 0,
      credit: totalINSSEmployee,
      memo: 'INSS employee 4%'
    });
  }

  if (totalINSSEmployer > 0) {
    lines.push({
      account: '2120',
      accountName: 'INSS Employer Payable',
      debit: 0,
      credit: totalINSSEmployer,
      memo: 'INSS employer 6%'
    });
  }

  lines.push({
    account: '2130',
    accountName: 'Net Payroll Payable',
    debit: 0,
    credit: totalNet,
    memo: 'Net pay to employees'
  });

  return lines;
}
```

---

## Testing Checklist

- [ ] CSV exports correctly formatted
- [ ] IIF exports correctly formatted (tab-delimited)
- [ ] Debits equal credits
- [ ] Account mappings apply correctly
- [ ] Export downloads successfully
- [ ] Export log created in Firestore
- [ ] Works with payrun that has:
  - [ ] Regular employees
  - [ ] Overtime
  - [ ] Employees below WIT threshold
  - [ ] Foreign workers (different INSS?)
- [ ] Settings save and load
- [ ] Translations complete (EN, PT, TET)

---

## Future Enhancements

1. **Direct API Integration** - OAuth connection to QuickBooks Online
2. **Auto-export** - Automatically export when payroll is approved
3. **Sync Status** - Show which payruns have been exported
4. **13th Month Journal** - Separate export for Subsidio Anual accrual
5. **Department Grouping** - Separate journal entries by department

---

*Implementation target: 3-4 hours*
*Complexity: Medium*
*Dependencies: Existing payroll service, Settings page*
