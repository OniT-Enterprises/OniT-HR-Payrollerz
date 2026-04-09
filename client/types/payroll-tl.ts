/**
 * Timor-Leste Payroll Types
 * Adapted for TL labor law, tax code, and INSS requirements
 */

import { TLPayFrequency } from '@/lib/payroll/constants-tl';
import { FirestoreTimestamp } from './firebase';

// ============================================
// PAYROLL RUN (TL-Specific)
// ============================================

export type TLPayrollStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'cancelled';

export interface TLPayrollRun {
  id?: string;

  // Period
  periodStart: string;           // YYYY-MM-DD
  periodEnd: string;
  payDate: string;
  payFrequency: TLPayFrequency;

  // For weekly sub-payroll
  isSubPayroll: boolean;
  weekNumber?: number;           // 1-5
  parentPayrollRunId?: string;   // Links to monthly run

  // Status
  status: TLPayrollStatus;

  // Totals
  totalGrossPay: number;
  totalNetPay: number;
  totalDeductions: number;
  totalIncomeTax: number;
  totalINSSEmployee: number;
  totalINSSEmployer: number;
  totalEmployerCost: number;
  employeeCount: number;

  // Workflow
  createdBy: string;
  createdAt?: FirestoreTimestamp;
  approvedBy?: string;
  approvedAt?: FirestoreTimestamp;
  paidAt?: FirestoreTimestamp;

  // Notes
  notes?: string;

  // Accounting integration
  journalEntryId?: string;       // Link to accounting journal entry

  updatedAt?: FirestoreTimestamp;
}

// ============================================
// INDIVIDUAL PAYROLL RECORD
// ============================================

export interface TLPayrollRecord {
  id?: string;
  payrollRunId: string;
  employeeId: string;

  // Employee snapshot
  employeeName: string;
  employeeNumber: string;        // Internal employee ID
  department: string;
  position: string;
  isResident: boolean;

  // Hours
  regularHours: number;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  restDayHours: number;

  // Absences
  absenceHours: number;
  lateArrivalMinutes: number;
  sickDaysUsed: number;

  // Rates
  hourlyRate: number;
  dailyRate: number;
  monthlySalary: number;

  // Earnings
  earnings: TLPayrollEarningRecord[];
  grossPay: number;
  taxableIncome: number;
  inssBase: number;

  // Deductions
  deductions: TLPayrollDeductionRecord[];
  incomeTax: number;
  inssEmployee: number;
  totalDeductions: number;

  // Employer contributions
  inssEmployer: number;

  // Net
  netPay: number;
  totalEmployerCost: number;

  // YTD
  ytdGrossPay: number;
  ytdNetPay: number;
  ytdIncomeTax: number;
  ytdINSSEmployee: number;
  ytdSickDaysUsed: number;

  // Payment
  paymentMethod: 'bank_transfer' | 'cash' | 'cheque';
  bankAccountLast4?: string;

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface TLPayrollEarningRecord {
  type: string;
  description: string;
  descriptionTL: string;
  hours?: number;
  rate?: number;
  amount: number;
  isTaxable: boolean;
  isINSSBase: boolean;
}

export interface TLPayrollDeductionRecord {
  type: string;
  description: string;
  descriptionTL: string;
  amount: number;
  isStatutory: boolean;
}

