/**
 * Money Module Types
 * Simple accounting for small TL businesses
 *
 * VAT fields are optional on all types — only populated when
 * tenant has vatEnabled = true in their settings.
 */
import type { VATCategory } from '@onit/shared';

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

  // VAT (optional — populated when vatEnabled)
  vatCategory?: VATCategory;       // 'standard' | 'reduced' | 'zero' | 'exempt'
  vatRate?: number;                // Rate for this line (e.g., 10)
  vatAmount?: number;              // VAT on this line
  netAmount?: number;              // Amount excluding VAT
  grossAmount?: number;            // Amount including VAT
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

  // VAT (optional — populated when vatEnabled)
  vatBreakdown?: {                 // Breakdown by rate (mixed-rate invoices)
    rate: number;
    category: VATCategory;
    netAmount: number;
    vatAmount: number;
  }[];
  isVATInvoice?: boolean;          // Was this created with VAT enabled?
  supplierVatId?: string;          // Seller's VAT registration
  customerVatId?: string;          // Buyer's VAT ID (from customer.tin)

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
  cancelledAt?: Date;
  cancelReason?: string;

  // Reminders
  lastReminderAt?: Date;
  reminderCount?: number;

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

  // VAT (optional — input VAT tracking when vatEnabled)
  vatRate?: number;
  vatAmount?: number;              // Input VAT (claimable if valid invoice)
  netAmount?: number;              // Amount excluding VAT
  vatCategory?: VATCategory;
  supplierVatId?: string;          // Vendor's VAT ID (required for credit)
  hasValidVATInvoice?: boolean;    // Can we claim input VAT credit?
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

  // VAT (optional — input VAT tracking when vatEnabled)
  vatRate?: number;
  vatAmount?: number;              // Input VAT on this bill
  netAmount?: number;              // Amount excluding VAT
  vatCategory?: VATCategory;
  supplierVatId?: string;          // Vendor's VAT ID
  hasValidVATInvoice?: boolean;    // Valid for input credit?
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

  // AR Aging breakdown
  aging?: {
    current: number;      // 0-30 days
    days30to60: number;   // 31-60 days
    days60to90: number;   // 61-90 days
    over90: number;       // 90+ days
  };

  // Cash flow (last 6 months)
  cashFlow?: {
    month: string;
    received: number;
    spent: number;
  }[];

  // Top customers by outstanding
  topCustomers?: {
    id: string;
    name: string;
    outstanding: number;
    invoiceCount: number;
    oldestInvoiceDays?: number;  // Days since oldest unpaid invoice
  }[];

  // Recent activity
  recentActivity?: {
    id: string;
    type: 'invoice_created' | 'invoice_sent' | 'invoice_viewed' | 'payment_received' | 'invoice_overdue';
    description: string;
    amount?: number;
    timestamp: Date;
    entityId?: string;
  }[];
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

  // VAT (populated when vatEnabled)
  vatRegistrationNumber?: string;  // Business VAT ID / TIN
  pricesIncludeVAT?: boolean;      // true = shelf prices are VAT-inclusive
}

const DEFAULT_INVOICE_SETTINGS: Partial<InvoiceSettings> = {
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

// ============================================
// RECURRING INVOICES
// ============================================

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type RecurringStatus = 'active' | 'paused' | 'completed';

export interface RecurringInvoice {
  id: string;

  // Customer
  customerId: string;
  customerName: string;
  customerEmail?: string;

  // Schedule
  frequency: RecurringFrequency;
  startDate: string;               // YYYY-MM-DD
  endDate?: string;                // Optional end date
  endAfterOccurrences?: number;    // Optional - stop after N invoices
  nextRunDate: string;             // YYYY-MM-DD - when to generate next

  // Template
  items: InvoiceItem[];
  taxRate: number;
  notes?: string;
  terms?: string;
  dueDays: number;                 // Days until due from issue date

  // Settings
  autoSend: boolean;               // Auto-send on generation
  status: RecurringStatus;

  // Tracking
  generatedCount: number;          // How many invoices generated
  lastGeneratedAt?: Date;
  lastInvoiceId?: string;          // ID of last generated invoice

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringInvoiceFormData {
  customerId: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  endAfterOccurrences?: number;
  items: Omit<InvoiceItem, 'id'>[];
  taxRate: number;
  notes?: string;
  terms?: string;
  dueDays: number;
  autoSend: boolean;
}

// ============================================
// VAT RETURN (when vatEnabled)
// ============================================

export type VATReturnStatus = 'draft' | 'reviewed' | 'filed' | 'paid';

export interface VATReturn {
  id: string;

  // Period
  periodStart: string;             // "2027-01-01"
  periodEnd: string;               // "2027-01-31"
  filingDeadline: string;          // periodEnd + X days

  // Output VAT (from sales)
  outputVAT: {
    standardRate: { net: number; vat: number };
    reducedRate?: { net: number; vat: number };
    zeroRated: { net: number; vat: number };
    exempt: { net: number };
    total: number;
  };

  // Input VAT (from purchases)
  inputVAT: {
    domesticPurchases: { net: number; vat: number };
    imports: { net: number; vat: number };
    total: number;
  };

  // Net
  netVATDue: number;               // output.total - input.total

  // Status
  status: VATReturnStatus;

  // Drill-down references
  outputInvoiceIds: string[];
  outputTransactionIds: string[];  // Kaixa transaction IDs
  inputBillIds: string[];
  inputExpenseIds: string[];

  // Filing
  filedAt?: Date;
  filedBy?: string;
  paymentReference?: string;

  createdAt: Date;
  updatedAt: Date;
}
