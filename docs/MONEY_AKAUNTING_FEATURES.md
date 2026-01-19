# Money Section: Akaunting-Inspired Features

> Scoped features from Akaunting open-source platform, filtered for Timor-Leste context.
> Created: January 2026

## Overview

After reviewing Akaunting (Laravel-based open-source accounting), these features are relevant and valuable for our TL-focused Money module. American-specific features like multi-currency complexity, ACH transfers, and complex tax jurisdictions have been excluded.

---

## Phase 4: Dashboard Enhancements (Priority: High)

### 4.1 Receivables Progress Widget
**What**: Visual breakdown of outstanding receivables with aging segments
**Why**: At-a-glance view of money owed, critical for cash flow management

```
┌─────────────────────────────────────────┐
│ Receivables              $12,450 total  │
│ ═══════════════════════════════════════ │
│ ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ▲ Current (0-30)    $8,200   65%        │
│ ▲ 31-60 days        $2,500   20%        │
│ ▲ 61-90 days        $1,250   10%        │
│ ▲ 90+ days          $500     5%         │
│                                         │
│ [View AR Report]                        │
└─────────────────────────────────────────┘
```

**Implementation**:
- Component: `ReceivablesWidget.tsx`
- Uses existing `stats.aging` data from `invoiceService.getStats()`
- Progress bar segments with color-coded aging buckets
- Click-through to AR Aging report

### 4.2 Payables Summary Widget
**What**: Overview of bills due with payment reminders
**Why**: Avoid late fees, manage vendor relationships

```
┌─────────────────────────────────────────┐
│ Bills Due                               │
│ ═══════════════════════════════════════ │
│ 🔴 Overdue (3)           $2,100         │
│ 🟠 Due this week (5)     $4,800         │
│ 🟢 Due later (12)        $8,500         │
│                         ───────         │
│                         $15,400 total   │
│                                         │
│ [View Bills] [Pay Now]                  │
└─────────────────────────────────────────┘
```

**Implementation**:
- Component: `PayablesSummaryWidget.tsx`
- Requires `billService.getStats()` enhancement
- Group by urgency: overdue, due this week, due later

### 4.3 Enhanced Cash Flow Widget
**What**: Combined view of money in vs money out
**Why**: Net cash position over time

**Current**: Shows only "Received" payments
**Enhanced**: Add "Spent" (bills/expenses) as second series

```
Chart showing:
- Green area: Payments received
- Red area: Payments made (bills + expenses)
- Net line: Difference
```

**Implementation**:
- Update `invoiceService.getStats()` to include expense/bill payments by month
- Add `spent` data series to existing `cashFlow` array
- Modify `MoneyDashboard.tsx` to render both series

---

## Phase 5: Quick Payment Recording (Priority: High)

### 5.1 Simple Payment Modal
**What**: One-click payment recording without leaving current view
**Why**: Most common action - make it fast

**Trigger Points**:
- Invoice list: "Record Payment" in dropdown
- Invoice view: "Record Payment" button
- Dashboard: Click on outstanding invoice

```
┌─────────────────────────────────────────┐
│ Record Payment                      [X] │
│ ═══════════════════════════════════════ │
│ Invoice: INV-2026-042                   │
│ Customer: Timor Coffee Co              │
│ Total: $2,500.00                        │
│ ─────────────────────────────────────── │
│                                         │
│ Amount Received:  [$2,500.00    ]       │
│                   ☐ Partial payment     │
│                                         │
│ Payment Date:     [19/01/2026   ] 📅    │
│                                         │
│ Payment Method:   [▼ Bank Transfer  ]   │
│                   • Cash                │
│                   • Bank Transfer       │
│                   • Mobile Money (Telemor) │
│                   • Check               │
│                                         │
│ Reference:        [REF-001234   ]       │
│ (optional)                              │
│                                         │
│ Notes:            [               ]     │
│                                         │
│ ─────────────────────────────────────── │
│     [Cancel]              [Save Payment]│
└─────────────────────────────────────────┘
```

**Payment Methods (TL Context)**:
- Cash (most common)
- Bank Transfer (BNU, BNCTL, Mandiri, ANZ)
- Mobile Money (Telemor, Telkomcel)
- Check

**Implementation**:
- Component: `RecordPaymentModal.tsx`
- Reusable across invoice list, invoice view, dashboard
- Partial payment support (updates invoice to "partial" status)
- Auto-mark as "paid" when full amount received

### 5.2 Batch Payment Recording
**What**: Record multiple payments at once (e.g., when depositing checks)
**Why**: Efficiency for businesses with many small invoices

**Defer to later phase** - single payment modal covers most needs first.

---

