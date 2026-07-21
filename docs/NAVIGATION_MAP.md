# OniT HR/Payroll Navigation Map

## The One-Sentence Philosophy

> **Hubs help users decide. Work pages help users finish. Never mix the two.**

This explains:
- Why hubs have boxes (orientation) and work pages have tables (execution)
- Why hubs are skippable for power users
- Why deep pages feel "quiet" and focused
- How to prevent feature creep from breaking the UI

---

## Navigation Philosophy

> **Navigation should reflect how often something is used, not how important it is conceptually.**

### The Decision Rule
When designing any page, ask:
- **"Is the user deciding what to do?"** → Hub with boxes
- **"Is the user already doing it?"** → Work page with tables/tabs/filters

---

## Three-Layer Navigation System

### Layer 1: Global Navigation (Always Visible)
Purpose: Switch between domains of work.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  [Logo]   Dashboard   People   Time & Leave   Payroll   Money   Accounting   Workforce Reports   ⚙️  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Rules:
- Always flat, no dropdowns
- No deep links
- Answers: "What area am I working in?"

---

### Layer 2: Section Hubs (Boxes Allowed)
Purpose: Orient users when entering a section.

| Hub | URL | Skippable? | Notes |
|-----|-----|------------|-------|
| Dashboard | `/` | No | Command center, always needed |
| People Hub | `/people` | Yes | **Compliance-first**, then navigation. Power users → `/people/employees` |
| Time & Leave | `/time-leave` | Yes | Attendance, leave, and weekly shifts |
| Payroll Hub | `/payroll` | Yes | Power users → direct to `/payroll/run` |
| Money Hub | `/money` | Yes | **Day-to-day AR/AP** for small businesses. Power users → `/money/invoices` |
| Accounting Hub | `/accounting` | Yes | Books, statements, reconciliation, and business tax. Power users → `/accounting/journal` |
| Workforce Reports Hub | `/reports` | Soft | Payroll, people, attendance, NGO, and custom reports |

Rules:
- Boxes/cards are GOOD here
- Separate: Status → Actions → Tools
- Should be optional after familiarity

### Hub Priority Guidelines

**People Hub** = Compliance & risk first, navigation second
- "Payroll blocked (5 issues)" is more important than "Org chart"
- Attention Required section stays dominant
- Navigation boxes have lower visual weight

**Money Hub** = Day-to-day AR/AP for business owners
- Customer invoicing (USD)
- Vendor bills & expenses
- Receivable and payable aging
- Receipt upload (mobile-friendly)
- Designed for: Small business owners completing day-to-day money tasks

**Accounting Hub** = Advanced ledger & compliance for accountants
- Payroll journals (auto-posted from payroll)
- Chart of Accounts management
- General Ledger detail
- Bank reconciliation and formal financial statements
- Business tax: annual income tax, tax clearance, and VAT
- Designed for: Accountants, auditors, and compliance officers
- Do NOT add: Invoices, Bills, Expenses (those live in Money)

**Workforce Reports Hub** = Workforce reporting and exports
- Payroll, employee, attendance, and department reports
- NGO/donor packs and custom reports
- No financial statements or statutory filing workflow; those live in Accounting or Payroll

---

### Layer 3: Work Pages (No Boxes)
Purpose: Do the actual work.

Rules:
- Tables, filters, tabs, inline actions
- Assume user intent
- No "choose what you want to do" patterns

---

## Complete Site Map

