/**
 * Bank Transfer File Generation
 * Generates bank-specific payment files for bulk salary transfers
 */

import { TLPayrollRun, TLPayrollRecord } from '@/types/payroll-tl';
import { PayrollRecord, PayrollRun } from '@/types/payroll';
import { Employee } from '@/services/employeeService';
import { generateBNUFile } from './bnu-format';
import { generateMandiriFile } from './mandiri-format';
import { generateANZFile } from './anz-format';
import { generateBNCTLFile } from './bnctl-format';
import { sumMoney } from '@/lib/currency';

export type BankCode = 'BNU' | 'MANDIRI' | 'ANZ' | 'BNCTL';

export interface BankTransferLine {
  accountNumber: string;
  accountName: string;
  amount: number;
  reference: string;
  employeeId: string;
}

export interface BankTransferSummary {
  bankCode: BankCode;
  bankName: string;
  lines: BankTransferLine[];
  totalAmount: number;
  transactionCount: number;
  valueDate: string;
  payrollPeriod: string;
}

export interface BankFileResult {
  content: string;
  fileName: string;
  mimeType: string;
  summary: BankTransferSummary;
}

interface BankTransferInput {
  payrollRun: TLPayrollRun | PayrollRun;
  records: AnyPayrollRecord[];
  employees: Employee[];
  valueDate: string;
  companyName: string;
  companyAccountNumber: string;
}

const BANK_NAMES: Record<BankCode, string> = {
  BNU: 'Banco Nacional Ultramarino',
  MANDIRI: 'Bank Mandiri (Timor-Leste)',
  ANZ: 'ANZ Bank',
  BNCTL: 'Banco Nacional de Comércio de Timor-Leste',
};

function getEmployeeBankCode(employee: Employee): BankCode | null {
  const bankName = employee.bankName?.toUpperCase() || '';
  if (bankName.includes('BNU') || bankName.includes('ULTRAMARINO')) return 'BNU';
  if (bankName.includes('MANDIRI')) return 'MANDIRI';
  if (bankName.includes('ANZ')) return 'ANZ';
  if (bankName.includes('BNCTL') || bankName.includes('COMÉRCIO')) return 'BNCTL';
  return null;
}

/** Refuse a partial salary file when any payroll line cannot be paid safely. */
export function validateBankTransferRecords(
  records: AnyPayrollRecord[],
  employees: Employee[],
): void {
  const employeesById = new Map(
    employees.flatMap((employee) => employee.id ? [[employee.id, employee] as const] : []),
  );
  const issues: string[] = [];

  for (const record of records) {
    const employee = employeesById.get(record.employeeId);
    const label = record.employeeName || record.employeeId;
    if (!employee) {
      issues.push(`${label}: employee record not found`);
      continue;
    }
    if (!getEmployeeBankCode(employee)) {
      issues.push(`${label}: supported bank not configured`);
    }
    if (!employee.bankAccountNumber?.trim()) {
      issues.push(`${label}: bank account number missing`);
    }
    if (!Number.isFinite(record.netPay) || record.netPay <= 0) {
      issues.push(`${label}: net pay must be greater than zero`);
    }
  }

  if (issues.length > 0) {
    throw new Error(`Bank file validation failed: ${issues.slice(0, 5).join('; ')}`);
  }
}

/**
 * Group payroll records by bank
 */
type AnyPayrollRecord = TLPayrollRecord | PayrollRecord;

export function groupRecordsByBank(
  records: AnyPayrollRecord[],
  employees: Employee[]
): Record<BankCode, Array<{ record: AnyPayrollRecord; employee: Employee }>> {
  const groups: Record<BankCode, Array<{ record: AnyPayrollRecord; employee: Employee }>> = {
    BNU: [],
    MANDIRI: [],
    ANZ: [],
    BNCTL: [],
  };

  const employeesById = new Map<string, Employee>();
  for (const emp of employees) {
    if (emp.id) employeesById.set(emp.id, emp);
  }

  for (const record of records) {
    const employee = employeesById.get(record.employeeId);
    if (!employee) continue;

    const bankCode = getEmployeeBankCode(employee);

    if (bankCode) {
      groups[bankCode].push({ record, employee });
    }
  }

  return groups;
}

/**
 * Generate bank transfer file for a specific bank
 */
export function generateBankFile(
  bankCode: BankCode,
  input: BankTransferInput
): BankFileResult {
  const { payrollRun, records, employees, valueDate, companyName, companyAccountNumber } = input;
  if (!companyAccountNumber.trim()) {
    throw new Error('Company debit account number is required');
  }

  // Filter records for this bank
  const grouped = groupRecordsByBank(records, employees);
  const bankRecords = grouped[bankCode];
  if (bankRecords.length === 0) {
    throw new Error(`No valid ${bankCode} salary records were found`);
  }

  // Build transfer lines
  const lines: BankTransferLine[] = bankRecords.map(({ record, employee }) => {
    const period = formatPeriod(payrollRun.periodStart, payrollRun.periodEnd);
    return {
      accountNumber: employee.bankAccountNumber || '',
      accountName: record.employeeName,
      amount: record.netPay,
      reference: `SALARY-${period}-${record.employeeNumber || record.employeeId}`,
      employeeId: record.employeeId,
    };
  });

  const invalidLine = lines.find(
    (line) =>
      !line.accountNumber.trim() ||
      !line.accountName.trim() ||
      !Number.isFinite(line.amount) ||
      line.amount <= 0,
  );
  if (invalidLine) {
    throw new Error(`Invalid bank details for employee ${invalidLine.employeeId}`);
  }

  const summary: BankTransferSummary = {
    bankCode,
    bankName: BANK_NAMES[bankCode],
    lines,
    totalAmount: sumMoney(lines.map((line) => line.amount)),
    transactionCount: lines.length,
    valueDate,
    payrollPeriod: formatPeriod(payrollRun.periodStart, payrollRun.periodEnd),
  };

  // Generate bank-specific file format
  switch (bankCode) {
    case 'BNU':
      return generateBNUFile(summary, companyName, companyAccountNumber);
    case 'MANDIRI':
      return generateMandiriFile(summary, companyName, companyAccountNumber);
    case 'ANZ':
      return generateANZFile(summary, companyName, companyAccountNumber);
    case 'BNCTL':
      return generateBNCTLFile(summary, companyName, companyAccountNumber);
    default:
      throw new Error(`Unknown bank code: ${bankCode}`);
  }
}

/**
 * Download a bank file
 */
export function downloadBankFile(result: BankFileResult): void {
  const blob = new Blob([result.content], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format period as MMM-YYYY
 */
function formatPeriod(startDate: string, endDate: string): string {
  const end = new Date(endDate);
  return `${end.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Dili' }).toUpperCase()}${end.getFullYear()}`;
}

/**
 * Format date as YYYYMMDD
 */
export function formatDateYYYYMMDD(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Format amount with 2 decimal places
 */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Pad or truncate string to fixed length
 */
export function padString(str: string, length: number, fillChar = ' ', alignRight = false): string {
  const truncated = str.substring(0, length);
  if (alignRight) {
    return truncated.padStart(length, fillChar);
  }
  return truncated.padEnd(length, fillChar);
}
