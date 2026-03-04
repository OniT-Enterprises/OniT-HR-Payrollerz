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
│  [Logo]   Dashboard   People   Time & Leave   Payroll   Money   Accounting   Reports   ⚙️  │
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
| Time & Leave | `/time-leave` | Yes | Scheduling, attendance, leave, shifts |
| Payroll Hub | `/payroll` | Yes | Power users → direct to `/payroll/run` |
| Money Hub | `/money` | Yes | **Day-to-day AR/AP** for small businesses. Power users → `/money/invoices` |
| Accounting Hub | `/accounting` | Yes | Ledger/compliance. Payroll-scoped. Power users → `/accounting/core/journal` |
| Reports Hub | `/reports` | Soft | Remember last category. First visit → hub, repeat visits → last used |

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
- Basic financial reports (P&L, Balance Sheet, Cash Flow)
- Receipt upload (mobile-friendly)
- Bank reconciliation
- Designed for: Small business owners who want QuickBooks-lite simplicity

**Accounting Hub** = Advanced ledger & compliance for accountants
- Payroll journals (auto-posted from payroll)
- Chart of Accounts management
- General Ledger detail
- Trial Balance
- Designed for: Accountants, auditors, and compliance officers
- Do NOT add: Invoices, Bills, Expenses (those live in Money)

**Reports Hub** = Discovery-oriented with memory
- First visit: Show full hub for orientation
- Repeat visits: Route to last-used category
- Scheduled reports reduce need to browse

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
│   │   ├── Announcements (/people/announcements) [WORK PAGE]
│   │   └── Grievances (/people/grievances) [WORK PAGE]
│   │
│   ├── Hiring                             [Section]
│   │   ├── Jobs (/people/jobs)
│   │   ├── Candidates (/people/candidates)
│   │   ├── Interviews (/people/interviews)
│   │   ├── Onboarding (/people/onboarding)
│   │   └── Offboarding (/people/offboarding)
│   │
│   └── Performance                        [Section]
│       ├── Goals (/people/goals)
│       ├── Reviews (/people/reviews)
│       ├── Training (/people/training)
│       └── Disciplinary (/people/disciplinary)
│
├── Time & Leave (/time-leave)             [HUB - Skippable]
│   ├── Time Tracking (/time-leave/time-tracking) [WORK PAGE]
│   ├── Attendance (/time-leave/attendance)       [WORK PAGE]
│   ├── Leave (/time-leave/leave)                 [WORK PAGE]
│   └── Shifts (/time-leave/shifts)               [WORK PAGE]
│
├── Payroll (/payroll)                     [HUB - Skippable]
│   │
│   ├── Run Payroll (/payroll/run)         [WORK PAGE - Wizard]
│   │
│   ├── Setup                              [Section]
│   │   ├── Benefits (/payroll/setup/benefits) [WORK PAGE]
│   │   └── Deductions (/payroll/setup/deductions) [WORK PAGE]
│   │
│   ├── History (/payroll/history)         [WORK PAGE]
│   ├── Payments (/payroll/payments)       [WORK PAGE]
│   └── Reports (/payroll/reports)         [WORK PAGE]
│
├── Money (/money)                         [HUB - Skippable]
│   │
│   ├── Invoices                           [Section]
│   │   ├── Invoices (/money/invoices)     [WORK PAGE]
│   │   ├── Customers (/money/customers)   [WORK PAGE]
│   │   └── Payments (/money/payments)     [WORK PAGE]
│   │
│   ├── Bills                              [Section]
│   │   ├── Bills (/money/bills)           [WORK PAGE]
│   │   └── Vendors (/money/vendors)       [WORK PAGE]
│   │
│   ├── Expenses (/money/expenses)         [WORK PAGE]
│   │
│   └── Reports                            [Section]
│       ├── Profit & Loss (/money/reports/profit-loss)
│       ├── Balance Sheet (/money/reports/balance-sheet)
│       ├── Cashflow (/money/reports/cashflow)
│       ├── AR Aging (/money/reports/ar-aging)
│       ├── AP Aging (/money/reports/ap-aging)
│       ├── Reconciliation (/money/reports/reconciliation)
│       ├── VAT Settings (/money/reports/vat-settings)
│       └── VAT Returns (/money/reports/vat-returns)
│
├── Accounting (/accounting)               [HUB - Skippable]
│   │
│   ├── Core                               [Section]
│   │   ├── Chart of Accounts (/accounting/core/chart)
│   │   ├── Journal Entries (/accounting/core/journal)
│   │   ├── General Ledger (/accounting/core/ledger)
│   │   └── Reconciliation (/accounting/core/reconciliation)
│   │
│   └── Reports                            [Section]
│       ├── Trial Balance (/accounting/reports/trial-balance)
│       ├── Income Statement (/accounting/reports/income-statement)
│       ├── Balance Sheet (/accounting/reports/balance-sheet)
│       ├── Fiscal Periods (/accounting/reports/fiscal-periods)
│       └── Audit Trail (/accounting/reports/audit-trail)
│
├── Reports (/reports)                     [HUB]
│   │
│   ├── Standard                           [Section]
│   │   ├── Payroll (/reports/payroll)
│   │   ├── Employees (/reports/employees)
│   │   ├── Attendance (/reports/attendance)
│   │   └── Departments (/reports/departments)
│   │
│   ├── Compliance                         [Section]
│   │   ├── Monthly WIT (/reports/attl-monthly-wit)
│   │   ├── Monthly INSS (/reports/inss-monthly)
│   │   └── Annual INSS (/reports/inss-annual)
│   │
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
| Reports Hub | Hub | Yes | Recent + categories |
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
| Journal Entries | `/accounting/core/journal` | Most-used accounting tool |
| Payroll Reports | `/reports/payroll` | Most-used reports |
| Leave Requests | `/time-leave/leave` | Frequent approvals |

---

## Power User Paths (Month-End Workflow)

What does a payroll officer click *every month*? Optimize this path mercilessly.

### Monthly Payroll Cycle
```
1. People Hub → Check "Attention Required" (blocked employees)
2. Leave Requests → Approve pending requests
3. Time Tracking → Finalize timesheets
4. Run Payroll → Select → Review → Taxes → Confirm & Process
5. Journal Entries → Verify payroll posted correctly
6. Payroll Reports → Generate tax reports (WIT, INSS)
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
5. **Reports Memory**: Remember last-used report category per user

---

## Contract: Treat This Map as Frozen

New features must justify where they live:
- Does it belong in an existing hub?
- Is it a new work page under an existing section?
- Does it require a new hub? (Very rare - needs strong justification)

This map is a **contract**, not a suggestion.

---

*Last updated: March 2026*
*Philosophy: Hubs help users decide. Work pages help users finish. Never mix the two.*
