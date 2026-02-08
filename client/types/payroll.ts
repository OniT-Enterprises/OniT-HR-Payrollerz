/**
 * Payroll TypeScript Types
 * Adapted from timor-payroll patterns for Firebase/OniT HR system
 */

import { FirestoreTimestamp } from './firebase';

// Payroll Run Status
export type PayrollStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'cancelled' | 'rejected';

// Pay frequency
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

// Filing status for tax calculation
export type FilingStatus = 'single' | 'married' | 'head_of_household';

// Deduction types
export type DeductionType =
  | 'federal_tax'
  | 'state_tax'
  | 'local_tax'
  | 'social_security'
  | 'medicare'
  | 'health_insurance'
  | 'dental_insurance'
  | 'vision_insurance'
  | 'life_insurance'
  | '401k'
  | 'hsa'
  | 'fsa'
  | 'garnishment'
  | 'advance'
  | 'other';

// Earning types
export type EarningType =
  | 'regular'
  | 'overtime'
  | 'double_time'
  | 'holiday'
  | 'bonus'
  | 'subsidio_anual'
  | 'commission'
  | 'tip'
  | 'reimbursement'
  | 'allowance'
  | 'other';

/**
 * Payroll Run - A batch payroll processing event
 */
export interface PayrollRun {
  id?: string;
  tenantId?: string;

  // Period information
  periodStart: string;  // YYYY-MM-DD
  periodEnd: string;    // YYYY-MM-DD
  payDate: string;      // YYYY-MM-DD
  payFrequency: PayFrequency;

  // Status tracking
  status: PayrollStatus;

  // Summary totals
  totalGrossPay: number;
  totalNetPay: number;
  totalDeductions: number;
  totalEmployerTaxes: number;
  totalEmployerContributions: number;
  employeeCount: number;

  // Workflow
  createdBy: string;
  createdAt?: FirestoreTimestamp;
  approvedBy?: string;
  approvedAt?: FirestoreTimestamp;
  paidAt?: FirestoreTimestamp;

  // Rejection tracking
  rejectedBy?: string;
  rejectedAt?: FirestoreTimestamp;
  rejectionReason?: string;

  // Notes
  notes?: string;

  // Accounting linkage (optional)
  journalEntryId?: string;

  updatedAt?: FirestoreTimestamp;
}

/**
 * Individual employee payroll record within a payroll run
 */
export interface PayrollRecord {
  id?: string;
  payrollRunId: string;
  tenantId?: string;
  employeeId: string;

  // Employee snapshot (denormalized for historical reference)
  employeeName: string;
  employeeNumber: string;
  department: string;
  position: string;

  // Hours worked
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  holidayHours: number;
  ptoHoursUsed: number;
  sickHoursUsed: number;

  // Rates
  hourlyRate: number;
  overtimeRate: number;  // multiplier (e.g., 1.5)

  // Earnings breakdown
  earnings: PayrollEarning[];
  totalGrossPay: number;

  // Deductions breakdown
  deductions: PayrollDeduction[];
  totalDeductions: number;

  // Employer contributions (not deducted from employee)
  employerContributions: EmployerContribution[];
  totalEmployerContributions: number;

  // Employer taxes
  employerTaxes: EmployerTax[];
  totalEmployerTaxes: number;

  // Net pay
  netPay: number;

  // Total cost to employer
  totalEmployerCost: number;

  // YTD totals
  ytdGrossPay: number;
  ytdNetPay: number;
  ytdFederalTax: number;
  ytdStateTax: number;
  ytdSocialSecurity: number;
  ytdMedicare: number;

