# CLAUDE.md - Project Context

## Important
- **Frontend work**: Check `STYLE_GUIDE.md` for design patterns and colors before UI changes. For the PUBLIC marketing pages (/, /how-it-works, /engine, /pricing, /accountants), also read `docs/DESIGN_MARKETING.md` — the codified marketing design language (per-page accents, crescent motif, anti-vibe-code bans).
- **Public site plumbing**: Read `docs/PUBLIC_SITE.md` before adding/renaming public pages or touching their SEO. Marketing pages exist at `/`, `/tet/...` and `/pt/...` (hreflang cluster, per-locale static heads in the build, sitemap alternates); worked payroll figures on public pages must be engine-exact; the /engine page's proof wording stays vague about sourcing.
- **Dashboards / simplicity**: Read `docs/DASHBOARD_DESIGN.md` before adding to any dashboard or customer-facing screen. Our users are first-time, mobile, often non-accountant TL small businesses — **simplicity is a hard requirement**. No charts on dashboards/report summaries; push back on over-complication instead of building it.
- **Roadmap**: See `docs/IMPLEMENTATION_ROADMAP.md` for feature plans and TL legal requirements.
- **Code quality**: See `docs/CODE_REVIEW_JAN2026.md` for technical debt and pending items.
- **Launch ops**: See `docs/LAUNCH_OPS_TODO.md` for remaining manual/console items (backups, Sentry, icons) and deploy notes.
- **Billing / paywall**: Read `docs/BILLING.md` before touching payroll gating, Stripe, subscriptions, or tenant billing fields. One paywall only (finalizing payroll); `isTenantSubscribed()` ↔ rules `tenantHasActiveSubscription()` must stay in sync; tenant billing fields are tamper-protected in rules.
- **Email / notifications**: Read `docs/EMAIL_NOTIFICATIONS.md` before sending anything. **Never write `mail` docs directly from client code** — always `notificationService.queueEmail()` (per-recipient privacy, purpose tags, EN+Tetun footer). Emails are non-fatal: they never break the action that triggered them. Actions that email someone say so in the UI first.
- **Invoicing / hosted invoice pages**: Read `docs/INVOICING.md` before touching invoice delivery, `/i/:token`, `invoice_links`, invoice PDFs/emails, or storage rules. Key invariants: public `get` must allow `resource == null`; no public `list`; the as-sent PDF is frozen at send; Storage cross-service IAM grant must exist or all uploads 403.
- **Accountant vs simple flow**: Read `docs/AUDIENCE_SPLIT.md` before touching supplier withholding, tax filing screens, VAT, the `accountant` role, or `advancedTaxMode`. One primitive — `useAdvancedTax()` — gates all accountant-grade controls; the simple flow applies safe defaults that yield no withholding. `isTenantFinanceAdmin` in rules must stay in sync with the role.
- **Time & Leave**: Read `docs/TIME_LEAVE.md` before touching attendance, leave, shifts, timesheets, holiday handling, or their role boundaries. Attendance is the single hours-entry workflow; balances and timesheets are Cloud Functions-owned projections.
- **Payroll money chain**: Read `docs/MONEY_CHAIN.md` (diagrams) before touching payroll run statuses, settlement, payroll/tax journals, or rules around `payruns`/`taxFilings` — it maps run lifecycle → journals → statutory filings and lists the non-negotiable invariants.
- **Bank payments**: Read `docs/BANK_PAYMENTS.md` before touching `client/lib/bank-transfers/*` or the Bank Transfers page. BNU/BNCTL take salary batches by emailed Excel pack + signed payment order (evidence-based), NOT CSV upload; bank-facing text stays Portuguese.
- **Accounting automations**: Read `docs/ACCOUNTING_AUTOMATIONS.md` before touching fixed assets, depreciation, or recurring journals. Recurring journal templates (`tenants/{tid}/recurringJournals`) post nightly via the `processRecurringJournals` Cloud Function; fixed-asset depreciation and disposal each post through `createJournalEntry` in ONE atomic transaction, guarded by append-only per-period docs (`fixedAssetPostings/{YYYY-MM}`, `recurringJournalPostings/{templateId}_{YYYY-MM}`) that make posting exactly-once — reversal = manual journal, never delete a guard. Depreciation math is straight-line **cumulative-cap** (accumulated never exceeds cost−residual, never a negative charge) using decimal.js money helpers, pure/unit-tested in `client/lib/accounting/{recurring,depreciation}.ts` — keep the CF copies in sync and `templateIsDue` lives in the functions module (tested=running). Acquisition posts NO GL journal (register-only, to avoid double-booking bill-acquired assets) — an open decision. Statutory Excel exports mirror OFFICIAL templates only (INSS portal DR, ATTL form — compliance); everything else (fixed-asset register, resumo sheets) is Xefe's own layout, never a client/firm workbook's.
- **Bot integration**: See `OPENCLAW_XEFE_INTEGRATION.md` for the Xefe AI assistant (WhatsApp + web dashboard).
- **Branding**: User-facing name is **Xefe** (Tetun for "boss"; Ekipa = employee app, XefeBot = assistant, Kaixa = sales product). Infra was renamed meza-* → xefe-* on 2026-07-13 (`server/xefe-api`, `openclaw-xefe`, PM2/Docker `xefe-*`); the canonical public domain is **xefe.tl** (was meza.naroman.tl, which now 301s to it). The `onit-hr-payroll` Firebase project ID is unchanged.

