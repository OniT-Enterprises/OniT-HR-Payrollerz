/**
 * BNCTL (Banco Nacional de Comércio de Timor-Leste) Transfer File Format
 * CSV format for domestic transfers
 */

import {
  BankTransferSummary,
  BankFileResult,
  formatDateYYYYMMDD,
  formatAmount,
} from './index';

/**
 * BNCTL CSV Format:
 * Simple CSV with standard columns
 * Includes batch information in header rows
 */
export function generateBNCTLFile(
  summary: BankTransferSummary,
  companyName: string,
  companyAccountNumber: string
): BankFileResult {
  const lines: string[] = [];
  const valueDate = formatDateYYYYMMDD(summary.valueDate);

  // Batch header (metadata rows)
  lines.push('BNCTL BULK TRANSFER FILE');
  lines.push(`Batch Reference,SALARY-${summary.payrollPeriod}`);
  lines.push(`Originator,${companyName}`);
  lines.push(`Debit Account,${companyAccountNumber}`);
  lines.push(`Value Date,${summary.valueDate}`);
  lines.push(`Transaction Count,${summary.transactionCount}`);
  lines.push(`Batch Total (USD),${formatAmount(summary.totalAmount)}`);
  lines.push('');

  // Column headers
  lines.push('No.,Account Number,Beneficiary Name,Amount (USD),Reference,Remarks');

  // Detail records
  let rowNum = 1;
  for (const line of summary.lines) {
    const row = [
      String(rowNum++),
      line.accountNumber,
      `"${line.accountName.replace(/"/g, '""')}"`,
      formatAmount(line.amount),
      line.reference,
      `Salary Payment ${summary.payrollPeriod}`,
    ];
    lines.push(row.join(','));
  }

  // Summary footer
  lines.push('');
  lines.push(`TOTAL,${summary.transactionCount} records,${formatAmount(summary.totalAmount)} USD`);
  lines.push(`Generated,${new Date().toISOString()}`);

  const content = lines.join('\n');
  const fileName = `BNCTL_Salaries_${summary.payrollPeriod}_${valueDate}.csv`;

  return {
    content,
    fileName,
    mimeType: 'text/csv',
    summary,
  };
}
