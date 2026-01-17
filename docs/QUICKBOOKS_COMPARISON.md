# OniT vs QuickBooks: Feature Comparison & Integration Strategy

## Executive Summary

QuickBooks Online is the dominant SMB accounting platform globally but has **zero Timor-Leste localization**. OniT owns the compliance layer that QuickBooks cannot provide. The strategic question: should OniT expand into general accounting, or focus on payroll/HR excellence with QuickBooks integration?

**Recommendation**: Keep OniT payroll-scoped, build QuickBooks export capability.

---

## Feature Matrix

### What OniT Does That QuickBooks Cannot

| Feature | OniT | QuickBooks | Notes |
|---------|------|------------|-------|
| **WIT Tax Calculation** | ✅ Automatic | ❌ None | 10% withholding, $500 resident threshold |
| **INSS Social Security** | ✅ 4%+6% | ❌ None | Employee + employer contributions |
| **13th Month Salary** | ✅ Automatic | ❌ None | Subsidio Anual, Dec 20 deadline, prorated |
| **Lei Trabalho Compliance** | ✅ Built-in | ❌ None | 44-hour weeks, overtime 150%/200% |
| **SEFOPE Registration** | ✅ Tracking | ❌ None | Labor ministry compliance |
| **Tetum/Portuguese UI** | ✅ Full | ❌ English only | Critical for local adoption |
| **TL Holiday Calendar** | ✅ Built-in | ❌ None | Independence Day, Heroes Day, etc. |
| **Employee Compliance Tracking** | ✅ Documents | ❌ None | Bilhete Identidade, work permits |

### What QuickBooks Does Well (Generic Accounting)

| Feature | QuickBooks | OniT Current | Strategic Decision |
|---------|------------|--------------|-------------------|
| **Custom Invoicing** | ✅ Full | ❌ None | Don't build - out of scope |
| **Accounts Receivable** | ✅ Full | ❌ None | Don't build - out of scope |
| **Accounts Payable** | ✅ Full | ❌ None | Don't build - out of scope |
| **Expense Tracking** | ✅ Full | ❌ None | Don't build - out of scope |
| **Bank Reconciliation** | ✅ Automatic | ❌ None | Don't build - out of scope |
| **Receipt Scanning** | ✅ Mobile app | ❌ None | Don't build - out of scope |
| **Inventory Management** | ✅ Some plans | ❌ None | Don't build - out of scope |
| **65+ Reports** | ✅ Full suite | ⚠️ Basic | Keep payroll-focused reports |
| **Multi-user (25)** | ✅ Advanced | ✅ Firebase | Already have |
| **Chart of Accounts** | ✅ Full | ✅ Basic | Keep payroll-relevant accounts |
| **Journal Entries** | ✅ Full | ✅ Full | Already have |
| **General Ledger** | ✅ Full | ✅ Full | Already have |
| **Trial Balance** | ✅ Full | ✅ Full | Already have |

### Overlap: What Both Do

| Feature | Comparison |
|---------|------------|
| **Payroll Journal Posting** | OniT auto-generates; QB requires manual entry or import |
| **Financial Reports** | QB has more; OniT has payroll-specific (WIT, INSS, 13th) |
| **Cloud-based** | Both ✅ |
| **Multi-user** | Both ✅ |

---

## Strategic Options

### Option A: Stay Payroll-Scoped + Build QB Export ⭐ RECOMMENDED

**What to build:**
1. **QuickBooks Journal Export** - Generate QB-compatible journal entries from payroll
2. **CSV/IIF Export** - Standard import format for QB Desktop and Online
3. **Account Mapping UI** - Let user map OniT accounts to their QB chart of accounts

**Benefits:**
- OniT remains focused on what QuickBooks *cannot* do
- No feature bloat
- Users get best of both worlds
- Lower development cost
- Clear market positioning: "OniT for payroll, QuickBooks for accounting"

**User workflow:**
```
OniT                          QuickBooks
├── Run Payroll               ├── Invoices
├── Calculate WIT/INSS        ├── Bills
├── Track 13th month          ├── Expenses
├── Generate journal entry →→ │── Import payroll journal
├── Compliance reports        ├── Bank reconciliation
└── HR/People management      └── Financial statements
```

### Option B: Build Full Accounting (NOT RECOMMENDED)

**What would need to be built:**
- Invoicing system (templates, sending, payment tracking)
- Bills/Accounts Payable
- Vendor management
- Customer management
- Expense tracking with receipt scanning
- Bank feed integration (complex, requires bank partnerships)
- Inventory management
- 40+ additional reports

**Why not:**
- 12-18 months of development
- Competing with $7B company on their core product
- Distracts from TL compliance advantage
- Banks in TL may not support feed integration
- Users would still want QuickBooks for its ecosystem

### Option C: Hybrid - Add Basic Invoicing Only

**Scope:**
- Simple invoice creation
- Customer list
- A/R tracking
- Payment recording

**Why maybe:**
- Some NGOs/SMBs don't have QuickBooks
- Invoicing is a common need
- Doesn't require bank integration

