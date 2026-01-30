/**
 * Zod Validation Schemas
 * Reusable validation schemas for forms and API data
 */

import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// ============================================
// FIRESTORE DATA SCHEMAS (for incoming data)
// ============================================

/**
 * Convert Firestore Timestamp or Date to Date
 */
const firestoreDateSchema = z.union([
  z.instanceof(Date),
  z.custom<Timestamp>((val) => val instanceof Timestamp).transform((ts) => ts.toDate()),
  z.string().transform((s) => new Date(s)),
]).optional().default(() => new Date());

/**
 * Firestore Employee document schema
 * Validates and transforms data from Firestore
 */
export const firestoreEmployeeSchema = z.object({
  personalInfo: z.object({
    firstName: z.string().default(''),
    lastName: z.string().default(''),
    email: z.string().default(''),
    phone: z.string().default(''),
    phoneApp: z.string().default(''),
    appEligible: z.boolean().default(false),
    address: z.string().default(''),
    dateOfBirth: z.string().default(''),
    socialSecurityNumber: z.string().default(''),
    emergencyContactName: z.string().default(''),
    emergencyContactPhone: z.string().default(''),
  }).default({}),
  jobDetails: z.object({
    employeeId: z.string().default(''),
    department: z.string().default(''),
    position: z.string().default(''),
    hireDate: z.string().default(''),
    employmentType: z.string().default('Full-time'),
    workLocation: z.string().default(''),
    manager: z.string().default(''),
    sefopeNumber: z.string().optional(),
    sefopeRegistrationDate: z.string().optional(),
    fundingSource: z.string().optional(),
    projectCode: z.string().optional(),
  }).default({}),
  compensation: z.object({
    monthlySalary: z.number().default(0),
    annualLeaveDays: z.number().default(25),
    benefitsPackage: z.string().default('standard'),
    isResident: z.boolean().default(true),
  }).default({}),
  documents: z.object({
    bilheteIdentidade: z.object({
      number: z.string().default(''),
      expiryDate: z.string().default(''),
      required: z.boolean().default(false),
    }).optional(),
    employeeIdCard: z.object({
      number: z.string().default(''),
      expiryDate: z.string().default(''),
      required: z.boolean().default(false),
    }).default({ number: '', expiryDate: '', required: false }),
    socialSecurityNumber: z.object({
      number: z.string().default(''),
      expiryDate: z.string().default(''),
      required: z.boolean().default(true),
    }).default({ number: '', expiryDate: '', required: true }),
    electoralCard: z.object({
      number: z.string().default(''),
      expiryDate: z.string().default(''),
      required: z.boolean().default(false),
    }).default({ number: '', expiryDate: '', required: false }),
    idCard: z.object({
      number: z.string().default(''),
      expiryDate: z.string().default(''),
      required: z.boolean().default(false),
    }).default({ number: '', expiryDate: '', required: false }),
    passport: z.object({
      number: z.string().default(''),
      expiryDate: z.string().default(''),
      required: z.boolean().default(false),
    }).default({ number: '', expiryDate: '', required: false }),
    workContract: z.object({
      fileUrl: z.string().default(''),
      uploadDate: z.string().default(''),
    }).default({ fileUrl: '', uploadDate: '' }),
    nationality: z.string().default('Timor-Leste'),
    residencyStatus: z.string().default('timorese'),
    workingVisaNumber: z.string().optional(),
    workingVisaExpiry: z.string().optional(),
  }).default({}),
  status: z.string().default('active'),
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
}).passthrough(); // Allow additional fields

export type FirestoreEmployee = z.infer<typeof firestoreEmployeeSchema>;

/**
 * Firestore Invoice document schema
 */
export const firestoreInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  customerId: z.string(),
  customerName: z.string().default(''),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).default('draft'),
  issueDate: z.string(),
  dueDate: z.string(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    amount: z.number().optional(),
  })).default([]),
  subtotal: z.number().default(0),
  taxRate: z.number().default(0),
  taxAmount: z.number().default(0),
  total: z.number().default(0),
  amountPaid: z.number().default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
}).passthrough();

export type FirestoreInvoice = z.infer<typeof firestoreInvoiceSchema>;

