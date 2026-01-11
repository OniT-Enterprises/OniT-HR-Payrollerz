# OniT HR/Payroll - Timor-Leste Adaptation Roadmap

## Executive Summary

This document outlines the conversion of OniT HR/Payroll from a US-focused system to a **Timor-Leste first** HR, Payroll & Accounting SaaS platform. The goal is to create an all-in-one solution that eliminates the need for Excel-based payroll and QuickBooks.

---

## Phase 1: Payroll Engine Conversion (Priority: CRITICAL)

### 1.1 Tax System Changes

| Current (US) | Target (Timor-Leste) |
|--------------|----------------------|
| Progressive federal brackets (10-37%) | Flat 10% above $500/month |
| State taxes (varies) | No state tax |
| Social Security 6.2% + Medicare 1.45% | INSS: 4% employee + 6% employer |
| $168,600 SS wage base | No wage base limit |

**Timor-Leste Tax Rules (Law 8/2008):**
- **Residents**: 10% on income > $500/month
- **Non-residents**: 10% on ALL income (no threshold)
- **Withholding**: Employer responsible for monthly withholding
- **Per diem**: NOT taxable (travel allowances exempt)

### 1.2 Social Security (INSS) - Regime Contributivo

Based on Decree-Law 19/2016:
- **Employee contribution**: 4% of gross salary
- **Employer contribution**: 6% of gross salary
- **Base calculation**: Gross pay - Absences - Food allowance
- **Per diem**: Excluded from INSS calculation

### 1.3 Subsidio Anual (13th Month Salary)

Per Labor Code (Law 4/2012):
- **Amount**: One full month's salary
- **Due date**: By December 20th
- **Pro-rata**: For employees with < 12 months, calculate proportionally
- **Formula**: `(months_worked / 12) * monthly_salary`

### 1.4 Sick Leave Rules

Per Labor Code Article 42:
- Maximum 12 days per year with medical certificate
- First 6 days: 100% of daily wage
- Remaining 6 days: 50% of daily wage
- Medical certificate required

### 1.5 Working Hours & Overtime

- Standard: 44 hours/week maximum
- Daily: 8 hours standard
- Overtime rate: 150% of hourly rate
- Night shift premium: Additional percentage (company-defined)
- Holiday work: 200% of hourly rate

---

## Phase 2: Accounting Module (Priority: HIGH)

### 2.1 Why Accounting?

- Eliminate QuickBooks dependency
- Automatic journal entries from payroll
- Integrated financial reporting
- Tax authority compliance
- Complete business management solution

### 2.2 Core Accounting Features

#### Chart of Accounts (Plano de Contas)
Standard Timorese chart structure:
```
1xxx - Assets (Ativos)
  1100 - Cash & Bank
  1200 - Accounts Receivable
  1300 - Inventory
  1400 - Prepaid Expenses

2xxx - Liabilities (Passivos)
  2100 - Accounts Payable
  2200 - Salaries Payable
  2300 - Tax Payable (IRPC/IRPS)
  2400 - INSS Payable
  2500 - Loans & Borrowings

3xxx - Equity (Capital Proprio)
  3100 - Share Capital
  3200 - Retained Earnings

4xxx - Revenue (Receitas)
  4100 - Service Revenue
  4200 - Sales Revenue

5xxx - Expenses (Despesas)
  5100 - Salary Expense
  5200 - INSS Employer Expense
  5300 - Rent Expense
  5400 - Utilities
  5500 - Office Supplies
```

#### Journal Entries
- Manual entry capability
- Auto-generated from payroll
- Auto-generated from invoices
- Reversing entries support

#### Financial Reports
- Trial Balance (Balancete)
- Income Statement (Demonstracao de Resultados)
- Balance Sheet (Balanco)
- Cash Flow Statement
- Tax reports for DNRE (Direccao Nacional de Receitas do Estado)

### 2.3 Payroll-to-Accounting Integration

When payroll is approved, auto-generate journal entries:

```
DR 5100 Salary Expense           $10,000.00
DR 5200 INSS Employer (6%)          $600.00
    CR 2200 Salaries Payable                 $8,600.00
    CR 2300 Tax Payable (IRPS)               $1,000.00
    CR 2400 INSS Payable (10%)               $1,000.00
```

---

## Phase 3: Module Enhancements

### 3.1 Hiring Module
- [ ] SEFOPE registration PDF generator
- [ ] Work permit tracking (foreigners)
- [ ] Contract templates (Prazo Indeterminado, Prazo Certo)
- [ ] Probation period management
- [ ] AI candidate screening (future)

### 3.2 Staff Module
- [ ] Document uploads (BI, Passport, Electoral Card)
- [ ] Document expiry notifications
- [ ] Multi-contract support
- [ ] Emergency contact management
- [ ] Bank account details (BNU, Mandiri, ANZ format)

### 3.3 Time & Leave Module
- [ ] Fingerprint CSV import (ZKTeco, Anviz formats)
- [ ] Shift scheduling with drag-drop
- [ ] Shift swap requests
- [ ] TL sick leave rules (6+6 days)
- [ ] Maternity leave tracking
- [ ] Holiday calendar (TL public holidays)
- [ ] Late arrival logging & salary docking

### 3.4 Performance Module
- [ ] Warning letter generation
- [ ] 3-strike disciplinary workflow
- [ ] Supervisor mobile app integration
- [ ] Performance scorecards
- [ ] 360-degree reviews

### 3.5 Payroll Module
- [x] Basic payroll structure
- [ ] TL tax calculation
- [ ] INSS calculation
- [ ] Subsidio Anual
- [ ] Weekly sub-payroll
- [ ] Per diem tracking
- [ ] Loan deductions
- [ ] Bank transfer file generation
- [ ] Payslip by email/WhatsApp

