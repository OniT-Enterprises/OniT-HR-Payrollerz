# VAT Architecture — OniT Platform

## Context

Timor-Leste plans to implement Value Added Tax (VAT) from **2027** (per 2026 Budget Strategy and IMF Article IV). The exact rate, thresholds, and filing format are not yet confirmed. OniT needs to be ready.

### Current Tax Landscape (Pre-VAT)
- Sales Tax / Services Tax / Import Duty / Excise under Taxes and Duties Act 2008
- WIT (Withholding Income Tax): 10% on wages above $500/month
- INSS: 4% employee + 6% employer
- No VAT currently

### What VAT Means for Businesses
Every business above the registration threshold must:
1. Charge VAT on sales (output VAT)
2. Claim back VAT paid on purchases (input VAT)
3. Pay the net difference to the tax authority each period
4. Issue compliant tax invoices with specific fields
5. Keep records for audit (typically 5+ years)

---

## Design Principles

### 1. VAT is a Feature Flag, Not a Rebuild
- Meza web: VAT **disabled by default** — toggled on per tenant when TL implements it
- Kaixa mobile: Built **VAT-ready from day one** — data model captures VAT fields even when rate is 0%
- When VAT goes live: flip the flag, set the rate, existing data is already structured correctly

### 2. Three User Levels
```
Level 1: Kaixa-only user (kiosk owner)
  → Sees: "VAT collected this month: $X"
  → Does: Taps sale button, VAT auto-added
  → Gets: Compliant receipt with VAT breakdown

Level 2: Meza-only user (formal business, web)
  → Sees: Full VAT dashboard, return builder, filing export
  → Does: Creates invoices with per-line VAT, records purchase VAT
  → Gets: VAT return pack, audit trail, journal entries

Level 3: Both (business owner with Kaixa POS + Meza back office)
  → Kaixa sales sync to Meza
  → Meza aggregates all VAT (POS + invoices + bills + expenses)
  → One unified VAT return
```

### 3. Remotely Updatable Rules
VAT rates, thresholds, exemptions, and filing templates live in a config that can be updated without app redeployment:
- Firestore document: `platform/vatConfig`
- Cached locally on device for offline
- When law finalizes: update config, push notification to users

---

## Data Model

### VAT Config (Platform-Level)
```typescript
// Firestore: platform/vatConfig
interface VATConfig {
  enabled: boolean;                    // Global kill switch
  effectiveDate: string;               // "2027-01-01" — when VAT starts

  standardRate: number;                // e.g., 10 (percent)
  reducedRates: {                      // If TL implements multiple rates
    rate: number;
    label: string;                     // "Reduced", "Tourism"
    categories: string[];              // Item categories this applies to
  }[];

  registrationThreshold: number;       // Annual revenue threshold for mandatory registration
  filingFrequency: 'monthly' | 'quarterly';

  // Exempt categories (no VAT charged, no input credit)
  exemptCategories: string[];          // e.g., ["health", "education", "financial_services"]

  // Zero-rated categories (0% VAT charged, input credit allowed)
  zeroRatedCategories: string[];       // e.g., ["exports", "international_transport"]

  // Required invoice fields (for compliance validation)
  requiredInvoiceFields: string[];

  updatedAt: Date;
  updatedBy: string;
}
```

### Tenant VAT Settings
```typescript
// Firestore: tenants/{tenantId}/settings/vat
interface TenantVATSettings {
  vatEnabled: boolean;                 // Per-tenant toggle (default: false)
  vatRegistered: boolean;              // Is this business VAT-registered?
  vatRegistrationNumber?: string;      // TIN / VAT ID
  vatRegistrationDate?: string;

  // Defaults
  defaultVATRate: number;              // Usually standardRate from config
  pricesIncludeVAT: boolean;           // true = shelf prices include VAT (common retail)

  // Filing
  filingFrequency: 'monthly' | 'quarterly';
  currentPeriodStart: string;
  currentPeriodEnd: string;

  // Thresholds
  annualRevenue?: number;              // For monitoring registration threshold

  updatedAt: Date;
}
```

### Transaction-Level VAT Fields

