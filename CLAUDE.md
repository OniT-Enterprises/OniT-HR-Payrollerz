# CLAUDE.md - Project Context

## Important
- **Frontend work**: Check `STYLE_GUIDE.md` for design patterns and colors before UI changes. Three invariants it now records, all of which were broken in production: `AppLayout` owns scrolling (`min-h-0` on the shell column — without it the whole document scrolls, sidebar included); dates use `DatePicker`, **never `<input type="date">`**; and **`pnpm e2e` is required before pushing UI work** — five user-facing bugs on 2026-08-07 passed typecheck, lint and 1,100+ unit tests. For the PUBLIC marketing pages (/, /how-it-works, /engine, /pricing, /accountants), also read `docs/DESIGN_MARKETING.md` — the codified marketing design language (per-page accents, crescent motif, anti-vibe-code bans).
- **Auth / sessions / lazy chunks**: Read `docs/AUTH_SESSION.md` before touching sign-in, sign-out, route guards, the host split, or dynamic imports. Two facts drive every rule there: Firebase auth state is per-ORIGIN (so a cross-host redirect must be decided from the PATH, never from "am I signed in?"), and session resolution can HANG (so nothing that recovers from a bad auth state — login, signup — may be gated on `authResolved` without a ceiling; use `useAuthSettled`). Four prod defects on 2026-08-04 were those two mistakes.
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
- **Uploaded documents (bills, receipts, timesheets)**: Read `docs/DOCUMENT_EXTRACTION.md` before touching `server/xefe-api/extract.js`, `client/lib/extracted-*.ts`, `client/lib/attendance/spreadsheet-text.ts`, or the upload paths in QuickBillDialog/Expenses/Attendance. The document is **attacker-controlled**, so one rule is absolute: **never add a bare `allowedTools: ['Read']`** to the extractor options — it auto-approves before the workspace check AND before `canUseTool`, which left an arbitrary-file-read open on the box holding `serviceAccountKey.json`. Four guards decide what reaches a money field (foreign currency, future date, multi-document file, protected PDF), a payslip is never a bill, and Excel time cells live on the 1899 epoch — rendering them as dates destroyed every clock time in real timesheets. `server/xefe-api/` deploys ONLY via `workflow_dispatch`, so the client and server halves ship apart unless you run it.
- **Payroll money chain**: Read `docs/MONEY_CHAIN.md` (diagrams) before touching payroll run statuses, settlement, payroll/tax journals, leaver final pay, or rules around `payruns`/`taxFilings` — it maps run lifecycle → journals → statutory filings and lists the non-negotiable invariants. §4a carries the **scope contract** for a leaver's once-only Art. 56 severance / Art. 44 subsídio / Art. 32 untaken-leave payout: entitlement and the amount netted off it must ALWAYS be computed over the same scope, from equally-recorded data. Four separate money bugs in Jul 2026 were that one mistake — three of them inside the fix for the previous one — so treat any change on one side as requiring the other. Adding the Art. 32 payout in Aug 2026 immediately inherited the same hazard (two runs over one termination period would each pay it), which is the fifth instance: **any new final-pay earning needs its own once-only guard before it ships.**
- **Bank payments**: Read `docs/BANK_PAYMENTS.md` before touching `client/lib/bank-transfers/*` or the Bank Transfers page. BNU/BNCTL take salary batches by emailed Excel pack + signed payment order (evidence-based), NOT CSV upload; bank-facing text stays Portuguese.
- **Accounting automations**: Read `docs/ACCOUNTING_AUTOMATIONS.md` before touching fixed assets, depreciation, or recurring journals. Recurring journal templates (`tenants/{tid}/recurringJournals`) post nightly via the `processRecurringJournals` Cloud Function; fixed-asset depreciation and disposal each post through `createJournalEntry` in ONE atomic transaction, guarded by append-only per-period docs (`fixedAssetPostings/{YYYY-MM}`, `recurringJournalPostings/{templateId}_{YYYY-MM}`) that make posting exactly-once — reversal = manual journal, never delete a guard. Depreciation math is straight-line **cumulative-cap** (accumulated never exceeds cost−residual, never a negative charge) using decimal.js money helpers, pure/unit-tested in `client/lib/accounting/{recurring,depreciation}.ts` — keep the CF copies in sync and `templateIsDue` lives in the functions module (tested=running). Acquisition posts NO GL journal (register-only, to avoid double-booking bill-acquired assets) — an open decision. Statutory Excel exports mirror OFFICIAL templates only (INSS portal DR, ATTL form — compliance); everything else (fixed-asset register, resumo sheets) is Xefe's own layout, never a client/firm workbook's.
- **Bot / AI assistant**: XefeBot is the **web chat only**, and it runs on the Claude Agent SDK inside `server/xefe-api` (`agentChat.js`), as does document extraction (`extract.js`). **WhatsApp and the OpenClaw gateway were retired on 2026-08-09** — the container, its nginx `/openclaw/` route and `server/openclaw-xefe/` are gone (recoverable from git history; the box keeps `/opt/openclaw-xefe` and the Docker volumes). Don't reintroduce a WhatsApp write path: the plugin's 28 write tools were the last callers of the legacy payroll endpoints that now fail closed. `server/xefe-api` remains the only AI surface.
- **Branding**: User-facing name is **Xefe** (Tetun for "boss"; Ekipa = employee app, XefeBot = assistant, Kaixa = sales product). Infra was renamed meza-* → xefe-* on 2026-07-13 (`server/xefe-api`, PM2 `xefe-api`); the canonical public domain is **xefe.tl** (was meza.naroman.tl, which now 301s to it). The `onit-hr-payroll` Firebase project ID is unchanged.

