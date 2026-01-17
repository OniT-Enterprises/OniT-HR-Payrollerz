/**
 * Money Module Types
 * Simple accounting for small TL businesses
 */

// ============================================
// CUSTOMERS
// ============================================

export interface Customer {
  id: string;
  name: string;
  type: 'business' | 'individual';
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  tin?: string;                    // Tax ID (NIF in TL)
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerFormData {
  name: string;
  type: 'business' | 'individual';
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  tin?: string;
  notes?: string;
}

// ============================================
// INVOICES
// ============================================

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'cancelled';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;                  // quantity × unitPrice
}

export interface Invoice {
  id: string;
  invoiceNumber: string;           // "INV-2026-001"

  // Customer
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;

  // Dates
  issueDate: string;               // YYYY-MM-DD
  dueDate: string;                 // YYYY-MM-DD

  // Line items
  items: InvoiceItem[];

  // Totals
  subtotal: number;
  taxRate: number;                 // 0-100 (percentage)
  taxAmount: number;
  total: number;

  // Payment tracking
  status: InvoiceStatus;
  amountPaid: number;
  balanceDue: number;

  // Additional info
  notes?: string;                  // "Thank you for your business"
  terms?: string;                  // "Payment due within 30 days"

  currency: 'USD';

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  paidAt?: Date;
  viewedAt?: Date;

  // For sharing
  shareToken?: string;             // Random token for public link

  // Payments received (populated by service)
  payments?: PaymentReceived[];
}

export interface InvoiceFormData {
  customerId: string;
  issueDate: string;
  dueDate: string;
  items: Omit<InvoiceItem, 'id'>[];
  taxRate: number;
  notes?: string;
  terms?: string;
}

// ============================================
// PAYMENTS RECEIVED
// ============================================

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'check'
  | 'mobile_money'
  | 'other';

export interface PaymentReceived {
  id: string;
  date: string;                    // YYYY-MM-DD

  // Customer (optional - can be advance payment)
  customerId?: string;
  customerName?: string;

  // Invoice (optional - can be unlinked)
  invoiceId?: string;
  invoiceNumber?: string;

  amount: number;
  method: PaymentMethod;
  reference?: string;              // Check number, transfer ref, etc.
  notes?: string;

  createdAt: Date;
}

export interface PaymentFormData {
  date: string;
  customerId?: string;
  invoiceId?: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

// ============================================
// VENDORS (Phase 2)
// ============================================

export interface Vendor {
  id: string;
  name: string;
  type: 'business' | 'individual';
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  tin?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorFormData {
  name: string;
  type: 'business' | 'individual';
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  tin?: string;
  notes?: string;
}

// ============================================
// EXPENSES (Phase 2)
// ============================================

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'supplies'
  | 'equipment'
  | 'transport'
  | 'fuel'
  | 'meals'
  | 'professional_services'
  | 'insurance'
  | 'taxes_licenses'
  | 'marketing'
  | 'communication'
  | 'maintenance'
  | 'other';

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  vendorId?: string;
  vendorName?: string;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  notes?: string;
  createdAt: Date;
}

export interface ExpenseFormData {
  date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  vendorId?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}

// ============================================
// BILLS (Phase 2)
// ============================================

export type BillStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled';

export interface Bill {
  id: string;
  billNumber?: string;             // Vendor's invoice number
  vendorId: string;
  vendorName: string;

  billDate: string;
  dueDate: string;

  description: string;
  amount: number;
  taxAmount: number;
  total: number;

  status: BillStatus;
  amountPaid: number;
  balanceDue: number;

  category: ExpenseCategory;
  notes?: string;
  attachmentUrls?: string[];

  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;

  // Payments made (populated by service)
  payments?: BillPayment[];
}

export interface BillFormData {
  billNumber?: string;
  vendorId: string;
  billDate: string;
  dueDate: string;
  description: string;
  amount: number;
  taxRate: number;
  category: ExpenseCategory;
  notes?: string;
}

export interface BillPayment {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: Date;
}

export interface BillPaymentFormData {
  date: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

// ============================================
// DASHBOARD STATS
// ============================================

export interface MoneyStats {
  // Revenue
  totalRevenue: number;
  revenueThisMonth: number;
  revenuePreviousMonth: number;

  // Receivables
  totalOutstanding: number;
  overdueAmount: number;
  invoicesDraft: number;
  invoicesSent: number;
  invoicesOverdue: number;

  // Expenses (Phase 2)
  totalExpenses: number;
  expensesThisMonth: number;

  // Profit
  profitThisMonth: number;
  profitPreviousMonth: number;
}

// ============================================
// INVOICE SETTINGS
// ============================================

export interface InvoiceSettings {
  // Numbering
  prefix: string;                  // "INV"
  nextNumber: number;              // Auto-increment

  // Defaults
  defaultTaxRate: number;          // 0 for most TL businesses
  defaultTerms: string;
  defaultNotes: string;
  defaultDueDays: number;          // Days until due (e.g., 30)

  // Company info (shown on invoice)
  companyName: string;
  companyAddress: string;
  companyPhone?: string;
  companyEmail?: string;
  companyTin?: string;
  logoUrl?: string;

  // Bank details (for payment)
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
}

export const DEFAULT_INVOICE_SETTINGS: Partial<InvoiceSettings> = {
  prefix: 'INV',
  nextNumber: 1,
  defaultTaxRate: 0,
  defaultTerms: 'Payment due within 30 days',
  defaultNotes: 'Thank you for your business',
  defaultDueDays: 30,
};

// ============================================
// BANK RECONCILIATION
// ============================================

export type BankTransactionType = 'deposit' | 'withdrawal';
export type ReconciliationStatus = 'unmatched' | 'matched' | 'reconciled';

export interface BankTransaction {
  id: string;
  date: string;                      // YYYY-MM-DD
  description: string;
  amount: number;                    // Positive for deposits, negative for withdrawals
  type: BankTransactionType;
  reference?: string;                // Check number, transfer ref
  balance?: number;                  // Running balance (if provided)

  // Matching
  status: ReconciliationStatus;
  matchedTo?: {
    type: 'invoice_payment' | 'bill_payment' | 'expense';
    id: string;
    description: string;
  };

  createdAt: Date;
  reconciledAt?: Date;
}

export interface BankReconciliation {
  id: string;
  accountName: string;
  statementDate: string;
  statementBalance: number;

  // Calculated
  clearedBalance: number;
  outstandingDeposits: number;
  outstandingWithdrawals: number;
  difference: number;

  transactions: BankTransaction[];

  status: 'in_progress' | 'completed';
  createdAt: Date;
  completedAt?: Date;
}
