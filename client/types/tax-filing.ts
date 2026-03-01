/**
 * Tax Filing Types for Timor-Leste ATTL Compliance
 *
 * Based on:
 * - ATTL (Autoridade Tributaria Timor-Leste) requirements
 * - Law 8/2008 (Taxes and Duties Act)
 * - Monthly WIT returns due by 15th of following month
 * - Annual WIT returns due by March 31st
 */

// ============================================
// FILING TYPES
// ============================================

export type TaxFilingType = 'monthly_wit' | 'annual_wit' | 'inss_monthly';
export type TaxFilingTask = 'statement' | 'payment';

export type TaxFilingStatus = 'pending' | 'filed' | 'overdue' | 'draft';

export type SubmissionMethod = 'etax' | 'bnu_paper' | 'inss_portal' | 'not_filed';

// ============================================
// MONTHLY WIT RETURN
// ============================================

export interface MonthlyWITEmployeeRecord {
  employeeId: string;
  fullName: string;
  tinNumber?: string;
  isResident: boolean;
  grossWages: number;
  taxableWages: number;       // Gross - $500 threshold for residents
  witWithheld: number;        // 10% of taxable wages
}

export interface MonthlyWITReturn {
  // Header
  employerTIN: string;
  employerName: string;
  employerAddress: string;
  reportingPeriod: string;    // "2025-01"
  periodStartDate: string;
  periodEndDate: string;

  // Summary Totals
  totalEmployees: number;
  totalResidentEmployees: number;
  totalNonResidentEmployees: number;
  totalGrossWages: number;
  totalTaxableWages: number;
  totalWITWithheld: number;

  // Employee Details
  employees: MonthlyWITEmployeeRecord[];
}

// ============================================
// ANNUAL WIT RETURN
// ============================================

export interface AnnualWITEmployeeRecord {
  employeeId: string;
  fullName: string;
  tinNumber?: string;
  isResident: boolean;
  startDate?: string;         // If hired during year
  endDate?: string;           // If terminated during year
  monthsWorked: number;
  totalGrossWages: number;
  totalWITWithheld: number;
}

export interface AnnualWITReturn {
  // Header
  employerTIN: string;
  employerName: string;
  employerAddress: string;
  taxYear: number;            // e.g., 2025

  // Summary
  totalEmployeesInYear: number;
  totalGrossWagesPaid: number;
  totalWITWithheld: number;

  // Employee Details
  employees: AnnualWITEmployeeRecord[];
}

// ============================================
// MONTHLY INSS RETURN
// ============================================

export interface MonthlyINSSEmployeeRecord {
  employeeId: string;
  fullName: string;
  inssNumber?: string;
  contributionBase: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
}

export interface MonthlyINSSReturn {
  // Header
  employerTIN: string;
  employerName: string;
  employerAddress: string;
  reportingPeriod: string; // "2025-01"
  periodStartDate: string;
  periodEndDate: string;

  // Summary Totals
  totalEmployees: number;
  totalContributionBase: number;
  totalEmployeeContributions: number;
  totalEmployerContributions: number;
  totalContributions: number;

  // Employee Details
  employees: MonthlyINSSEmployeeRecord[];
}

// ============================================
// EMPLOYEE WIT CERTIFICATE
// ============================================

export interface EmployeeWITCertificate {
  // Employer Info
  employerName: string;
  employerTIN: string;
  employerAddress: string;

  // Employee Info
  employeeId: string;
  employeeName: string;
  employeeTIN?: string;
  employeeAddress: string;

  // Employment Period
  taxYear: number;
  employmentStartDate: string;
  employmentEndDate?: string;

  // Tax Summary
  totalGrossWages: number;
  totalWITWithheld: number;

  // Certification
  certificationDate: string;
  authorizedSignatory: string;
  signatoryPosition: string;
}

// ============================================
// TAX FILING RECORD (Stored in Firestore)
// ============================================

export interface TaxFiling {
  id: string;
  tenantId: string;

  // Filing Info
  type: TaxFilingType;
  period: string;             // "2025-01" for monthly, "2024" for annual
  status: TaxFilingStatus;
  dueDate: string;
  statementStatus?: TaxFilingStatus;
  paymentStatus?: TaxFilingStatus;
  statementDueDate?: string;
  paymentDueDate?: string;

  // Data Snapshot
  dataSnapshot: MonthlyWITReturn | AnnualWITReturn | MonthlyINSSReturn;

  // Filing Details (when filed)
  filedDate?: string;
  submissionMethod?: SubmissionMethod;
  receiptNumber?: string;
  notes?: string;
  statementFiledDate?: string;
  paymentFiledDate?: string;
  statementSubmissionMethod?: SubmissionMethod;
  paymentSubmissionMethod?: SubmissionMethod;
  statementReceiptNumber?: string;
  paymentReceiptNumber?: string;
  statementNotes?: string;
  paymentNotes?: string;

  // Totals (for quick display)
  totalWages: number;
  totalWITWithheld: number;
  totalINSSEmployee?: number;
  totalINSSEmployer?: number;
  employeeCount: number;

  // Attachments
  pdfUrl?: string;
  csvUrl?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  filedBy?: string;
}

// ============================================
// FILING TRACKER
// ============================================