## Phase 6: Recurring Invoices (Priority: Medium)

### 6.1 Recurring Invoice Setup
**What**: Auto-generate invoices on schedule
**Why**: Service businesses (IT support, cleaning, security) bill monthly

```
┌─────────────────────────────────────────┐
│ Create Recurring Invoice                │
│ ═══════════════════════════════════════ │
│ Customer:         [▼ Select customer ]  │
│                                         │
│ Frequency:        [▼ Monthly        ]   │
│                   • Weekly              │
│                   • Monthly             │
│                   • Quarterly           │
│                   • Yearly              │
│                                         │
│ Start Date:       [01/02/2026   ] 📅    │
│ End Date:         [▼ Never      ]       │
│                   • After X occurrences │
│                   • On specific date    │
│                   • Never               │
│                                         │
│ Auto-send:        [✓] Email on creation │
│                                         │
│ ─── Line Items ──────────────────────── │
│ Same as regular invoice form            │
│                                         │
│ ─────────────────────────────────────── │
│     [Cancel]         [Create Recurring] │
└─────────────────────────────────────────┘
```

**Implementation**:
- New collection: `tenants/{tid}/recurringInvoices`
- Firebase Functions: Daily cron to generate due invoices
- New page: `/money/invoices/recurring`
- Dashboard widget showing upcoming auto-invoices

### 6.2 Recurring Invoice Management
- List view of all recurring templates
- Edit/pause/delete recurring invoices
- History of generated invoices

---

## Phase 7: Invoice Actions Enhancement (Priority: Medium)

### 7.1 Invoice Duplicate
**What**: Copy existing invoice as starting point for new one
**Why**: Similar invoices for same customer