```
OniT HR/Payroll
│
├── Dashboard (/)                          [HUB - Command Center]
│   ├── Status cards (KPIs)
│   ├── Quick actions
│   └── Alerts/notifications
│
├── People (/people)                       [HUB - Skippable]
│   │
│   ├── Staff                              [Section]
│   │   ├── Employees (/people/employees)  [WORK PAGE]
│   │   │   └── Employee Profile (modal)
│   │   ├── Add Employee (/people/add)     [WORK PAGE - Form]
│   │   ├── Offboarding (/people/offboarding) [WORK PAGE]
│   │   ├── Announcements (/people/announcements) [WORK PAGE]
│   │   └── Grievances (/people/grievances) [WORK PAGE]
│   │
│   ├── Hiring                             [Section]
│   │   └── Jobs & Applicants (/people/jobs) [WORK PAGE]
│   │       ├── New Job (/people/jobs/new)
│   │       └── Onboarding checklist (contextual handoff; not in sidebar)
│   │
│   └── Performance                        [Section]
│       ├── Goals (/people/goals)
│       ├── Reviews (/people/reviews)
│       ├── Training (/people/training)
│       └── Disciplinary (/people/disciplinary)
│
├── Time & Leave (/time-leave)             [HUB - Skippable]
│   ├── Attendance (/time-leave/attendance)       [WORK PAGE — clock times + hours]
│   ├── Leave (/time-leave/leave)                 [WORK PAGE]
│   └── Shifts (/time-leave/shifts)               [WORK PAGE]
│
├── Payroll (/payroll)                     [HUB - Skippable]
│   │
│   ├── Run Payroll (/payroll/run)         [WORK PAGE - Wizard]
│   ├── History (/payroll/history)         [WORK PAGE]
│   ├── Payments (/payroll/payments)       [WORK PAGE]
│   ├── Benefits (/payroll/benefits)       [WORK PAGE]
│   ├── Deductions & Advances (/payroll/deductions) [WORK PAGE]
│   └── Payroll Tax & INSS                 [Section]
│       ├── Filing overview (/payroll/tax)
│       ├── Monthly WIT (/payroll/tax/monthly-wit) [ADVANCED]
│       ├── Monthly INSS (/payroll/tax/inss-monthly)
│       └── Annual INSS (/payroll/tax/inss-annual)
│
├── Money (/money)                         [HUB - Skippable]
│   │
│   ├── Invoices                           [Section]
│   │   ├── Invoices (/money/invoices)     [WORK PAGE]
│   │   ├── Customers (/money/customers)   [WORK PAGE]
│   │   ├── Payments (/money/payments)     [WORK PAGE]
│   │   └── AR Aging (/money/financials/ar-aging)
│   │
│   ├── Bills                              [Section]
│   │   ├── Bills (/money/bills)           [WORK PAGE]
│   │   ├── Vendors (/money/vendors)       [WORK PAGE]
│   │   └── AP Aging (/money/financials/ap-aging)
│   │
│   └── Expenses                           [Section]
│       ├── Expenses (/money/expenses)     [WORK PAGE]
│       └── Cash Advances (/money/cash-advances) [WORK PAGE]
│
├── Accounting (/accounting)               [HUB - Skippable]
│   │
│   ├── Chart of Accounts (/accounting/chart)
│   ├── Journal Entries (/accounting/journal)
│   ├── General Ledger (/accounting/ledger)
│   ├── Fixed Assets (/accounting/fixed-assets)
│   ├── Reconciliation (/accounting/reconciliation)
│   ├── Statements                         [Section]
│   │   ├── Trial Balance (/accounting/statements/trial-balance)
│   │   ├── Income Statement (/accounting/statements/income-statement)
│   │   ├── Balance Sheet (/accounting/statements/balance-sheet)
│   │   ├── Cash Flow (/accounting/statements/cash-flow)
│   │   ├── Fiscal Periods (/accounting/statements/fiscal-periods)
│   │   └── Audit Trail (/accounting/statements/audit-trail)
│   └── Business Tax                       [Section]
│       ├── Annual Income Tax (/accounting/tax/annual-income-tax)
│       ├── Tax Clearance (/accounting/tax/clearance) [ADVANCED]
│       ├── VAT Returns (/accounting/tax/vat-returns) [ADVANCED]
│       └── VAT Settings (/accounting/tax/vat-settings) [ADVANCED]
│
├── Workforce Reports (/reports)           [HUB]
│   │
│   ├── Payroll (/reports/payroll)
│   ├── Employees (/reports/employees)
│   ├── Attendance (/reports/attendance)
│   ├── Departments (/reports/departments)
│   ├── NGO & Donor                        [Section]
│   │   ├── Payroll Allocation (/reports/payroll-allocation)
│   │   └── Donor Export (/reports/donor-export)
│   └── Custom                             [Section]
│       ├── Custom Reports (/reports/custom)
│       └── Report Setup (/reports/setup)
│
└── Settings (/settings)                   [WORK PAGE - Tabs]
    ├── Organization tab
    ├── Users tab
    ├── Payroll Settings tab
    ├── Integrations tab
    └── Billing tab
```

---

## UI Patterns by Page Type

### Hubs (Layer 2)
```
┌──────────────────────────────────────────────────────────┐
│ [Icon] Section Title                        [Primary CTA]│
│ Subtitle / description                                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │ Status  │  │ Status  │  │ Status  │   ← Quick stats  │
│  │ Card 1  │  │ Card 2  │  │ Card 3  │                  │
│  └─────────┘  └─────────┘  └─────────┘                  │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐                       │
│  │   Tool 1    │  │   Tool 2    │        ← Boxes for   │
│  │  (click)    │  │  (click)    │          navigation  │
│  └─────────────┘  └─────────────┘                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Work Pages (Layer 3)
```
┌──────────────────────────────────────────────────────────┐
│ Page Title                              [Filter] [+ Add] │
├──────────────────────────────────────────────────────────┤
│ [Tab 1] [Tab 2] [Tab 3]                 ← If applicable │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐│
│ │ Search...                    [Status ▾] [Dept ▾]    ││
│ ├──────────────────────────────────────────────────────┤│
│ │ Column 1  │ Column 2  │ Column 3  │ Actions         ││
│ ├───────────┼───────────┼───────────┼─────────────────┤│
│ │ Data      │ Data      │ Data      │ [•••]           ││
│ │ Data      │ Data      │ Data      │ [•••]           ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

