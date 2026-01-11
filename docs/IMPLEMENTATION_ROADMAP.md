# OniT HR/Payroll System - Implementation Roadmap

## Project Overview

Multi-tenant SaaS HR and Payroll web application for Timor-Leste market, initially targeting security guard companies with 2,000+ employees.

**Target Market**: Companies currently using Excel spreadsheets for payroll
**Key Pain Points**:
- Complex pay rate calculations (different clients/sites, shift timing)
- Attendance tracking and late arrival management
- Holiday/leave request workflow
- Accurate tax and social security calculations

---

## Timor-Leste Legal Requirements (Researched)

### Tax (Wage Income Tax - WIT)

| Employee Type | Tax Rate | Threshold |
|--------------|----------|-----------|
| **TL Resident** | 10% | First $500/month exempt |
| **Non-Resident** | 10% flat | No exemption |

**Calculation Example (Resident)**:
- Salary: $800/month
- Taxable: $800 - $500 = $300
- Tax: $300 × 10% = **$30**

**Payment**: Due by 15th of following month

Sources: [PWC Tax Summaries](https://taxsummaries.pwc.com/timor-leste/individual/taxes-on-personal-income), [Autoridade Tributária TL](https://attl.gov.tl/wage-income-tax/)

### Social Security (INSS)

| Contribution | Rate |
|-------------|------|
| **Employer** | 6% of gross |
| **Employee** | 4% of gross |
| **Total** | 10% |

**Exclusions from calculation**:
- Food allowance
- Per diem expenses

**Payment**: Due by 10th of following month

**Small Business Reduction**: Employers with ≤10 workers (60% Timorese) get reduced rate until 2026

Sources: [Pinnacle Dili](https://pinnacledili.com/insight/social-security-scheme-in-timor-leste), [Papaya Global](https://www.papayaglobal.com/countrypedia/country/timor-leste/)

### Working Hours & Overtime (Labor Code Law 4/2012)

| Type | Hours/Rate |
|------|------------|
| Standard work day | 8 hours |
| Maximum per week | **44 hours** |
| Overtime (first 2 hrs) | +50% |
| Overtime (beyond 2 hrs) | +100% |
| Sunday/Holiday work | +100% (some sources say 200%) |
| Max daily overtime | 4 hours |
| Max weekly overtime | 16 hours |

Sources: [Rivermate Working Hours](https://www.rivermate.com/guides/timor-leste/working-hours), [Global Expansion](https://www.globalexpansion.com/countrypedia/timor-leste)

### Leave Entitlements

| Leave Type | Entitlement | Payment |
|-----------|-------------|---------|
| **Annual Leave** | 12 working days/year | 100% paid |
| **Sick Leave** | 30 days/year (with medical cert) | Paid (see note) |
| **Maternity Leave** | 12 weeks (10 after birth) | 100% (employer or SS) |
| **Paternity Leave** | 5 consecutive working days | 100% paid |
| **Child Sick Care** | 5 days/year (child <10) | Unpaid |

**Sick Leave Note**: User spec states 12 days (6 @ 100%, 6 @ 50%) - need to verify against latest law

Sources: [Rivermate Leave Rights](https://www.rivermate.com/guides/timor-leste/leave), [Papaya Global](https://www.papayaglobal.com/countrypedia/country/timor-leste/)

### 13th Month (Subsídio Anual)

- **NOT mandatory** for private sector
- Public sector receives by government decree
- Many companies pay voluntarily by December 20th
- Pro-rata for employees with <12 months service

Sources: [Neeyamo](https://www.neeyamo.com/global-guide/timor-leste), [Government of TL](https://timor-leste.gov.tl/?p=35577)

### Minimum Wage

**$115 USD/month** (unchanged since 2012)

### Contract Types

| Type | Description |
|------|-------------|
| **Open-ended** | Permanent employment |
| **Fixed-term** | Defined duration with user-defined probation |
| **Agency** | Through staffing agency |

---

## Current Application State

### Navigation Structure (Completed)

```
Dashboard
├── People (Mega-menu)
│   ├── Staff: Employees, Add, Departments, Org Chart
│   ├── Hiring: Jobs, Candidates, Interviews, Onboarding, Offboarding
│   ├── Time & Leave: Time Tracking, Attendance, Leave, Schedules
│   └── Performance: Goals, Reviews, Training, Disciplinary
├── Payroll (Dropdown)
│   └── Run, History, Bank Transfers, INSS & Tax, Benefits, Deductions
└── Accounting (Dropdown)
    └── Chart of Accounts, Journal Entries, General Ledger, Trial Balance
```

### What's Built

| Feature | Status | Notes |
|---------|--------|-------|
| Navigation structure | ✅ Complete | 3-pillar design |
| Employee CRUD | ✅ Basic | Missing TL fields |
| Department management | ✅ Basic | Org chart needs work |
| Hiring workflow | ⚠️ Partial | Missing AI screening |
| Time tracking UI | ⚠️ Shell | No actual tracking |
| Leave requests UI | ⚠️ Shell | No workflow |
| Payroll run UI | ⚠️ Shell | **No calculations** |
| Accounting module | ✅ Good | Chart of accounts, GL, TB |
| Firebase integration | ✅ Working | Auth + Firestore |
| Multi-tenant | ⚠️ Basic | Context exists |

---

## Implementation Phases

### Phase 1: Core Setup & Employee Data (Foundation)

**Goal**: Complete setup wizard and employee profiles with TL-specific fields

#### 1.1 Settings/Setup Module
- [ ] HR Admin levels (Owner, HR Director, Senior HR, Junior HR)
- [ ] Company details form (legal name, TIN, address, logo, business type)
- [ ] Company structure wizard
  - [ ] Business sector selection
  - [ ] Work locations (multiple)
  - [ ] Departments with drag-drop org chart
  - [ ] Employee types/grades
- [ ] Payment structure configuration
  - [ ] Payment methods (Bank, Cash, Cheque)
  - [ ] Bank account details (payroll, tax, SS)
  - [ ] Payroll frequency (hourly, daily, weekly, bi-weekly, monthly)
  - [ ] Pay period dates
- [ ] Time-off policies configuration
  - [ ] Probation period before leave
  - [ ] Annual leave days
  - [ ] Sick leave rules (TL: 30 days with cert)
  - [ ] Maternity/paternity leave
  - [ ] Holiday carryover rules

#### 1.2 Employee Profile Enhancement
- [ ] TL-specific ID fields
  - [ ] Bilhete de Identidade (National ID) + image upload
  - [ ] Electoral Card number
  - [ ] SEFOPE work number + image
  - [ ] Passport (for foreigners) + expiry tracking
  - [ ] Work permit/visa + expiry tracking
- [ ] Document expiry alerts (30, 14, 7 days before)
- [ ] Emergency contact details
- [ ] Bank account for salary
- [ ] Contract type (Open-ended, Fixed-term, Agency)
- [ ] Probation period tracking
- [ ] SEFOPE registration PDF generator

### Phase 2: Time & Attendance

**Goal**: Accurate time tracking that feeds into payroll

#### 2.1 Attendance Import
- [ ] Fingerprint reader CSV import (standardized format)
- [ ] Manual time entry interface
- [ ] Paper attendance sheet scanning (future: AI OCR)

#### 2.2 Time Tracking
- [ ] Clock in/out records
- [ ] Late arrival logging with minutes
- [ ] Early departure logging
- [ ] Overtime tracking (auto-calculate after 44 hrs/week)
- [ ] Night shift detection and flagging

#### 2.3 Shift Management (Critical for Security Company)
- [ ] Shift template creation
- [ ] Drag-drop shift scheduler
- [ ] Employee availability tracking
- [ ] Different pay rates per client/site
- [ ] Shift swap requests with approval workflow
- [ ] Supervisor mobile interface for reporting

#### 2.4 Warning System
- [ ] Late arrival counter
- [ ] Warning letter generation (auto after threshold)
- [ ] 3-strike tracking for disciplinary
- [ ] Salary dock calculation

### Phase 3: Leave Management

**Goal**: Paperless leave workflow

#### 3.1 Leave Types Configuration
- [ ] Annual leave (12 days)
- [ ] Sick leave (30 days with cert requirement)
- [ ] Maternity leave (12 weeks)
- [ ] Paternity leave (5 days)
- [ ] Unpaid leave
- [ ] Custom leave types

#### 3.2 Leave Request Workflow
- [ ] Employee request submission (web + email + WhatsApp)
- [ ] Manager approval interface
- [ ] HR calendar view (all employee leave)
- [ ] Leave balance tracking
- [ ] Carryover rules engine
- [ ] Backup worker assignment

#### 3.3 Sick Leave Specific
- [ ] Medical certificate upload requirement
- [ ] Paid rate calculation (100% vs 50% based on days)
- [ ] Integration with attendance

### Phase 4: Payroll Engine (Most Critical)

**Goal**: Accurate, auditable payroll with TL tax compliance

#### 4.1 Payroll Configuration
- [ ] Pay periods (weekly, bi-weekly, monthly)
- [ ] Weekly sub-payroll → monthly rollup
- [ ] Pay date management
- [ ] Different pay rates per:
  - [ ] Employee grade
  - [ ] Client/site
  - [ ] Shift type (day/night/weekend)

#### 4.2 Earnings Calculation
- [ ] Base salary (hourly/daily/weekly/monthly)
- [ ] Overtime calculation
  - [ ] First 2 hours: +50%
  - [ ] Beyond 2 hours: +100%
  - [ ] Sunday/Holiday: +100%
- [ ] Allowances
  - [ ] Food allowance (exclude from SS)
  - [ ] Transport allowance
  - [ ] Per diem (exclude from tax AND SS)
- [ ] Bonuses
- [ ] Sales commission
- [ ] Subsídio Anual (13th month pro-rata)

#### 4.3 Deductions Calculation
- [ ] **Tax (WIT)**
  - [ ] Resident: 10% above $500
  - [ ] Non-resident: 10% flat
- [ ] **Social Security (INSS)**
  - [ ] Employee: 4%
  - [ ] Employer: 6%
  - [ ] Exclude food allowance
  - [ ] Exclude per diem
- [ ] Absence deductions
- [ ] Late arrival deductions
- [ ] Company loans (with repayment schedule)
- [ ] Court orders
- [ ] Private insurance

#### 4.4 Payroll Run Interface
- [ ] Employee selector (all, by department, by frequency)
- [ ] Pre-run validation checks
- [ ] Draft → Review → Approve workflow
- [ ] Approval by designated person (configurable)
- [ ] Payroll summary dashboard
- [ ] Individual payslip preview

#### 4.5 Payslip Generation
- [ ] PDF generation
- [ ] Email delivery
- [ ] WhatsApp delivery
- [ ] Monthly and YTD totals
- [ ] Tax paid YTD
- [ ] SS contributions (employee + employer)

#### 4.6 Bank Integration
- [ ] Bank transfer file generation (Excel format for bank upload)
- [ ] Separate files for:
  - [ ] Salary payments
  - [ ] Tax payments
  - [ ] SS payments

### Phase 5: Hiring Module

**Goal**: Streamlined recruitment with AI assistance

#### 5.1 Job Posting
- [ ] Job creation form with all fields
- [ ] Two-person approval workflow
- [ ] Social sharing (Facebook, LinkedIn)
- [ ] Job portal integration

#### 5.2 Candidate Management
- [ ] CV/cover letter upload
- [ ] AI screening and shortlisting
- [ ] Candidate ranking
- [ ] Interview selection letter (email)

#### 5.3 Interview Management
- [ ] Jury selection from staff
- [ ] Calendar integration
- [ ] Score card creation
- [ ] Criminal/reference check tracking

#### 5.4 Onboarding
- [ ] Onboarding checklist
- [ ] Company handbook generation
- [ ] Policy acknowledgment form
- [ ] Document collection workflow
- [ ] SEFOPE registration

#### 5.5 Offboarding
- [ ] Resignation processing
- [ ] Redundancy (compensation calculation)
- [ ] Dismissal workflow
- [ ] Exit checklist
- [ ] Account deactivation

### Phase 6: Performance & Disciplinary

**Goal**: Track and manage employee performance

#### 6.1 Performance Reviews
- [ ] Review schedule (weekly/monthly/quarterly/annual)
- [ ] Scorecard templates
- [ ] 360-degree feedback
- [ ] Manager/supervisor mobile access

#### 6.2 Disciplinary System
- [ ] Warning letter generation
- [ ] 3-strike tracking
- [ ] Disciplinary hearing workflow
- [ ] Documentation trail

### Phase 7: Loans & Expenses

#### 7.1 Employee Loans
- [ ] Loan request submission
- [ ] Approval workflow
- [ ] Repayment schedule
- [ ] Auto-deduction from salary

#### 7.2 Per Diem & Expenses
- [ ] Per diem rate configuration
- [ ] Trip request with days and rate
- [ ] Pre-payment or salary addition option
- [ ] Exclude from tax/SS calculations

### Phase 8: Reports

- [ ] Payroll summary by month/department/week
- [ ] Tax payment reports
- [ ] SS contribution reports
- [ ] Bank transfer reports
- [ ] Attendance reports (good/poor)
- [ ] Leave calendar
- [ ] Holiday schedule
- [ ] Custom report builder

### Phase 9: Mobile App (Future)

**Employee Self-Service App**:
- [ ] Pay date and amount
- [ ] Tax paid (monthly and YTD)
- [ ] SS contributions
- [ ] Leave balance and requests
- [ ] Shift schedule view
- [ ] Shift swap requests
- [ ] End of year summary

---

## Technical Considerations

### Database Schema Additions Needed

```typescript
// TL-specific employee fields
interface EmployeeTL {
  bilheteIdentidade: {
    number: string;
    imageUrl?: string;
    expiryDate?: Date;
  };
  electoralCard?: string;
  sefopeNumber?: {
    number: string;
    imageUrl?: string;
  };
  passport?: {
    number: string;
    nationality: string;
    expiryDate: Date;
    imageUrl?: string;
  };
  workPermit?: {
    number: string;
    type: 'visa' | 'residence';
    expiryDate: Date;
    imageUrl?: string;
  };
  taxResidency: 'resident' | 'non-resident';
  socialSecurityNumber?: string;
}

// Payroll calculation
interface PayrollEntry {
  employeeId: string;
  period: { start: Date; end: Date };
  earnings: {
    baseSalary: number;
    overtime: { hours: number; amount: number };
    allowances: { type: string; amount: number; taxable: boolean; ssApplicable: boolean }[];
    bonuses: number;
    perDiem: { days: number; rate: number; total: number }; // Not taxed
  };
  deductions: {
    tax: { rate: number; threshold: number; amount: number };
    socialSecurity: { employeeRate: number; amount: number };
    absences: { days: number; amount: number };
    lateArrivals: { minutes: number; amount: number };
    loans: { loanId: string; amount: number }[];
    other: { type: string; amount: number }[];
  };
  employerContributions: {
    socialSecurity: number; // 6%
  };
  netPay: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'paid';
}
```

### Integration Points

1. **Fingerprint Readers**: CSV import standardization
2. **Banks**: Excel file format for bulk transfers
3. **Email**: SMTP for payslip delivery
4. **WhatsApp**: Business API for notifications
5. **SEFOPE**: PDF generation for registration

---

## Priority Order

1. **Settings/Setup** - Foundation for everything
2. **Employee Enhancement** - TL-specific fields
3. **Payroll Engine** - Core business value
4. **Time & Attendance** - Feeds payroll
5. **Leave Management** - Affects payroll
6. **Reports** - Management visibility
7. **Hiring** - Support function
8. **Performance** - Nice to have
9. **Mobile App** - Future phase

---

## Open Questions

1. **Sick Leave**: User spec says 12 days (6 @ 100%, 6 @ 50%) but research shows 30 days. Need to clarify with TL labor attorney.

2. **13th Month**: Is this mandatory for client's company or voluntary?

3. **Bank File Format**: What format does their bank accept for bulk transfers?

4. **Fingerprint Reader**: What brand/model? What's the CSV export format?

5. **Client/Site Pay Rates**: How many different rates? How are they structured?

6. **Warning Letter Templates**: Do they have existing templates in Tetun?

---

## Sources

- [Papaya Global - Timor-Leste Payroll Guide](https://www.papayaglobal.com/countrypedia/country/timor-leste/)
- [PWC Tax Summaries - Timor-Leste](https://taxsummaries.pwc.com/timor-leste/individual/taxes-on-personal-income)
- [Autoridade Tributária Timor-Leste](https://attl.gov.tl/wage-income-tax/)
- [Pinnacle Dili - Social Security](https://pinnacledili.com/insight/social-security-scheme-in-timor-leste)
- [Rivermate - Working Hours](https://www.rivermate.com/guides/timor-leste/working-hours)
- [Rivermate - Leave Rights](https://www.rivermate.com/guides/timor-leste/leave)
- [Global Expansion - Timor-Leste Guide](https://www.globalexpansion.com/countrypedia/timor-leste)
- [ILO NATLEX - Labor Code Law 4/2012](https://www.ilo.org/dyn/natlex/natlex4.detail?p_lang=en&p_isn=89742)
