# Ekipa Feature Spec

> Employee Self-Service (ESS) mobile app — Tetum for "team"
> Companion to Meza web platform. Expo Router + Zustand + Firebase.
> Category: ESS / HR Companion App (like BambooHR Mobile, ADP Mobile, Employment Hero Work App)

---

## What's Shipped

| Feature | Screen(s) | Status |
|---------|-----------|--------|
| Email/password login | `(auth)/login` | Done |
| Forgot password flow | `(auth)/forgot-password` | Done (UI only — email not actually sent, link logged) |
| Home dashboard | `(tabs)/index` | Done — greeting, payday countdown, leave balance card, latest payslip, quick actions |
| Payslip list | `(tabs)/payslips` | Done — 12-month history, pull-to-refresh |
| Payslip detail | `screens/PayslipDetail` | Done — earnings/deductions breakdown, PDF export via expo-print + expo-sharing |
| Leave management | `(tabs)/leave` | Done — balances with progress bars, request history, status badges |
| Leave request form | `screens/LeaveRequestForm` | Done — 7 leave types, date pickers, validation |
| Profile | `(tabs)/profile` | Done — personal info, job details, documents, attendance summary, language toggle, sign out |
| Crew clock-in | `screens/CrewClockIn` | Done — 4-step wizard (site → workers → photo → review), GPS, QR scanner |
| Crew clock-out | `screens/CrewClockOut` | Done — 3-step wizard, optional photo |
| Crew dashboard | `(tabs)/crew` | Done — stats, recent activity, role-gated (owner/hr-admin/manager only) |
| Crew history | `screens/CrewHistory` | Done — grouped by month, reads from local DB |
| QR scanner | `screens/QRScanner` | Done — full-screen camera, multiple barcode formats, haptic feedback |
| Sync queue | `screens/SyncQueue` | Done — pending/error counts, retry/delete, batch list |
| Offline sync engine | `lib/syncEngine.ts` + `lib/db.ts` | Done — SQLite local DB for crew data, background sync to Firestore |
| i18n (EN/Tetum) | `lib/i18n.ts` | Done — useT hook, ~80 strings |
| Dark theme | `lib/colors.ts` | Done — consistent across all screens |

---

## Tier 1 — Must-Have (build next)

These are table stakes for any ESS app. Every major competitor has them.

### 1.1 Push Notifications
**What:** Firebase Cloud Messaging (FCM) alerts for key events.
**Triggers:**
- Payslip ready / payroll processed
- Leave request approved / rejected
- Shift reminder (X hours before)
- Company announcement
- Clock-in/out confirmation

**Why TL:** Workers won't proactively open the app. Passive alerts are essential — especially for shift workers on construction sites.
**Inspired by:** ADP Mobile, Paylocity, Staffbase
**Ties to payroll:** "Your January payslip is ready" drives payslip views.

### 1.2 Payslip WhatsApp Share
**What:** One-tap share of payslip PDF to WhatsApp (or any share target).
**Details:**
- Use existing expo-print PDF generation
- expo-sharing already integrated — just needs a prominent "Share" button
- Deep link or share sheet to WhatsApp specifically

**Why TL:** WhatsApp is the dominant messaging platform. Workers need to share payslips with banks, landlords, visa offices. Email is rarely used.
**Inspired by:** PaySpace/Pacey (WhatsApp ESS)
**Ties to payroll:** Payslip becomes portable proof of income.

### 1.3 Fix Password Reset
**What:** Actually send the password reset email (not just generate and log the link).
**Options:**
- Client-side `sendPasswordResetEmail()` from Firebase Auth SDK (simplest)
- Server-side SMTP via Cloud Function
- SMS-based reset (future — needs Twilio/local SMS provider)

**Why:** Currently broken. Users can't recover accounts. Table stakes.

### 1.4 Attendance History (Employee View)
**What:** Employee sees their own clock-in/out records with hours worked.
**Details:**
- Calendar or list view of attendance by day/week/month
- Each entry: date, clock-in time, clock-out time, total hours, overtime flag
- Summary: total hours this period, late count, absent count
- Highlight discrepancies (e.g., hours recorded vs. payslip hours)

**Why TL:** Wage theft protection. Workers verify their hours match their payslip. Builds trust in the system.
**Inspired by:** ADP, BambooHR, Paylocity
**Ties to payroll:** Direct link — "these hours → this pay."

