/**
 * QuickBooks Export Types
 * For exporting OniT payroll data to QuickBooks Online/Desktop
 */

// ============================================
// ACCOUNT MAPPING
// ============================================

export interface QBAccountMapping {
  onitAccountCode: string;     // OniT internal account code
  onitAccountName: string;     // Display name in OniT
  qbAccountName: string;       // QuickBooks account name
  qbAccountNumber?: string;    // Optional QB account number
  accountType: 'expense' | 'liability' | 'asset';
  isDefault: boolean;          // Using default vs custom mapping
}

export interface QBExportSettings {
  id?: string;
  defaultFormat: 'csv' | 'iif';
  includeEmployeeDetail: boolean;
  groupByDepartment: boolean;
  accountMappings: QBAccountMapping[];
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// JOURNAL ENTRY STRUCTURE
// ============================================

export interface QBJournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string;
  name?: string;              // Employee or vendor name
  className?: string;         // QB class (e.g., "Payroll")
  department?: string;        // For departmental grouping
}

export interface QBJournalEntry {
  refNumber: string;          // Unique reference (e.g., "PAY-2026-01")
  txnDate: string;            // YYYY-MM-DD
  memo: string;               // Entry description
  lines: QBJournalLine[];
  totalDebits: number;
  totalCredits: number;
}

// ============================================
// EXPORT LOG
// ============================================

export interface QBExportLog {
  id?: string;
  tenantId: string;
  payrollRunId: string;
  payrollPeriod: string;      // Display name (e.g., "January 2026")
  payDate: string;            // YYYY-MM-DD
  exportDate: string;         // ISO timestamp
  exportedBy: string;         // User who exported
  format: 'csv' | 'iif';
  fileName: string;
  recordCount: number;
  totalDebits: number;
  totalCredits: number;
  createdAt?: Date;
}

// ============================================
// DEFAULT ACCOUNT MAPPINGS (Timor-Leste)
// ============================================

export const DEFAULT_TL_ACCOUNT_MAPPINGS: QBAccountMapping[] = [
  // Expenses
  {
    onitAccountCode: '5110',
    onitAccountName: 'Salaries and Wages',
    qbAccountName: 'Payroll Expenses',
    accountType: 'expense',
    isDefault: true,
  },
  {
    onitAccountCode: '5150',
    onitAccountName: 'INSS Employer Contribution',
    qbAccountName: 'Payroll Expenses:INSS Employer',
    accountType: 'expense',
    isDefault: true,
  },
  {
    onitAccountCode: '5120',
    onitAccountName: 'Overtime Expense',
    qbAccountName: 'Payroll Expenses:Overtime',
    accountType: 'expense',
    isDefault: true,
  },
  {
    onitAccountCode: '5140',
    onitAccountName: 'Subsidio Anual Expense',
    qbAccountName: 'Payroll Expenses:13th Month',
    accountType: 'expense',
    isDefault: true,
  },
  {
    onitAccountCode: '5160',
    onitAccountName: 'Employee Benefits',
    qbAccountName: 'Payroll Expenses:Allowances',
    accountType: 'expense',
    isDefault: true,
  },

  // Liabilities
  {
    onitAccountCode: '2220',
    onitAccountName: 'Withholding Income Tax (WIT)',
    qbAccountName: 'Payroll Liabilities:WIT Payable',
    accountType: 'liability',
    isDefault: true,
  },
  {
    onitAccountCode: '2230',
    onitAccountName: 'INSS Payable - Employee',
    qbAccountName: 'Payroll Liabilities:INSS Employee',
    accountType: 'liability',
    isDefault: true,
  },
  {
    onitAccountCode: '2240',
    onitAccountName: 'INSS Payable - Employer',
    qbAccountName: 'Payroll Liabilities:INSS Employer',
    accountType: 'liability',
    isDefault: true,
  },
  {
    onitAccountCode: '2210',
    onitAccountName: 'Salaries Payable',
    qbAccountName: 'Payroll Liabilities:Wages Payable',
    accountType: 'liability',
    isDefault: true,
  },
  {
    onitAccountCode: '2250',
    onitAccountName: 'Subsidio Anual Accrued',
    qbAccountName: 'Payroll Liabilities:13th Month Accrual',
    accountType: 'liability',
    isDefault: true,
  },

  // Assets (for cash payment)
  {
    onitAccountCode: '1130',
    onitAccountName: 'Cash in Bank - Payroll',
    qbAccountName: 'Checking',
    accountType: 'asset',
    isDefault: true,
  },
];

// ============================================
// EXPORT OPTIONS
// ============================================

export interface QBExportOptions {
  format: 'csv' | 'iif';
  includeEmployeeDetail: boolean;
  groupByDepartment: boolean;
  useCustomMappings: boolean;
  customMappings?: QBAccountMapping[];
}

// ============================================
// CSV EXPORT STRUCTURE
// ============================================

// Simple CSV format (Transaction Pro Importer compatible)
export interface CSVJournalRow {
  RefNumber: string;
  TxnDate: string;
  Account: string;
  Debit: string;
  Credit: string;
  Memo: string;
  Name: string;
  Class: string;
}

// ============================================
// IIF EXPORT STRUCTURE
// ============================================

// IIF format for QuickBooks Desktop
export interface IIFTransaction {
  type: 'TRNS' | 'SPL' | 'ENDTRNS';
  trnsType?: string;          // e.g., "GENERAL JOURNAL"
  date?: string;              // MM/DD/YYYY
  account?: string;
  name?: string;
  class?: string;
  amount?: number;
  docNum?: string;
  memo?: string;
}
