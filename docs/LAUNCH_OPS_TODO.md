# Launch Ops TODO — remaining manual items

Status as of **10 June 2026**. The code side of the public launch is shipped and live
(see git history June 9–10: hardening, solo self-approval, leave-aware payroll sync,
Primos Books rebrand, security headers, privacy/terms pages, CI rules deploy).
Everything below is console/asset work that code can't do.

## High priority (do before marketing the launch)

### 0. Enable Google sign-in provider — ~3 min, REQUIRED for Google login to work
The "Continue with Google" buttons (login + signup) and the `/auth/onboarding`
self-serve org flow are wired in code, but the provider must be enabled in the
console before they work:

- Firebase Console → **Authentication → Sign-in method** → add **Google**, enable, save
  (set the public-facing project name + support email it prompts for)
- **Authentication → Settings → Authorized domains** → confirm `payroll.naroman.tl`
  (and any other production hostnames) are listed; `localhost` is there by default
- **Authentication → Settings → User account linking** → keep the default
  **"One account per email address"** so invited users (created email-first by
  `addTenantMember`) link to their Google identity instead of getting a duplicate uid
- Behaviour once enabled: existing/invited users sign straight in; a brand-new Google
  user (no profile) is routed to `/auth/onboarding` to create their company

### 1. ~~Firestore backups + point-in-time recovery~~ — DONE July 5 2026
Enabled via gcloud on the `(default)` database: **point-in-time recovery** (7-day
version retention), **delete protection**, and a **daily backup schedule** with 14-day
retention (schedule id `688b3702-fa98-4867-bebd-91192429b9f6`). Verify anytime with:
`gcloud firestore backups schedules list --database='(default)' --project=onit-hr-payroll`

### 2. Sentry error tracking — ~10 min
The app has full Sentry wiring (`client/main.tsx`) but ships disabled because no DSN
is configured. Production errors are currently invisible.

- Create a free project at sentry.io (platform: React)
- `gh secret set VITE_SENTRY_DSN --body "<the dsn>"` (it flows into the CI build)
- Next push to main activates it

### 3. ~~Uptime monitoring~~ — DONE July 5 2026 (GitHub Actions)
`.github/workflows/uptime.yml` probes every 30 min: site 200, API health JSON,
and the WhatsApp bot channel (via SSH, log-based). GitHub emails the workflow
author when a scheduled run fails. The WhatsApp step is `continue-on-error`
until the pairing is re-scanned — flip it to strict after re-pairing.
(An external monitor like UptimeRobot is still a nice-to-have for
independence from GitHub, but the gap is closed.)

## Medium priority

### 4. Spam protection on the public apply form
`/apply/:jobId` is constrained by Firestore rules (strict field validation) but has no
CAPTCHA or rate limiting. App Check wiring already exists in `client/lib/firebase.ts`:

- Create a **reCAPTCHA Enterprise** key (console.cloud.google.com/security/recaptcha)
- Register it in Firebase Console → App Check
- Set `VITE_RECAPTCHA_ENTERPRISE_KEY` as a GitHub secret + add to the CI build env

### 5. Legal pages review
`/privacy` and `/terms` are live in EN/Tetun/PT — plain-language drafts, not
lawyer-reviewed. Two actions:

- Confirm **info@naroman.tl** is the right public contact (used on both pages)
- Have someone familiar with TL practice read them (content in
  `client/i18n/locales/{en,tet,pt}.ts` under the `legal` section)

## Cosmetic / later

### 6. ~~App icon assets~~ — DONE June 10: rebranded to Xefe (gold kaibauk crescent + x
monogram); all favicon/PWA icon sizes generated and the manifest's previously-missing
icon files now exist. Remaining art task: a proper XefeBot mascot (current xefebot.webp
is the old book character).

### 7. ~~WhatsApp bot identity~~ — DONE July 5 2026
Renamed to **XefeBot** in the live `openclaw.json` (backup at
`openclaw.json.bak-20260705`), the workspace `IDENTITY.md`, the repo example
config, and the integration doc; gateway restarted and healthy.

**⚠️ Found while deploying: the WhatsApp pairing has been dead since July 2**
(2,596 × 401 "Connection Failure" in the logs — the phone unlinked the device).
Re-pair from a phone with the bot's WhatsApp account:
`ssh hetzner`, then `docker exec -it openclaw-xefe openclaw channels login`
and scan the QR. This outage went unnoticed for 3 days — item 3 (uptime
monitoring) would have caught it.

### 8. OpenAI key rotation (optional)
The key in `.env.local` leaked into **local** builds only — verified the live CI-built
bundle never contained it. Rotating at platform.openai.com is good hygiene, not urgent.
(Root cause fixed: `client/lib/firebase.ts` no longer uses dynamic `import.meta.env[key]`.)

### 9. Domain naming (decision)
The public URL is still `meza.naroman.tl` (payroll.naroman.tl 301s to it) while the
product is now **Xefe** — consider registering `xefe.tl` and migrating. If the domain
changes: new nginx site + certbot, update CORS allowlist in `server/xefe-api/index.js`,
CI deploy target, and Firebase authorized domains.

## Notes for whoever does this (or future Claude sessions)

- **Firebase CLI on this Mac is logged out** (stale session was cleared June 10).
  Run `firebase login` before manual CLI work — or skip it: rules deploy works
  without login via `GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/deploy-rules.mjs`.
- **CI deploys everything now**: hosting + Hetzner rsync + Firestore rules
  (rules via Admin SDK script — the firebase-tools CLI path 403s because neither
  service account has `firebaserules` IAM roles).
- **xefe-api deploys are still manual**:
  `rsync -avz --delete --exclude .env --exclude serviceAccountKey.json --exclude node_modules server/xefe-api/ hetzner:/opt/xefe-api/ && ssh hetzner 'cd /opt/xefe-api && npm install --omit=dev && pm2 restart xefe-api'`
  (the `--exclude` flags protect the server's `.env` and credentials — do not drop them).
- **nginx security headers** live in `/etc/nginx/snippets/xefe-headers.conf` on Hetzner,
  included at server level AND inside each `location` that has its own `add_header`
  (nginx discards inherited headers in those locations — keep the includes if editing).
- **FirebaseExtended/action-hosting-deploy is pinned at @v0** and runs under forced
  Node 24 (`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`) — verified working June 10, but watch
  for an upstream v1 release and adopt it.
- **Leave-type pay rules**: attendance→payroll sync treats unknown/custom leave types
  as PAID by default (see `computeLeaveCredits` in `client/lib/payroll/run-payroll-helpers.ts`).
  If a tenant adds a custom unpaid leave type, it must be the literal `unpaid` type to
  be deducted.