### 1.5 Offline Payslip Cache
**What:** Cache last 6 payslips locally so they're viewable without internet.
**Details:**
- Store payslip JSON in AsyncStorage or SQLite on fetch
- Show cached data with "last updated" indicator
- Offline-generated PDF from cached data

**Why TL:** Workers on construction sites or rural areas have no signal. They need to show payslips to bank tellers or landlords in person.
**Inspired by:** Paylocity (works with limited/no service)
**Ties to payroll:** Payslip is always in your pocket.

---

## Tier 2 — Should-Have (differentiation, ~3 months)

Features that differentiate Ekipa from generic ESS apps. Tailored to TL context.

### 2.1 Digital Employee ID Card
**What:** QR-scannable digital ID card on the employee's phone.
**Shows:** Full name, photo, employer name, position, employee number, start date, QR code.
**QR links to:** Verification page confirming employment status, tenure, salary range — without revealing full payslip.
**Works offline:** Card rendered locally, QR contains signed payload or verification URL.

**Why TL:** Workers constantly need proof of employment for bank accounts, visa applications, government services. Paper IDs get lost. Employer gatekeeping is a real barrier.
**Inspired by:** Connecteam digital ID cards, ORGiD
**Ties to payroll:** Pulls salary range + tenure from payroll data.

### 2.2 Employment Letter / Salary Certificate Request
**What:** Employee taps "Request Letter" → selects type → auto-generated PDF with employer details.
**Types:**
- Proof of employment (name, position, dates, employer)
- Salary certificate (above + gross salary)
- INSS contribution summary

**Why TL:** Reduces HR admin burden. Workers get instant proof without chasing the office.
**Inspired by:** Darwinbox (self-generate HR letters)
**Ties to payroll:** Pulls salary data directly from payroll records.

### 2.3 Visual Payslip Breakdown
**What:** Instead of (or alongside) the traditional table, show a visual bar/funnel:
```
Earned: $150
  → Tax (WIT): -$5
  → INSS: -$6
  → Other deductions: -$4
  ═══════════════════
  You receive: $135
```
**Use:** Animated bar chart or stacked graphic. Color-coded (green for earnings, red for deductions).

**Why TL:** Many workers have limited financial literacy. A visual breakdown demystifies deductions. "Where did my money go?" answered at a glance.
**Inspired by:** Gusto's paycheck preview (simplified breakdown concept, taken further)
**Ties to payroll:** Core payroll data, presented accessibly.

### 2.4 Shift Schedule Viewing
**What:** View upcoming shift assignments — date, time, location.
**Details:**
- Calendar view with shifts color-coded by type (morning/afternoon/night)
- List view with next 7/14 days
- Push notification reminder before shift starts
- If no shifts assigned, show empty state

**Why TL:** Construction and hospitality workers need to know when and where to show up. Currently relies on word-of-mouth or WhatsApp messages.
**Inspired by:** Connecteam, Paylocity, Orbital Shift
**Ties to payroll:** Scheduled shifts → expected hours → payroll calculation.
**Depends on:** Meza web having shift scheduling feature (exists at `pages/time-leave/ShiftScheduling.tsx`).

### 2.5 Company Announcements Feed
**What:** Simple broadcast feed from employer to all employees.
**Details:**
- Admin posts from Meza web → appears in Ekipa feed
- Title, body, optional image/attachment
- Read receipts (optional — "42 of 50 employees have seen this")
- Push notification on new announcement
- Pinned announcements at top

**Why TL:** Replaces informal WhatsApp groups for official communications. Important for safety notices, policy changes, holiday schedules.
**Inspired by:** BambooHR Community, Paylocity, Connecteam
**Ties to payroll:** Announce payroll schedule, bonus info, tax changes.

### 2.6 Personal Info Edit
**What:** Employee updates their own contact details.
**Editable:** Phone number, address, emergency contacts, bank account details.
**Flow:** Employee submits change → HR gets notification → approves/rejects (for sensitive fields like bank details) or auto-approved (for phone/address).

**Why TL:** Reduces HR admin burden. Employees own their data. Bank detail changes need approval to prevent fraud.
**Inspired by:** ADP, BambooHR, Paylocity
**Ties to payroll:** Bank details feed directly into payroll disbursement.

