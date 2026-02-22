/**
 * Payroll TypeScript Types
 * Adapted from timor-payroll patterns for Firebase/OniT HR system
 */

import { FirestoreTimestamp } from './firebase';

// Payroll Run Status
export type PayrollStatus = 'draft' | 'writing_records' | 'processing' | 'approved' | 'paid' | 'cancelled' | 'rejected';

// Pay frequency
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

// Deduction types (Timor-Leste native)
export type DeductionType =
  | 'income_tax'
  | 'inss_employee'
  | 'inss_employer'
  | 'absence'
  | 'late_arrival'
  | 'loan_repayment'
  | 'advance_repayment'
  | 'court_order'
  | 'health_insurance'
  | 'life_insurance'
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

  // Batch write tracking — used to detect/repair interrupted multi-batch writes
  expectedRecordCount?: number;

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
  ytdIncomeTax: number;
  ytdINSSEmployee: number;

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
  type: 'inss_employer';
  description: string;
  amount: number;
}

/**
 * Employee benefit enrollment
 */
export interface BenefitEnrollment {
  id?: string;
  tenantId?: string;
  employeeId: string;
  benefitType: 'health' | 'life' | 'transport' | 'food' | 'housing' | 'other';
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