## Project Overview
OniT HR/Payroll System - React/TypeScript app for HR operations (hiring, staff, attendance and leave, performance, payroll, reporting) targeting Timor-Leste market.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite 6
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: React Context + TanStack React Query
- **Backend**: Firebase (Firestore/Auth)
- **Server**: Express.js REST API (Xefe API) + OpenClaw bot gateway
- **Deployment**: Hetzner VPS (nginx static SPA); Firebase for Firestore/Auth/Functions only
- **Analytics**: GA4 via gtag.js in `index.html` (property `G-WVYDBVTC1P`); relies on GA4 Enhanced Measurement for SPA route views. Marketing UTMs (e.g. `utm_source=tetumdili`) land here.

## Firebase Configuration

### Project: `onit-hr-payroll`
```
Project ID: onit-hr-payroll
Auth Domain: onit-hr-payroll.firebaseapp.com
Storage Bucket: onit-hr-payroll.firebasestorage.app
Console: https://console.firebase.google.com/project/onit-hr-payroll/overview
```

### Local Development
```bash
pnpm dev             # Start Vite dev server
```

### Deploy Commands
```bash
firebase deploy                      # Deploy everything
firebase deploy --only firestore:rules  # Deploy rules only
firebase deploy --only hosting       # Deploy hosting only
```

### Firestore Rules
- Production: `firestore.rules` (deployed)
- Dev: `firestore-dev.rules` (local testing only)

## Hetzner VPS

**Production**: split hosts since 2026-07-21 — **xefe.tl** = marketing/public
(docs, pricing, hosted invoice `/i/` + `/apply/` share links) and
**app.xefe.tl** = the authenticated app (noindex). ONE build serves both from
`/var/www/xefe.tl/dist/spa` (65.109.173.122); nginx redirects server-side
hits across the boundary, `client/lib/hosts.ts` + HostGuard (App.tsx) correct
client-side navigations. Auth lives on app.xefe.tl (Firebase authorized
domain added). Both vhosts proxy `/api/` → xefe-api :3201; API_BASE is
same-origin in prod. `meza.naroman.tl` / `payroll.naroman.tl` still 301 →
xefe.tl. app cert: Let's Encrypt via certbot dns-cloudflare
(`/root/.cloudflare-certbot.ini`).

**Deploys are automatic**: pushing to `main` runs `deploy.yml`, which (after
typecheck/lint/tests/rules suite) deploys Firestore+Storage rules, Cloud
Functions, AND rsyncs `dist/spa` to Hetzner. Do NOT also deploy manually after
a push. The manual fallback (CI down, hotfix without a push) is:

```bash
pnpm build      # vite → dist/spa + per-route static heads
rsync -az --delete --exclude='.well-known' -e "ssh -i ~/.ssh/id_hetzner" \
  dist/spa/ root@65.109.173.122:/var/www/xefe.tl/dist/spa/
ssh -i ~/.ssh/id_hetzner root@65.109.173.122 'chown -R www-data:www-data /var/www/xefe.tl/dist/spa'
```

## Key Directories
```
client/
├── components/     # React components (ui/ for shadcn)
├── contexts/       # Auth, Firebase, Tenant contexts
├── hooks/          # React Query hooks (useEmployees, useInvoices, etc.)
├── lib/            # Firebase config, payroll calculations
├── pages/          # Page components by module
├── services/       # Firestore data services
└── types/          # TypeScript definitions

server/
├── xefe-api/       # Express REST API for bot (port 3201, PM2)
│   └── index.js    # 26 read-only Firestore endpoints
└── openclaw-xefe/  # OpenClaw Docker gateway (port 18790)
    ├── extensions/xefe-hr/  # Plugin: 29 tools + 5 commands
    ├── docker-compose.yml
    ├── Dockerfile
    └── deploy.sh

routes.tsx          # All route definitions (extracted from App.tsx)
```

## Common Commands
```bash
pnpm dev             # Dev server (Vite frontend, port 8080 strict)
pnpm build           # Production build
pnpm typecheck       # TypeScript check
pnpm test            # Unit tests (vitest)
pnpm emul:rules      # Firestore rules tests (emulator; needs Java 21)
# On this machine, put Java 21 first on PATH as well as setting JAVA_HOME:
PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" \
  JAVA_HOME=/opt/homebrew/opt/openjdk@21 pnpm emul:rules
```
CI (`deploy.yml`) runs typecheck, lint, unit tests, AND the rules suite before
deploying — rules auto-deploy on push, so never skip `emul:rules` after editing
`firestore.rules`.

