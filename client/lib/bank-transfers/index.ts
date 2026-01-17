/**
 * Bank Transfer File Generation
 * Generates bank-specific payment files for bulk salary transfers
 */

import { TLPayrollRun, TLPayrollRecord } from '@/types/payroll-tl';
import { Employee } from '@/services/employeeService';
import { generateBNUFile } from './bnu-format';
import { generateMandiriFile } from './mandiri-format';
import { generateANZFile } from './anz-format';
import { generateBNCTLFile } from './bnctl-format';

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

export interface BankTransferInput {
  payrollRun: TLPayrollRun;
  records: TLPayrollRecord[];
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

/**
 * Group payroll records by bank
 */
export function groupRecordsByBank(
  records: TLPayrollRecord[],
  employees: Employee[]
): Record<BankCode, Array<{ record: TLPayrollRecord; employee: Employee }>> {
  const groups: Record<BankCode, Array<{ record: TLPayrollRecord; employee: Employee }>> = {
    BNU: [],
    MANDIRI: [],
    ANZ: [],
    BNCTL: [],
  };

  for (const record of records) {
    const employee = employees.find(e => e.id === record.employeeId);
    if (!employee) continue;

    // Get bank name from employee record and normalize
    const bankName = (employee as any).bankName?.toUpperCase() || '';

    let bankCode: BankCode | null = null;
    if (bankName.includes('BNU') || bankName.includes('ULTRAMARINO')) {
      bankCode = 'BNU';
    } else if (bankName.includes('MANDIRI')) {
      bankCode = 'MANDIRI';
    } else if (bankName.includes('ANZ')) {
      bankCode = 'ANZ';
    } else if (bankName.includes('BNCTL') || bankName.includes('COMÉRCIO')) {
      bankCode = 'BNCTL';
    }

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

  // Filter records for this bank
  const grouped = groupRecordsByBank(records, employees);
  const bankRecords = grouped[bankCode];

  // Build transfer lines
  const lines: BankTransferLine[] = bankRecords.map(({ record, employee }) => {
    const period = formatPeriod(payrollRun.periodStart, payrollRun.periodEnd);
    return {
      accountNumber: (employee as any).bankAccountNumber || '',
      accountName: record.employeeName,
      amount: record.netPay,
      reference: `SALARY-${period}-${record.employeeNumber || record.employeeId}`,
      employeeId: record.employeeId,
    };
  });

  const summary: BankTransferSummary = {
    bankCode,
    bankName: BANK_NAMES[bankCode],
    lines,
    totalAmount: lines.reduce((sum, line) => sum + line.amount, 0),
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
 * Generate files for all banks with employees
 */
export function generateAllBankFiles(input: BankTransferInput): BankFileResult[] {
  const results: BankFileResult[] = [];
  const grouped = groupRecordsByBank(input.records, input.employees);

  for (const bankCode of Object.keys(grouped) as BankCode[]) {
    if (grouped[bankCode].length > 0) {
      results.push(generateBankFile(bankCode, input));
    }
  }

  return results;
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
  return `${end.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}${end.getFullYear()}`;
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
