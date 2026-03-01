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
  rosters: (tid: string, ym: string) => `tenants/${tid}/rosters/${ym}/shifts`,
  roster: (tid: string, ym: string, shiftId: string) => `tenants/${tid}/rosters/${ym}/shifts/${shiftId}`,
  
  timesheets: (tid: string) => `tenants/${tid}/timesheets`,
  timesheet: (tid: string, empId_weekIso: string) => `tenants/${tid}/timesheets/${empId_weekIso}`,
  
  leavePolicies: (tid: string) => `tenants/${tid}/leavePolicies`,
  leavePolicy: (tid: string, policyId: string) => `tenants/${tid}/leavePolicies/${policyId}`,
  
  leaveRequests: (tid: string) => `tenants/${tid}/leaveRequests`,
  leaveRequest: (tid: string, reqId: string) => `tenants/${tid}/leaveRequests/${reqId}`,
  
  leaveBalances: (tid: string) => `tenants/${tid}/leaveBalances`,
  leaveBalance: (tid: string, empId_year: string) => `tenants/${tid}/leaveBalances/${empId_year}`,
  
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

  vendors: (tid: string) => `tenants/${tid}/vendors`,
  vendor: (tid: string, vendorId: string) => `tenants/${tid}/vendors/${vendorId}`,

  bills: (tid: string) => `tenants/${tid}/bills`,
  bill: (tid: string, billId: string) => `tenants/${tid}/bills/${billId}`,

  billPayments: (tid: string) => `tenants/${tid}/bill_payments`,
  billPayment: (tid: string, paymentId: string) => `tenants/${tid}/bill_payments/${paymentId}`,

  expenses: (tid: string) => `tenants/${tid}/expenses`,
  expense: (tid: string, expenseId: string) => `tenants/${tid}/expenses/${expenseId}`,
  
  // Analytics and reports
  analytics: (tid: string) => `tenants/${tid}/analytics`,
  analytic: (tid: string, docId: string) => `tenants/${tid}/analytics/${docId}`,
  
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

  // VAT
  vatConfig: () => 'platform/vatConfig',
  vatSettings: (tid: string) => `tenants/${tid}/settings/vat`,
  vatReturns: (tid: string) => `tenants/${tid}/vatReturns`,
  vatReturn: (tid: string, periodId: string) => `tenants/${tid}/vatReturns/${periodId}`,

  // Face recognition embeddings
  faceEmbeddings: (tid: string) => `tenants/${tid}/face_embeddings`,
  faceEmbedding: (tid: string, empId: string) => `tenants/${tid}/face_embeddings/${empId}`,
} as const;

// Type definitions for better TypeScript support
export type TenantPath = ReturnType<typeof paths.tenant>;
export type DepartmentPath = ReturnType<typeof paths.departments>;
export type EmployeePath = ReturnType<typeof paths.employees>;
export type JobPath = ReturnType<typeof paths.jobs>;


