/**
 * Timor-Leste Default Chart of Accounts
 * (Plano de Contas)
 *
 * Based on standard accounting practices adapted for Timor-Leste businesses
 * Includes accounts for payroll, INSS, and tax compliance
 */

import type { Account, AccountType, AccountSubType } from '@/types/accounting';

interface DefaultAccount {
  code: string;
  name: string;
  nameTL: string;
  type: AccountType;
  subType: AccountSubType;
  description?: string;
  isSystem: boolean;
  parentCode?: string;
}

/**
 * Default Chart of Accounts for Timor-Leste businesses
 * Account codes follow standard structure:
 * 1xxx - Assets (Ativos)
 * 2xxx - Liabilities (Passivos)
 * 3xxx - Equity (Capital Próprio)
 * 4xxx - Revenue (Receitas)
 * 5xxx - Expenses (Despesas)
 */
const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  // ============================================
  // 1000 - ASSETS (ATIVOS)
  // ============================================

  // Current Assets - Cash
  {
    code: '1000',
    name: 'Current Assets',
    nameTL: 'Ativos Correntes',
    type: 'asset',
    subType: 'other_asset',
    isSystem: true,
  },
  {
    code: '1100',
    name: 'Cash and Cash Equivalents',
    nameTL: 'Kaixa no Ekivalentes',
    type: 'asset',
    subType: 'cash',
    isSystem: true,
    parentCode: '1000',
  },
  {
    code: '1110',
    name: 'Cash on Hand',
    nameTL: 'Kaixa',
    type: 'asset',
    subType: 'cash',
    description: 'Petty cash and cash in office',
    isSystem: false,
    parentCode: '1100',
  },
  {
    code: '1120',
    name: 'Cash in Bank - Operating',
    nameTL: 'Banku - Operasaun',
    type: 'asset',
    subType: 'bank',
    description: 'Main operating bank account',
    isSystem: true,
    parentCode: '1100',
  },
  {
    code: '1130',
    name: 'Cash in Bank - Payroll',
    nameTL: 'Banku - Pagamentu Saláriu',
    type: 'asset',
    subType: 'bank',
    description: 'Bank account for payroll disbursements',
    isSystem: true,
    parentCode: '1100',
  },
  {
    code: '1140',
    name: 'Cash in Bank - Savings',
    nameTL: 'Banku - Poupança',
    type: 'asset',
    subType: 'bank',
    isSystem: false,
    parentCode: '1100',
  },

  // Accounts Receivable
  {
    code: '1200',
    name: 'Accounts Receivable',
    nameTL: 'Kontas a Receber',
    type: 'asset',
    subType: 'accounts_receivable',
    isSystem: true,
    parentCode: '1000',
  },
  {
    code: '1210',
    name: 'Trade Receivables',
    nameTL: 'Receivables Komersial',
    type: 'asset',
    subType: 'accounts_receivable',
    description: 'Amounts owed by customers',
    isSystem: false,
    parentCode: '1200',
  },
  {
    code: '1220',
    name: 'Employee Advances',
    nameTL: 'Adiantamentu Empregadu',
    type: 'asset',
    subType: 'accounts_receivable',
    description: 'Salary advances and loans to employees',
    isSystem: true,
    parentCode: '1200',
  },

  // Prepaid Expenses
  {
    code: '1300',
    name: 'Prepaid Expenses',
    nameTL: 'Despesas Antecipadas',
    type: 'asset',
    subType: 'prepaid_expense',
    isSystem: false,
    parentCode: '1000',
  },
  {
    code: '1310',
    name: 'Prepaid Insurance',
    nameTL: 'Seguru Antecipadu',
    type: 'asset',
    subType: 'prepaid_expense',
    isSystem: false,
    parentCode: '1300',
  },
  {
    code: '1320',
    name: 'Prepaid Rent',
    nameTL: 'Renda Antecipada',
    type: 'asset',
    subType: 'prepaid_expense',
    isSystem: false,
    parentCode: '1300',
  },

  // Fixed Assets
  {
    code: '1500',
    name: 'Fixed Assets',
    nameTL: 'Ativos Fixos',
    type: 'asset',
    subType: 'fixed_asset',
    isSystem: true,
  },
  {
    code: '1510',
    name: 'Land',
    nameTL: 'Rai',
    type: 'asset',
    subType: 'fixed_asset',
    isSystem: false,
    parentCode: '1500',
  },
  {
    code: '1520',
    name: 'Buildings',
    nameTL: 'Edifísiu',
    type: 'asset',
    subType: 'fixed_asset',
    isSystem: false,
    parentCode: '1500',
  },
  {
    code: '1530',
    name: 'Equipment',
    nameTL: 'Ekipamentu',
    type: 'asset',
    subType: 'fixed_asset',
    isSystem: false,
    parentCode: '1500',
  },
  {
    code: '1540',
    name: 'Vehicles',
    nameTL: 'Veíkulu',
    type: 'asset',
    subType: 'fixed_asset',
    isSystem: false,
    parentCode: '1500',
  },
  {
    code: '1550',
    name: 'Furniture and Fixtures',
    nameTL: 'Mobília',
    type: 'asset',
    subType: 'fixed_asset',
    isSystem: false,
    parentCode: '1500',
  },
  {
    code: '1590',
    name: 'Accumulated Depreciation',
    nameTL: 'Depresiaun Akumulada',
    type: 'asset',
    subType: 'accumulated_depreciation',
    isSystem: true,
    parentCode: '1500',
  },

  // ============================================
  // 2000 - LIABILITIES (PASSIVOS)
  // ============================================

  {
    code: '2000',
    name: 'Current Liabilities',
    nameTL: 'Passivos Correntes',
    type: 'liability',
    subType: 'other_liability',
    isSystem: true,
  },

  // Accounts Payable
  {
    code: '2100',
    name: 'Accounts Payable',
    nameTL: 'Kontas a Pagar',
    type: 'liability',
    subType: 'accounts_payable',
    isSystem: true,
    parentCode: '2000',
  },
  {
    code: '2110',
    name: 'Trade Payables',
    nameTL: 'Payables Komersial',
    type: 'liability',
    subType: 'accounts_payable',
    description: 'Amounts owed to suppliers',
    isSystem: false,
    parentCode: '2100',
  },

  // Payroll Liabilities
  {
    code: '2200',
    name: 'Payroll Liabilities',
    nameTL: 'Passivos Folha Pagamentu',
    type: 'liability',
    subType: 'salaries_payable',
    isSystem: true,
    parentCode: '2000',
  },
  {
    code: '2210',
    name: 'Salaries Payable',
    nameTL: 'Saláriu a Pagar',
    type: 'liability',
    subType: 'salaries_payable',
    description: 'Net salaries owed to employees',
    isSystem: true,
    parentCode: '2200',
  },
  {
    code: '2220',
    name: 'Withholding Income Tax (WIT)',
    nameTL: 'Impostu Retidu (WIT)',
    type: 'liability',
    subType: 'tax_payable',
    description: 'Employee income tax withholdings to be remitted',
    isSystem: true,
    parentCode: '2200',
  },
  {
    code: '2230',
    name: 'INSS Payable - Employee',
    nameTL: 'INSS a Pagar - Trabalhador',
    type: 'liability',
    subType: 'inss_payable',
    description: 'Employee INSS contributions (4%)',
    isSystem: true,
    parentCode: '2200',
  },
  {
    code: '2240',
    name: 'INSS Payable - Employer',
    nameTL: 'INSS a Pagar - Empregador',
    type: 'liability',
    subType: 'inss_payable',
    description: 'Employer INSS contributions (6%)',
    isSystem: true,
    parentCode: '2200',
  },
  {
    code: '2250',
    name: 'Subsidio Anual Accrued',
    nameTL: 'Subsídiu Anual Akumuladu',
    type: 'liability',
    subType: 'accrued_expense',
    description: '13th month salary accrual',
    isSystem: true,
    parentCode: '2200',
  },

  // Other Taxes
  {
    code: '2300',
    name: 'Other Taxes Payable',
    nameTL: 'Impostu Seluk a Pagar',
    type: 'liability',
    subType: 'tax_payable',
    isSystem: false,
    parentCode: '2000',
  },
  {
    code: '2310',
    name: 'Sales Tax Payable',
    nameTL: 'Impostu Vendas a Pagar',
    type: 'liability',
    subType: 'tax_payable',
    isSystem: false,
    parentCode: '2300',
  },

  // Accrued Expenses
  {
    code: '2400',
    name: 'Accrued Expenses',
    nameTL: 'Despesas Akumuladas',
    type: 'liability',
    subType: 'accrued_expense',
    isSystem: false,
    parentCode: '2000',
  },
  {
    code: '2410',
    name: 'Accrued Rent',
    nameTL: 'Renda Akumulada',
    type: 'liability',
    subType: 'accrued_expense',
    isSystem: false,
    parentCode: '2400',
  },
  {
    code: '2420',
    name: 'Accrued Utilities',
    nameTL: 'Utilidades Akumuladas',
    type: 'liability',
    subType: 'accrued_expense',
    isSystem: false,
    parentCode: '2400',
  },

  // Long-term Liabilities
  {
    code: '2500',
    name: 'Long-term Liabilities',
    nameTL: 'Passivos Longu Prazu',
    type: 'liability',
    subType: 'loans_payable',
    isSystem: true,
  },
  {
    code: '2510',
    name: 'Bank Loans',
    nameTL: 'Empréstimu Banku',
    type: 'liability',
    subType: 'loans_payable',
    isSystem: false,
    parentCode: '2500',
  },

  // ============================================
  // 3000 - EQUITY (CAPITAL PRÓPRIO)
  // ============================================

  {
    code: '3000',
    name: 'Equity',
    nameTL: 'Capital Própriu',
    type: 'equity',
    subType: 'owner_equity',
    isSystem: true,
  },
  {
    code: '3100',
    name: 'Share Capital',
    nameTL: 'Capital Social',
    type: 'equity',
    subType: 'share_capital',
    description: 'Invested capital from shareholders',
    isSystem: true,
    parentCode: '3000',
  },
  {
    code: '3200',
    name: 'Retained Earnings',
    nameTL: 'Lucros Retidos',
    type: 'equity',
    subType: 'retained_earnings',
    description: 'Accumulated profits not distributed',
    isSystem: true,
    parentCode: '3000',
  },
  {
    code: '3300',
    name: 'Current Year Earnings',
    nameTL: 'Lucros Tinan Atual',
    type: 'equity',
    subType: 'retained_earnings',
    description: 'Net income for current year (closing account)',
    isSystem: true,
    parentCode: '3000',
  },
  {
    code: '3400',
    name: 'Dividends',
    nameTL: 'Dividendus',
    type: 'equity',
    subType: 'dividends',
    description: 'Distributions to shareholders',
    isSystem: false,
    parentCode: '3000',
  },

  // ============================================
  // 4000 - REVENUE (RECEITAS)
  // ============================================

  {
    code: '4000',
    name: 'Revenue',
    nameTL: 'Receitas',
    type: 'revenue',
    subType: 'service_revenue',
    isSystem: true,
  },
  {
    code: '4100',
    name: 'Service Revenue',
    nameTL: 'Receita Servisu',
    type: 'revenue',
    subType: 'service_revenue',
    description: 'Revenue from services provided',
    isSystem: true,
    parentCode: '4000',
  },
  {
    code: '4110',
    name: 'Security Services Revenue',
    nameTL: 'Receita Servisu Seguransa',
    type: 'revenue',
    subType: 'service_revenue',
    description: 'Revenue from security guard services',
    isSystem: false,
    parentCode: '4100',
  },
  {
    code: '4120',
    name: 'Consulting Revenue',
    nameTL: 'Receita Konsultoria',
    type: 'revenue',
    subType: 'service_revenue',
    isSystem: false,
    parentCode: '4100',
  },
  {
    code: '4200',
    name: 'Sales Revenue',
    nameTL: 'Receita Vendas',
    type: 'revenue',
    subType: 'sales_revenue',
    isSystem: false,
    parentCode: '4000',
  },
  {
    code: '4300',
    name: 'Other Income',
    nameTL: 'Rendimentu Seluk',
    type: 'revenue',
    subType: 'other_income',
    isSystem: false,
    parentCode: '4000',
  },
  {
    code: '4310',
    name: 'Interest Income',
    nameTL: 'Rendimentu Juru',
    type: 'revenue',
    subType: 'interest_income',
    isSystem: false,
    parentCode: '4300',
  },

  // ============================================
  // 5000 - EXPENSES (DESPESAS)
  // ============================================

  {
    code: '5000',
    name: 'Expenses',
    nameTL: 'Despesas',
    type: 'expense',
    subType: 'other_expense',
    isSystem: true,
  },

  // Payroll Expenses
  {
    code: '5100',
    name: 'Payroll Expenses',
    nameTL: 'Despesas Folha Pagamentu',
    type: 'expense',
    subType: 'salary_expense',
    isSystem: true,
    parentCode: '5000',
  },
  {
    code: '5110',
    name: 'Salaries and Wages',
    nameTL: 'Saláriu no Vensimentu',
    type: 'expense',
    subType: 'salary_expense',
    description: 'Gross salaries paid to employees',
    isSystem: true,
    parentCode: '5100',
  },
  {
    code: '5120',
    name: 'Overtime Pay',
    nameTL: 'Pagamentu Oras Extra',
    type: 'expense',
    subType: 'salary_expense',
    isSystem: false,
    parentCode: '5100',
  },
  {
    code: '5130',
    name: 'Bonuses',
    nameTL: 'Bónus',
    type: 'expense',
    subType: 'salary_expense',
    isSystem: false,
    parentCode: '5100',
  },
  {
    code: '5140',
    name: 'Subsidio Anual Expense',
    nameTL: 'Despesa Subsídiu Anual',
    type: 'expense',
    subType: 'salary_expense',
    description: '13th month salary expense',
    isSystem: true,
    parentCode: '5100',
  },
  {
    code: '5150',
    name: 'INSS Employer Contribution',
    nameTL: 'Kontribuisaun INSS Empregador',
    type: 'expense',
    subType: 'inss_expense',
    description: 'Employer 6% INSS contribution',
    isSystem: true,
    parentCode: '5100',
  },
  {
    code: '5160',
    name: 'Employee Benefits',
    nameTL: 'Benefísiu Empregadu',
    type: 'expense',
    subType: 'salary_expense',
    description: 'Health insurance, allowances, etc.',
    isSystem: false,
    parentCode: '5100',
  },
  {
    code: '5170',
    name: 'Per Diem Expense',
    nameTL: 'Despesa Per Diem',
    type: 'expense',
    subType: 'salary_expense',
    description: 'Travel and per diem allowances',
    isSystem: false,
    parentCode: '5100',
  },

  // Operating Expenses
  {
    code: '5200',
    name: 'Rent Expense',
    nameTL: 'Despesa Renda',
    type: 'expense',
    subType: 'rent_expense',
    isSystem: false,
    parentCode: '5000',
  },
  {
    code: '5300',
    name: 'Utilities Expense',
    nameTL: 'Despesa Utilidades',
    type: 'expense',
    subType: 'utilities_expense',
    isSystem: false,
    parentCode: '5000',
  },
  {
    code: '5310',
    name: 'Electricity',
    nameTL: 'Eletrisidade',
    type: 'expense',
    subType: 'utilities_expense',
    isSystem: false,
    parentCode: '5300',
  },
  {
    code: '5320',
    name: 'Water',
    nameTL: 'Bee',
    type: 'expense',
    subType: 'utilities_expense',
    isSystem: false,
    parentCode: '5300',
  },
  {
    code: '5330',
    name: 'Telephone and Internet',
    nameTL: 'Telefone no Internet',
    type: 'expense',
    subType: 'utilities_expense',
    isSystem: false,
    parentCode: '5300',
  },
  {
    code: '5400',
    name: 'Office Supplies',
    nameTL: 'Material Eskritóriu',
    type: 'expense',
    subType: 'office_supplies',
    isSystem: false,
    parentCode: '5000',
  },
  {
    code: '5500',
    name: 'Transportation Expense',
    nameTL: 'Despesa Transporte',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5000',
  },
  {
    code: '5510',
    name: 'Fuel',
    nameTL: 'Kombustivel',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5500',
  },
  {
    code: '5520',
    name: 'Vehicle Maintenance',
    nameTL: 'Manutensaun Veíkulu',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5500',
  },
  {
    code: '5600',
    name: 'Professional Services',
    nameTL: 'Servisu Profisional',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5000',
  },
  {
    code: '5610',
    name: 'Legal Fees',
    nameTL: 'Taxa Legal',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5600',
  },
  {
    code: '5620',
    name: 'Accounting Fees',
    nameTL: 'Taxa Kontabilidade',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5600',
  },
  {
    code: '5700',
    name: 'Insurance Expense',
    nameTL: 'Despesa Seguru',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5000',
  },
  {
    code: '5800',
    name: 'Depreciation Expense',
    nameTL: 'Despesa Depresiaun',
    type: 'expense',
    subType: 'depreciation_expense',
    isSystem: true,
    parentCode: '5000',
  },
  {
    code: '5900',
    name: 'Other Expenses',
    nameTL: 'Despesa Seluk',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5000',
  },
  {
    code: '5910',
    name: 'Bank Charges',
    nameTL: 'Taxa Banku',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5900',
  },
  {
    code: '5920',
    name: 'Licenses and Permits',
    nameTL: 'Lisensa no Permit',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5900',
  },
  {
    code: '5930',
    name: 'Training and Development',
    nameTL: 'Formasaun no Dezenvolvimentu',
    type: 'expense',
    subType: 'other_expense',
    isSystem: false,
    parentCode: '5900',
  },
];

