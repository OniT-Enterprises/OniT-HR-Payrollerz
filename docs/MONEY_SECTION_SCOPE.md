# Money Section - Scope & Improvement Plan

## Current State Assessment

The Money section is **80-85% complete** with solid infrastructure already in place.

---

## What Exists (Complete)

### Pages (14 components in `/client/pages/money/`)

| Page | Lines | Status | Description |
|------|-------|--------|-------------|
| MoneyDashboard.tsx | ~400 | Complete | Overview with stats, quick actions, recent invoices |
| Invoices.tsx | 396 | Complete | Invoice list with search/filter |
| InvoiceForm.tsx | 883 | Complete | Create/edit invoices with line items |
| Customers.tsx | 498 | Complete | Customer management with inline forms |
| Payments.tsx | 344 | Complete | Payment tracking for invoices |
| Vendors.tsx | 503 | Complete | Vendor (supplier) management |
| Expenses.tsx | 825 | Complete | Expense tracking with categories |
| Bills.tsx | 390 | Complete | AP bill management |
| BillForm.tsx | 745 | Complete | Create/edit bills with payments |
| ProfitLoss.tsx | 398 | Complete | P&L reporting |
| BalanceSheet.tsx | 312 | Complete | Balance sheet |
| Cashflow.tsx | 354 | Complete | Cash flow analysis |
| ARAgingReport.tsx | 292 | Complete | Accounts Receivable aging |
| APAgingReport.tsx | 300 | Complete | Accounts Payable aging |
| BankReconciliation.tsx | 623 | Partial | Bank statement reconciliation |

### Services (5 fully-featured)

| Service | Lines | Coverage |
|---------|-------|----------|
| invoiceService.ts | 752 | CRUD, payments, status, share tokens, settings |
| customerService.ts | 237 | CRUD, filters, search |
| vendorService.ts | 230 | CRUD, filters, activate/deactivate |
| expenseService.ts | 302 | CRUD, filters, category totals |
| billService.ts | 530 | CRUD, payments, overdue detection |

### Types (`/client/types/money.ts` - 407 lines)

- Customer, Invoice, Vendor, Expense, Bill
- Payment methods, statuses, form data types
- 14 expense categories
- Bank reconciliation types

### React Query Hooks (5 hooks)

- useInvoices, useCustomers, useVendors, useExpenses, useBills
- All with proper query/mutation patterns

### Bank Transfer Support

- ANZ, BNCTL, BNU, Mandiri formats in `/client/lib/bank-transfers/`

---

## Improvement Opportunities

### Priority 1: Dashboard Enhancements (High Impact)

Based on research from FreshBooks, Wave, Zoho Invoice, and Ramp:

#### 1.1 Invoice Aging Chart
```
Visual bar chart showing AR breakdown:
- 0-30 days (green)
- 31-60 days (yellow)
- 60+ days (red)
```
**Inspiration:** Wave, FreshBooks dashboards

#### 1.2 Cash Flow Visualization
```
Simple line/area chart showing:
- Money in (invoices paid)
- Money out (bills + expenses)
- Net cash flow trend
```
**Inspiration:** Xero, QuickBooks dashboards

#### 1.3 Top Customers Widget
```
Show top 5 customers by:
- Outstanding balance
- Total revenue (this year)
Quick action: Send reminder
```
**Inspiration:** Zoho Invoice

#### 1.4 Activity Feed
```
Recent activity timeline:
- "Invoice #123 viewed by client" (with timestamp)
- "Payment received: $500 from ABC Corp"
- "Bill #45 due in 3 days"
```
**Inspiration:** FreshBooks, Ramp

#### 1.5 Quick Stats Bar
```
Horizontal stats strip at top:
| Revenue MTD | Collected | Outstanding | Overdue % | DSO |
| $12,500     | $8,200    | $4,300      | 12%       | 28  |
```
**Inspiration:** Brex, Ramp dashboards

---

### Priority 2: Invoice Experience (Medium Impact)

#### 2.1 Invoice Status Timeline
```
Visual progress indicator:
[Draft] → [Sent] → [Viewed] → [Paid]
         ↓
      [Overdue]
```

#### 2.2 Invoice Templates
- 2-3 professional templates
- Company logo/branding
- TL-specific: TIN number, BNU/BNCTL bank details

#### 2.3 PDF Generation
- Generate professional PDF invoices
- Download or email directly
- Include QR code for payment reference

#### 2.4 Automated Reminders
- Email reminders for upcoming/overdue invoices
- SMS option (more common in TL)
- Configurable schedule: 3 days before, on due date, 7 days after

#### 2.5 Payment Links
- Shareable link for invoice viewing
- Track when customer views invoice
- Copy link button, email, WhatsApp share

---

### Priority 3: TL-Specific Adaptations