/**
 * Firestore Customer document schema
 */
export const firestoreCustomerSchema = z.object({
  name: z.string(),
  email: z.string().default(''),
  phone: z.string().default(''),
  address: z.string().default(''),
  city: z.string().default(''),
  country: z.string().default(''),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  totalRevenue: z.number().default(0),
  outstandingBalance: z.number().default(0),
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
}).passthrough();

export type FirestoreCustomer = z.infer<typeof firestoreCustomerSchema>;

/**
 * Firestore Bill document schema
 */
export const firestoreBillSchema = z.object({
  vendorName: z.string(),
  billNumber: z.string().optional(),
  billDate: z.string(),
  dueDate: z.string(),
  amount: z.number(),
  amountPaid: z.number().default(0),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).default('pending'),
  category: z.string(),
  description: z.string().optional(),
  notes: z.string().optional(),
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
}).passthrough();

export type FirestoreBill = z.infer<typeof firestoreBillSchema>;

/**
 * Safe parser for Firestore documents
 * Returns validated data or throws with detailed error
 */
export function parseFirestoreDoc<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  docId?: string
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const context = docId ? ` (doc: ${docId})` : '';
  console.warn(`Firestore validation warning${context}:`, result.error.flatten());
  // Return parsed with defaults for partial data
  return schema.parse(data);
}

/**
 * Safe parser that doesn't throw - returns null on failure
 */
export function safeParseFirestoreDoc<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

// ============================================
// COMMON SCHEMAS
// ============================================

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(1, 'Email is required');

export const phoneSchema = z
  .string()
  .regex(/^[+]?[\d\s()-]{7,20}$/, 'Invalid phone number')
  .optional()
  .or(z.literal(''));

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const moneySchema = z
  .number()
  .min(0, 'Amount cannot be negative')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places');

export const positiveNumberSchema = z
  .number()
  .positive('Must be a positive number');

export const percentageSchema = z
  .number()
  .min(0, 'Percentage cannot be negative')
  .max(100, 'Percentage cannot exceed 100');

// ============================================
// EMPLOYEE SCHEMAS
// ============================================

export const employeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: emailSchema,
  phone: phoneSchema,
  position: z.string().min(1, 'Position is required'),
  department: z.string().optional(),
  hireDate: dateSchema,
  monthlySalary: moneySchema.min(0.01, 'Salary must be greater than 0'),
  payFrequency: z.enum(['weekly', 'biweekly', 'monthly']),
  isResident: z.boolean().default(true),
  bankAccount: z.string().optional(),
  taxId: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: phoneSchema,
  notes: z.string().max(1000).optional(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;

/**
 * AddEmployee wizard form schema - comprehensive validation for the multi-step form
 */
export const addEmployeeFormSchema = z.object({
  // Step 1: Basic Info
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  phone: z.string().optional().or(z.literal('')),
  phoneApp: z.string().optional().or(z.literal('')),
  appEligible: z.boolean().default(false),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactPhone: z.string().optional().or(z.literal('')),

  // Step 2: Job Details
  department: z.string().min(1, 'Department is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  manager: z.string().optional().or(z.literal('')),
  startDate: z.string().min(1, 'Start date is required'),
  employmentType: z.enum(['Full-time', 'Part-time', 'Contractor']).default('Full-time'),
  sefopeNumber: z.string().optional().or(z.literal('')),
  sefopeRegistrationDate: z.string().optional().or(z.literal('')),

  // Step 3: Compensation
  salary: z.string().optional().or(z.literal('')),
  leaveDays: z.string().default('25'),
  benefits: z.enum(['basic', 'standard', 'premium', 'executive']).default('standard'),
  isResident: z.boolean().default(true),
});

export type AddEmployeeFormData = z.infer<typeof addEmployeeFormSchema>;

/**
 * Schema for additional employee info (nationality, visa)
 */
export const employeeAdditionalInfoSchema = z.object({
  nationality: z.string().default('Timor-Leste'),
  residencyStatus: z.enum(['timorese', 'permanent_resident', 'work_permit', 'temporary']).default('timorese'),
  workingVisaNumber: z.string().optional().or(z.literal('')),
  workingVisaExpiry: z.string().optional().or(z.literal('')),
});

export type EmployeeAdditionalInfoData = z.infer<typeof employeeAdditionalInfoSchema>;

/**
 * Schema for individual document entry
 */
export const employeeDocumentSchema = z.object({
  id: z.number(),
  type: z.string(),
  fieldKey: z.string(),
  number: z.string().optional().or(z.literal('')),
  expiryDate: z.string().optional().or(z.literal('')),
  required: z.boolean(),
  description: z.string(),
});

export type EmployeeDocumentData = z.infer<typeof employeeDocumentSchema>;

// ============================================
// INVOICE SCHEMAS
// ============================================

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unitPrice: moneySchema,
  amount: moneySchema.optional(), // Calculated field
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  issueDate: dateSchema,
  dueDate: dateSchema,
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  taxRate: percentageSchema.default(0),
  notes: z.string().max(1000).optional(),
  terms: z.string().max(1000).optional(),
}).refine(
  (data) => new Date(data.dueDate) >= new Date(data.issueDate),
  { message: 'Due date must be on or after issue date', path: ['dueDate'] }
);

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

