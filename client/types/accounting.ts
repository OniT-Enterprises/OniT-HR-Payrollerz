/**
 * Accounting Module Types
 * Double-entry bookkeeping system for Timor-Leste businesses
 * Designed to replace QuickBooks for HR/Payroll integrated accounting
 */

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

  // Balances (computed, not stored directly)
  // Balance is calculated from journal entries

  // Tax
  taxCode?: string;          // For tax reporting

  // Metadata
  createdAt?: any;
  updatedAt?: any;
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
  postedAt?: any;
  postedBy?: string;
  voidedAt?: any;
  voidedBy?: string;
  voidReason?: string;

  // Attachments
  attachments?: string[];

  // Period
  fiscalYear: number;
  fiscalPeriod: number;      // 1-12

  // Metadata
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
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

  createdAt?: any;
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

  generatedAt: any;
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

  generatedAt: any;
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

  generatedAt: any;
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
  closedAt?: any;
  closedBy?: string;

  // Opening balances
  openingBalancesPosted: boolean;
  openingBalanceEntryId?: string;

  createdAt?: any;
  updatedAt?: any;
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
  closedAt?: any;
  closedBy?: string;

  createdAt?: any;
}

// ============================================
// BANK RECONCILIATION
// ============================================

export interface BankAccount {
  id?: string;
  accountId: string;         // Link to Chart of Accounts
  bankName: string;
  accountNumber: string;
  accountNumberLast4: string;
  accountType: 'checking' | 'savings' | 'payroll';
  currency: string;          // USD for Timor-Leste
  isActive: boolean;

  // Current balance
  bookBalance: number;
  lastReconciledDate?: string;
  lastReconciledBalance?: number;

  createdAt?: any;
  updatedAt?: any;
}

export interface BankReconciliation {
  id?: string;
  bankAccountId: string;
  statementDate: string;
  statementEndingBalance: number;

  // Book side
  bookBalance: number;

  // Reconciling items
  depositsInTransit: BankReconciliationItem[];
  outstandingChecks: BankReconciliationItem[];
  adjustments: BankReconciliationItem[];

  // Calculated
  adjustedBankBalance: number;
  adjustedBookBalance: number;
  difference: number;
  isReconciled: boolean;

  // Status
  status: 'in_progress' | 'completed';
  completedAt?: any;
  completedBy?: string;

  createdAt?: any;
  updatedAt?: any;
}

export interface BankReconciliationItem {
  id?: string;
  type: 'deposit_in_transit' | 'outstanding_check' | 'bank_fee' | 'interest' | 'adjustment';
  date: string;
  description: string;
  amount: number;
  reference?: string;
  cleared: boolean;
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
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Journal entry generated from payroll run
 */
export interface PayrollJournalEntry {
  payrollRunId: string;
  journalEntryId: string;

  // Summary
  periodStart: string;
  periodEnd: string;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  totalEmployerCost: number;

  // Entry details
  lines: {
    description: string;
    debitAccount: string;
    debitAmount: number;
    creditAccount: string;
    creditAmount: number;
  }[];

  createdAt?: any;
}

// ============================================
// REPORTS
// ============================================

export interface AccountingReportParams {
  reportType:
    | 'trial_balance'
    | 'income_statement'
    | 'balance_sheet'
    | 'general_ledger'
    | 'account_transactions'
    | 'journal_listing';

  // Date range
  startDate?: string;
  endDate?: string;
  asOfDate?: string;

  // Filters
  accountId?: string;
  accountType?: AccountType;
  departmentId?: string;

  // Options
  includeZeroBalances?: boolean;
  showAccountDetails?: boolean;
  compareWithPriorPeriod?: boolean;
}

// ============================================
// INVOICE / BILLING (Future)
// ============================================

export interface Invoice {
  id?: string;
  invoiceNumber: string;

  // Customer
  customerId: string;
  customerName: string;
  customerAddress?: string;

  // Dates
  invoiceDate: string;
  dueDate: string;

  // Items
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;

  // Payment
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void';
  amountPaid: number;
  amountDue: number;

  // Journal entry
  journalEntryId?: string;

  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  accountId: string;
  taxable: boolean;
}

// ============================================
// EXPENSE TRACKING
// ============================================

export interface Expense {
  id?: string;

  // Vendor
  vendorId?: string;
  vendorName: string;

  // Details
  date: string;
  description: string;
  category: string;
  amount: number;

  // Account
  accountId: string;
  accountCode: string;

  // Payment
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'credit_card';
  bankAccountId?: string;
  reference?: string;

  // Receipt
  receiptUrl?: string;

  // Approval
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  approvedBy?: string;
  approvedAt?: any;

  // Journal entry
  journalEntryId?: string;

  // Employee (for reimbursements)
  employeeId?: string;
  isReimbursement: boolean;

  createdAt?: any;
  updatedAt?: any;
}

// ============================================
// AUDIT TRAIL
// ============================================

export interface AccountingAuditLog {
  id?: string;
  action:
    | 'account_created'
    | 'account_modified'
    | 'journal_posted'
    | 'journal_voided'
    | 'period_closed'
    | 'reconciliation_completed';

  entityType: 'account' | 'journal_entry' | 'fiscal_period' | 'reconciliation';
  entityId: string;

  // Details
  description: string;
  oldValue?: any;
  newValue?: any;

  // User
  userId: string;
  userEmail: string;
  timestamp: any;
  ipAddress?: string;
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

  updatedAt?: any;
  updatedBy?: string;
}
