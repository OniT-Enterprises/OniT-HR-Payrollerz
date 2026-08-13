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
type EarningType =
  | 'regular'
  | 'overtime'
  | 'double_time'
  | 'holiday'
  | 'night_shift'
  | 'rest_day'
  | 'sick_pay'
  | 'bonus'
  /** Prémio de assiduidade — forfeited or reduced by unjustified absence. */
  | 'attendance_premium'
  /** Wage arrears from a back-dated pay rise ("Retroativos"). */
  | 'retroactive_pay'
  | 'subsidio_anual'
  | 'service_compensation'
  /** Art. 32 cash-out of annual leave left untaken at exit. */
  | 'untaken_leave'
  | 'non_cash_benefit'
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
  paidBy?: string;
  paymentDate?: string;
  paymentReference?: string;
  paymentMethod?: 'bank_transfer' | 'cash';
  paymentAccountCode?: string;
  paymentBankAccountId?: string;
  paymentBankAccountName?: string;
  bankTransferId?: string;

  // Rejection tracking
  rejectedBy?: string;
  rejectedAt?: FirestoreTimestamp;
  rejectionReason?: string;

  // Notes
  notes?: string;

  // Accounting linkage (optional)
  journalEntryId?: string;
  settlementJournalEntryId?: string;

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
  /**
   * Employee's INSS registration number (NISS) as at the run. Printed on the
   * payslip and snapshotted here so the as-sent PDF survives a later profile
   * edit. Empty string when the worker has no NISS yet — payroll never blocks on
   * it, because the number is needed to FILE the monthly DR, not to work out pay.
   */
  employeeNiss?: string;
  department: string;
  position: string;
  isResident?: boolean;
  /** Project allocation captured when this payroll record was created. */
  projectCode?: string;
  /** Donor/funding allocation captured when this payroll record was created. */
  fundingSource?: string;

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
  /** Statutory wages actually paid after unpaid absence/late reductions. */
  wagesPaid?: number;
  /** WIT wage base for the period after attendance reductions. */
  taxableIncome?: number;
  /** Threshold-adjusted amount to which the WIT rate was applied. */
  witTaxableAmount?: number;
  /** WIT withheld this period — required by the ATTL/INSS filing generators. */
  incomeTax?: number;
  /** Employee INSS (4%) withheld — required by the INSS filing generators. */
  inssEmployee?: number;
  /** Employer INSS (6%) contribution — required by the INSS filing generators. */
  inssEmployer?: number;
  /** INSS contribution base used for the period. */
  inssBase?: number;

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
  /**
   * Accumulated EMPLOYER social-security contribution for the year. Optional
   * because records written before this field existed do not carry it, and the
   * payslip omits the row rather than printing a wrong zero.
   */
  ytdINSSEmployer?: number;

  /**
   * `effectiveFrom` dates of the salary changes whose arrears this record's
   * retroactive-pay earning discharges. Stamped onto the employee's
   * `compensation.salaryHistory` when the run is marked paid, which is what stops
   * a second run over the same period paying the same arrears again.
   */
  retroactiveSettles?: string[];

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
  /**
   * 'YYYY-MM' period month of the last PAID payroll run that withheld this
   * deduction — the once-per-period-month guard (see
   * client/lib/payroll/recurring-deductions.ts). Stamped by
   * markPayrollRunAsPaid; run input-building skips docs already stamped with
   * the run's own period month.
   */
  lastAppliedPeriod?: string;
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
  settlementJournalEntryId?: string;
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