  // Metadata
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

/**
 * Individual earning line item
 */
export interface PayrollEarning {
  type: EarningType;
  description: string;
  hours?: number;
  rate?: number;
  amount: number;
}

/**
 * Individual deduction line item
 */
export interface PayrollDeduction {
  type: DeductionType;
  description: string;
  amount: number;
  isPreTax: boolean;
  isPercentage: boolean;
  percentage?: number;
}

/**
 * Employer contribution (not deducted from employee pay)
 */
export interface EmployerContribution {
  type: string;
  description: string;
  amount: number;
}

/**
 * Employer-side taxes
 */
export interface EmployerTax {
  type: 'social_security' | 'medicare' | 'futa' | 'suta';
  description: string;
  amount: number;
}

/**
 * Employee tax settings (stored on employee record)
 */
export interface EmployeeTaxInfo {
  federalFilingStatus: FilingStatus;
  federalAllowances: number;
  additionalFederalWithholding: number;
  stateFilingStatus?: FilingStatus;
  stateAllowances?: number;
  additionalStateWithholding?: number;
  isExemptFromFederal: boolean;
  isExemptFromState: boolean;
  isExemptFromFICA: boolean;
}

/**
 * Employee benefit enrollment
 */
export interface BenefitEnrollment {
  id?: string;
  tenantId?: string;
  employeeId: string;
  benefitType: 'health' | 'dental' | 'vision' | 'life' | '401k' | 'hsa' | 'fsa' | 'other';
  planName: string;
  planId: string;
  coverageLevel: 'employee_only' | 'employee_spouse' | 'employee_children' | 'family';
  employeeContribution: number;  // per pay period
  employerContribution: number;  // per pay period
  isPreTax: boolean;
  effectiveDate: string;
  terminationDate?: string;
  status: 'active' | 'pending' | 'terminated';
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

/**
 * Recurring deduction/advance
 */
export interface RecurringDeduction {
  id?: string;
  tenantId?: string;
  employeeId: string;
  type: DeductionType;
  description: string;
  amount: number;
  isPercentage: boolean;
  percentage?: number;
  isPreTax: boolean;
  startDate: string;
  endDate?: string;
  remainingBalance?: number;  // For advances with set payback amount
  totalAmount?: number;       // Original amount for advances
  frequency: PayFrequency | 'per_paycheck';
  status: 'active' | 'paused' | 'completed';
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

/**
 * Tax report record
 */
export interface TaxReport {
  id?: string;
  tenantId?: string;
  reportType: 'quarterly_941' | 'annual_w2' | 'annual_940' | 'state_quarterly' | 'state_annual';
  period: string;  // e.g., "Q1 2024" or "2024"
  year: number;
  quarter?: number;

  // Summary data
  totalWages: number;
  totalFederalTax: number;
  totalStateTax: number;
  totalSocialSecurity: number;
  totalMedicare: number;
  totalFUTA?: number;
  totalSUTA?: number;

  employeeCount: number;

  // Filing status
  status: 'draft' | 'generated' | 'filed' | 'accepted';
  filedDate?: string;
  confirmationNumber?: string;

  // PDF/file reference
  fileUrl?: string;

  createdBy: string;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

/**
 * Bank transfer record (extends existing)
 */
export interface BankTransfer {
  id?: string;
  tenantId?: string;
  payrollRunId: string;
  payrollPeriod: string;
  amount: number;
  employeeCount: number;
  transferDate: string;
  bankAccountId: string;
  bankAccountName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reference: string;
  initiatedBy: string;
  notes?: string;
  errorMessage?: string;
  completedAt?: FirestoreTimestamp;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

/**
 * Input for payroll calculation
 */
export interface PayrollCalculationInput {
  employeeId: string;

  // Pay info
  baseSalary: number;  // Monthly salary
  isHourly: boolean;
  hourlyRate?: number;

  // Hours
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  holidayHours: number;

  // Additional earnings
  bonuses: number;
  commissions: number;
  reimbursements: number;
  allowances: number;
  tips: number;

  // Tax settings
  taxInfo: EmployeeTaxInfo;
  state: string;  // State code for state tax calculation

  // YTD totals (for tax bracket calculations)
  ytdGrossPay: number;
  ytdSocialSecurity: number;

  // Benefits/deductions
  benefitEnrollments: BenefitEnrollment[];
  recurringDeductions: RecurringDeduction[];
}

/**
 * Result from payroll calculation
 */
export interface PayrollCalculationResult {
  // Earnings
  regularPay: number;
  overtimePay: number;
  doubleTimePay: number;
  holidayPay: number;
  bonuses: number;
  commissions: number;
  reimbursements: number;
  allowances: number;
  tips: number;
  grossPay: number;

  // Pre-tax deductions
  preTaxDeductions: PayrollDeduction[];
  totalPreTaxDeductions: number;

  // Taxable income
  taxableIncome: number;

  // Taxes
  federalTax: number;
  stateTax: number;
  localTax: number;
  socialSecurityEmployee: number;
  medicareEmployee: number;
  additionalMedicare: number;  // 0.9% over $200k
  totalEmployeeTaxes: number;

  // Post-tax deductions
  postTaxDeductions: PayrollDeduction[];
  totalPostTaxDeductions: number;

  // Net pay
  totalDeductions: number;
  netPay: number;

  // Employer costs
  socialSecurityEmployer: number;
  medicareEmployer: number;
  futa: number;
  suta: number;
  employerBenefitContributions: number;
  totalEmployerCost: number;

  // Warnings/notes
  warnings: string[];
}

/**
 * List/filter options
 */
export interface ListPayrollRunsOptions {
  tenantId?: string;
  status?: PayrollStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ListPayrollRecordsOptions {
  payrollRunId?: string;
  employeeId?: string;
  department?: string;
  limit?: number;
  offset?: number;
}