#### 3.1 Payment Methods
```typescript
// Current
type PaymentMethod = 'bank_transfer' | 'cash' | 'check' | 'credit_card' | 'other';

// Enhanced for TL
type PaymentMethod =
  | 'bank_transfer_bnu'      // Banco Nacional Ultramarino
  | 'bank_transfer_bnctl'    // Banco Nacional Comercio TL
  | 'bank_transfer_mandiri'  // Bank Mandiri (Indonesian)
  | 'bank_transfer_anz'      // ANZ (Australian)
  | 'cash_usd'               // Cash in USD (common in TL)
  | 'check'
  | 'mobile_money'           // Future: if TL adopts
  | 'other';
```

#### 3.2 Currency Handling
- Primary: USD (official currency of Timor-Leste)
- Display: Always show $ with proper formatting
- No currency conversion needed (single currency)

#### 3.3 Tax Integration
- Include TIN (Tax ID Number) on invoices
- Auto-calculate 10% WIT if applicable
- Link to ATTL tax filing when relevant

#### 3.4 Bank Details on Invoices
```
Payment Details:
Bank: BNU (Banco Nacional Ultramarino)
Account: [Company Account Number]
Account Name: [Company Legal Name]
Reference: INV-2026-0001
```

---

### Priority 4: UI Polish (Lower Priority)

#### 4.1 Component Extraction
Extract reusable components from page files:
- `<InvoiceStatusBadge />`
- `<CustomerSelect />` (searchable dropdown)
- `<PaymentModal />`
- `<DateRangePicker />`
- `<MoneyInput />` (formatted currency input)

#### 4.2 Bulk Operations
- Bulk send reminders
- Bulk export to CSV/PDF
- Bulk status update

#### 4.3 Advanced Filtering
- Date range picker (not just dropdowns)
- Amount range filter
- Multi-select status filter
- Saved filter presets

#### 4.4 Keyboard Shortcuts
- `Cmd+N` - New invoice
- `Cmd+F` - Focus search
- `Cmd+S` - Save draft

---

## Implementation Phases

### Phase 1: Dashboard Polish (1-2 weeks)
- [ ] Invoice aging chart
- [ ] Cash flow mini-chart
- [ ] Top customers widget
- [ ] Activity feed
- [ ] Quick stats bar

### Phase 2: Invoice Experience (2-3 weeks)
- [ ] Status timeline visualization
- [ ] PDF generation
- [ ] Email/share functionality
- [ ] Payment reminders (email)

### Phase 3: TL Adaptations (1 week)
- [ ] Enhanced payment methods
- [ ] Bank details on invoices
- [ ] TIN integration
- [ ] Invoice templates with TL branding

### Phase 4: Polish & Extras (Ongoing)
- [ ] Component extraction
- [ ] Bulk operations
- [ ] Advanced filtering
- [ ] Mobile responsiveness review

---

## Competitive Reference

| Feature | FreshBooks | Wave | Zoho | Our App |
|---------|------------|------|------|---------|
| Invoice CRUD | ✅ | ✅ | ✅ | ✅ |
| Customer management | ✅ | ✅ | ✅ | ✅ |
| Payment tracking | ✅ | ✅ | ✅ | ✅ |
| Expense tracking | ✅ | ✅ | ✅ | ✅ |
| Bills/AP | ✅ | ✅ | ✅ | ✅ |
| AR/AP Aging | ✅ | ✅ | ✅ | ✅ |
| P&L Report | ✅ | ✅ | ✅ | ✅ |
| PDF invoices | ✅ | ✅ | ✅ | ❌ |
| Email invoices | ✅ | ✅ | ✅ | ❌ |
| Auto reminders | ✅ | ✅ | ✅ | ❌ |
| Invoice aging chart | ✅ | ✅ | ✅ | ❌ |
| Activity feed | ✅ | ❌ | ✅ | ❌ |
| Bank reconciliation | ✅ | ✅ | ✅ | 🔶 |

✅ = Complete | ❌ = Missing | 🔶 = Partial

---

## Tech Notes

### Existing Patterns to Follow
- Services use tenant-scoped Firestore paths
- React Query hooks with optimistic updates
- shadcn/ui components throughout
- Skeleton loading states

### Dependencies Needed
- PDF generation: `@react-pdf/renderer` or `jspdf`
- Charts: Already have chart library (check existing)
- Email: Firebase Functions or external service

### Firestore Indexes Required
- invoices: `tenantId` + `status` + `dueDate`
- invoices: `tenantId` + `customerId` + `createdAt`
- expenses: `tenantId` + `category` + `date`
- bills: `tenantId` + `vendorId` + `dueDate`

---

## Summary

The Money section has a **solid foundation**. The main gaps compared to leading invoicing apps are:

1. **Visual dashboard elements** (charts, activity feed)
2. **Invoice delivery** (PDF, email, reminders)
3. **TL-specific polish** (bank details, payment methods)

These are all additive improvements - the core functionality is already working well.