## Firestore Data Layout (two generations)
- **Tenant-scoped**: `tenants/{tid}/settings|members|employees|shifts|timesheets|...`
- **Top-level tenant-keyed** collections carry a required `tenantId` FIELD.
  Some are still canonical (`attendance`, `leave_requests`, `leave_balances`,
  `jobs`, `candidates`); others are migration-era. For Time & Leave, see the
  exact authority table in `docs/TIME_LEAVE.md`.
  Rules for these must never reference `request.resource` in delete clauses
  (deletes have no request.resource — see tests/rules/legacy-collection-deletes.test.ts).
  Admin scripts that delete a tenant must also sweep these by `tenantId`.

## Ekipa Mobile App (Expo)

**Expo account**: `naroman`

```bash
# Dev server
cd mobile/ekipa && pnpm exec expo start --clear

# Build APK (Android preview)
cd mobile/ekipa && eas build --platform android --profile preview

# Build production AAB
cd mobile/ekipa && eas build --platform android --profile production
```

## Xefe Bot (Server)

The Xefe AI assistant lets HR managers query company data via WhatsApp and a web dashboard.

```bash
# Xefe API (local dev)
cd server/xefe-api && npm install && npm run dev

# Deploy Xefe API to Hetzner (PM2)
# The excludes are load-bearing: /opt/xefe-api holds the prod .env and
# serviceAccountKey.json, which exist ONLY on the server — a bare
# `--delete` rsync would destroy them (and nuke node_modules).
rsync -avz --delete --exclude .env --exclude serviceAccountKey.json \
  --exclude node_modules --exclude .DS_Store \
  server/xefe-api/ hetzner:/opt/xefe-api/
ssh hetzner 'cd /opt/xefe-api && npm ci --omit=dev && pm2 restart xefe-api'

# Deploy OpenClaw bot
cd server/openclaw-xefe && ./deploy.sh

# Pair WhatsApp (on server)
docker exec -it openclaw-xefe openclaw channels login
```

**Ports on Hetzner:**
| Service | Port | Process |
|---------|------|---------|
| Xefe API | 3201 | PM2 |
| OpenClaw Xefe | 18790 | Docker |
| Hotel API | 3100 | PM2 |
| OpenClaw Hotel | 18789 | Docker |

**Sensitive files (never commit):**
- `server/xefe-api/.env` — API key, tenant ID
- `server/xefe-api/serviceAccountKey.json` — Firebase Admin credentials
- `server/openclaw-xefe/.env` — Anthropic API key
- `server/openclaw-xefe/openclaw.json` — Bot config with API keys

## Firestore Timestamps
Always handle Firestore Timestamps properly:
```typescript
// In mapper functions:
createdAt: data.createdAt instanceof Timestamp
  ? data.createdAt.toDate()
  : data.createdAt || new Date()
```

## UI Rules
- **Simplicity first** — see `docs/DASHBOARD_DESIGN.md`. Customers are first-time, mobile, often non-accountant TL small businesses. Dashboards answer only "what needs attention / the one number / where to go next"; analysis lives on report pages one tap away. **No charts on dashboards or report summaries** (recharts being installed ≠ permission to use it). Don't add filters/toggles/date-pickers to dashboards or a second row of overview cards. When a request would over-complicate, push back and offer the simpler version rather than building it.
- **Top-left logo is Xefe's, always** — the app-chrome brand (top bar + sidebar header) always shows the Xefe logo, never the tenant/client logo (not even as an "if uploaded" fallback). The client logo belongs on their invoices/PDFs (`companyDetails.logoUrl`), not the app chrome. The `CompanyBrand` component that did this was removed — don't reintroduce it.
- **No left border accents on cards** — do not use `border-l-4 border-l-{color}` on Card components. Use standard borders only.
- **No stat cards on report pages** — report pages should use report cards (title, description, label:value rows, export button) and data tables, not 4-column stat card grids.
- **Brand color** is `#6A9C29` — use `text-primary` / `bg-primary` instead of hardcoded `text-green-500` / `bg-green-500` for brand accent colors. Semantic status colors (success/error badges) can stay as Tailwind greens/reds.

## Page Patterns
All pages follow consistent patterns:
- `useTenantId()` - tenant isolation for multi-tenant support
- `useToast()` - user feedback for success/error states
- `Skeleton` loading states during data fetches
- Proper error handling with try/catch and toast notifications
- `Dialog` for forms, `AlertDialog` for confirmations

## Git
- Main branch: `main`
- Auto-deploys on push to main (Firebase + Hetzner)
