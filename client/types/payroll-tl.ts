/**
 * Timor-Leste Payroll Types
 * Adapted for TL labor law, tax code, and INSS requirements
 */

import { TLPayFrequency, TLContractType } from '@/lib/payroll/constants-tl';
import { FirestoreTimestamp } from './firebase';

// ============================================
// EMPLOYEE TYPES (TL-Specific)
// ============================================

export interface TLEmployeePayrollInfo {
  employeeId: string;

  // Personal
  firstName: string;
  middleName?: string;
  lastName: string;
  nationality: 'timorese' | 'portuguese' | 'indonesian' | 'australian' | 'other';
  isResident: boolean;  // For tax purposes

  // Documents
  nationalIdNumber?: string;     // Bilhete de Identidade
  electoralCardNumber?: string;  // Kartaun Eleitoral
  sefopeNumber?: string;         // SEFOPE work registration
  passportNumber?: string;
  workPermitNumber?: string;     // For foreigners
  inssNumber?: string;           // Social security number

  // Contract
  contractType: TLContractType;
  hireDate: string;              // YYYY-MM-DD
  contractEndDate?: string;      // For fixed-term
  probationEndDate?: string;
  department: string;
  position: string;
  reportsTo?: string;

  // Compensation
  payFrequency: TLPayFrequency;
  monthlySalary: number;
  isHourly: boolean;
  hourlyRate?: number;

  // Allowances
  foodAllowance: number;
  transportAllowance: number;
  housingAllowance: number;
  otherAllowances: number;

  // Bank
  bankName: string;
  bankAccountNumber: string;
  bankBranch?: string;

  // Tax
  hasTaxExemption: boolean;
  taxExemptionReason?: string;
}

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
  employeeNumber: string;        // SEFOPE or internal ID
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

// ============================================
// SUBSIDIO ANUAL (13th Month)
// ============================================

export interface TLSubsidioAnual {
  id?: string;
  year: number;
  employeeId: string;
  employeeName: string;

  // Calculation
  monthlySalary: number;
  monthsWorked: number;
  proRataFactor: number;
  calculatedAmount: number;

  // Status
  status: 'pending' | 'approved' | 'paid';
  paymentDate?: string;
  payrollRunId?: string;

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// ============================================
// SICK LEAVE TRACKING
// ============================================

export interface TLSickLeaveRecord {
  id?: string;
  employeeId: string;
  year: number;

  // Usage
  fullPayDaysUsed: number;       // Max 6
  reducedPayDaysUsed: number;    // Max 6
  totalDaysUsed: number;         // Max 12

  // Individual records
  records: TLSickLeaveEntry[];

  updatedAt?: FirestoreTimestamp;
}

export interface TLSickLeaveEntry {
  date: string;
  days: number;
  hasMedicalCertificate: boolean;
  certificateUrl?: string;
  payRate: number;               // 1.0 or 0.5
  payAmount: number;
  payrollRunId?: string;
  notes?: string;
}

// ============================================
// LOAN / ADVANCE
// ============================================

export interface TLEmployeeLoan {
  id?: string;
  employeeId: string;
  employeeName: string;

  // Loan details
  type: 'loan' | 'advance';
  amount: number;
  reason: string;
  requestDate: string;

  // Repayment
  repaymentMethod: 'fixed' | 'percentage';
  repaymentAmount: number;       // Per pay period
  repaymentPercentage?: number;  // Of salary
  totalRepaid: number;
  remainingBalance: number;

  // Status
  status: 'pending' | 'approved' | 'active' | 'completed' | 'cancelled';
  approvedBy?: string;
  approvedAt?: FirestoreTimestamp;
  startDate?: string;
  endDate?: string;

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// ============================================
// PER DIEM / TRAVEL
// ============================================

export interface TLPerDiem {
  id?: string;
  employeeId: string;
  employeeName: string;

  // Trip details
  destination: string;
  purpose: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;

  // Rates
  dailyRate: number;
  totalAmount: number;

  // Payment
  paymentMethod: 'advance' | 'reimbursement' | 'with_salary';
  paymentStatus: 'pending' | 'paid';
  payrollRunId?: string;
  paidDate?: string;

  // Approval
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approvedBy?: string;
  approvedAt?: FirestoreTimestamp;

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// ============================================
// BANK TRANSFER FILE
// ============================================

export interface TLBankTransferFile {
  id?: string;
  payrollRunId: string;
  bankCode: 'BNU' | 'MANDIRI' | 'ANZ' | 'BNCTL';

  // File details
  fileName: string;
  fileUrl?: string;
  format: 'csv' | 'xlsx' | 'txt';

  // Summary
  totalAmount: number;
  transactionCount: number;
  generatedAt: FirestoreTimestamp;
  generatedBy: string;

  // Status
  status: 'generated' | 'submitted' | 'processed' | 'failed';
  submittedAt?: FirestoreTimestamp;
  processedAt?: FirestoreTimestamp;
  errorMessage?: string;
}

// ============================================
// TAX / INSS REPORTS
// ============================================

export interface TLTaxReport {
  id?: string;
  type: 'monthly_irps' | 'annual_irps' | 'inss_monthly' | 'inss_annual';
  year: number;
  month?: number;               // For monthly reports