### 3.6 Reports Module
- [ ] Monthly payroll summary
- [ ] INSS contribution report
- [ ] Tax withholding report
- [ ] Attendance reports
- [ ] Department cost analysis
- [ ] Custom report builder

### 3.7 Accounting Module (NEW)
- [ ] Chart of Accounts
- [ ] Journal Entries
- [ ] General Ledger
- [ ] Trial Balance
- [ ] Income Statement
- [ ] Balance Sheet
- [ ] Bank Reconciliation
- [ ] Invoice/Billing (future)
- [ ] Accounts Payable (future)
- [ ] Accounts Receivable (future)

---

## Phase 4: Multi-Tenant SaaS Architecture

### 4.1 Current State
- Single tenant implementation
- TenantContext exists but underutilized

### 4.2 Target State
- Full multi-tenant isolation
- Per-tenant customization
- Subscription management
- Usage-based billing

### 4.3 Tenant Data Model
```typescript
interface Tenant {
  id: string;
  name: string;              // Company name
  legalName: string;         // Legal registration name
  tin: string;               // TIN number
  businessType: 'SA' | 'Lda' | 'Unipessoal' | 'ENIN';
  address: string;
  logo?: string;

  // Subscription
  plan: 'starter' | 'professional' | 'enterprise';
  employeeLimit: number;

  // Settings
  payrollFrequency: PayFrequency[];
  workWeekHours: number;     // Default 44
  overtimeRate: number;      // Default 1.5

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Phase 5: Mobile Apps (Future)

### 5.1 Employee App (Android/iOS)
- View payslips
- Request leave
- View shift schedule
- Request shift swap
- View tax/INSS summary
- Year-end summary

### 5.2 Supervisor App
- Mark attendance
- Log late arrivals
- Request overtime
- Performance scoring
- Shift management

---

## Implementation Priority Order

### Sprint 1: Payroll Core (Week 1-2)
1. ~~Create TL constants file~~
2. ~~Rewrite tax calculations~~
3. ~~Add INSS calculations~~
4. ~~Add Subsidio Anual logic~~
5. ~~Update payroll UI for TL~~

### Sprint 2: Accounting Foundation (Week 3-4)
1. Create accounting types
2. Build Chart of Accounts
3. Create journal entry system
4. Build General Ledger
5. Add payroll integration

### Sprint 3: Time & Attendance (Week 5-6)
1. Shift scheduling
2. Fingerprint import
3. Late arrival tracking
4. Sick leave (TL rules)

### Sprint 4: Documents & Compliance (Week 7-8)
1. SEFOPE PDF generation
2. Document uploads
3. Contract templates
4. Warning letters

---

## Technical Decisions

### Database: Firebase Firestore
- Already configured
- Good for multi-tenant
- Real-time updates
- Offline support

### Hosting: Firebase Hosting
- Auto-deploy from GitHub
- SSL included
- CDN included

### Authentication: Firebase Auth
- Email/password
- Google sign-in
- Role-based access

### PDF Generation: @react-pdf/renderer
- Already installed
- Payslips
- SEFOPE forms
- Reports

---

## File Structure Changes

```
client/
├── lib/
│   └── payroll/
│       ├── constants-tl.ts      # TL-specific constants (NEW)
│       ├── calculations-tl.ts   # TL calculations (NEW)
│       └── subsidio-anual.ts    # 13th month logic (NEW)
│
├── lib/
│   └── accounting/              # NEW MODULE
│       ├── chart-of-accounts.ts
│       ├── journal-entries.ts
│       └── calculations.ts
│
├── types/
│   ├── payroll-tl.ts           # TL-specific types (NEW)
│   └── accounting.ts           # Accounting types (NEW)
│
├── services/
│   └── accountingService.ts    # Firebase accounting (NEW)
│
├── pages/
│   └── accounting/             # NEW PAGES
│       ├── ChartOfAccounts.tsx
│       ├── JournalEntries.tsx
│       ├── GeneralLedger.tsx
│       ├── TrialBalance.tsx
│       ├── IncomeStatement.tsx
│       └── BalanceSheet.tsx
```

---

## Timor-Leste Specific Constants

### Public Holidays 2024-2025
- January 1: New Year
- March/April: Good Friday, Easter
- May 1: Labor Day
- May 20: Independence Restoration Day
- August 30: Popular Consultation Day
- November 1: All Saints Day
- November 2: All Souls Day
- November 12: Santa Cruz Youth Day
- November 28: Independence Proclamation Day
- December 7: National Heroes Day
- December 8: Immaculate Conception
- December 25: Christmas
- Eid al-Fitr: Variable
- Eid al-Adha: Variable

### Minimum Wage
- Current: $115/month (2023)
- Check for updates annually

### Banking
- BNU (Banco Nacional Ultramarino)
- Mandiri
- ANZ
- BNCTL (Banco Nacional de Comercio de Timor-Leste)

---

## Success Metrics

1. **Payroll Accuracy**: 100% correct tax/INSS calculations
2. **Time Savings**: 80% reduction in payroll processing time
3. **Compliance**: Zero SEFOPE/INSS filing errors
4. **User Adoption**: 90% of HR tasks done in-app (not Excel)
5. **Accounting Integration**: Auto-generated journal entries for all payroll runs

---

## Next Steps

1. **Immediate**: Convert payroll constants and calculations to TL
2. **This Week**: Build accounting foundation
3. **Next Week**: Integrate payroll with accounting
4. **Ongoing**: Document everything in this file

---

*Document created: January 2026*
*Last updated: January 2026*
*Author: Claude Code Assistant*
