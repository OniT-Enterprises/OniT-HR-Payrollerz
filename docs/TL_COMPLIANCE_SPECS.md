# Timor-Leste Compliance Features Specification

> **Status note — 11 July 2026:** This is an older feature-planning document,
> not the authoritative calculation specification. Some research links below
> are third-party summaries and may be stale. For implemented formulas, current
> primary-source links, worked examples, and unresolved professional-review
> questions, use the
> [Timor-Leste Accounting Mathematics Review](TIMOR_LESTE_ACCOUNTING_MATH_REVIEW.html)
> and [current compliance audit](TL_COMPLIANCE_AUDIT.md). Do not change payroll
> rates from this planning document alone.

## Overview

This document details the implementation specifications for TL government compliance features:
1. **ATTL Tax Integration** - Monthly/Annual WIT returns for Tax Authority
2. **SEFOPE Enhancement** - Extended employment registration with foreign worker support
3. **Document Retention** - 5-year compliance archive with audit trail
4. **Foreign Worker Module** - Work permit tracking and alerts

**Research Sources:**
- [ATTL Official](https://attl.gov.tl/)
- [ATTL WIT Guide](https://attl.gov.tl/wage-income-tax/)
- [ATTL e-Tax](https://e-tax.mof.gov.tl/login)
- [TL Immigration](https://www.migracao.gov.tl/)
- [Rivermate TL Guide](https://rivermate.com/guides/timor-leste/)
- [Neeyamo TL Guide](https://www.neeyamo.com/global-guide/timor-leste)
- [Papaya Global TL](https://www.papayaglobal.com/countrypedia/country/timor-leste/)

---

## 1. ATTL Tax Integration

### 1.1 Background

The Autoridade Tributaria Timor-Leste (ATTL) requires employers to:
- File monthly WIT (Wage Income Tax) returns by the 15th of the following month
- File annual WIT returns by March 31st
- Provide WIT certificates to employees within 21 days of year-end

**Contact Information:**
- e-Tax Support: (+670) 74962772, (+670) 77305824
- Email: etax@mof.gov.tl
- Office: Level 8, Ministeriu Finansas, Aitarak-laran, Dili

### 1.2 Monthly WIT Return

#### Deadline
- **Due:** 15th of the month following the pay period
- Example: January wages → file by February 15th

#### Submission Methods
1. **e-Tax Portal:** https://e-tax.mof.gov.tl/login
2. **Paper:** 3 copies of Monthly Taxes Form to BNU bank branches

#### Required Data Fields

```typescript
interface MonthlyWITReturn {
  // Header
  employerTIN: string;
  employerName: string;
  reportingPeriod: string;        // "2025-01"
  submissionDate: string;

  // Summary Totals
  totalEmployees: number;
  totalResidentEmployees: number;
  totalNonResidentEmployees: number;
  totalGrossWages: number;        // All wages paid
  totalTaxableWages: number;      // Wages subject to WIT
  totalWITWithheld: number;       // 10% tax withheld

  // Employee Details (per employee)
  employees: {
    employeeId: string;
    fullName: string;
    tinNumber?: string;           // If employee has TIN
    isResident: boolean;
    grossWages: number;
    taxableWages: number;         // Gross - $500 threshold for residents
    witWithheld: number;
  }[];
}
```

#### Export Formats

**CSV Format (for e-Tax upload):**
```csv
Employee ID,Full Name,TIN,Resident,Gross Wages,Taxable Wages,WIT Withheld
EMP001,Jose Silva,,Y,650.00,150.00,15.00
EMP002,Maria Santos,,Y,1200.00,700.00,70.00
EMP003,John Smith,TIN12345,N,2000.00,2000.00,200.00
```

**PDF Summary (for BNU submission):**
- Company header with TIN
- Period covered
- Summary totals table
- Employee detail table
- Signature line for authorized person
- 3 copies required

### 1.3 Annual WIT Return

#### Deadline
- **Due:** March 31st following the end of the tax year
- Tax year: January 1 - December 31

#### Required Data Fields

```typescript
interface AnnualWITReturn {
  // Header
  employerTIN: string;
  employerName: string;
  taxYear: number;                // e.g., 2025
  submissionDate: string;

  // Annual Summary
  totalEmployeesInYear: number;
  totalGrossWagesPaid: number;
  totalWITWithheld: number;

  // Per Employee Annual Summary
  employees: {
    employeeId: string;
    fullName: string;
    tinNumber?: string;
    isResident: boolean;
    startDate?: string;           // If hired during year
    endDate?: string;             // If terminated during year
    totalGrossWages: number;      // Full year total
    totalWITWithheld: number;     // Full year WIT
  }[];
}
```

### 1.4 Employee WIT Certificate

**Requirement:** Provide to each employee within 21 days after year-end OR upon termination.

```typescript
interface EmployeeWITCertificate {
  // Employer Info
  employerName: string;
  employerTIN: string;
  employerAddress: string;

  // Employee Info
  employeeName: string;
  employeeTIN?: string;
  employeeAddress: string;

  // Employment Period
  taxYear: number;
  employmentStartDate: string;
  employmentEndDate?: string;     // If terminated

  // Tax Summary
  totalGrossWages: number;
  totalWITWithheld: number;

  // Certification
  certificationDate: string;
  authorizedSignatory: string;
  signatoryPosition: string;
}
```

### 1.5 UI/UX Design

#### New Menu: Reports > Tax Reports > ATTL Returns

**Monthly Return Page:**
```
┌─────────────────────────────────────────────────────────────┐
│ ATTL Monthly WIT Return                                     │
├─────────────────────────────────────────────────────────────┤
│ Period: [January 2025 ▼]    Status: ⚠️ Due in 5 days       │
├─────────────────────────────────────────────────────────────┤
│ Summary                                                     │
│ ┌─────────────────┬─────────────────┬─────────────────────┐ │
│ │ Total Employees │ Total Wages     │ Total WIT          │ │
│ │ 45              │ $52,350.00      │ $3,285.00          │ │
│ └─────────────────┴─────────────────┴─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Employee Details                              [Search 🔍]   │
│ ┌────┬────────────┬──────────┬───────────┬────────────────┐ │
│ │ ID │ Name       │ Resident │ Gross     │ WIT Withheld   │ │
│ ├────┼────────────┼──────────┼───────────┼────────────────┤ │
│ │001 │ Jose Silva │ Yes      │ $650.00   │ $15.00         │ │
│ │002 │ Maria...   │ Yes      │ $1,200.00 │ $70.00         │ │
│ └────┴────────────┴──────────┴───────────┴────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [Export CSV]  [Export PDF]  [Mark as Filed]                 │
└─────────────────────────────────────────────────────────────┘
```

**Filing Tracker Dashboard Widget:**
```
┌─────────────────────────────────────────┐
│ 📋 Tax Filing Status                    │
├─────────────────────────────────────────┤
│ Monthly WIT (Jan 2025)                  │
│ ├─ Due: Feb 15, 2025                    │
│ ├─ Status: ⚠️ Pending                   │
│ └─ [File Now →]                         │
│                                         │
│ Annual WIT (2024)                       │
│ ├─ Due: Mar 31, 2025                    │
│ ├─ Status: ✅ Filed Jan 28              │
│ └─ [View →]                             │
└─────────────────────────────────────────┘
```

### 1.6 Implementation Tasks

```
□ Create TaxFilingService
  □ generateMonthlyWITReturn(period: string)
  □ generateAnnualWITReturn(year: number)
  □ generateEmployeeWITCertificate(employeeId, year)
  □ markAsFiled(filingId, method, receiptNumber?)

□ Create ATTL Return Pages
  □ /reports/tax/attl-monthly - Monthly WIT return
  □ /reports/tax/attl-annual - Annual WIT return
  □ /reports/tax/wit-certificates - Employee certificates

□ Create Export Functions
  □ exportMonthlyCSV() - For e-Tax upload
  □ exportMonthlyPDF() - For BNU submission
  □ exportAnnualPDF() - Annual return
  □ exportWITCertificatePDF() - Per employee

□ Create Filing Tracker
  □ Store filing history in Firestore
  □ Dashboard widget showing upcoming/overdue
  □ Email reminders (future)

□ Add to Dashboard
  □ Tax Filing Status card
  □ Overdue alert banner
```

---

## 2. SEFOPE Enhancement

### 2.1 Current State

The system already has `client/lib/documents/sefope-form.ts` with:
- Basic employment registration form fields
- Portuguese/Tetun labels
- Form validation
- PDF generation support

### 2.2 Enhancements Needed

#### Foreign Worker Extended Fields

Add to `SefopeFormData` interface:

```typescript
interface SefopeFormDataExtended extends SefopeFormData {
  // Foreign Worker Section (only if residencyStatus !== 'timorese')
  foreignWorker?: {
    // Work Visa (Type C)
    workVisaNumber: string;
    workVisaIssueDate: string;
    workVisaExpiryDate: string;
    workVisaType: 'C' | 'other';

    // Temporary Residence Permit
    residencePermitNumber: string;
    residencePermitIssueDate: string;
    residencePermitExpiryDate: string;

    // Employer Justification
    positionJustification: string;    // Why foreign worker needed
    localRecruitmentAttempts: string; // What local hiring was tried
    skillsNotAvailableLocally: string[];

    // Work Permit (from SEFOPE)
    workPermitNumber?: string;
    workPermitIssueDate?: string;
    workPermitExpiryDate?: string;
    workPermitStatus: 'pending' | 'approved' | 'expired' | 'renewal';
  };

  // Document Checklist
  documentsProvided: {
    employmentContract: boolean;
    companyRegistration: boolean;
    taxComplianceCertificate: boolean;
    passportCopy: boolean;
    qualificationsCertificates: boolean;
    medicalCertificate: boolean;
    policeClearance: boolean;
    accommodationProof: boolean;
    returnTicketProof: boolean;
  };
}
```

### 2.3 SEFOPE Form Labels (Portuguese)

Add to `SEFOPE_LABELS`:

```typescript
// Foreign Worker Section
foreignWorkerSection: 'DADOS DO TRABALHADOR ESTRANGEIRO',
workVisaNumber: 'Número do Visto de Trabalho',
workVisaIssueDate: 'Data de Emissão do Visto',
workVisaExpiryDate: 'Data de Validade do Visto',
residencePermitNumber: 'Número da Autorização de Residência',
residencePermitExpiryDate: 'Data de Validade da AR',
positionJustification: 'Justificação para Contratação de Estrangeiro',
localRecruitmentAttempts: 'Tentativas de Recrutamento Local',

// Document Checklist
documentChecklist: 'LISTA DE DOCUMENTOS',
employmentContract: 'Contrato de Trabalho',
companyRegistration: 'Registo da Empresa',
taxComplianceCertificate: 'Certidão de Conformidade Fiscal',
passportCopy: 'Cópia do Passaporte',
qualificationsCertificates: 'Certificados de Qualificações',
medicalCertificate: 'Atestado Médico',
policeClearance: 'Certificado de Registo Criminal',
accommodationProof: 'Comprovativo de Alojamento',
returnTicketProof: 'Comprovativo de Bilhete de Regresso',
```

### 2.4 Implementation Tasks

```
□ Extend sefope-form.ts
  □ Add foreign worker fields to interface
  □ Add Portuguese labels
  □ Update mapToSefopeForm() function
  □ Update validation for foreign workers

□ Update SEFOPE PDF Generator
  □ Add foreign worker section (conditional)
  □ Add document checklist section
  □ Two-page form for foreign workers

□ Create Foreign Worker Registration Wizard
  □ Step 1: Basic info (existing)
  □ Step 2: Visa & permit details
  □ Step 3: Document checklist with uploads
  □ Step 4: Review & generate PDF
```

---

## 3. Document Retention & Audit Trail

### 3.1 Legal Requirements

| Document Type | Retention Period | Source |
|---------------|------------------|--------|
| Tax documents (WIT returns) | 5 years minimum | TL Tax Law |
| Employment contracts | Duration + 5 years | Labor Code |
| Payroll records | 5 years | Best practice |
| Working time records | 5 years | Labor Code |
| Termination records | 5 years | Labor Code |
| INSS contribution records | 5 years | INSS regulations |

### 3.2 Data Model

```typescript
// Archive record for terminated employees
interface ArchivedEmployee {
  id: string;
  originalEmployeeId: string;
  employeeData: Employee;         // Full snapshot at termination

  // Termination info
  terminationDate: string;
  terminationReason: 'resignation' | 'dismissal' | 'redundancy' | 'contract_end' | 'retirement' | 'death';
  terminationType: 'with_cause' | 'without_cause' | 'mutual';
  finalPayDate: string;

  // Retention
  archivedAt: Timestamp;
  retentionExpiresAt: Timestamp;  // terminationDate + 5 years
  canBeDeleted: boolean;          // false until retention expires

  // Audit
  archivedBy: string;             // userId
  archiveReason: string;
}

// Audit trail for all changes
interface AuditLogEntry {
  id: string;
  tenantId: string;

  // What changed
  entityType: 'employee' | 'payroll' | 'tax_filing' | 'leave' | 'attendance' | 'settings';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'archive' | 'export' | 'view';

  // Change details
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  // Context
  timestamp: Timestamp;
  userId: string;
  userName: string;
  ipAddress?: string;
  userAgent?: string;

  // Retention
  retentionExpiresAt: Timestamp;  // 5 years from timestamp
}

// Tax filing archive
interface TaxFilingArchive {
  id: string;
  tenantId: string;

  filingType: 'monthly_wit' | 'annual_wit' | 'inss_monthly';
  period: string;                 // "2025-01" or "2024"

  // Filing details
  filedDate: string;
  submissionMethod: 'etax' | 'bnu_paper';
  receiptNumber?: string;

  // Snapshot of data at filing time
  dataSnapshot: MonthlyWITReturn | AnnualWITReturn;

  // Attachments
  pdfUrl?: string;
  csvUrl?: string;

  // Retention
  retentionExpiresAt: Timestamp;  // filedDate + 5 years
}
```

### 3.3 Archive Workflow

```
Employee Termination Flow:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Process      │────▶│ Calculate    │────▶│ Generate     │
│ Termination  │     │ Final Pay    │     │ Documents    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Move to      │◀────│ Create       │◀────│ WIT Cert     │
│ Archive      │     │ Audit Entry  │     │ + Final Pay  │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 3.4 Export for Audit

**Audit Export Package Structure:**
```
audit_export_2025-01-18/
├── README.txt                    # Export summary
├── company_info.json             # Company details
├── employees/
│   ├── active_employees.csv
│   ├── archived_employees.csv
│   └── employee_documents/
│       └── [employee_id]/
│           ├── contract.pdf
│           └── termination_letter.pdf
├── payroll/
│   ├── payroll_runs_2024.csv
│   ├── payroll_runs_2025.csv
│   └── payslips/
│       └── [period]/
│           └── [employee_id].pdf
├── tax_filings/
│   ├── monthly_wit_2024.csv
│   ├── monthly_wit_2025.csv
│   ├── annual_wit_2024.pdf
│   └── employee_wit_certificates/
│       └── 2024/
│           └── [employee_id].pdf
├── inss/
│   ├── monthly_contributions_2024.csv
│   └── monthly_contributions_2025.csv
└── audit_log/
    └── audit_trail_2024-2025.csv
```

### 3.5 UI Design

**Archive Management Page:**
```
┌─────────────────────────────────────────────────────────────┐
│ Document Retention & Archives                               │
├─────────────────────────────────────────────────────────────┤
│ [Active Records] [Archived Records] [Retention Policy]      │
├─────────────────────────────────────────────────────────────┤
│ Archived Employees (23)                    [Export All]     │
│ ┌────────────────┬────────────┬────────────┬──────────────┐ │
│ │ Name           │ Terminated │ Retention  │ Actions      │ │
│ ├────────────────┼────────────┼────────────┼──────────────┤ │
│ │ Jose Silva     │ 2024-06-15 │ 2029-06-15 │ [View] [📥]  │ │
│ │ Maria Santos   │ 2023-12-01 │ 2028-12-01 │ [View] [📥]  │ │
│ └────────────────┴────────────┴────────────┴──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Tax Filing Archives (156)                                   │
│ ┌────────────────┬────────────┬────────────┬──────────────┐ │
│ │ Type           │ Period     │ Filed      │ Actions      │ │
│ ├────────────────┼────────────┼────────────┼──────────────┤ │
│ │ Monthly WIT    │ 2025-01    │ 2025-02-10 │ [View] [📥]  │ │
│ │ Annual WIT     │ 2024       │ 2025-03-15 │ [View] [📥]  │ │
│ └────────────────┴────────────┴────────────┴──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 📦 Export for Tax Audit                                     │
│ Date Range: [2024-01-01] to [2024-12-31]                   │
│ Include: ☑️ Payroll  ☑️ Tax Filings  ☑️ INSS  ☑️ Employees  │
│ [Generate Audit Package]                                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 Implementation Tasks

```
□ Create Archive Service
  □ archiveEmployee(employeeId, terminationDetails)
  □ archiveTaxFiling(filing)
  □ getArchivedEmployees()
  □ getArchivedTaxFilings()
  □ checkRetentionExpiry()

□ Create Audit Log Service
  □ logAction(entityType, entityId, action, changes)
  □ getAuditLog(filters)
  □ exportAuditLog(dateRange)

□ Create Archive Pages
  □ /admin/archives - Archive management
  □ /admin/audit-log - Audit trail viewer
  □ /admin/retention-policy - Policy settings

□ Create Export Functions
  □ generateAuditPackage(dateRange, options)
  □ exportArchivedEmployee(archiveId)
  □ exportTaxFilingArchive(filingId)

□ Add Retention Checks
  □ Scheduled function to check expiring retention
  □ Prevent deletion of records within retention
  □ Alert when retention expires (allow deletion)

□ Integrate with Existing Features
  □ Add audit logging to employee updates
  □ Add audit logging to payroll runs
  □ Add archive step to offboarding workflow
```

---

## 4. Foreign Worker Module

### 4.1 Requirements Overview

**Work Visa (Type C):**
- Fee: $50 USD
- Duration: Up to 1 year
- Processing: ~15 days at SEFOPE
- Renewal: Can be extended for equal periods

**Temporary Residence Permit:**
- Duration: 2 years
- Renewable
- Required in addition to work visa

**Employer Obligations:**
- Must be legally registered in TL
- Must demonstrate "genuine need" for foreign worker
- Responsible for employee's immigration compliance
- Must maintain: Business registration, Tax compliance proof

### 4.2 Required Documents Checklist

```typescript
interface ForeignWorkerDocuments {
  // Required from Employer
  employmentContract: {
    provided: boolean;
    documentUrl?: string;
    uploadedAt?: string;
  };
  companyBusinessRegistration: {
    provided: boolean;
    documentUrl?: string;
    registrationNumber?: string;
  };
  taxComplianceCertificate: {
    provided: boolean;
    documentUrl?: string;
    validUntil?: string;
  };

  // Required from Employee
  passportCopy: {
    provided: boolean;
    documentUrl?: string;
    passportNumber?: string;
    expiryDate?: string;
  };
  qualificationsCertificates: {
    provided: boolean;
    documentUrls?: string[];
    description?: string;
  };
  curriculumVitae: {
    provided: boolean;
    documentUrl?: string;
  };
  medicalCertificate: {
    provided: boolean;
    documentUrl?: string;
    issuedDate?: string;
    validUntil?: string;
  };
  policeClearance: {
    provided: boolean;
    documentUrl?: string;
    issuedDate?: string;
    issuingCountry?: string;
  };
  accommodationProof: {
    provided: boolean;
    documentUrl?: string;
    address?: string;
  };
  returnTicketOrFunds: {
    provided: boolean;
    documentUrl?: string;
    type: 'ticket' | 'funds_proof';
  };
}
```

### 4.3 Work Permit Tracking

```typescript
interface WorkPermitStatus {
  // Current Status
  status: 'not_required' | 'pending' | 'approved' | 'expired' | 'renewal_pending';

  // Work Visa
  workVisa: {
    number: string;
    type: 'C';
    issueDate: string;
    expiryDate: string;
    issuingAuthority: string;
    documentUrl?: string;
  };

  // Temporary Residence Permit
  residencePermit: {
    number: string;
    issueDate: string;
    expiryDate: string;
    documentUrl?: string;
  };

  // Work Permit (SEFOPE)
  workPermit?: {
    number: string;
    issueDate: string;
    expiryDate: string;
    documentUrl?: string;
  };

  // Renewal History
  renewalHistory: {
    date: string;
    type: 'work_visa' | 'residence_permit' | 'work_permit';
    previousExpiry: string;
    newExpiry: string;
    processedBy: string;
  }[];

  // Alerts
  alerts: {
    type: 'expiring_soon' | 'expired' | 'renewal_due';
    documentType: string;
    daysUntilExpiry: number;
    message: string;
  }[];
}
```

### 4.4 Alert Thresholds

| Days Until Expiry | Alert Level | Action |
|-------------------|-------------|--------|
| > 90 days | None | - |
| 60-90 days | Info (Blue) | "Consider starting renewal" |
| 30-60 days | Warning (Yellow) | "Start renewal process" |
| 15-30 days | Critical (Orange) | "Urgent: Renew immediately" |
| 0-15 days | Danger (Red) | "EXPIRED or expiring imminently" |

**Recommended Renewal Timeline:**
- Start renewal 45 days before expiry (15 days processing + buffer)

### 4.5 UI Design

**Foreign Workers Dashboard:**
```
┌─────────────────────────────────────────────────────────────┐
│ Foreign Worker Management                                   │
├─────────────────────────────────────────────────────────────┤
│ Summary                                                     │
│ ┌──────────────┬──────────────┬──────────────┬────────────┐ │
│ │ Total        │ Valid Permits│ Expiring Soon│ Expired    │ │
│ │ 12           │ 9            │ 2 ⚠️          │ 1 🔴       │ │
│ └──────────────┴──────────────┴──────────────┴────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Action Required (3)                                      │
│ ┌────────────────┬─────────────┬────────────┬─────────────┐ │
│ │ Employee       │ Document    │ Expires    │ Action      │ │
│ ├────────────────┼─────────────┼────────────┼─────────────┤ │
│ │ John Smith     │ Work Visa   │ 15 days    │ [Renew →]   │ │
│ │ Sarah Lee      │ Res. Permit │ 28 days    │ [Renew →]   │ │
│ │ Mike Chen      │ Work Visa   │ EXPIRED    │ [Urgent!]   │ │
│ └────────────────┴─────────────┴────────────┴─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ All Foreign Workers                          [+ Add New]    │
│ ┌────────────────┬─────────────┬────────────┬─────────────┐ │
│ │ Name           │ Nationality │ Visa Valid │ Status      │ │
│ ├────────────────┼─────────────┼────────────┼─────────────┤ │
│ │ John Smith     │ Australian  │ 2025-02-15 │ ⚠️ Expiring │ │
│ │ Maria Garcia   │ Portuguese  │ 2025-08-20 │ ✅ Valid    │ │
│ │ David Kim      │ Korean      │ 2025-11-01 │ ✅ Valid    │ │
│ └────────────────┴─────────────┴────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Employee Profile - Work Permit Tab:**
```
┌─────────────────────────────────────────────────────────────┐
│ John Smith - Work Permit Status                             │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Work Visa expires in 15 days - Start renewal now         │
├─────────────────────────────────────────────────────────────┤
│ Work Visa (Type C)                                          │
│ ├─ Number: WV-2024-12345                                    │
│ ├─ Issued: 2024-02-15                                       │
│ ├─ Expires: 2025-02-15                                      │
│ └─ [View Document] [Start Renewal]                          │
│                                                             │
│ Temporary Residence Permit                                  │
│ ├─ Number: TRP-2024-6789                                    │
│ ├─ Issued: 2024-02-20                                       │
│ ├─ Expires: 2026-02-20                                      │
│ └─ [View Document]                                          │
├─────────────────────────────────────────────────────────────┤
│ Document Checklist                              85% Complete│
│ ☑️ Employment Contract                         [View]       │
│ ☑️ Passport Copy                               [View]       │
│ ☑️ Medical Certificate                         [View]       │
│ ☑️ Police Clearance                            [View]       │
│ ☐ Updated CV                                   [Upload]     │
│ ☑️ Accommodation Proof                         [View]       │
├─────────────────────────────────────────────────────────────┤
│ Renewal History                                             │
│ ├─ 2024-02-15: Work Visa renewed (was 2024-02-15)          │
│ └─ 2024-02-20: Residence Permit issued                      │
└─────────────────────────────────────────────────────────────┘
```

### 4.6 Implementation Tasks

```
□ Extend Employee Data Model
  □ Add foreignWorker section to Employee type
  □ Add work permit tracking fields
  □ Add document checklist fields

□ Create Foreign Worker Service
  □ getForeignWorkers()
  □ getExpiringPermits(daysThreshold)
  □ updateWorkPermitStatus(employeeId, status)
  □ logRenewal(employeeId, renewalDetails)

□ Create UI Components
  □ ForeignWorkerDashboard.tsx
  □ WorkPermitStatusCard.tsx
  □ DocumentChecklist.tsx
  □ RenewalWizard.tsx

□ Create Pages
  □ /staff/foreign-workers - Dashboard
  □ /staff/foreign-workers/[id] - Detail view
  □ /staff/foreign-workers/new - Add new
  □ Employee profile "Work Permit" tab

□ Enhance Existing Alerts
  □ Add work visa expiry to DocumentAlertsCard
  □ Add residence permit expiry
  □ Add to dashboard alerts widget

□ Add Renewal Workflow
  □ "Start Renewal" button
  □ Document checklist verification
  □ Track submission to SEFOPE
  □ Track approval and new dates
```

---

## 5. Database Schema Summary

### New Collections

```
firestore/
├── tenants/{tenantId}/
│   ├── taxFilings/              # Monthly/Annual WIT records
│   │   └── {filingId}
│   ├── taxFilingArchives/       # Archived filings (5yr retention)
│   │   └── {archiveId}
│   ├── archivedEmployees/       # Terminated employees
│   │   └── {archiveId}
│   ├── auditLog/                # All change history
│   │   └── {logId}
│   └── retentionPolicy/         # Configurable retention settings
│       └── config
```

### Updated Collections

```
firestore/
├── tenants/{tenantId}/
│   └── employees/{employeeId}
│       ├── ... existing fields ...
│       ├── foreignWorker: {      # NEW - only for foreign workers
│       │   workVisa: {...}
│       │   residencePermit: {...}
│       │   workPermit: {...}
│       │   documentsChecklist: {...}
│       │   renewalHistory: [...]
│       │   }
│       └── terminationDetails: { # NEW - when terminated
│           date: string
│           reason: string
│           type: string
│           finalPayDate: string
│           archivedAt: Timestamp
│           }
```

---

## 6. Implementation Priority

### Phase 1: ATTL Monthly WIT (Week 1)
Most immediate compliance need - due monthly

1. Create TaxFilingService
2. Create Monthly WIT return page
3. CSV export for e-Tax
4. PDF export for BNU
5. Filing status tracking

### Phase 2: Foreign Worker Alerts (Week 1-2)
Build on existing DocumentAlerts infrastructure

1. Extend employee model for foreign workers
2. Add to existing document alerts
3. Create Foreign Workers dashboard
4. Document checklist component

### Phase 3: Annual WIT + Certificates (Week 2)
Prepare for March 31st deadline

1. Annual WIT return generation
2. Employee WIT certificate PDF
3. Batch certificate generation
4. Filing archive

### Phase 4: Document Retention (Week 3)
Background compliance feature

1. Audit log service
2. Archive service
3. Retention tracking
4. Export for audit

### Phase 5: Full Foreign Worker Module (Week 3-4)
Complete the module

1. Renewal workflow
2. SEFOPE form enhancement
3. Full document management
4. Reporting

---

## 7. Testing Checklist

```
□ ATTL Monthly WIT
  □ Correctly calculates WIT for residents (10% above $500)
  □ Correctly calculates WIT for non-residents (10% all income)
  □ CSV export matches e-Tax format
  □ PDF has all required fields
  □ Filing status updates correctly

□ ATTL Annual WIT
  □ Aggregates all monthly data correctly
  □ Employee certificates have correct totals
  □ Handles mid-year hires/terminations

□ Foreign Workers
  □ Alerts trigger at correct thresholds
  □ Document checklist tracks completion
  □ Renewal history logs correctly
  □ Dashboard shows correct counts

□ Document Retention
  □ Archived records cannot be deleted within 5 years
  □ Audit log captures all changes
  □ Export package has correct structure
  □ Retention expiry calculated correctly
```

---

*Document created: January 18, 2026*
*Last updated: January 18, 2026*
*Author: Claude Code Assistant*
