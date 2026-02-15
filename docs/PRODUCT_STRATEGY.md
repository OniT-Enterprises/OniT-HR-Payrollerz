# OniT Product Strategy

## Brand Architecture

| Entity | Name | What It Is |
|--------|------|------------|
| **Company** | OniT | The company behind it all |
| **Platform** | Meza | Web platform — full back-office (HR, payroll, accounting, invoicing, time, performance). Tetum for "table/desk" — where you sit down and run your business. |
| **Mobile App** | Kaixa | React Native app — daily money tracking, simple POS for anyone. Tetum for "cash box" — your digital cash box. Mass market, standalone. |
| **Mobile App** | Meza Go | React Native app — employee self-service & manager companion for Meza customers. View payslips, leave, approvals. |

### Two Apps, One Codebase

```
┌──────────────────────────┐     ┌──────────────────────────┐
│         Kaixa             │     │        Meza Go            │
│   "Your digital cash box" │     │  "Meza in your pocket"    │
│                           │     │                           │
│  Mass market, standalone  │     │  Requires Meza employer   │
│  Anyone can download      │     │  Employer tells you to    │
│                           │     │  install it               │
│  • Money In / Money Out   │     │                           │
│  • Simple POS + inventory │     │  • View payslips          │
│  • Customer tabs          │     │  • Leave balance/request  │
│  • Bluetooth receipts     │     │  • Timesheet entry        │
│  • WhatsApp sharing       │     │  • Manager approvals      │
│                           │     │  • Push notifications     │
│  Brand: warm, casual      │     │  Brand: professional      │
│  Terracotta/copper        │     │  Teal/navy                │
└────────────┬─────────────┘     └────────────┬─────────────┘
             │                                 │
             └──────────┬──────────────────────┘
                        │
              Shared codebase (monorepo)
              Same Firebase project (onit-hr-payroll)
              Shared components, stores, utils
                        │
                        ▼
                 Meza (web platform)
              "Sit down. Run your business."
            ┌────────────────────────┐
            │  HR & Hiring            │
            │  Payroll & Tax          │
            │  Accounting & GL        │
            │  Invoicing & Billing    │
            │  Time & Attendance      │
            │  Performance            │
            └────────────────────────┘
```

### Why Two Apps, Not One

- **Different users** — kiosk vendor tracking cash ≠ employee checking payslip
- **Different distribution** — mass market app store download vs employer tells staff to install
- **Different onboarding** — Kaixa: phone number signup, start immediately. Meza Go: email login tied to employer account
- **Different app store messaging** — clear value prop for each
- **Simpler UX** — each app does one thing well, no confused UI
- **Same codebase** — 90% shared code, two Expo build targets with different `app.json` configs

---

## Target Market: Timor-Leste

### User Personas

1. **Maria (Kiosk Owner)** → **Kaixa** — Sells phone credit, snacks, cigarettes from a small stand. Uses a notebook today. 1 employee. Needs: "How much did I make today?"
2. **João (Shop Employee)** → **Meza Go** — Works at a formal business using Meza. Wants to see his payslip and check leave balance on his phone.
3. **Ana (Small Business Owner)** → **Both** — Runs a café with 5 staff. Uses Meza web for payroll. Uses Kaixa for daily sales tracking. Her staff use Meza Go.
4. **Carlos (NGO Finance Manager)** → **Meza Go** — Manages project staff. Approves leave and timesheets from phone. Full HR/payroll stays on Meza web.

### Market Reality

- Population: ~1.3 million
- Currency: USD
- Mobile: 95%+ Android, growing smartphone penetration
- Internet: Intermittent, especially outside Dili
- Economy: Cash-dominant, large informal sector
- Accounting: Most small businesses use notebooks or nothing
- Languages: Tetum (daily), Portuguese (official), English (business)
- Competitors: Essentially none for local SME market

---

## Kaixa — Money & POS App

### Tier 1: Money Tracking (Free)

Not accounting. **Money tracking.**

- **Tama / Sai** (Money In / Money Out) — two big buttons
- Daily/weekly/monthly summaries with simple charts
- Photo receipts (snap the notebook page)
- Category tagging (stock, sales, personal, etc.)
- No accounts, no journals, no jargon
- Works fully offline, syncs when there's wifi
- Tetum-first UI, big touch targets
- Android-only to start

**Why:** Gets thousands of people tracking money digitally. Builds user base. Creates data foundation.

### Tier 2: Simple POS (Freemium)

Everything from Tier 1, plus:

- **Product catalog** — name, price, optional photo
- **Tap-to-sell** — big product buttons, quantity, total
- **Inventory** — "I bought 50, sold 30, have 20 left"
- **Customer tabs** — "João owes me $15" (informal credit is huge in TL)
- **Bluetooth thermal printer** — $30 printers, ESC/POS protocol
- **WhatsApp receipt sharing** — everyone uses WhatsApp in TL
- **Monthly summary report** — printable PDF for tax office

---

## Meza Go — Employee & Manager App

### Employee Features (included with Meza subscription)

- **View payslips** — current and historical
- **Leave balance** — days remaining, request time off
- **Timesheet entry** — log hours from phone
- **Documents** — view contract, upload docs
- **Push notifications** — "Payroll processed", "Leave approved"