### 2.7 Biometric App Lock
**What:** Fingerprint or Face ID to open the app.
**Details:**
- Optional — enabled in settings
- Uses expo-local-authentication
- Falls back to device PIN
- Auto-locks after 5 min inactive

**Why TL:** Shared devices are common (family shares one phone). Prevents others from viewing payslips or personal info.
**Inspired by:** ADP Mobile
**Ties to payroll:** Protects sensitive financial data.

---

## Tier 3 — Nice-to-Have (~6 months)

Polish features. Build after core is solid and user feedback confirms demand.

### 3.1 Expense Submission
**What:** Employee photographs a receipt, enters amount and category, submits for reimbursement.
**Details:**
- Camera capture or gallery pick
- Amount, date, category (travel, supplies, meals, other)
- Optional notes
- Status tracking (submitted → approved → paid)
- Manager approval in Ekipa or Meza web

**Inspired by:** Deel, Darwinbox, Paylocity
**Ties to payroll:** Approved expenses → added to next payroll run as reimbursement.

### 3.2 Tax Summary (WIT/INSS Year-to-Date)
**What:** Year-to-date breakdown of tax withholdings and social security contributions.
**Shows:**
- Total gross YTD
- Total WIT withheld YTD
- Total INSS (employee 4%) YTD
- Total INSS (employer 6%) YTD — "your employer also contributes this"
- Chart: monthly trend of deductions

**Why TL:** INSS is new (since 2017). Workers don't understand deductions. Transparency builds trust.
**Inspired by:** ADP (3-year tax history), Gusto
**Ties to payroll:** Aggregated from payslip data.

### 3.3 Holiday Calendar
**What:** TL public holidays + company-specific holidays in one calendar view.
**Details:**
- TL public holidays pre-loaded (13+ per year)
- Company holidays added by admin in Meza web
- Indicator on home dashboard: "Next holiday: Liberation Day (Nov 28) — 14 days away"

**Inspired by:** Darwinbox
**Ties to payroll:** Holiday pay calculations, leave planning.

### 3.4 Manager Approvals (Mobile)
**What:** Managers approve/reject leave requests, timesheets, expense claims from Ekipa.
**Details:**
- Badge count on tab or home card
- Swipe to approve/reject or tap for details
- Bulk approve option
- Comment/reason field on reject

**Why TL:** Managers in construction/hospitality are in the field, not at a desk.
**Inspired by:** All competitors — table stakes for manager role
**Ties to payroll:** Approved timesheets → payroll hours. Approved leave → leave deduction.

### 3.5 Peer Recognition
**What:** Send a kudos/shout-out to a colleague. Visible on a company feed.
**Details:**
- "Send kudos" button → select colleague → write message → optional badge/category
- Categories: teamwork, above-and-beyond, safety, customer service
- Feed visible to all employees in tenant
- Monthly leaderboard (optional)

**Why:** Low-cost, high-morale feature. Engagement tool.
**Inspired by:** BambooHR, Paylocity, Connecteam

### 3.6 Employee Directory
**What:** Searchable list of colleagues with name, photo, position, department, contact info.
**Details:**
- Search by name or department
- Tap to call or message
- Respects privacy settings (employee can hide phone number)

**Inspired by:** Darwinbox, ADP
**Ties to payroll:** Uses same employee data.

### 3.7 Multi-Language Toggle (Expanded)
**What:** Expand beyond EN/Tetum to include Portuguese and Bahasa Indonesia.
**Details:**
- In-app language picker (currently EN/Tetum)
- Add Portuguese (official language, used in government/legal)
- Add Bahasa Indonesia (widely understood, many workers are bilingual)
- Per-user preference stored locally

**Why TL:** Four working languages. Different workers prefer different ones depending on education and background.

### 3.8 Anonymous Grievance Reporting
**What:** Submit anonymous complaint or concern to HR.
**Details:**
- Category: harassment, wage issue, safety concern, other
- Free-text description
- Optional photo/evidence attachment
- Truly anonymous — no user ID attached to submission
- HR sees it in Meza web dashboard
- Status updates visible to reporter (via anonymous ticket ID)