/**
 * Invoice form schema - for react-hook-form validation
 * Uses useFieldArray for dynamic line items
 */
export const invoiceFormSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer'),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  items: z.array(z.object({
    description: z.string().min(1, 'Description is required').max(500),
    quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0'),
    unitPrice: z.coerce.number().min(0, 'Price cannot be negative'),
    amount: z.number().optional(),
  })).min(1, 'At least one item is required'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().max(1000).optional().or(z.literal('')),
  terms: z.string().max(1000).optional().or(z.literal('')),
}).refine(
  (data) => new Date(data.dueDate) >= new Date(data.issueDate),
  { message: 'Due date must be on or after issue date', path: ['dueDate'] }
);

export type InvoiceFormSchemaData = z.infer<typeof invoiceFormSchema>;

/**
 * Recurring invoice form schema - for react-hook-form validation
 */
export const recurringInvoiceFormSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer'),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  startDate: z.string().min(1, 'Start date is required'),
  endType: z.enum(['never', 'date', 'occurrences']),
  endDate: z.string().optional().or(z.literal('')),
  endAfterOccurrences: z.coerce.number().min(1).optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    description: z.string().min(1, 'Description is required'),
    quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0'),
    unitPrice: z.coerce.number().min(0, 'Price cannot be negative'),
    amount: z.number().optional(),
  })).min(1, 'At least one item is required'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().max(1000).optional().or(z.literal('')),
  terms: z.string().max(1000).optional().or(z.literal('')),
  dueDays: z.coerce.number().min(1).default(30),
  autoSend: z.boolean().default(false),
}).refine(
  (data) => {
    if (data.endType === 'date' && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: 'End date must be on or after start date', path: ['endDate'] }
).refine(
  (data) => {
    if (data.endType === 'occurrences') {
      return data.endAfterOccurrences && data.endAfterOccurrences >= 1;
    }
    return true;
  },
  { message: 'Number of occurrences is required', path: ['endAfterOccurrences'] }
);

export type RecurringInvoiceFormSchemaData = z.infer<typeof recurringInvoiceFormSchema>;

// ============================================
// BILL SCHEMAS
// ============================================

export const billSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required').max(200),
  billNumber: z.string().optional(),
  billDate: dateSchema,
  dueDate: dateSchema,
  amount: moneySchema.min(0.01, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => new Date(data.dueDate) >= new Date(data.billDate),
  { message: 'Due date must be on or after bill date', path: ['dueDate'] }
);

export type BillSchemaData = z.infer<typeof billSchema>;

/**
 * Bill form schema - for react-hook-form validation
 * Matches the BillFormData interface in types/money.ts
 */
export const billFormSchema = z.object({
  billNumber: z.string().optional().or(z.literal('')),
  vendorId: z.string().min(1, 'Please select a vendor'),
  billDate: z.string().min(1, 'Bill date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  category: z.string().min(1, 'Category is required'),
  notes: z.string().max(1000).optional().or(z.literal('')),
}).refine(
  (data) => new Date(data.dueDate) >= new Date(data.billDate),
  { message: 'Due date must be on or after bill date', path: ['dueDate'] }
);

export type BillFormSchemaData = z.infer<typeof billFormSchema>;

// ============================================
// CUSTOMER SCHEMAS
// ============================================

export const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(200),
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema,
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxId: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

// ============================================
// PAYMENT SCHEMAS
// ============================================

export const paymentSchema = z.object({
  date: dateSchema,
  amount: moneySchema.min(0.01, 'Amount must be greater than 0'),
  method: z.enum(['cash', 'bank_transfer', 'check', 'other']),
  notes: z.string().max(500).optional(),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;

// ============================================
// PAYROLL SCHEMAS
// ============================================

export const payrollInputSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  monthlySalary: moneySchema,
  payFrequency: z.enum(['weekly', 'biweekly', 'monthly']),
  regularHours: z.number().min(0),
  overtimeHours: z.number().min(0).default(0),
  bonus: moneySchema.default(0),
  commission: moneySchema.default(0),
  loanRepayment: moneySchema.default(0),
  advanceRepayment: moneySchema.default(0),
  otherDeductions: moneySchema.default(0),
});

export type PayrollInputFormData = z.infer<typeof payrollInputSchema>;

// ============================================
// BANK RECONCILIATION SCHEMAS
// ============================================

export const bankTransactionSchema = z.object({
  date: dateSchema,
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.number(), // Can be negative for withdrawals
  type: z.enum(['deposit', 'withdrawal']),
  reference: z.string().max(100).optional(),
  balance: z.number().optional(),
});

export type BankTransactionFormData = z.infer<typeof bankTransactionSchema>;

// ============================================
// GL ACCOUNT SCHEMAS
// ============================================

export const glAccountSchema = z.object({
  code: z.string().min(1, 'Account code is required').max(20),
  name: z.string().min(1, 'Account name is required').max(200),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  subtype: z.string().optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export type GLAccountFormData = z.infer<typeof glAccountSchema>;

// ============================================
// JOURNAL ENTRY SCHEMAS
// ============================================

export const journalLineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  debit: moneySchema.default(0),
  credit: moneySchema.default(0),
  description: z.string().max(500).optional(),
});

export const journalEntrySchema = z.object({
  date: dateSchema,
  reference: z.string().max(100).optional(),
  description: z.string().min(1, 'Description is required').max(500),
  lines: z.array(journalLineSchema).min(2, 'At least 2 lines required'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01; // Allow for floating point
  },
  { message: 'Debits must equal credits', path: ['lines'] }
);

export type JournalEntryFormData = z.infer<typeof journalEntrySchema>;

// ============================================
// SETTINGS SCHEMAS
// ============================================

/**
 * Company Details form schema (Settings page)
 */
export const companyDetailsFormSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required').max(200),
  tradingName: z.string().optional().or(z.literal('')),
  businessType: z.enum(['SA', 'Lda', 'Unipessoal', 'ENIN', 'NGO', 'Government', 'Other']).default('Lda'),
  tinNumber: z.string().max(50).optional().or(z.literal('')),
  registeredAddress: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).default('Dili'),
  country: z.string().max(100).default('Timor-Leste'),
  phone: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
});

export type CompanyDetailsFormData = z.infer<typeof companyDetailsFormSchema>;

/**
 * Holiday Override form schema (Settings page - Time Off tab)
 */
export const holidayOverrideFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  name: z.string().max(200).optional().or(z.literal('')),
  nameTetun: z.string().max(200).optional().or(z.literal('')),
  isHoliday: z.boolean().default(true),
  notes: z.string().max(500).optional().or(z.literal('')),
}).refine(
  (data) => !data.isHoliday || data.name?.trim(),
  { message: 'Holiday name is required when adding a holiday', path: ['name'] }
);

export type HolidayOverrideFormData = z.infer<typeof holidayOverrideFormSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate data against a schema and return errors
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }

  return { success: false, errors };
}

/**
 * Get first error message for a field
 */
export function getFieldError(
  errors: Record<string, string> | undefined,
  field: string
): string | undefined {
  return errors?.[field];
}