### Manager Features

- **Approve** leave requests, timesheets
- **Payroll status** — view, not process (that stays on web)
- **Employee lookup** — quick directory
- **Notifications** → deep link to Meza web for complex actions

---

## What the Apps Do NOT Do

Payroll processing, accounting journals, trial balance, hiring workflows, performance reviews — these are **sit-down, big-screen tasks**. They stay in Meza web.

---

## Revenue Model

| Model | Target | App |
|-------|--------|-----|
| **Freemium upsell** | Kaixa Tier 1 → 2 | Kaixa |
| **Meza subscription** | Formal businesses ($20-50/month) | Meza Go included |
| **Hardware bundles** | App + thermal printer kit ($30-50) | Kaixa |
| **Government/NGO contracts** | "Digitize the informal economy" programs | Kaixa |
| **Telco partnership** | Bundle with Telemor/Timor Telecom data plans | Kaixa |

### Growth Flywheel

```
Formal businesses (50 companies)
  └── Already use Meza → give staff Meza Go
  └── Employees get self-service → 500 users

Those 500 employees also run side businesses
  └── They download Kaixa for their kiosk → organic growth

Their friends see Kaixa
  └── "What app is that?" → free tier adoption → thousands

Some grow, hire staff, need payroll
  └── Upgrade to Meza web → Meza Go for their employees → cycle repeats

Government/NGO sees adoption numbers
  └── "Digitize the informal economy" funding → $$$
```

---

## Build Phases

### Monorepo Structure

```
mobile/
├── apps/
│   ├── kaixa/          # app.json, entry, tabs (Home, Money, Sales, Profile)
│   └── meza-go/        # app.json, entry, tabs (Payslips, Leave, Timesheet, Profile)
├── components/         # shared UI components
├── stores/             # shared Zustand stores (auth, tenant)
├── lib/                # shared firebase, colors, utils
└── types/              # shared type declarations
```

### Phase Plan

| Phase | Focus | Deliverable |
|-------|-------|-------------|
| **1 — Foundation** (done) | Monorepo, shared package, Expo scaffold, Firebase auth, navigation | Kaixa shell with Money In/Out screens |
| **2 — Meza Go MVP** | Employee self-service | Payslip viewer, leave balance/request, push notifications |
| **3 — Meza Go Manager** | Manager companion | Approvals, payroll status, employee lookup |
| **4 — Kaixa Offline** | Offline-first engine | SQLite/WatermelonDB, sync queue, conflict resolution |
| **5 — Kaixa POS** | Simple POS | Product catalog, tap-to-sell, Bluetooth printer, WhatsApp |

### MVP Priority

**Meza Go first** — serves paying customers now:
1. Payslip viewer (read existing Firestore data)
2. Leave balance + request
3. Push notifications (FCM)
4. Distribute to existing Meza client employees

**Kaixa second** — bigger bet, needs offline engine:
1. Money In/Out with SQLite persistence
2. Sync engine for intermittent connectivity
3. Mass market launch

---

## Product-Market Fit Assessment

### Kaixa (Money/POS)
- **Need:** Real but unproven — competing with paper notebooks
- **Moat:** Tetum-first, local, no competition
- **Risk:** Monetization from low-income users, offline engineering complexity
- **Validation needed:** Will kiosk owners actually switch from notebooks?

### Meza Go (Employee/Manager)
- **Need:** Direct — existing customers have asked for mobile access
- **Moat:** Tightly integrated with Meza platform
- **Risk:** Low — read-only views of existing data
- **Validation needed:** Minimal — serves known customers

---

## Logo Briefs

### Kaixa Logo

> App logo for "Kaixa" — a mobile money tracking and POS app for Timor-Leste.
> Concept: Stylized cash box or register, minimal and modern. Approachable, trustworthy, local. Subtle tais textile patterns as accent.
> Style: Clean geometric, flat/semi-flat. Works at 24px and 512px.
> Colors: Terracotta/copper (earth tones), clean white. Avoid cold blue and bright green.
> Typography: Rounded friendly sans-serif, slightly bold, lowercase or title case.
> Do NOT: Coin/dollar imagery, globe icons, shield icons, clip-art.

### Meza Go Logo

> App logo for "Meza Go" — employee & manager companion app for the Meza business platform.
> Concept: Sibling to the Meza web logo but mobile-native. Could incorporate a subtle motion/speed element ("Go"). Professional but friendly.
> Style: Clean, structured. Same design family as Meza web logo.
> Colors: Deep teal or navy primary, warm copper accent. Should feel professional, not casual.
> Typography: Clean sans-serif, medium weight. "Meza Go" or just a "M" mark.

### Meza Logo

> Platform logo for "Meza" — a business management platform for Timor-Leste.
> Concept: Stylized desk/table or workspace. Professional but warm. Stability and order.
> Style: Clean, structured, geometric. More "professional" than Kaixa but same design family.
> Colors: Deep teal or navy paired with warm accent (gold/copper). Should feel like a sibling to Kaixa.
> Typography: Clean sans-serif, medium weight. Title case.
