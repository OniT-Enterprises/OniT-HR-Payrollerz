# Simple Accounting Module - Scope Document

## Vision

Transform OniT from HR/Payroll into a **small business ERP for Timor-Leste** - the one app a small business needs to manage employees, pay salaries, send invoices, and track money.

**Target User**: Small TL business owner (5-50 employees) currently using paper/spreadsheets.

**Design Principles**:
- Simple over powerful
- Mobile-first (works on phone)
- Tetum/Portuguese/English
- Offline-capable where possible
- No accounting knowledge required

---

## Module Overview

```
┌─────────────────────────────────────────────────────────┐
│                    OniT ERP                             │
├─────────────────┬─────────────────┬─────────────────────┤
│   HR/Payroll    │    Money In     │     Money Out       │
│   (existing)    │   (new)         │     (new)           │
├─────────────────┼─────────────────┼─────────────────────┤
│ • Employees     │ • Customers     │ • Vendors           │
│ • Attendance    │ • Invoices      │ • Bills             │
│ • Leave         │ • Payments In   │ • Expenses          │
│ • Payroll       │ • Quotes        │ • Payments Out      │
└─────────────────┴─────────────────┴─────────────────────┘
                          │
                    ┌─────┴─────┐
                    │  Reports  │
                    │ Dashboard │
                    └───────────┘
```

---

## Phase 1: Invoicing (Money In)

**Goal**: Let businesses create invoices and track who owes them money.

### 1.1 Customers
Simple contact management for people/companies you sell to.

```typescript
interface Customer {
  id: string;
  name: string;                    // "Café Timor" or "João Silva"
  type: 'business' | 'individual';
  email?: string;
  phone?: string;
  address?: string;
  tin?: string;                    // Tax ID (optional)
  notes?: string;
  balance: number;                 // What they owe (calculated)
  createdAt: Date;
}
```

**UI**: Simple list + add/edit form. Search by name.

### 1.2 Invoices
Create and send invoices.

```typescript
interface Invoice {
  id: string;
  invoiceNumber: string;          // "INV-2026-001" (auto-generated)
  customerId: string;
  customerName: string;           // Denormalized for display

  issueDate: string;              // YYYY-MM-DD
  dueDate: string;                // YYYY-MM-DD

  items: InvoiceItem[];

  subtotal: number;
  taxRate: number;                // Usually 0% or 10% in TL
  taxAmount: number;
  total: number;

  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  amountPaid: number;
  balanceDue: number;

  notes?: string;                 // "Thank you for your business"
  terms?: string;                 // "Payment due within 30 days"

  currency: 'USD';                // TL uses USD

  createdAt: Date;
  sentAt?: Date;
  paidAt?: Date;
}

interface InvoiceItem {
  description: string;            // "Security Services - January 2026"
  quantity: number;
  unitPrice: number;
  amount: number;                 // quantity × unitPrice
}
```

**UI Features**:
- Invoice list with status filters (Draft, Sent, Paid, Overdue)
- Create/edit invoice form
- Preview invoice (print-ready)
- Send via email or WhatsApp share link
- Record payment (full or partial)
- Duplicate invoice
- Dashboard widget: "Outstanding Invoices: $X"

**Invoice Template**:
- Clean, professional design
- Company logo + details
- Customer details
- Line items table
- Totals
- Payment instructions
- "Powered by OniT" footer (optional)

### 1.3 Payments Received
Track money coming in.

```typescript
interface PaymentReceived {
  id: string;
  date: string;
  customerId: string;
  invoiceId?: string;             // Can be unlinked (advance payment)
  amount: number;
  method: 'cash' | 'bank_transfer' | 'check' | 'other';
  reference?: string;             // Check number, transfer ref
  notes?: string;
}
```

### 1.4 Phase 1 Reports
- **Invoices Aging**: Who owes how much, for how long
- **Revenue by Month**: Simple bar chart
- **Top Customers**: By revenue

---

## Phase 2: Bills & Expenses (Money Out)

**Goal**: Track what the business spends money on.

### 2.1 Vendors
People/companies you buy from.

```typescript
interface Vendor {
  id: string;
  name: string;
  type: 'business' | 'individual';
  email?: string;
  phone?: string;
  address?: string;
  tin?: string;
  notes?: string;
  balance: number;                // What you owe them
  createdAt: Date;
}
```

### 2.2 Bills
Invoices you receive from vendors.

```typescript
interface Bill {
  id: string;
  billNumber?: string;            // Vendor's invoice number
  vendorId: string;
  vendorName: string;

  billDate: string;
  dueDate: string;

  items: BillItem[];

  subtotal: number;
  taxAmount: number;
  total: number;

  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  amountPaid: number;
  balanceDue: number;

  category: ExpenseCategory;
  notes?: string;
  attachments?: string[];         // Receipt photos

  createdAt: Date;
  paidAt?: Date;
}

type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'supplies'
  | 'equipment'
  | 'transport'
  | 'meals'
  | 'professional_services'
  | 'insurance'
  | 'taxes_licenses'
  | 'marketing'
  | 'other';
```

### 2.3 Quick Expenses
For small cash expenses that don't need a formal bill.

```typescript
interface Expense {
  id: string;
  date: string;
  description: string;            // "Taxi to client meeting"
  amount: number;
  category: ExpenseCategory;
  vendorId?: string;              // Optional - can be unnamed
  vendorName?: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'other';
  receipt?: string;               // Photo URL
  notes?: string;
  createdAt: Date;
}
```

**UI Features**:
- Quick expense entry (mobile-optimized)
- Camera button for receipt photo
- Category picker
- Expense list with filters
- Dashboard widget: "Spent this month: $X"

