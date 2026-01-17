/**
 * Bank Mandiri (Timor-Leste) Transfer File Format
 * Fixed-width text file format
 */

import {
  BankTransferSummary,
  BankFileResult,
  formatDateYYYYMMDD,
  formatAmount,
  padString,
} from './index';

/**
 * Mandiri Fixed-Width Format:
 * Field positions:
 * - 01-20: Account Number (right-aligned, zero-padded)
 * - 21-55: Beneficiary Name (left-aligned)
 * - 56-70: Amount (right-aligned, 2 decimals, no separator)
 * - 71-90: Reference (left-aligned)
 * - 91-98: Value Date (YYYYMMDD)
 */
export function generateMandiriFile(
  summary: BankTransferSummary,
  companyName: string,
  companyAccountNumber: string
): BankFileResult {
  const lines: string[] = [];

  // Header record (type H)
  const header = [
    'H',                                            // Record type
    padString(companyAccountNumber, 20, '0', true), // Debit account
    padString(companyName, 35),                     // Company name
    formatDateYYYYMMDD(summary.valueDate),          // Value date
    padString(String(summary.transactionCount), 6, '0', true), // Transaction count
    padString(formatAmount(summary.totalAmount).replace('.', ''), 15, '0', true), // Total (no decimal point)
  ].join('');
  lines.push(header);

  // Detail records (type D)
  for (const line of summary.lines) {
    const detail = [
      'D',                                             // Record type
      padString(line.accountNumber, 20, '0', true),   // Beneficiary account
      padString(line.accountName, 35),                 // Beneficiary name
      padString(formatAmount(line.amount).replace('.', ''), 15, '0', true), // Amount (cents)
      padString(line.reference, 20),                   // Reference
    ].join('');
    lines.push(detail);
  }

  // Trailer record (type T)
  const trailer = [
    'T',                                            // Record type
    padString(String(summary.transactionCount), 6, '0', true), // Transaction count
    padString(formatAmount(summary.totalAmount).replace('.', ''), 15, '0', true), // Total amount
  ].join('');
  lines.push(trailer);

  const content = lines.join('\n');
  const fileName = `MANDIRI_Salaries_${summary.payrollPeriod}_${formatDateYYYYMMDD(summary.valueDate)}.txt`;

  return {
    content,
    fileName,
    mimeType: 'text/plain',
    summary,
  };
}