**Implementation**:
- Add "Duplicate" to invoice dropdown menu
- Pre-fill form with copied data (new number, today's date)

### 7.2 Invoice Void/Cancel
**What**: Proper void workflow instead of just delete
**Why**: Audit trail, accounting accuracy

**Current**: Delete removes invoice
**Enhanced**:
- "Void" marks as cancelled with reason
- Maintains record for audit
- Can't void paid invoices

### 7.3 Send Reminder
**What**: Quick reminder email for overdue invoices
**Why**: Follow up on late payments

**Implementation**:
- Button on overdue invoices
- Template email with outstanding amount
- Track reminder history

---

## Excluded Features (Not Relevant for TL)

These Akaunting features are excluded as they don't fit our TL context:

| Feature | Reason for Exclusion |
|---------|---------------------|
| Multi-currency | TL uses USD exclusively |
| ACH/Wire transfers | Not common in TL banking |
| Tax jurisdiction management | TL has simple flat tax |
| Inventory management | Separate module if needed |
| Bank feed sync | TL banks don't support this |
| Stripe/PayPal integration | Limited adoption in TL |
| Complex chart of accounts | Small business focus |
| Budgeting module | Separate feature if needed |

---

## Implementation Order

1. **Phase 4** (Dashboard) - 1-2 days
   - Receivables widget
   - Payables widget
   - Enhanced cash flow

2. **Phase 5** (Payment Recording) - 1 day
   - Simple payment modal
   - Integration points

3. **Phase 6** (Recurring) - 2-3 days
   - Data model
   - Firebase function
   - UI pages

4. **Phase 7** (Invoice Actions) - 1 day
   - Duplicate
   - Void
   - Reminders

---

## Technical Notes

### Firestore Structure for Recurring

```typescript
// tenants/{tid}/recurringInvoices/{id}
interface RecurringInvoice {
  id: string;
  customerId: string;
  customerName: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Timestamp;
  endDate?: Timestamp;
  endAfterOccurrences?: number;
  nextRunDate: Timestamp;
  autoSend: boolean;
  status: 'active' | 'paused' | 'completed';
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  taxRate: number;
  createdAt: Timestamp;
  lastGeneratedAt?: Timestamp;
  generatedCount: number;
}
```

### Payment Modal Component API

```typescript
interface RecordPaymentModalProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onPaymentRecorded: (payment: Payment) => void;
}
```

---

## Dependencies

- Existing: `invoiceService`, `customerService`, `billService`
- New: `recurringInvoiceService`
- Firebase Functions: `generateRecurringInvoices` (scheduled)

---

## Status

- [x] Phase 1: Dashboard basics - DONE
- [x] Phase 2: Invoice PDF & Timeline - DONE
- [x] Phase 3: Invoice Settings - DONE
- [x] Phase 4: Dashboard enhancements - DONE (ReceivablesWidget, PayablesSummaryWidget)
- [x] Phase 5: Quick payment recording - DONE (RecordPaymentModal)
- [x] Phase 6: Recurring invoices - DONE (types, service, list page, form)
- [x] Phase 7: Invoice actions - DONE (VoidInvoiceDialog, SendReminderDialog)

---

## Future Enhancements

### 1. Process All Due Button
**Priority**: Low (workaround exists)
**Effort**: Small

Add a "Process All Due" button to the Recurring Invoices page that manually triggers generation of all due recurring invoices at once. Useful until a Firebase cron is set up.

```typescript
// Already implemented in recurringInvoiceService:
await recurringInvoiceService.processAllDue(tenantId);
// Returns: { generated: number, errors: string[] }
```

**Implementation**:
- Add button to RecurringInvoices.tsx header
- Call `processAllDue()` on click
- Show toast with results

---

### 2. Firebase Scheduled Function
**Priority**: Medium (required for true automation)
**Effort**: Medium

Create a Firebase Cloud Function that runs daily to auto-generate recurring invoices.

```typescript
// functions/src/scheduled/processRecurringInvoices.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const processRecurringInvoices = functions.pubsub
  .schedule('0 6 * * *')  // 6 AM daily
  .timeZone('Asia/Dili')  // Timor-Leste timezone
  .onRun(async (context) => {
    const db = admin.firestore();
    const tenantsSnap = await db.collection('tenants').get();

    for (const tenant of tenantsSnap.docs) {
      // Get active recurring invoices due today or earlier
      const today = new Date().toISOString().split('T')[0];
      const dueRecurring = await db
        .collection(`tenants/${tenant.id}/recurring_invoices`)
        .where('status', '==', 'active')
        .where('nextRunDate', '<=', today)
        .get();

      for (const doc of dueRecurring.docs) {
        // Generate invoice using same logic as client service
        // Update nextRunDate, generatedCount, etc.
      }
    }
  });
```

**Dependencies**:
- Firebase Blaze plan (for scheduled functions)
- Move invoice generation logic to shared location

---

### 3. Email Integration
**Priority**: Medium
**Effort**: Medium-Large

Integrate email service for:
- Invoice delivery (when marked as sent)
- Payment reminders
- Auto-send for recurring invoices
- Payment confirmation receipts

**Recommended Service**: SendGrid (free tier: 100 emails/day)

**Implementation Steps**:
1. Set up SendGrid account and API key
2. Create email templates:
   - `invoice-sent.html` - New invoice notification
   - `payment-reminder.html` - Overdue reminder
   - `payment-received.html` - Receipt confirmation
3. Create Firebase Function or Edge Function for sending
4. Update client to trigger email sends

```typescript
// Example SendGrid integration
import sgMail from '@sendgrid/mail';

async function sendInvoiceEmail(invoice: Invoice, settings: InvoiceSettings) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const pdfBuffer = await generateInvoicePDF(invoice, settings);

  await sgMail.send({
    to: invoice.customerEmail,
    from: settings.companyEmail,
    subject: `Invoice ${invoice.invoiceNumber} from ${settings.companyName}`,
    html: renderTemplate('invoice-sent', { invoice, settings }),
    attachments: [{
      content: pdfBuffer.toString('base64'),
      filename: `${invoice.invoiceNumber}.pdf`,
      type: 'application/pdf',
    }],
  });
}
```

**TL-Specific Considerations**:
- Email deliverability to local domains (.tl)
- SMS fallback for customers without reliable email
- Portuguese/Tetum language templates

---

### 4. Customer Portal
**Priority**: Low
**Effort**: Large

Public-facing page where customers can view and pay invoices via the share link.

**Current State**:
- Invoices have `shareToken` field for public links
- `invoiceService.getShareUrl()` generates the URL

**Required Components**:
1. **Public Invoice View** (`/invoice/:token`)
   - No authentication required
   - Shows invoice details, line items, totals
   - Download PDF button
   - Payment status

2. **Online Payment** (optional)
   - Integration with local payment providers
   - TL options: Bank transfer instructions, Mobile money QR codes
   - International: Stripe (limited TL support)

3. **Mark as Viewed**
   - Track when customer opens the link
   - Update invoice status to "viewed"

```typescript
// Public route (no auth)
// pages/public/InvoiceView.tsx

export default function PublicInvoiceView() {
  const { token } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    // Fetch invoice by share token (public endpoint)
    // Mark as viewed if first access
  }, [token]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Company logo & info */}
      {/* Invoice details */}
      {/* Line items table */}
      {/* Totals */}
      {/* Payment instructions (bank details) */}
      {/* Download PDF button */}
    </div>
  );
}
```

**Security Considerations**:
- Tokens should be unguessable (UUID v4)
- Rate limiting on public endpoint
- Optional: Token expiration