### 2.4 Payments Made
Track money going out.

```typescript
interface PaymentMade {
  id: string;
  date: string;
  vendorId?: string;
  billId?: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'check' | 'other';
  reference?: string;
  notes?: string;
}
```

### 2.5 Phase 2 Reports
- **Bills Aging**: What you owe, when it's due
- **Expenses by Category**: Pie chart
- **Expenses by Month**: Trend line
- **Top Vendors**: By spend

---

## Phase 3: Dashboard & Reports

**Goal**: Give business owners a clear picture of their financial health.

### 3.1 Financial Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  Money Dashboard                          January 2026  │
├─────────────────┬─────────────────┬─────────────────────┤
│  Money In       │  Money Out      │  Profit             │
│  $12,450        │  $8,320         │  $4,130             │
│  ↑ 12% vs Dec   │  ↑ 5% vs Dec    │  ↑ 28% vs Dec       │
├─────────────────┴─────────────────┴─────────────────────┤
│                                                         │
│  [Cash Flow Chart - 6 months]                          │
│  ████ In  ░░░░ Out                                     │
│                                                         │
├─────────────────────────────┬───────────────────────────┤
│  They Owe You               │  You Owe                  │
│  $3,200 (4 invoices)        │  $1,450 (2 bills)        │
│                             │                           │
│  • Café Timor - $1,200      │  • Office Rent - $800    │
│  • Hotel Dili - $800        │  • Telkomcel - $650      │
│  • João Silva - $700        │                           │
│  • [View All]               │  • [View All]             │
├─────────────────────────────┴───────────────────────────┤
│  Payroll This Month                                     │
│  $5,200 (12 employees)                    [Run Payroll] │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Profit & Loss Report (Simple)

```
Profit & Loss
January 2026
─────────────────────────────
MONEY IN
  Sales/Services      $12,450
                     ────────
  Total In            $12,450

MONEY OUT
  Payroll              $5,200
  Rent                   $800
  Utilities              $320
  Supplies               $450
  Transport              $280
  Other                $1,270
                     ────────
  Total Out            $8,320

─────────────────────────────
PROFIT                 $4,130
═════════════════════════════
```

### 3.3 Cash Flow Report
- Money in vs money out by week/month
- Running balance
- Forecast (based on outstanding invoices/bills)

### 3.4 Tax Summary
- Total revenue
- Total expenses by category
- Payroll taxes paid (WIT, INSS)
- Useful for annual tax filing

---

## Phase 4: Integration & Polish

### 4.1 Payroll → Accounting Integration
When payroll runs, automatically create:
- Expense entry for total payroll cost
- Liability entries for WIT/INSS payable
- This already exists via the journal entry system

### 4.2 Bank Account Tracking (Manual)
Simple register to track bank balance without bank feeds.

```typescript
interface BankTransaction {
  id: string;
  date: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  description: string;
  amount: number;
  balance: number;                // Running balance
  linkedTo?: {
    type: 'invoice' | 'bill' | 'expense' | 'payroll';
    id: string;
  };
}
```

### 4.3 Recurring Transactions
- Recurring invoices (monthly retainer clients)
- Recurring bills (rent, subscriptions)

### 4.4 Multi-Currency (Future)
- Support for USD + other currencies
- Exchange rate tracking
- Most TL businesses just use USD, so low priority

---

## Navigation Update

```
Current:
├── Dashboard
├── Hiring
├── Staff
├── Time & Leave
├── Performance
├── Payroll
├── Reports
└── Settings

Proposed:
├── Dashboard (combined HR + Money)
├── Hiring
├── Staff
├── Time & Leave
├── Performance
├── Payroll
├── Money (NEW)
│   ├── Overview (dashboard)
│   ├── Invoices
│   ├── Customers
│   ├── Bills & Expenses
│   ├── Vendors
│   └── Reports
├── Reports (combined)
└── Settings
```

---

## Database Collections (Firestore)

```
/tenants/{tenantId}/
  /customers/{customerId}
  /vendors/{vendorId}
  /invoices/{invoiceId}
  /bills/{billId}
  /expenses/{expenseId}
  /payments/{paymentId}         // Both in and out
  /bankTransactions/{txId}      // Manual bank register
```

---

## Implementation Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase 1** | Customers, Invoices, Payments In | 1-2 weeks |
| **Phase 2** | Vendors, Bills, Expenses | 1-2 weeks |
| **Phase 3** | Dashboard, Reports | 1 week |
| **Phase 4** | Polish, Recurring, Integration | 1 week |

**Total: 4-6 weeks** for a complete simple accounting module.

---

## What This Is NOT

- Not double-entry accounting (too complex for target users)
- Not bank reconciliation (no bank feeds in TL)
- Not inventory management (separate module if needed)
- Not project costing (keep it simple)
- Not multi-company (one business per tenant)

---

## Success Metrics

1. **Adoption**: Businesses create invoices in OniT instead of Word/Excel
2. **Time Saved**: Faster to create invoice than manual process
3. **Visibility**: Owner can see "who owes me" in 2 taps
4. **Completeness**: All money in/out tracked in one place

---

## Next Steps

1. **Validate**: Does this match what TL businesses actually need?
2. **Design**: Create UI mockups for invoice flow
3. **Build Phase 1**: Customers + Invoices
4. **Test**: With real users
5. **Iterate**: Based on feedback

---

## Open Questions

1. Do businesses need quotes/estimates before invoices?
2. Should invoices support multiple tax rates?
3. Is WhatsApp sharing more important than email?
4. Do we need inventory/product catalog, or just free-text line items?
5. What payment methods are common in TL? (Cash, bank transfer, ...?)