/**
 * Get default accounts as Account objects
 */
export function getDefaultAccounts(): Omit<Account, 'id' | 'createdAt' | 'updatedAt'>[] {
  return DEFAULT_CHART_OF_ACCOUNTS.map((acc, _index) => ({
    code: acc.code,
    name: acc.name,
    nameTL: acc.nameTL,
    description: acc.description,
    type: acc.type,
    subType: acc.subType,
    isSystem: acc.isSystem,
    isActive: true,
    parentAccountId: acc.parentCode,
    parentCode: acc.parentCode,
    level: acc.parentCode ? 2 : 1,
  }));
}

/**
 * Expense category to account code mappings for auto-generating journal entries
 * from the Money module (Expenses, Bills)
 */
export const EXPENSE_CATEGORY_TO_ACCOUNT: Record<string, { code: string; name: string }> = {
  rent: { code: '5200', name: 'Rent Expense' },
  utilities: { code: '5300', name: 'Utilities Expense' },
  supplies: { code: '5400', name: 'Office Supplies' },
  equipment: { code: '5400', name: 'Office Supplies' }, // Small equipment; capitalize large ones manually
  transport: { code: '5500', name: 'Transportation Expense' },
  fuel: { code: '5510', name: 'Fuel' },
  meals: { code: '5900', name: 'Other Expenses' },
  professional_services: { code: '5600', name: 'Professional Services' },
  insurance: { code: '5700', name: 'Insurance Expense' },
  taxes_licenses: { code: '5920', name: 'Licenses and Permits' },
  marketing: { code: '5900', name: 'Other Expenses' },
  communication: { code: '5330', name: 'Telephone and Internet' },
  maintenance: { code: '5520', name: 'Vehicle Maintenance' },
  other: { code: '5900', name: 'Other Expenses' },
};

