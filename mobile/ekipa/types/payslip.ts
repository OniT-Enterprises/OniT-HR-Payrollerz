/**
 * Payslip types — mirrors web payrun/payslip structure
 * Payslips stored at: tenants/{tid}/payruns/{yyyymm}/payslips/{empId}
 */

export interface PayslipEarning {
  label: string;
  amount: number;
}

export interface PayslipDeduction {
  label: string;
  amount: number;
}

export interface Payslip {
  id: string; // employeeId
  employeeId: string;
  employeeName: string;
  period: string; // YYYYMM
  periodLabel: string; // e.g. "January 2026"

  // Earnings
  baseSalary: number;
  overtimePay: number;
  allowances: number;
  otherEarnings: number;
  grossPay: number;

  // Deductions
  witAmount: number; // Withholding tax
  inssEmployee: number; // INSS 4%
  inssEmployer: number; // INSS 6%
  otherDeductions: number;
  totalDeductions: number;

  // Net
  netPay: number;

  // Detail arrays for breakdown view
  earnings: PayslipEarning[];
  deductions: PayslipDeduction[];

  // Metadata
  status: 'draft' | 'processed' | 'approved' | 'paid';
  processedAt?: Date;
  paidAt?: Date;
}

export interface PayrunMeta {
  period: string; // YYYYMM
  status: string;
  processedAt?: Date;
}
