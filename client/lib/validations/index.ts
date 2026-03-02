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
    payFrequency: z.enum(['weekly', 'monthly']).optional(),
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
  status: z.enum(['draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled']).default('draft'),
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
  status: z.enum(['pending', 'paid', 'partial', 'overdue', 'cancelled']).default('pending'),
  category: z.string(),
  description: z.string().optional(),
  notes: z.string().optional(),
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
}).passthrough();

export type FirestoreBill = z.infer<typeof firestoreBillSchema>;

// ============================================
// COERCION HELPERS
// ============================================

/**
 * Coerces input to a number for form validation.
 * Unlike z.coerce.number(), treats empty strings and NaN as undefined
 * so that required_error / .optional() / .default() work correctly.
 * Usage: z.preprocess(coerceToNumber, z.number({ required_error: '...' }).min(...))
 */
const coerceToNumber = (val: unknown): number | undefined => {
  if (val === '' || val === undefined || val === null) return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
};

// ============================================
// EMPLOYEE SCHEMAS
// ============================================

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
  employmentType: z.preprocess(
    (val) => {
      if (typeof val !== 'string') return val;
      const map: Record<string, string> = {
        'full-time': 'Full-time', 'fulltime': 'Full-time',
        'part-time': 'Part-time', 'parttime': 'Part-time',
        'contractor': 'Contractor', 'contract': 'Contractor',
      };
      return map[val.toLowerCase()] || val;
    },
    z.enum(['Full-time', 'Part-time', 'Contractor']).default('Full-time'),
  ),
  sefopeNumber: z.string().optional().or(z.literal('')),
  sefopeRegistrationDate: z.string().optional().or(z.literal('')),

  // Step 3: Compensation
  salary: z.string().optional().or(z.literal('')),
  leaveDays: z.string().default('25'),
  benefits: z.enum(['basic', 'standard', 'premium', 'executive']).default('standard'),
  payFrequency: z.enum(['weekly', 'monthly']).default('monthly'),
  isResident: z.boolean().default(true),
});

export type AddEmployeeFormData = z.infer<typeof addEmployeeFormSchema>;

// ============================================
// INVOICE SCHEMAS
// ============================================

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
    quantity: z.preprocess(coerceToNumber, z.number({ required_error: 'Quantity is required' }).min(0.01, 'Quantity must be greater than 0')),
    unitPrice: z.preprocess(coerceToNumber, z.number({ required_error: 'Unit price is required' }).refine(v => v > 0, { message: 'Unit price must be greater than 0' })),
    amount: z.number().optional(),
    vatRate: z.preprocess(coerceToNumber, z.number().min(0).max(100).optional()),
  })).min(1, 'At least one item is required'),
  taxRate: z.preprocess(coerceToNumber, z.number().min(0).max(100).default(0)),
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
  endAfterOccurrences: z.preprocess(coerceToNumber, z.number().min(1).optional()),
  items: z.array(z.object({
    id: z.string().optional(),
    description: z.string().min(1, 'Description is required'),
    quantity: z.preprocess(coerceToNumber, z.number({ required_error: 'Quantity is required' }).min(0.01, 'Quantity must be greater than 0')),
    unitPrice: z.preprocess(coerceToNumber, z.number({ required_error: 'Unit price is required' }).refine(v => v > 0, { message: 'Unit price must be greater than 0' })),
    amount: z.number().optional(),
  })).min(1, 'At least one item is required'),
  taxRate: z.preprocess(coerceToNumber, z.number().min(0).max(100).default(0)),
  notes: z.string().max(1000).optional().or(z.literal('')),
  terms: z.string().max(1000).optional().or(z.literal('')),
  dueDays: z.preprocess(coerceToNumber, z.number().min(1).default(30)),
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
  amount: z.preprocess(coerceToNumber, z.number({ required_error: 'Amount is required' }).min(0.01, 'Amount must be greater than 0')),
  taxRate: z.preprocess(coerceToNumber, z.number().min(0).max(100).default(0)),
  category: z.string().min(1, 'Category is required'),
  notes: z.string().max(1000).optional().or(z.literal('')),
}).refine(
  (data) => new Date(data.dueDate) >= new Date(data.billDate),
  { message: 'Due date must be on or after bill date', path: ['dueDate'] }
);

export type BillFormSchemaData = z.infer<typeof billFormSchema>;

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