#### Kaixa Transactions (Mobile)
```typescript
// Extends existing Kaixa Transaction model
interface KaixaTransaction {
  id: string;
  type: 'in' | 'out';

  // Existing fields
  amount: number;                      // Total amount (VAT-inclusive if applicable)
  category: string;
  note: string;
  timestamp: Date;

  // NEW: VAT fields (always present, zero when VAT not active)
  netAmount: number;                   // Amount excluding VAT
  vatRate: number;                     // 0, 5, 10, etc.
  vatAmount: number;                   // Calculated VAT
  vatCategory: VATCategory;            // 'standard' | 'reduced' | 'zero' | 'exempt' | 'none'

  // NEW: Receipt compliance
  receiptNumber?: string;              // Sequential receipt number
  businessVatId?: string;              // Seller's VAT registration
  customerVatId?: string;              // Buyer's VAT ID (for B2B)

  // Sync
  syncedToMeza: boolean;               // Has this synced to Meza?
  mezaInvoiceId?: string;              // Linked Meza invoice (if synced)
}

type VATCategory = 'standard' | 'reduced' | 'zero' | 'exempt' | 'none';
```

#### Meza Invoice Line Items (Web)
```typescript
// Updated InvoiceItem — per-line VAT instead of invoice-level
interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;                   // Price before VAT (or including VAT if pricesIncludeVAT)
  amount: number;                      // quantity × unitPrice

  // NEW: Per-line VAT
  vatCategory: VATCategory;            // 'standard' | 'reduced' | 'zero' | 'exempt'
  vatRate: number;                     // Rate for this specific line
  vatAmount: number;                   // VAT on this line
  netAmount: number;                   // Amount excluding VAT
  grossAmount: number;                 // Amount including VAT
}
```

#### Meza Invoice (Updated)
```typescript
// Updated Invoice — backward compatible
interface Invoice {
  // ... existing fields ...

  // UPDATED: Tax breakdown (replaces single taxRate/taxAmount)
  subtotal: number;                    // Sum of line netAmounts
  taxRate: number;                     // KEPT for backward compat (primary rate)
  taxAmount: number;                   // KEPT for backward compat (total VAT)
  total: number;                       // subtotal + taxAmount

  // NEW: VAT-specific
  vatBreakdown?: {                     // Breakdown by rate (for mixed-rate invoices)
    rate: number;
    category: VATCategory;
    netAmount: number;
    vatAmount: number;
  }[];
  isVATInvoice: boolean;               // Was this created with VAT enabled?

  // NEW: Compliance
  supplierVatId?: string;              // From InvoiceSettings
  customerVatId?: string;              // From Customer.tin
}
```

#### Meza Expense/Bill (Updated)
```typescript
// Updated Expense — captures input VAT for credit
interface Expense {
  // ... existing fields ...

  // NEW: Input VAT
  vatRate?: number;
  vatAmount?: number;                  // Input VAT (claimable)
  netAmount?: number;                  // Amount excluding VAT
  vatCategory?: VATCategory;
  supplierVatId?: string;              // Vendor's VAT ID (required for credit)
  hasValidVATInvoice: boolean;         // Can we claim input VAT credit?
}

// Same pattern for Bill — per-line VAT like Invoice
```

### VAT Return
```typescript
// Firestore: tenants/{tenantId}/vatReturns/{periodId}
interface VATReturn {
  id: string;

  // Period
  periodStart: string;                 // "2027-01-01"
  periodEnd: string;                   // "2027-01-31"
  filingDeadline: string;              // periodEnd + X days

  // Output VAT (sales)
  outputVAT: {
    standardRate: { net: number; vat: number; };
    reducedRate?: { net: number; vat: number; };
    zeroRated: { net: number; vat: number; };   // vat = 0
    exempt: { net: number; };                     // no vat field
    total: number;                                // Total output VAT
  };

  // Input VAT (purchases)
  inputVAT: {
    domesticPurchases: { net: number; vat: number; };
    imports: { net: number; vat: number; };
    total: number;                                // Total input VAT
  };

  // Net
  netVATDue: number;                   // output.total - input.total

  // Status
  status: 'draft' | 'reviewed' | 'filed' | 'paid';

  // Drill-down references
  outputInvoiceIds: string[];          // Invoice IDs included
  outputTransactionIds: string[];      // Kaixa transaction IDs included
  inputBillIds: string[];
  inputExpenseIds: string[];

  // Filing
  filedAt?: Date;
  filedBy?: string;
  paymentReference?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## Shared VAT Engine (`@onit/shared`)

### `packages/shared/src/lib/vat/`

```typescript
// vat-config.ts — Default config, types
export interface VATRateConfig {
  standardRate: number;
  reducedRates: { rate: number; label: string; categories: string[] }[];
  exemptCategories: string[];
  zeroRatedCategories: string[];
}