/**
 * Money module journal mappings for auto-generating journal entries
 */
export const MONEY_JOURNAL_MAPPINGS = {
  // When invoice is sent: Debit AR, Credit Revenue
  invoiceCreated: {
    description: 'Invoice Created',
    debit: { code: '1210', name: 'Trade Receivables' },
    credit: { code: '4100', name: 'Service Revenue' },
  },
  // When payment received: Debit Cash, Credit AR
  invoicePayment: {
    description: 'Payment Received',
    debit: { code: '1120', name: 'Cash in Bank - Operating' },
    credit: { code: '1210', name: 'Trade Receivables' },
  },
  // When bill created: Debit Expense, Credit AP
  billCreated: {
    description: 'Bill Created',
    debit: null, // Dynamic based on expense category
    credit: { code: '2110', name: 'Trade Payables' },
  },
  // When bill paid: Debit AP, Credit Cash
  billPayment: {
    description: 'Bill Payment',
    debit: { code: '2110', name: 'Trade Payables' },
    credit: { code: '1120', name: 'Cash in Bank - Operating' },
  },
  // When expense recorded: Debit Expense, Credit Cash
  expenseCreated: {
    description: 'Expense Recorded',
    debit: null, // Dynamic based on expense category
    credit: { code: '1120', name: 'Cash in Bank - Operating' },
  },
};