export interface FilingDueDate {
  type: TaxFilingType;
  /**
   * Some obligations have multiple deadlines (e.g., INSS statement vs payment).
   * When present, this distinguishes the deadline task while keeping `type` stable.
   */
  task?: TaxFilingTask;
  period: string;
  dueDate: string;
  status: TaxFilingStatus;
  daysUntilDue: number;
  isOverdue: boolean;
  filing?: TaxFiling;
}

// ============================================
// AUDIT LOG TYPES
// ============================================

export type AuditEntityType =
  | 'employee'
  | 'payroll'
  | 'tax_filing'
  | 'leave'
  | 'attendance'
  | 'settings'
  | 'document';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'export'
  | 'view'
  | 'file'
  | 'approve';

export interface AuditLogEntry {
  id: string;
  tenantId: string;

  // What changed
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;        // For display (e.g., employee name)
  action: AuditAction;

  // Change details
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];

  // Context
  timestamp: Date;
  userId: string;
  userName: string;
  ipAddress?: string;
  userAgent?: string;

  // Retention
  retentionExpiresAt: Date;   // 5 years from timestamp
}

// ============================================
// ARCHIVED EMPLOYEE
// ============================================

export type TerminationReason =
  | 'resignation'
  | 'dismissal'
  | 'redundancy'
  | 'contract_end'
  | 'retirement'
  | 'death'
  | 'mutual_agreement';

export type TerminationType =
  | 'with_cause'
  | 'without_cause'
  | 'mutual';

export interface ArchivedEmployee {
  id: string;
  tenantId: string;
  originalEmployeeId: string;

  // Full employee data snapshot at termination
  employeeData: Record<string, unknown>;

  // Termination info
  terminationDate: string;
  terminationReason: TerminationReason;
  terminationType: TerminationType;
  terminationNotes?: string;
  finalPayDate: string;
  finalPayAmount?: number;

  // Retention
  archivedAt: Date;
  retentionExpiresAt: Date;   // terminationDate + 5 years
  canBeDeleted: boolean;      // false until retention expires

  // Audit
  archivedBy: string;
  archivedByName: string;
}

// ============================================
// TAX FILING ARCHIVE
// ============================================

export interface TaxFilingArchive {
  id: string;
  tenantId: string;
  originalFilingId: string;

  filingType: TaxFilingType;
  period: string;

  // Filing details
  filedDate: string;
  submissionMethod: SubmissionMethod;
  receiptNumber?: string;

  // Snapshot of data at filing time
  dataSnapshot: MonthlyWITReturn | AnnualWITReturn;

  // Attachments
  pdfUrl?: string;
  csvUrl?: string;

  // Retention
  archivedAt: Date;
  retentionExpiresAt: Date;   // filedDate + 5 years
}

// ============================================
// FOREIGN WORKER TYPES
// ============================================

export type VisaType = 'C' | 'other';

export type WorkPermitStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'expired'
  | 'renewal_pending';

export interface WorkVisa {
  number: string;
  type: VisaType;
  issueDate: string;
  expiryDate: string;
  issuingAuthority?: string;
  documentUrl?: string;
}

export interface ResidencePermit {
  number: string;
  issueDate: string;
  expiryDate: string;
  documentUrl?: string;
}

export interface WorkPermit {
  number: string;
  issueDate: string;
  expiryDate: string;
  documentUrl?: string;
}

export interface ForeignWorkerDocumentChecklist {
  employmentContract: { provided: boolean; documentUrl?: string };
  companyBusinessRegistration: { provided: boolean; documentUrl?: string };
  taxComplianceCertificate: { provided: boolean; documentUrl?: string; validUntil?: string };
  passportCopy: { provided: boolean; documentUrl?: string; passportNumber?: string; expiryDate?: string };
  qualificationsCertificates: { provided: boolean; documentUrls?: string[] };
  curriculumVitae: { provided: boolean; documentUrl?: string };
  medicalCertificate: { provided: boolean; documentUrl?: string; issuedDate?: string; validUntil?: string };
  policeClearance: { provided: boolean; documentUrl?: string; issuedDate?: string; issuingCountry?: string };
  accommodationProof: { provided: boolean; documentUrl?: string; address?: string };
  returnTicketOrFunds: { provided: boolean; documentUrl?: string; type?: 'ticket' | 'funds_proof' };
}

export interface RenewalHistoryEntry {
  date: string;
  type: 'work_visa' | 'residence_permit' | 'work_permit';
  previousExpiry: string;
  newExpiry: string;
  processedBy: string;
  notes?: string;
}

export interface ForeignWorkerData {
  // Status
  status: WorkPermitStatus;

  // Visa & Permits
  workVisa?: WorkVisa;
  residencePermit?: ResidencePermit;
  workPermit?: WorkPermit;

  // Documents
  documentsChecklist: ForeignWorkerDocumentChecklist;

  // Employer Justification
  positionJustification?: string;
  localRecruitmentAttempts?: string;
  skillsNotAvailableLocally?: string[];

  // History
  renewalHistory: RenewalHistoryEntry[];
}

export interface ForeignWorkerAlert {
  employeeId: string;
  employeeName: string;
  documentType: 'work_visa' | 'residence_permit' | 'work_permit';
  expiryDate: string;
  daysUntilExpiry: number;
  severity: 'info' | 'warning' | 'critical' | 'expired';
  message: string;
}