## When to Use Tabs vs Side Nav

### Use Tabs When:
- Content shares the same object
- Switching is frequent
- Examples: Employee Profile, Payroll Run steps, Settings

### Use Side Navigation When:
- Tools are related but distinct
- Users move between them deliberately
- Examples: Future Accounting tools sidebar, Reports categories

---

## Boxes: The Rules

### Boxes are GOOD for:
- First-time user orientation
- Section entry points (hubs)
- Conceptual grouping of tools

### Boxes are BAD for:
- Frequent navigation
- Inside workflows
- Data-heavy pages
- Anything after the hub level

---

## Quick Reference: Page Classification

| Page | Type | Boxes? | Primary Pattern |
|------|------|--------|-----------------|
| Dashboard | Hub | Yes | Status cards + quick actions |
| People Hub | Hub | Yes | Stats + tool cards |
| All Employees | Work | No | Table + filters |
| Employee Profile | Work | No | Tabs |
| Payroll Hub | Hub | Yes | Status + tool cards |
| Run Payroll | Work | No | Wizard steps |
| Payroll History | Work | No | Table + filters |
| Money Hub | Hub | Yes | Onboarding + stats + tool cards |
| Customers | Work | No | Table + filters |
| Invoices | Work | No | Table + filters + status |
| Vendors | Work | No | Table + filters |
| Bills | Work | No | Table + filters + status |
| Expenses | Work | No | Table + filters + receipt upload |
| Bank Reconciliation | Work | No | Table + CSV import + matching |
| Accounting Hub | Hub | Yes | Status + tool cards |
| Chart of Accounts | Work | No | Table + filters |
| Journal Entries | Work | No | Table + filters |
| Workforce Reports Hub | Hub | Yes | Workforce report families |
| Payroll Reports | Work | No | Table + generate actions |
| Settings | Work | No | Tabs |

---

## Primary Work Pages (Fast Access)

These pages get extra optimization - keyboard shortcuts, prominent placement:

| Page | Path | Why Primary |
|------|------|-------------|
| All Employees | `/people/employees` | Daily use for HR |
| Run Payroll | `/payroll/run` | Monthly critical path |
| Invoices | `/money/invoices` | Daily use for business owners |
| Expenses | `/money/expenses` | Frequent data entry |
| Journal Entries | `/accounting/journal` | Most-used accounting tool |
| Payroll Reports | `/reports/payroll` | Most-used reports |
| Leave Requests | `/time-leave/leave` | Frequent approvals |

---

## Power User Paths (Month-End Workflow)

What does a payroll officer click *every month*? Optimize this path mercilessly.

### Monthly Payroll Cycle
```
1. People Hub → Check "Attention Required" (blocked employees)
2. Leave Requests → Approve pending requests
3. Attendance → Check missing records and payroll-ready hours
4. Run Payroll → Select → Review → Taxes → Confirm & Process
5. Journal Entries → Verify payroll posted correctly
6. Payroll Tax & INSS → Prepare WIT and INSS filings
7. Bank Transfers → Process payments
```

### Quick Checks (Weekly)
```
- Dashboard → KPIs, alerts
- Leave Requests → Pending approvals
- People Hub → Compliance status
```

---

## Wizard Language Standards

For high-stakes actions (payroll, offboarding, etc.), use explicit language:

| Instead of | Use |
|------------|-----|
| "Submit" | "Confirm & Process Payroll" |
| "Save" | "Save as Draft" |
| "Approve" | "Approve & Process" |
| "Delete" | "Remove Employee" or "Cancel Payroll Run" |
| "Next" | "Continue to Review" |
| "Done" | "Payroll Complete" |

Consistency builds trust in high-risk actions.

---

## Future Considerations

1. **Keyboard Navigation**: Add shortcuts for primary work pages (e.g., `G E` for Employees, `G P` for Payroll)
2. **Favorites/Pinning**: Let users pin frequently-used work pages to global nav
3. **Breadcrumbs**: Already implemented - ensure consistency
4. **Mobile**: Hubs become more important on mobile (less screen space for side nav)
5. **Report shortcuts**: Let repeat users open their most-used workforce report directly

---

## Contract: Treat This Map as Frozen

New features must justify where they live:
- Does it belong in an existing hub?
- Is it a new work page under an existing section?
- Does it require a new hub? (Very rare - needs strong justification)

This map is a **contract**, not a suggestion.

---

*Last updated: July 2026*
*Philosophy: Hubs help users decide. Work pages help users finish. Never mix the two.*
