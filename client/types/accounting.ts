/**
 * Accounting Module Types
 * Double-entry bookkeeping system for Timor-Leste businesses
 * Designed to replace QuickBooks for HR/Payroll integrated accounting
 */

import { FirestoreTimestamp } from './firebase';

// ============================================
// CHART OF ACCOUNTS
// ============================================

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense';

export type AccountSubType =
  // Assets
  | 'cash'
  | 'bank'
  | 'accounts_receivable'
  | 'inventory'
  | 'prepaid_expense'
  | 'fixed_asset'
  | 'accumulated_depreciation'
  | 'other_asset'
  // Liabilities
  | 'accounts_payable'
  | 'accrued_expense'
  | 'salaries_payable'
  | 'tax_payable'
  | 'inss_payable'
  | 'loans_payable'
  | 'other_liability'
  // Equity
  | 'share_capital'
  | 'retained_earnings'
  | 'owner_equity'
  | 'dividends'
  // Revenue
  | 'service_revenue'
  | 'sales_revenue'
  | 'interest_income'
  | 'other_income'
  // Expenses
  | 'salary_expense'
  | 'inss_expense'
  | 'rent_expense'
  | 'utilities_expense'
  | 'office_supplies'
  | 'depreciation_expense'
  | 'tax_expense'
  | 'other_expense';

export interface Account {
  id?: string;

  // Account identification
  code: string;              // e.g., "1100", "2200", "5100"
  name: string;              // e.g., "Cash on Hand"
  nameTL?: string;           // Tetun translation
  description?: string;

  // Classification
  type: AccountType;
  subType: AccountSubType;
  isSystem: boolean;         // System accounts can't be deleted
  isActive: boolean;

  // Hierarchy
  parentAccountId?: string;  // For sub-accounts
  level: number;             // 1 = top level, 2 = sub-account, etc.
  parentCode?: string;       // Stored when parent doc ID isn't known yet

  // Balances (computed, not stored directly)
  // Balance is calculated from journal entries

  // Tax
  taxCode?: string;          // For tax reporting

  // Metadata
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  createdBy?: string;
}

// ============================================
// JOURNAL ENTRIES
// ============================================

export type JournalEntryStatus = 'draft' | 'posted' | 'void';

export type JournalEntrySource =
  | 'manual'
  | 'payroll'
  | 'invoice'
  | 'bill'
  | 'payment'
  | 'receipt'
  | 'adjustment'
  | 'closing'
  | 'opening';

export interface JournalEntry {
  id?: string;

  // Entry identification
  entryNumber: string;       // Auto-generated: JE-2024-0001
  date: string;              // YYYY-MM-DD
  description: string;

  // Source
  source: JournalEntrySource;
  sourceId?: string;         // e.g., payrollRunId
  sourceRef?: string;        // Human readable reference

  // Lines
  lines: JournalEntryLine[];

  // Totals (must balance)
  totalDebit: number;
  totalCredit: number;

  // Status
  status: JournalEntryStatus;
  postedAt?: FirestoreTimestamp;
  postedBy?: string;
  voidedAt?: FirestoreTimestamp;
  voidedBy?: string;
  voidReason?: string;

  // Attachments
  attachments?: string[];

  // Period
  fiscalYear: number;
  fiscalPeriod: number;      // 1-12

  // Metadata
  createdAt?: FirestoreTimestamp;
  createdBy?: string;
  updatedAt?: FirestoreTimestamp;
}

export interface JournalEntryLine {
  id?: string;
  lineNumber: number;

  // Account
  accountId: string;
  accountCode: string;
  accountName: string;

  // Amounts (one must be zero)
  debit: number;
  credit: number;

  // Description for this line
  description?: string;

  // Additional dimensions
  departmentId?: string;
  employeeId?: string;
  projectId?: string;
}

// ============================================
// GENERAL LEDGER
// ============================================

export interface GeneralLedgerEntry {
  id?: string;

  // Account
  accountId: string;
  accountCode: string;
  accountName: string;

  // Entry reference
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  description: string;

  // Amounts
  debit: number;
  credit: number;
  balance: number;           // Running balance

  // Period
  fiscalYear: number;
  fiscalPeriod: number;

  createdAt?: FirestoreTimestamp;
}

// ============================================
// TRIAL BALANCE
// ============================================

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;

  // Period balances
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalance {
  asOfDate: string;
  fiscalYear: number;
  fiscalPeriod: number;

  rows: TrialBalanceRow[];

  // Totals (must balance)
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;

  generatedAt: FirestoreTimestamp;
  generatedBy: string;
}

// ============================================
// FINANCIAL STATEMENTS
// ============================================