**Why TL:** Wage theft reporting, harassment reporting. Builds worker trust. Differentiates Ekipa as a worker-protection tool.
**Inspired by:** Vault Platform, FaceUp, HR Acuity

### 3.9 Wage Discrepancy Alerts
**What:** If recorded attendance hours don't match payslip hours, or if calculated pay is below minimum wage, flag it to the employee.
**Details:**
- Compare attendance records (clock-in/out hours) with payslip "hours worked"
- If discrepancy > threshold (e.g., 2+ hours), show alert: "Your recorded hours (176h) don't match your payslip hours (168h). Talk to your supervisor."
- If net pay < minimum wage ($115/month for full-time), show warning
- Non-accusatory tone — informational, not confrontational

**Why TL:** Unique to this market. No competitor does employee-side wage verification. Ghost worker and wage theft fraud are real problems.
**Ties to payroll:** Cross-references attendance with payroll data.

---

## Tier 4 — Future / Advanced (6+ months)

Market-dependent. Build based on traction and partnerships.

### 4.1 Earned Wage Access (EWA)
**What:** Employees access a portion of already-earned wages before payday.
**How it works:**
- App calculates earned-but-unpaid wages based on days worked this period
- Employee requests advance (capped at 50% of earned amount)
- Funds transferred instantly (via mobile money or bank)
- Deducted from next payroll automatically
- Small flat fee per transaction (e.g., $0.50-1.00)

**Why TL:** $115/month minimum wage. Workers live paycheck-to-paycheck. This is transformative. Proven in SEA by Paywatch (MY), GIMO (VN), Wagely (ID).
**Inspired by:** Gusto Wallet/Clair, Employment Hero, Paywatch
**Ties to payroll:** Requires real-time earned-wage calculation. Advance deducted from payslip.
**Needs:** Partnership with TL financial institution or mobile money provider (BNCTL, TL Pay).

### 4.2 WhatsApp Bot for Zero-Install Access
**What:** Employees interact with Ekipa features via WhatsApp — no app install needed.
**Commands:**
- "payslip" → latest payslip summary + PDF attachment
- "leave" → current leave balances
- "request leave 3 days" → guided flow
- "hours" → attendance summary this period

**Why TL:** Not everyone will install the app. WhatsApp is universal. Meets workers where they are.
**Inspired by:** PaySpace/Pacey
**Ties to payroll:** Same data, different channel.
**Already started:** Meza bot infrastructure exists (`server/openclaw-meza/`). Extend with employee-facing commands.

### 4.3 Training & Learning Modules
**What:** Short, visual training courses on mobile.
**Content types:**
- Safety training (construction — PPE, fall prevention, equipment)
- Onboarding (company policies, INSS explanation, how payroll works)
- Compliance (anti-harassment, workplace rights)
- Custom (employer uploads their own content)

**Format:** Image/video-based, minimal text. Quiz at end. Completion tracked.
**Why TL:** Safety training for construction is a legal requirement. Image/video format works for low-literacy workers.
**Inspired by:** Connecteam, Darwinbox, Employment Hero

