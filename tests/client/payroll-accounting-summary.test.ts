import { describe, expect, it } from 'vitest';
import { summarizePayrollForAccounting } from '@/lib/payroll/accounting-summary';

describe('payroll accounting summary', () => {
  it('reconciles attendance reductions and statutory deductions', () => {
    const summary = summarizePayrollForAccounting([{
      totalGrossPay: 800,
      wagesPaid: 740,
      totalDeductions: 113.6,
      netPay: 686.4,
      deductions: [
        { type: 'absence', amount: 60 },
        { type: 'income_tax', amount: 24 },
        { type: 'inss_employee', amount: 29.6 },
      ],
      employerTaxes: [{ type: 'inss_employer', amount: 44.4 }],
    }]);

    expect(summary).toEqual({
      totalWagesExpense: 740,
      totalNetPay: 686.4,
      totalIncomeTax: 24,
      totalINSSEmployee: 29.6,
      totalINSSEmployer: 44.4,
      totalAdvanceRepayments: 0,
      totalOtherDeductions: 0,
    });
    expect(summary.totalWagesExpense).toBe(
      summary.totalNetPay + summary.totalIncomeTax + summary.totalINSSEmployee,
    );
  });

  it('separates advance repayments and other deductions for journal credits', () => {
    const summary = summarizePayrollForAccounting([{
      totalGrossPay: 1000,
      totalDeductions: 190,
      netPay: 810,
      deductions: [
        { type: 'income_tax', amount: 50 },
        { type: 'inss_employee', amount: 40 },
        { type: 'loan_repayment', amount: 75 },
        { type: 'court_order', amount: 25 },
      ],
      employerTaxes: [{ type: 'inss_employer', amount: 60 }],
    }]);

    expect(summary.totalWagesExpense).toBe(1000);
    expect(summary.totalAdvanceRepayments).toBe(75);
    expect(summary.totalOtherDeductions).toBe(25);
    expect(summary.totalWagesExpense).toBe(
      summary.totalNetPay
        + summary.totalIncomeTax
        + summary.totalINSSEmployee
        + summary.totalAdvanceRepayments
        + summary.totalOtherDeductions,
    );
  });
});
