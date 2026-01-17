/**
 * BNU (Banco Nacional Ultramarino) Transfer File Format
 * CSV format with specific column order
 */

import {
  BankTransferSummary,
  BankFileResult,
  formatDateYYYYMMDD,
  formatAmount,
} from './index';

/**
 * BNU CSV Format:
 * Column order: Account Number, Beneficiary Name, Amount, Reference, Value Date
 * Header row included
 */
export function generateBNUFile(
  summary: BankTransferSummary,
  companyName: string,
  companyAccountNumber: string
): BankFileResult {
  const lines: string[] = [];

  // Header row
  lines.push('Account Number,Beneficiary Name,Amount (USD),Reference,Value Date,Description');

  // Data rows
  for (const line of summary.lines) {
    const row = [
      line.accountNumber,
      `"${line.accountName.replace(/"/g, '""')}"`, // Escape quotes in name
      formatAmount(line.amount),
      line.reference,
      summary.valueDate,
      `Salary Payment - ${summary.payrollPeriod}`,
    ];
    lines.push(row.join(','));
  }

  // Footer with totals (as comment)
  lines.push('');
  lines.push(`# Total Transactions: ${summary.transactionCount}`);
  lines.push(`# Total Amount: ${formatAmount(summary.totalAmount)} USD`);
  lines.push(`# Debit Account: ${companyAccountNumber}`);
  lines.push(`# Company: ${companyName}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);

  const content = lines.join('\n');
  const fileName = `BNU_Salaries_${summary.payrollPeriod}_${formatDateYYYYMMDD(summary.valueDate)}.csv`;

  return {
    content,
    fileName,
    mimeType: 'text/csv',
    summary,
  };
}
