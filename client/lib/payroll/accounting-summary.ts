import { addMoney, maxMoney, subtractMoney } from '@/lib/currency';

interface AmountLine {
  type?: string;
  amount?: number;
}

export interface AccountingPayrollRecord {
  totalGrossPay: number;
  wagesPaid?: number;
  totalDeductions: number;
  netPay: number;
  deductions?: AmountLine[];
  employerTaxes?: AmountLine[];
}

export interface PayrollAccountingSummary {
  totalWagesExpense: number;
  totalNetPay: number;
  totalIncomeTax: number;
  totalINSSEmployee: number;
  totalINSSEmployer: number;
  totalAdvanceRepayments: number;
  totalOtherDeductions: number;
}

function sumTypes(lines: AmountLine[] | undefined, types: Set<string>): number {
  return (lines || [])
    .filter((line) => line.type && types.has(line.type))
    .reduce((total, line) => addMoney(total, line.amount || 0), 0);
}

/** Convert payroll records into the amounts required for a balanced journal. */
export function summarizePayrollForAccounting(
  records: AccountingPayrollRecord[],
): PayrollAccountingSummary {
  return records.reduce<PayrollAccountingSummary>((summary, record) => {
    const attendanceReductions = sumTypes(
      record.deductions,
      new Set(['absence', 'late_arrival']),
    );
    const incomeTax = sumTypes(record.deductions, new Set(['income_tax']));
    const inssEmployee = sumTypes(record.deductions, new Set(['inss_employee']));
    const advanceRepayments = sumTypes(
      record.deductions,
      new Set(['loan_repayment', 'advance_repayment']),
    );
    const identifiedDeductions = addMoney(
      attendanceReductions,
      incomeTax,
      inssEmployee,
      advanceRepayments,
    );
    const otherDeductions = maxMoney(
      0,
      subtractMoney(record.totalDeductions || 0, identifiedDeductions),
    );
    const wagesExpense = typeof record.wagesPaid === 'number'
      ? record.wagesPaid
      : maxMoney(0, subtractMoney(record.totalGrossPay || 0, attendanceReductions));
    const inssEmployer = sumTypes(record.employerTaxes, new Set(['inss_employer']));

    return {
      totalWagesExpense: addMoney(summary.totalWagesExpense, wagesExpense),
      totalNetPay: addMoney(summary.totalNetPay, record.netPay || 0),
      totalIncomeTax: addMoney(summary.totalIncomeTax, incomeTax),
      totalINSSEmployee: addMoney(summary.totalINSSEmployee, inssEmployee),
      totalINSSEmployer: addMoney(summary.totalINSSEmployer, inssEmployer),
      totalAdvanceRepayments: addMoney(
        summary.totalAdvanceRepayments,
        advanceRepayments,
      ),
      totalOtherDeductions: addMoney(summary.totalOtherDeductions, otherDeductions),
    };
  }, {
    totalWagesExpense: 0,
    totalNetPay: 0,
    totalIncomeTax: 0,
    totalINSSEmployee: 0,
    totalINSSEmployer: 0,
    totalAdvanceRepayments: 0,
    totalOtherDeductions: 0,
  });
}
