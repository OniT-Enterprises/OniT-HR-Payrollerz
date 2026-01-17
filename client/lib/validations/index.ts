/**
 * Zod Validation Schemas
 * Reusable validation schemas for forms and API data
 */

import { z } from 'zod';

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

export type BillFormData = z.infer<typeof billSchema>;

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