export const DEFAULT_VAT_CONFIG: VATRateConfig = {
  standardRate: 0,           // 0 until VAT is implemented
  reducedRates: [],
  exemptCategories: [],
  zeroRatedCategories: [],
};

// vat-calculations.ts — Pure functions, no side effects
export function calculateVAT(netAmount: number, rate: number): {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
};

export function extractVAT(grossAmount: number, rate: number): {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
};

export function getVATRate(category: string, config: VATRateConfig): number;

export function calculateVATReturn(
  outputTransactions: { vatAmount: number; vatCategory: VATCategory }[],
  inputTransactions: { vatAmount: number; hasValidInvoice: boolean }[],
): { outputTotal: number; inputTotal: number; netDue: number };

// vat-invoice.ts — Invoice compliance
export function generateReceiptNumber(prefix: string, sequence: number): string;

export function validateVATInvoice(invoice: {
  supplierVatId?: string;
  items: { vatRate: number; vatAmount: number }[];
  total: number;
}): { valid: boolean; errors: string[] };

export function formatVATBreakdown(items: {
  vatRate: number;
  vatCategory: VATCategory;
  netAmount: number;
  vatAmount: number;
}[]): VATBreakdownLine[];
```

---

## Integration Flows

### Flow 1: Kaixa-Only User (Kiosk Owner)

```
Maria opens Kaixa → taps "Osan Tama" → enters $5.00 sale
                                         ↓
                              App checks VAT config
                              (cached from Firestore)
                                         ↓
                              If VAT enabled + rate 10%:
                                net = $4.55, vat = $0.45
                              If VAT not active:
                                net = $5.00, vat = $0.00
                                         ↓
                              Transaction saved locally
                              (SQLite / WatermelonDB)
                                         ↓
                              When online: sync to Firestore
                              tenants/{tenantId}/transactions/{id}
                                         ↓
                              VAT dashboard shows:
                              "VAT collected this month: $47.00"
                              "VAT paid on purchases: $12.00"
                              "Net VAT due: $35.00"
```

### Flow 2: Meza-Only User (Formal Business)

```
Ana opens Meza web → creates invoice for customer
                      ↓
           Each line item has VAT category
           (standard/reduced/zero/exempt)
                      ↓
           VAT auto-calculated per line
           Invoice total = subtotal + VAT
                      ↓
           Invoice saved to Firestore
           Journal entry auto-created:
             DR Accounts Receivable (gross)
             CR Revenue (net)
             CR VAT Output Payable (vat)
                      ↓
           End of month: VAT Return page
           Output VAT from invoices
           Input VAT from bills/expenses
           Net due = output - input
                      ↓
           Export filing pack (PDF/CSV)
```

### Flow 3: Both (Kaixa POS + Meza Back Office)

```
Daily sales via Kaixa POS → sync to Firestore
                              ↓
Meza web dashboard aggregates:
  - Kaixa POS transactions (output VAT)
  - Web invoices (output VAT)
  - Bills received (input VAT)
  - Expenses (input VAT)
                              ↓
Single unified VAT return
covering ALL sales channels
```

---

## Meza VAT Feature Flag

### How It Works

```typescript
// In tenant settings (Firestore)
tenants/{tenantId}/settings/vat: {
  vatEnabled: false,    // ← Default for all tenants
  // ... rest of settings
}
```

**When vatEnabled = false (current state):**
- Invoice form shows single `taxRate` field (as it does today)
- No VAT breakdown on invoices
- No VAT dashboard/return pages
- No VAT columns in reports
- Existing behavior is 100% unchanged

**When vatEnabled = true (after VAT law):**
- Invoice form shows per-line VAT category selector
- VAT breakdown on invoice PDF
- New sidebar item: "VAT Returns"
- VAT columns appear in P&L, trial balance
- New accounts auto-created: VAT Output Payable, VAT Input Receivable
- Expenses/bills get VAT input fields

### Activation Flow

```
Admin → Settings → Tax Configuration
  ↓
  "Enable VAT" toggle (with confirmation dialog)
  ↓
  Enter VAT registration number
  Set default VAT rate (from platform config)
  Set filing frequency
  Choose: prices include VAT? (yes for retail, no for services)
  ↓
  System auto-creates:
    - Account 2270: VAT Output Payable
    - Account 2280: VAT Input Receivable
    - Account 5160: VAT Expense (irrecoverable VAT)
  ↓
  Done. All new invoices/bills/expenses are VAT-aware.
  Historical data is untouched.