  // Totals
  totalGrossPay: number;
  totalTaxableIncome: number;
  totalIncomeTax: number;
  totalINSSEmployee: number;
  totalINSSEmployer: number;
  employeeCount: number;

  // Filing
  status: 'draft' | 'generated' | 'submitted' | 'accepted';
  dueDate: string;
  submittedDate?: string;
  confirmationNumber?: string;

  // File
  fileUrl?: string;

  createdBy: string;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// ============================================
// SEFOPE REGISTRATION
// ============================================

export interface TLSefopeRegistration {
  id?: string;
  employeeId: string;

  // Employee details for form
  fullName: string;
  nationalIdNumber: string;
  dateOfBirth: string;
  nationality: string;
  address: string;

  // Work permit (foreigners)
  workPermitNumber?: string;
  workPermitExpiry?: string;
  visaNumber?: string;
  visaExpiry?: string;
  residencyPermitNumber?: string;

  // Employment
  companyName: string;
  companyTIN: string;
  position: string;
  department: string;
  startDate: string;
  contractType: TLContractType;

  // Form generation
  pdfUrl?: string;
  generatedAt?: FirestoreTimestamp;

  // Submission
  status: 'draft' | 'generated' | 'submitted' | 'registered';
  sefopeRegistrationNumber?: string;
  submittedDate?: string;
  registeredDate?: string;

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// ============================================
// SHIFT SCHEDULING (For Security Companies)
// ============================================

export interface TLShift {
  id?: string;

  // Assignment
  employeeId: string;
  employeeName: string;
  siteId: string;
  siteName: string;
  clientId?: string;
  clientName?: string;

  // Timing
  date: string;
  startTime: string;            // HH:MM
  endTime: string;
  isNightShift: boolean;
  isHoliday: boolean;

  // Hours
  scheduledHours: number;
  actualHours?: number;
  overtimeHours?: number;
  breakMinutes: number;

  // Rates (can vary by client/site)
  hourlyRate: number;
  nightShiftPremium: number;

  // Status
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'no_show' | 'swapped';

  // Swap request
  swapRequestedWith?: string;
  swapApproved?: boolean;
  swapApprovedBy?: string;

  // Attendance
  checkInTime?: string;
  checkOutTime?: string;
  checkInMethod?: 'fingerprint' | 'qr_code' | 'gps' | 'manual';
  checkInLocation?: { lat: number; lng: number };

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface TLSite {
  id?: string;
  name: string;
  address: string;
  clientId: string;
  clientName: string;

  // Rates for this site
  dayShiftRate: number;
  nightShiftRate: number;
  holidayRate: number;

  // Requirements
  minGuards: number;
  maxGuards: number;

  // GPS coordinates for check-in verification
  location?: { lat: number; lng: number };
  allowedRadius?: number;        // Meters

  status: 'active' | 'inactive';
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// ============================================
// ATTENDANCE (Fingerprint Import)
// ============================================

export interface TLAttendanceRecord {
  id?: string;
  employeeId: string;
  date: string;

  // Clock times
  clockIn?: string;
  clockOut?: string;
  breakStart?: string;
  breakEnd?: string;

  // Calculated
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;

  // Source
  source: 'fingerprint' | 'manual' | 'mobile_app' | 'qr_code';
  deviceId?: string;
  importBatchId?: string;

  // Status
  status: 'pending' | 'approved' | 'adjusted';
  adjustedBy?: string;
  adjustmentReason?: string;

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface TLAttendanceImport {
  id?: string;
  fileName: string;
  deviceType: 'zkteco' | 'anviz' | 'hikvision' | 'other';
  importDate: FirestoreTimestamp;
  importedBy: string;

  // Stats
  recordCount: number;
  successCount: number;
  errorCount: number;
  errors?: string[];

  status: 'processing' | 'completed' | 'failed';

  createdAt?: FirestoreTimestamp;
}

// ============================================
// DISCIPLINARY
// ============================================

export interface TLWarningLetter {
  id?: string;
  employeeId: string;
  employeeName: string;

  // Warning details
  warningNumber: 1 | 2 | 3;      // 3 warnings = disciplinary action
  issueDate: string;
  issueReason: string;
  category: 'late_arrival' | 'absence' | 'misconduct' | 'performance' | 'other';

  // Supporting details
  incidentDate?: string;
  incidentDescription?: string;
  witnesses?: string[];

  // Response
  employeeResponse?: string;
  employeeSignedDate?: string;

  // Document
  pdfUrl?: string;

  // Status
  status: 'draft' | 'issued' | 'acknowledged' | 'appealed';
  issuedBy: string;

  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// ============================================
// HELPER TYPES
// ============================================

export interface TLPayrollSummary {
  periodLabel: string;
  grossPay: number;
  incomeTax: number;
  inssEmployee: number;
  inssEmployer: number;
  netPay: number;
  employeeCount: number;
}

export interface TLEmployeePayrollHistory {
  employeeId: string;
  records: {
    payrollRunId: string;
    periodStart: string;
    periodEnd: string;
    payDate: string;
    grossPay: number;
    netPay: number;
    status: TLPayrollStatus;
  }[];
  ytdSummary: {
    grossPay: number;
    incomeTax: number;
    inssEmployee: number;
    netPay: number;
  };
}
