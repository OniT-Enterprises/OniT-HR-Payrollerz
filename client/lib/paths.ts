/**
 * Centralized Firestore path helpers for multi-tenant structure
 * ALL components must import from this file - NO inline collection paths
 */

export const paths = {
  // Root level paths
  tenants: () => 'tenants',
  reference: () => 'reference',

  // User profiles (global, not tenant-scoped)
  users: () => 'users',
  user: (uid: string) => `users/${uid}`,

  // Admin audit log (superadmin actions)
  adminAuditLog: () => 'adminAuditLog',
  adminAuditEntry: (entryId: string) => `adminAuditLog/${entryId}`,
  superAdminRequests: () => 'superAdminRequests',
  superAdminRequest: (requestId: string) => `superAdminRequests/${requestId}`,
  packagesConfig: () => 'platform/packagesConfig',
  
  // Tenant-scoped paths
  tenant: (tid: string) => `tenants/${tid}`,
  settings: (tid: string) => `tenants/${tid}/settings/config`,
  members: (tid: string) => `tenants/${tid}/members`,
  member: (tid: string, uid: string) => `tenants/${tid}/members/${uid}`,
  
  // Core business entities
  departments: (tid: string) => `tenants/${tid}/departments`,
  department: (tid: string, deptId: string) => `tenants/${tid}/departments/${deptId}`,
  
  employees: (tid: string) => `tenants/${tid}/employees`,
  employee: (tid: string, empId: string) => `tenants/${tid}/employees/${empId}`,
  
  positions: (tid: string) => `tenants/${tid}/positions`,
  position: (tid: string, posId: string) => `tenants/${tid}/positions/${posId}`,
  
  // Hiring module
  jobs: (tid: string) => `tenants/${tid}/jobs`,
  job: (tid: string, jobId: string) => `tenants/${tid}/jobs/${jobId}`,
  
  candidates: (tid: string) => `tenants/${tid}/candidates`,
  candidate: (tid: string, candId: string) => `tenants/${tid}/candidates/${candId}`,
  
  interviews: (tid: string) => `tenants/${tid}/interviews`,
  interview: (tid: string, intId: string) => `tenants/${tid}/interviews/${intId}`,
  
  offers: (tid: string) => `tenants/${tid}/offers`,
  offer: (tid: string, offerId: string) => `tenants/${tid}/offers/${offerId}`,
  
  // Employment contracts and snapshots
  contracts: (tid: string) => `tenants/${tid}/contracts`,
  contract: (tid: string, contractId: string) => `tenants/${tid}/contracts/${contractId}`,
  
  snapshots: (tid: string) => `tenants/${tid}/employmentSnapshots`,
  snapshot: (tid: string, snapId: string) => `tenants/${tid}/employmentSnapshots/${snapId}`,
  
  // Time and leave management
  shifts: (tid: string) => `tenants/${tid}/shifts`,
  shift: (tid: string, shiftId: string) => `tenants/${tid}/shifts/${shiftId}`,
  
  timesheets: (tid: string) => `tenants/${tid}/timesheets`,
  timesheet: (tid: string, empId_weekIso: string) => `tenants/${tid}/timesheets/${empId_weekIso}`,
  
  // These canonical collections are top-level and always require a tenantId
  // query/filter. The tenant argument is retained for a consistent call shape.
  leaveRequests: (_tid: string) => `leave_requests`,
  leaveRequest: (_tid: string, reqId: string) => `leave_requests/${reqId}`,
  leaveBalances: (_tid: string) => `leave_balances`,
  leaveBalance: (_tid: string, empId_year: string) => `leave_balances/${empId_year}`,
  attendance: (_tid: string) => `attendance`,
  attendanceRecord: (_tid: string, recordId: string) => `attendance/${recordId}`,
  
  // Performance management
  goals: (tid: string) => `tenants/${tid}/goals`,
  goal: (tid: string, goalId: string) => `tenants/${tid}/goals/${goalId}`,
  
  reviews: (tid: string) => `tenants/${tid}/reviews`,
  review: (tid: string, reviewId: string) => `tenants/${tid}/reviews/${reviewId}`,
  
  trainings: (tid: string) => `tenants/${tid}/trainings`,
  training: (tid: string, trainingId: string) => `tenants/${tid}/trainings/${trainingId}`,
  
  discipline: (tid: string) => `tenants/${tid}/discipline`,
  disciplineRecord: (tid: string, disciplineId: string) => `tenants/${tid}/discipline/${disciplineId}`,

  // Compliance and audit
  auditLogs: (tid: string) => `tenants/${tid}/auditLogs`,
  auditLog: (tid: string, logId: string) => `tenants/${tid}/auditLogs/${logId}`,

  archives: (tid: string) => `tenants/${tid}/archives`,
  archive: (tid: string, archiveId: string) => `tenants/${tid}/archives/${archiveId}`,
  documentAlerts: (tid: string) => `tenants/${tid}/document_alerts`,
  documentAlert: (tid: string, alertId: string) => `tenants/${tid}/document_alerts/${alertId}`,

  qbExportLogs: (tid: string) => `tenants/${tid}/qbExportLogs`,
  qbExportLog: (tid: string, logId: string) => `tenants/${tid}/qbExportLogs/${logId}`,
  
  promotionSignals: (tid: string, year_q: string) => `tenants/${tid}/promotionSignals/${year_q}`,
  promotionSignal: (tid: string, year_q: string, empId: string) => `tenants/${tid}/promotionSignals/${year_q}/${empId}`,
  
  // Payroll
  payruns: (tid: string, yyyymm: string) => `tenants/${tid}/payruns/${yyyymm}`,
  payrun: (tid: string, yyyymm: string) => `tenants/${tid}/payruns/${yyyymm}`,
  
  payslips: (tid: string, yyyymm: string) => `tenants/${tid}/payruns/${yyyymm}/payslips`,
  payslip: (tid: string, yyyymm: string, empId: string) => `tenants/${tid}/payruns/${yyyymm}/payslips/${empId}`,

  // Accounting
  accounts: (tid: string) => `tenants/${tid}/accounts`,
  account: (tid: string, accountId: string) => `tenants/${tid}/accounts/${accountId}`,

  journalEntries: (tid: string) => `tenants/${tid}/journalEntries`,
  journalEntry: (tid: string, entryId: string) => `tenants/${tid}/journalEntries/${entryId}`,

  generalLedger: (tid: string) => `tenants/${tid}/generalLedger`,
  generalLedgerEntry: (tid: string, glId: string) => `tenants/${tid}/generalLedger/${glId}`,

  fiscalYears: (tid: string) => `tenants/${tid}/fiscalYears`,
  fiscalYear: (tid: string, yearId: string) => `tenants/${tid}/fiscalYears/${yearId}`,

  fiscalPeriods: (tid: string) => `tenants/${tid}/fiscalPeriods`,
  fiscalPeriod: (tid: string, periodId: string) => `tenants/${tid}/fiscalPeriods/${periodId}`,

  balanceSnapshots: (tid: string) => `tenants/${tid}/balanceSnapshots`,
  balanceSnapshot: (tid: string, snapshotId: string) => `tenants/${tid}/balanceSnapshots/${snapshotId}`,

  accountingSettings: (tid: string) => `tenants/${tid}/settings/accounting`,

  // Money (invoicing, AP/AR)
  customers: (tid: string) => `tenants/${tid}/customers`,
  customer: (tid: string, customerId: string) => `tenants/${tid}/customers/${customerId}`,

  invoices: (tid: string) => `tenants/${tid}/invoices`,
  invoice: (tid: string, invoiceId: string) => `tenants/${tid}/invoices/${invoiceId}`,

  recurringInvoices: (tid: string) => `tenants/${tid}/recurring_invoices`,
  recurringInvoice: (tid: string, recurringId: string) => `tenants/${tid}/recurring_invoices/${recurringId}`,

  paymentsReceived: (tid: string) => `tenants/${tid}/payments_received`,
  paymentReceived: (tid: string, paymentId: string) => `tenants/${tid}/payments_received/${paymentId}`,

  creditNotes: (tid: string) => `tenants/${tid}/credit_notes`,
  creditNote: (tid: string, creditNoteId: string) => `tenants/${tid}/credit_notes/${creditNoteId}`,

  vendors: (tid: string) => `tenants/${tid}/vendors`,
  vendor: (tid: string, vendorId: string) => `tenants/${tid}/vendors/${vendorId}`,

  bills: (tid: string) => `tenants/${tid}/bills`,
  bill: (tid: string, billId: string) => `tenants/${tid}/bills/${billId}`,

  billPayments: (tid: string) => `tenants/${tid}/bill_payments`,
  billPayment: (tid: string, paymentId: string) => `tenants/${tid}/bill_payments/${paymentId}`,

  supplierWithholdingPeriods: (tid: string) => `tenants/${tid}/supplierWithholdingPeriods`,
  supplierWithholdingPeriod: (tid: string, period: string) =>
    `tenants/${tid}/supplierWithholdingPeriods/${period}`,
  supplierWithholdingRemittances: (tid: string) =>
    `tenants/${tid}/supplierWithholdingRemittances`,
  supplierWithholdingRemittance: (tid: string, remittanceId: string) =>
    `tenants/${tid}/supplierWithholdingRemittances/${remittanceId}`,

  taxClearanceRequests: (tid: string) => `tenants/${tid}/taxClearanceRequests`,
  taxClearanceRequest: (tid: string, requestId: string) =>
    `tenants/${tid}/taxClearanceRequests/${requestId}`,

  cashAdvances: (tid: string) => `tenants/${tid}/cashAdvances`,
  cashAdvance: (tid: string, advanceId: string) => `tenants/${tid}/cashAdvances/${advanceId}`,
  cashAdvanceClearings: (tid: string) => `tenants/${tid}/cashAdvanceClearings`,
  cashAdvanceClearing: (tid: string, clearingId: string) =>
    `tenants/${tid}/cashAdvanceClearings/${clearingId}`,

  expenses: (tid: string) => `tenants/${tid}/expenses`,
  expense: (tid: string, expenseId: string) => `tenants/${tid}/expenses/${expenseId}`,

  // Bank reconciliation (imported statement transactions)
  bankTransactions: (tid: string) => `tenants/${tid}/bankTransactions`,
  bankTransaction: (tid: string, txId: string) => `tenants/${tid}/bankTransactions/${txId}`,
  
  // Analytics and reports
  analytics: (tid: string) => `tenants/${tid}/analytics`,
  analytic: (tid: string, docId: string) => `tenants/${tid}/analytics/${docId}`,
  
  // Contract templates (global, superadmin-managed, readable by all tenants)
  contractTemplates: () => 'contractTemplates',
  contractTemplate: (templateId: string) => `contractTemplates/${templateId}`,

  // Reference data (global, read-only)
  taxTables: () => 'reference/taxTables',
  taxTable: (year: string) => `reference/taxTables/${year}`,
  
  ssRates: () => 'reference/ssRates',
  ssRate: (effectiveDate: string) => `reference/ssRates/${effectiveDate}`,
  
  holidays: () => 'reference/holidays',
  holiday: (yyyymmdd: string) => `reference/holidays/${yyyymmdd}`,

  // Tenant-level overrides
  tenantHolidays: (tid: string) => `tenants/${tid}/holidays`,
  tenantHoliday: (tid: string, yyyymmdd: string) => `tenants/${tid}/holidays/${yyyymmdd}`,

  // Quickbooks integration settings
  quickbooksExportSettings: (tid: string) => `tenants/${tid}/settings/quickbooks_export_settings`,

  // Money module settings
  invoiceSettings: (tid: string) => `tenants/${tid}/settings/invoice_settings`,

  // Public hosted invoice links (top-level, doc id = unguessable share token,
  // keyed back to the tenant by a tenantId FIELD — sweep on tenant delete)
  invoiceLinks: () => 'invoice_links',
  invoiceLink: (token: string) => `invoice_links/${token}`,

  // VAT
  vatConfig: () => 'platform/vatConfig',
  vatSettings: (tid: string) => `tenants/${tid}/settings/vat`,
  vatReturns: (tid: string) => `tenants/${tid}/vatReturns`,
  vatReturn: (tid: string, periodId: string) => `tenants/${tid}/vatReturns/${periodId}`,

  // Face recognition embeddings
  faceEmbeddings: (tid: string) => `tenants/${tid}/face_embeddings`,
  faceEmbedding: (tid: string, empId: string) => `tenants/${tid}/face_embeddings/${empId}`,
} as const;