### 4.4 AI Assistant (Tetum)
**What:** Ask questions about pay, leave, policies in natural language — in Tetum.
**Examples:**
- "Hau iha loron lisensa hira?" (How many leave days do I have?)
- "Hau nia INSS tinan ida nian hira?" (What's my INSS total this year?)
- "Bainhira mak loron osan-na'in?" (When is payday?)

**Inspired by:** BambooHR Ask, ADP Assist, Paylocity AI
**Barrier:** Tetum NLP is extremely limited. May need custom fine-tuning or Claude with Tetum context.
**Already started:** Meza bot uses Claude. Could extend with employee-facing persona.

### 4.5 Financial Wellness Tools
**What:** Budgeting tips, savings goals, spending insights based on payslip data.
**Examples:**
- "You spent 45% of your salary on rent this month" (if categorized)
- Savings goal tracker ("Save $50 for school fees — $32 so far")
- Simple budget template based on TL cost of living

**Inspired by:** Gusto Wallet
**Barrier:** Requires banking data integration that TL infrastructure may not support yet.

### 4.6 Digital Wallet / Pay Card
**What:** Employer-issued digital debit card for unbanked workers.
**How:** Partner with TL bank (BNCTL) or mobile money provider to issue virtual cards.
**Use:** Salary deposited to card, employee uses for purchases or ATM withdrawal.

**Why TL:** ~36% of adults have no financial account. Payroll currently paid in cash envelopes for many workers.
**Inspired by:** Gusto Wallet, Employment Hero Swag
**Needs:** Banking partnership. Regulatory approval. Long lead time.

### 4.7 SMS Notification Fallback
**What:** For critical alerts (payslip ready, shift change), send SMS when push notification fails or device is offline.
**Why TL:** Push requires internet. SMS works on any phone, any network. Essential for workers outside Dili.
**Needs:** SMS provider integration (Twilio, local telco API, or bulk SMS service).

---

## Firestore Data Requirements (New Collections)

Features above will need these collections (some may already exist):

```
tenants/{tid}/announcements/{id}
  - title, body, imageUrl?, pinned, createdAt, createdBy
  - readBy: { [uid]: timestamp }

tenants/{tid}/employees/{eid}/documents/{id}
  - type: 'employment_letter' | 'salary_cert' | 'inss_summary'
  - requestedAt, generatedAt, url, status

tenants/{tid}/expenses/{id}
  - employeeId, amount, category, date, receiptUrl, notes
  - status: 'submitted' | 'approved' | 'rejected' | 'paid'
  - approvedBy, approvedAt

tenants/{tid}/grievances/{id}
  - category, description, attachmentUrls[], ticketId (anonymous)
  - status: 'submitted' | 'reviewing' | 'resolved'
  - NO userId field — truly anonymous

tenants/{tid}/recognition/{id}
  - fromEmployeeId, toEmployeeId, message, category
  - createdAt

tenants/{tid}/settings/notifications
  - payslipReady: boolean
  - leaveStatus: boolean
  - shiftReminder: boolean
  - announcements: boolean

users/{uid}/devices/{token}
  - fcmToken, platform, lastActive
```

---

## Implementation Notes

### Accent Colors (per module)
| Module | Color | Hex |
|--------|-------|-----|
| Home/Primary | Green | #22C55E |
| Payslips | Blue | #3B82F6 |
| Leave | Violet | #8B5CF6 |
| Crew/Time | Orange | #F97316 |
| Announcements | Teal | #0D9488 |
| Recognition | Amber | #F59E0B |
| Expenses | Emerald | #10B981 |

### Offline Strategy
- **Always cached locally:** payslips (last 6), leave balances, employee ID card, profile data
- **Queued when offline:** leave requests, expense submissions, clock-in/out, grievance reports
- **Online only:** announcements feed, directory search, document generation, EWA

### Dependencies on Meza Web — Full Audit

What Meza already has vs. what needs building to support Ekipa features:

#### Already Exists in Meza (ready or near-ready)
| Meza Feature | File | Ekipa Dependency | Notes |
|---|---|---|---|
| Leave request approval | `pages/time-leave/LeaveRequests.tsx` | Leave request form | Full workflow: pending → approved/rejected |
| Payslips / payroll | `pages/payroll/` | Payslip viewer | Read-only in Ekipa, full CRUD in Meza |
| Shift scheduling | `pages/time-leave/ShiftScheduling.tsx` | Shift viewing | **DEMO MODE** — 2,233 lines built but uses mock data. Needs Firestore integration before Ekipa can read shifts |
| Salary advances | `pages/payroll/DeductionsAdvances.tsx` | EWA / advance requests | Admin-side only. Records advances given. No employee-facing request flow |
| Expenses (company) | `pages/money/Expenses.tsx` | Expense submission | Company expense tracking only — not employee reimbursement claims. Needs separate workflow |
| Training certs | `pages/performance/TrainingCertifications.tsx` | Training modules | Tracks cert status. No learning content delivery |
| Employee profiles | `pages/staff/AllEmployees.tsx` | Digital ID, directory | Has "Create Ekipa Account" button. No QR code or digital ID generation |
| Disciplinary records | `pages/performance/Disciplinary.tsx` | (none — management only) | Management-initiated, not related to grievance reporting |

#### Does NOT Exist in Meza (needs building)
| Missing Feature | Ekipa Dependency | Priority | Scope |
|---|---|---|---|
| **Push notification service** | ALL push notifications | **Tier 1** | FCM setup, Cloud Function triggers on payslip create / leave status change / announcement create. New `users/{uid}/devices` collection for tokens. |
| **Announcements page** | Company announcements feed | **Tier 2** | New page in Meza: create/edit/delete announcements, pin, schedule, view read receipts. New Firestore collection `tenants/{tid}/announcements`. |
| **Document template engine** | Employment letter / salary cert requests | **Tier 2** | PDF generation with company letterhead, employee data, salary info. Could use existing @react-pdf/renderer (used for PayslipPDF). New page or section in employee profile. |
| **QR code / digital ID generator** | Digital employee ID card | **Tier 2** | Generate unique QR per employee (encode employee ID + verification URL). Display on employee profile. Verification endpoint (Cloud Function or public page). |
| **Employee reimbursement workflow** | Expense submission from Ekipa | **Tier 3** | Separate from company expenses. Employee submits → manager reviews → approved → added to payroll. New collection or sub-type in expenses. |
| **Recognition dashboard** | Peer recognition | **Tier 3** | Optional feed/report in Meza showing recognition activity. Leaderboard. Not blocking — Ekipa can show recognition without Meza dashboard. |
| **Grievance inbox** | Anonymous grievance reporting | **Tier 3** | HR admin view of anonymous submissions. Status management. No user identification. Sensitive — needs access control. |
| **Notification preferences** | Per-tenant notification config | **Tier 2** | Settings page: which events trigger push/SMS. Per-employee opt-in/out. Part of tenant settings. |
| **Shift scheduling Firestore integration** | Shift viewing in Ekipa | **Tier 2** | The ShiftScheduling page is fully built (2,233 lines) but runs on mock data. Wire it to Firestore: `tenants/{tid}/shifts`, `tenants/{tid}/schedules`. Then Ekipa reads published schedules. |

#### Meza Build Order (to unblock Ekipa tiers)

**Phase 1 — Unblocks Ekipa Tier 1:**
1. FCM / push notification infrastructure (Cloud Functions + device token management)
2. Trigger notifications on: payslip created, leave status changed

**Phase 2 — Unblocks Ekipa Tier 2:**
3. Announcements CRUD page + Firestore collection
4. Shift scheduling → Firestore integration (de-mock the existing page)
5. Document template engine (employment letter, salary cert PDF generation)
6. QR code generation on employee profiles + public verification endpoint
7. Notification settings in tenant config

**Phase 3 — Unblocks Ekipa Tier 3:**
8. Employee reimbursement workflow (separate from company expenses)
9. Grievance inbox for HR admins
10. Recognition feed/dashboard (optional — Ekipa can work without this)

---

## Market Research Summary

### Competitor Benchmarks
| App | Key Feature We're Taking |
|-----|--------------------------|
| BambooHR Mobile | Community feed, performance goals |
| ADP Mobile | 3-year pay history, biometric lock, push notifications |
| Gusto | Visual paycheck breakdown, earned wage access, wallet |
| Paylocity | Offline clock-in, on-demand pay, peer recognition, AI assistant |
| Employment Hero | EWA, cashback/benefits marketplace, training content |
| Darwinbox | Self-generate HR letters, geo-tagged attendance, learning modules |
| Connecteam | Digital ID cards, GPS time clock, checklists, shift management |
| PaySpace/Pacey | WhatsApp-based ESS (payslip, leave via chat) |
| Paywatch/GIMO/Wagely | Earned wage access in SEA developing markets |
| Vault Platform | Anonymous grievance reporting |

### TL-Unique Differentiators (no competitor does these)
1. **Wage discrepancy alerts** — employee-side verification of hours vs. payslip
2. **QR-verifiable employment proof** — bank teller scans, confirms employment instantly
3. **Visual payslip funnel** — low-literacy-friendly "where my money went" graphic
4. **SMS notification fallback** — critical alerts reach workers without data
5. **WhatsApp payslip delivery** — meets workers on the platform they already use daily

### Addressable Market
- TL formal workers: ~146,000 (growing ~15%/year via INSS formalization)
- Realistic paying employers (3-5yr): 100-300 businesses
- TL-only ARR ceiling: $300-500K
- Regional play (Lusophone Africa + Pacific + frontier SEA): $500K-2M ARR
- Closest comparable: BetterHR — 380 companies, 4 countries, ~$1.75/employee/month