## Project Overview
OniT HR/Payroll System - React/TypeScript app for HR operations (hiring, staff, attendance and leave, performance, payroll, reporting) targeting Timor-Leste market.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite 6
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: React Context + TanStack React Query
- **Backend**: Firebase (Firestore/Auth)
- **Server**: Express.js REST API (Xefe API), which also hosts XefeBot and document extraction on the Claude Agent SDK
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
└── xefe-api/       # Express REST API + XefeBot (port 3201, PM2)
    ├── index.js    # Firestore endpoints (payroll mutations fail closed)
    ├── agentChat.js  # XefeBot web chat on the Claude Agent SDK
    └── extract.js  # Bill/receipt/timesheet reading, same SDK

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
CI (`deploy.yml`) runs typecheck, lint, unit tests, `i18n:check` AND the rules
suite before deploying — rules auto-deploy on push, so never skip `emul:rules`
after editing `firestore.rules`.

**`test:api` is NOT in the local gate.** It needs Java and the Firestore
emulator, so it lives in its own CI job (`api-tests`) and a green
typecheck/lint/test/e2e run says nothing about it. Run it yourself after
touching `server/xefe-api/` or a `package.json` script — that gap is how a
broken `test:api` reached CI on 2026-08-07 with everything else green:

```bash
PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" \
  JAVA_HOME=/opt/homebrew/opt/openjdk@21 pnpm test:api
```

**Local Firestore emulator port.** 8081 is regularly held by another project on
this machine (rezerva's Metro). THREE things need the new port, and missing the
third looks like a product bug, not a config one — the app renders, the form
fills, and the create button sits on "Creating…" forever because the browser is
talking to Metro:

```bash
# 1. firebase.e2e.json / firebase.dev.json — emulators.firestore.port
# 2. FIRESTORE_EMULATOR_HOST=localhost:<port>   (tests/e2e/helpers/admin.ts uses ||=)
# 3. VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=<port>   (the BROWSER app; defaults to
#    8081 in client/lib/firebase-core.ts)
```

Revert the JSON before committing. Also kill leftover emulators from a failed
run before retrying — a stale `cloud-firestore-emulator` jar keeps the port and
the next start dies with "port taken":
`pgrep -fl cloud-firestore-emulator`.

### Verifying from a git worktree

The right move when another session holds the shared tree — but three things are
gitignored or not installed, and missing any of them makes **all four e2e specs
fail identically at the first `locator.fill`**, which reads exactly like a code
failure and is not one:

```bash
git worktree add --detach "$WT" origin/main
cd "$WT" && pnpm install
cp ~/Sites/xefe/.env.local "$WT/.env.local"     # gitignored: VITE_FIREBASE_*
ln -sfn ~/Sites/xefe/functions/node_modules "$WT/functions/node_modules"
```

Without `.env.local` Firebase never initialises and the app renders nothing.
`functions/` is on **npm**, so `pnpm install` there does not fix it — you get
1112 unit tests instead of 1141.

Symptom guide: app renders but a control is missing → real bug. App renders
NOTHING and every spec dies on the first fill → environment.

**Never run `pnpm i18n:split-locales`.** It regenerates the locale files from
the master and deletes every comment in them (11 → 0 in `en.ts`, measured), with
`i18n:check` still green afterwards so nothing warns you. The normal direction
is edit a locale, then `pnpm i18n:rebuild-master`.

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
# AUTOMATIC since 2026-08-08: merging anything under server/xefe-api/ to main
# runs .github/workflows/deploy-api.yml, which rsyncs and reloads through
# `pm2 startOrReload` — index.js drains on SIGTERM (kill_timeout 200s) so a
# deploy no longer cuts off an extraction that can legitimately run 180s.
# Before that the box sat two weeks behind main with a security fix merged but
# NOT running, because this was dispatch-only.
#
# Manual fallback only (CI down). The excludes are load-bearing: /opt/xefe-api
# holds the prod .env and serviceAccountKey.json, which exist ONLY on the
# server — a bare `--delete` rsync would destroy them (and nuke node_modules).
rsync -avz --delete --exclude .env --exclude serviceAccountKey.json \
  --exclude node_modules --exclude .DS_Store \
  server/xefe-api/ hetzner:/opt/xefe-api/
ssh hetzner 'cd /opt/xefe-api && npm ci --omit=dev && pm2 startOrReload ecosystem.config.js --update-env'

# (OpenClaw/WhatsApp was retired 2026-08-09 — there is no bot gateway to deploy.)
```

**Ports on Hetzner:**
| Service | Port | Process |
|---------|------|---------|
| Xefe API | 3201 | PM2 |
| Hotel API | 3100 | PM2 |
| OpenClaw Hotel | 18789 | Docker |

Port 18790 is now free; `openclaw-hotel` on 18789 belongs to a different
project and must be left alone.

**Sensitive files (never commit):**
- `server/xefe-api/.env` — API key, tenant ID
- `server/xefe-api/serviceAccountKey.json` — Firebase Admin credentials

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