```

---

## Kaixa VAT-Ready Design

### Day One (Before VAT)
- Every transaction stores `vatRate: 0, vatAmount: 0, vatCategory: 'none'`
- Receipt shows total only (no VAT line)
- No VAT dashboard visible
- Data structure is ready, UI is clean

### Day VAT Goes Live
- Platform config updates: `standardRate: 10` (or whatever TL sets)
- Kaixa fetches new config on next sync
- New transactions auto-calculate VAT
- Receipt now shows: "Total $5.50 (incl. VAT $0.50)"
- VAT dashboard appears: collected / paid / net due
- Business settings prompt: "Register your VAT number"

### No App Update Required
Because the rate lives in Firestore config, not in the app code. Users don't need to update the app — it just starts working.

---

## Receipt Compliance

### Minimum Fields (Expected for TL VAT)

Based on international standards (likely requirements):

```
┌────────────────────────────┐
│ BUSINESS NAME              │
│ VAT Reg: TL-12345678       │
│ Address line               │
│                            │
│ Receipt #: R-2027-0001     │
│ Date: 15/01/2027 14:30     │
│                            │
│ Items:                     │
│ Coffee          $2.00      │
│ Pastéis         $1.50      │
│                            │
│ Subtotal:       $3.50      │
│ VAT (10%):      $0.35      │
│ TOTAL:          $3.85      │
│                            │
│ Payment: Cash              │
│                            │
│ Customer VAT ID: ________  │
│ (optional for B2C)         │
└────────────────────────────┘
```

### Sequential Numbering
- Receipts MUST be sequentially numbered with no gaps
- Format: `{prefix}-{year}-{sequence}` → `R-2027-0001`
- Sequence stored in Firestore, incremented atomically
- Offline: reserve blocks of numbers (e.g., 100 at a time)

---

## Migration Strategy

### Phase 1: VAT-Ready Data (Now)
- Add VAT fields to all types (optional, nullable)
- Shared VAT engine with zero-rate default
- Kaixa transactions capture VAT fields (all zeros)
- No UI changes in Meza (vatEnabled = false)

### Phase 2: Kaixa VAT UI (Before 2027)
- VAT dashboard in Kaixa
- Receipt VAT breakdown
- Business VAT registration in profile
- Purchase VAT capture (photo receipt + VAT amount)

### Phase 3: Meza VAT Module (When Law Finalizes)
- Per-line VAT on invoices
- VAT Return builder page
- VAT filing export
- Chart of Accounts: VAT accounts
- Toggle activation flow

### Phase 4: Filing Integration (When Format Known)
- Government filing format integration
- Direct submission API (if TL builds one)
- Accountant export templates

---

## Customs/Import VAT (Timor-Specific)

Imports are a huge part of TL economy. VAT paid at customs is input VAT (claimable).

```typescript
interface ImportRecord {
  id: string;
  date: string;

  // Customs
  customsDeclarationNumber: string;
  portOfEntry: string;                 // Dili, etc.

  // Goods
  description: string;
  hsCode?: string;                     // Harmonized System code

  // Amounts
  cifValue: number;                    // Cost + Insurance + Freight
  importDuty: number;
  exciseDuty?: number;
  vatPaid: number;                     // VAT paid at border (input VAT)
  totalLandedCost: number;

  // Documents
  attachmentUrls?: string[];

  // VAT credit
  vatCredited: boolean;                // Included in VAT return?
  vatReturnId?: string;

  createdAt: Date;
}
```

This is a future feature but the data model should be ready.

---

## File Structure

```
packages/shared/src/
├── lib/
│   ├── vat/
│   │   ├── vat-config.ts          # Types, defaults, VATCategory
│   │   ├── vat-calculations.ts    # calculateVAT, extractVAT, getVATRate
│   │   ├── vat-invoice.ts         # Receipt numbering, validation
│   │   └── vat-return.ts          # Return calculation from transactions
│   └── ...existing...

mobile/                             # Kaixa
├── lib/
│   └── vat.ts                     # Mobile-specific VAT helpers (config caching)
├── stores/
│   └── vatStore.ts                # VAT config state, cached from Firestore
└── app/(tabs)/
    └── vat.tsx                    # VAT dashboard (hidden until enabled)

client/                             # Meza web
├── types/
│   └── money.ts                   # Updated with VAT fields
├── pages/money/
│   └── VATReturns.tsx             # VAT return builder (hidden until enabled)
└── services/
    └── vatService.ts              # VAT return CRUD, filing export
```
