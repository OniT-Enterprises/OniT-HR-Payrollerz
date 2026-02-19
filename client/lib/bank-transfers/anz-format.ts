/**
 * ANZ Bank Transfer File Format
 * CSV format with ANZ header format
 */

import {
  BankTransferSummary,
  BankFileResult,
  formatDateYYYYMMDD,
  formatAmount,
} from './index';
import { getTodayTL } from '@/lib/dateUtils';

/**
 * ANZ CSV Format:
 * Standard CSV with header metadata block
 * Includes batch header, detail records, and batch trailer
 */
export function generateANZFile(
  summary: BankTransferSummary,
  companyName: string,
  companyAccountNumber: string
): BankFileResult {
  const lines: string[] = [];
  const valueDate = formatDateYYYYMMDD(summary.valueDate);

  // File header block
  lines.push('ANZ BULK PAYMENT FILE');
  lines.push(`Date Generated,${getTodayTL()}`);
  lines.push(`Company Name,${companyName}`);
  lines.push(`Debit Account,${companyAccountNumber}`);
  lines.push(`Value Date,${summary.valueDate}`);
  lines.push(`Total Records,${summary.transactionCount}`);
  lines.push(`Total Amount,${formatAmount(summary.totalAmount)}`);
  lines.push(`Currency,USD`);
  lines.push('');

  // Column headers
  lines.push('Sequence,Account BSB,Account Number,Account Name,Amount,Reference,Description');

  // Detail records
  let sequence = 1;
  for (const line of summary.lines) {
    const row = [
      String(sequence++),
      '', // BSB (not used in TL)
      line.accountNumber,
      `"${line.accountName.replace(/"/g, '""')}"`,
      formatAmount(line.amount),
      line.reference,
      `Salary ${summary.payrollPeriod}`,
    ];
    lines.push(row.join(','));
  }

  // Batch trailer
  lines.push('');
  lines.push('--- END OF FILE ---');
  lines.push(`Records: ${summary.transactionCount}`);
  lines.push(`Total: USD ${formatAmount(summary.totalAmount)}`);

  const content = lines.join('\n');
  const fileName = `ANZ_Salaries_${summary.payrollPeriod}_${valueDate}.csv`;

  return {
    content,
    fileName,
    mimeType: 'text/csv',
    summary,
  };
}