**Why probably not:**
- Still significant scope creep
- Half-baked invoicing is worse than none
- Users will compare to QuickBooks and be disappointed

---

## Recommended Implementation: QuickBooks Export

### Phase 1: Journal Entry Export (MVP)

**Feature:** Export payroll journal entries in QuickBooks-compatible format

**Supported formats:**
1. **CSV** - Universal, works with QB Online import tools
2. **IIF** - QuickBooks Desktop format (still widely used)
3. **JSON** - For API integration (future)

**Journal entry structure:**
```
Date,RefNumber,Account,Debit,Credit,Memo,Name
2026-01-31,PAY-2026-01,Salary Expense,45000.00,,January Payroll,
2026-01-31,PAY-2026-01,WIT Payable,,4500.00,10% withholding,
2026-01-31,PAY-2026-01,INSS Employee,,1800.00,4% employee,
2026-01-31,PAY-2026-01,INSS Employer,,2700.00,6% employer,
2026-01-31,PAY-2026-01,INSS Expense,2700.00,,,
2026-01-31,PAY-2026-01,Net Payroll Payable,,38700.00,To be paid,
```

**UI Location:** Payroll History → View Payrun → Export to QuickBooks

### Phase 2: Account Mapping

**Feature:** Settings page to map OniT accounts to QuickBooks chart of accounts

**Example mapping:**
| OniT Account | Default QB Account | User Override |
|--------------|-------------------|---------------|
| Salary Expense | 6000 - Payroll Expenses | [Dropdown] |
| WIT Payable | 2100 - Payroll Liabilities | [Dropdown] |
| INSS Payable | 2100 - Payroll Liabilities | [Dropdown] |
| Net Payroll | 1000 - Checking | [Dropdown] |

**UI Location:** Settings → Integrations → QuickBooks Export Settings

### Phase 3: Automated Export (Future)

**Feature:** Direct API integration with QuickBooks Online

**Requirements:**
- OAuth 2.0 authentication
- QuickBooks developer app registration
- Rate limiting handling
- Error recovery

**Complexity:** High - requires Intuit developer partnership and ongoing maintenance

**Recommendation:** Defer until there's proven demand for Phase 1/2

---

## What OniT Should Keep Building

Focus development on features QuickBooks cannot provide:

### Payroll Excellence
- [ ] Payroll adjustment entries (retroactive corrections)
- [ ] Partial payroll execution (exclude blocked employees) ✅ Done
- [ ] Compliance override with audit trail ✅ Done
- [ ] Catch-up payroll for excluded employees
- [ ] INSS submission file generation
- [ ] WIT filing report generation

### HR/Compliance
- [ ] Document expiry alerts
- [ ] Work permit renewal tracking
- [ ] SEFOPE registration reminders
- [ ] Leave delegation and auto-approve ✅ Deferred
- [ ] Employee compliance dashboard

### Reporting
- [ ] Donor reports by funding source ✅ Fields added
- [ ] 13th month accrual reports
- [ ] Year-end tax summaries
- [ ] Audit-ready compliance reports

### Integration
- [ ] QuickBooks journal export (CSV/IIF) ← **Build this**
- [ ] Account mapping settings
- [ ] Export history log

---

## Competitive Positioning

### OniT's Tagline Options

> "Payroll compliance for Timor-Leste. Accounting integration for everywhere else."

> "We handle Lei Trabalho. You handle everything else."

> "The payroll system QuickBooks wishes it had for Timor-Leste."

### Target User Segments

1. **NGOs** - Need donor reporting + TL compliance + QuickBooks for grants
2. **Hotels/Tourism** - High staff turnover, strict labor law, use QB for operations
3. **Construction** - Project-based payroll, subcontractors in QB
4. **Retail** - Simple payroll needs, inventory in QB
5. **Professional Services** - Time-based billing in QB, payroll in OniT

---

## Decision Matrix

| Factor | Full Accounting | QB Export | Status Quo |
|--------|-----------------|-----------|------------|
| Development time | 12-18 months | 2-4 weeks | 0 |
| Market positioning | Diluted | Strengthened | Clear |
| User value | Moderate | High | Low |
| Maintenance burden | High | Low | None |
| Competitive moat | Weakened | Strengthened | Same |
| Revenue potential | Unknown | Indirect | Same |

**Verdict:** Build QuickBooks export. Stay focused.

---

## Sources

- [QuickBooks Online Features](https://quickbooks.intuit.com/online/)
- [QuickBooks Pricing & Plans](https://quickbooks.intuit.com/pricing/)
- [QuickBooks API Integration](https://www.merge.dev/blog/quickbooks-api)
- [Import Journal Entries to QBO](https://support.saasant.com/support/solutions/articles/14000143709-how-to-import-payroll-entries-as-journal-entries-into-quickbooks-online/)
- [QuickBooks Chart of Accounts](https://quickbooks.intuit.com/accounting/chart-accounts/)
- [Accounts Payable in QuickBooks](https://quickbooks.intuit.com/global/accounts-payable/)

---

*Document created: January 2026*
*Strategic recommendation: Build QuickBooks export, stay payroll-scoped*