export interface IncomeStatementRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'revenue' | 'expense';
  amount: number;
  level: number;
  isTotal: boolean;
}

export interface IncomeStatement {
  periodStart: string;
  periodEnd: string;
  fiscalYear: number;

  // Revenue section
  revenueItems: IncomeStatementRow[];
  totalRevenue: number;

  // Expense section
  expenseItems: IncomeStatementRow[];
  totalExpenses: number;

  // Bottom line
  netIncome: number;
  netIncomeLabel: string;    // "Net Profit" or "Net Loss"

  generatedAt: FirestoreTimestamp;
  generatedBy: string;
}

export interface BalanceSheetRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity';
  amount: number;
  level: number;
  isTotal: boolean;
}

export interface BalanceSheet {
  asOfDate: string;
  fiscalYear: number;

  // Asset section
  assetItems: BalanceSheetRow[];
  totalAssets: number;

  // Liability section
  liabilityItems: BalanceSheetRow[];
  totalLiabilities: number;

  // Equity section
  equityItems: BalanceSheetRow[];
  totalEquity: number;

  // Must balance
  isBalanced: boolean;       // Assets = Liabilities + Equity

  generatedAt: FirestoreTimestamp;
  generatedBy: string;
}

// ============================================
// FISCAL PERIODS
// ============================================

export interface FiscalYear {
  id?: string;
  year: number;
  startDate: string;
  endDate: string;

  // Status
  status: 'open' | 'closed' | 'locked';
  closedAt?: FirestoreTimestamp;
  closedBy?: string;
  lockedAt?: FirestoreTimestamp;
  lockedBy?: string;

  // Opening balances
  openingBalancesPosted: boolean;
  openingBalanceEntryId?: string;

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface FiscalPeriod {
  id?: string;
  fiscalYearId: string;
  year: number;
  period: number;            // 1-12
  startDate: string;
  endDate: string;

  // Status
  status: 'open' | 'closed' | 'locked';
  closedAt?: FirestoreTimestamp;
  closedBy?: string;
  lockedAt?: FirestoreTimestamp;
  lockedBy?: string;

  createdAt?: FirestoreTimestamp;
}

// ============================================
// PAYROLL INTEGRATION
// ============================================

/**
 * Configuration for auto-generating journal entries from payroll
 */
export interface PayrollAccountMapping {
  id?: string;

  // Payroll item type
  payrollItemType:
    | 'gross_salary'
    | 'overtime'
    | 'bonus'
    | 'commission'
    | 'allowance'
    | 'income_tax'
    | 'inss_employee'
    | 'inss_employer'
    | 'loan_deduction'
    | 'other_deduction'
    | 'net_pay';

  // Account mapping
  debitAccountId: string;
  debitAccountCode: string;
  creditAccountId: string;
  creditAccountCode: string;

  // Description template
  descriptionTemplate: string;

  isActive: boolean;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// ============================================
// BALANCE SNAPSHOTS (Monthly cumulative balances)
// ============================================

export interface BalanceSnapshotEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  cumulativeDebit: number;   // All-time through period end
  cumulativeCredit: number;
  cumulativeNet: number;     // Raw debit - credit
  periodDebit: number;       // This period only
  periodCredit: number;
  periodNet: number;
}

export interface BalanceSnapshot {
  id?: string;
  year: number;
  period: number;
  periodEndDate: string;
  fiscalPeriodId: string;
  accounts: BalanceSnapshotEntry[];
  totalCumulativeDebit: number;
  totalCumulativeCredit: number;
  isBalanced: boolean;
  generatedAt: FirestoreTimestamp;
  generatedBy: string;
  version: number;
}

// ============================================
// SETTINGS
// ============================================

export interface AccountingSettings {
  id?: string;

  // Company
  companyName: string;
  companyTIN: string;
  fiscalYearStart: number;   // Month (1-12)
  currency: string;          // USD

  // Numbering
  journalEntryPrefix: string;
  invoicePrefix: string;
  nextJournalNumber: number;
  nextInvoiceNumber: number;

  // Defaults
  defaultCashAccountId: string;
  defaultBankAccountId: string;
  defaultReceivableAccountId: string;
  defaultPayableAccountId: string;
  defaultSalaryExpenseAccountId: string;
  defaultINSSExpenseAccountId: string;
  defaultTaxPayableAccountId: string;
  defaultINSSPayableAccountId: string;
  defaultSalariesPayableAccountId: string;

  // Payroll integration
  autoGeneratePayrollJournals: boolean;
  payrollMappings: PayrollAccountMapping[];

  updatedAt?: FirestoreTimestamp;
  updatedBy?: string;
}
