# Launch Ops TODO — remaining manual items

Status as of **10 June 2026**. The code side of the public launch is shipped and live
(see git history June 9–10: hardening, solo self-approval, leave-aware payroll sync,
Primos Books rebrand, security headers, privacy/terms pages, CI rules deploy).
Everything below is console/asset work that code can't do.

## High priority (do before marketing the launch)

### 1. Firestore backups + point-in-time recovery — ~5 min, biggest risk reducer
The only remaining single-point-of-failure: there is (as far as we could verify) no
backup schedule. For a payroll product, data loss is the worst-case scenario.

- Firebase Console → Firestore → **Disaster recovery** → enable **Point-in-time recovery**
- Add a **daily backup schedule** (7–14 day retention)
- Or via gcloud: `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14d`

### 2. Sentry error tracking — ~10 min
The app has full Sentry wiring (`client/main.tsx`) but ships disabled because no DSN
is configured. Production errors are currently invisible.

- Create a free project at sentry.io (platform: React)
- `gh secret set VITE_SENTRY_DSN --body "<the dsn>"` (it flows into the CI build)
- Next push to main activates it

### 3. Uptime monitoring — ~5 min
Nothing watches the site or API. Use UptimeRobot / healthchecks.io (free):

- `https://meza.naroman.tl/` (expect 200)
- `https://meza.naroman.tl/api/health` (expect 200, JSON `success: true`)

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

### 7. WhatsApp bot identity
`server/openclaw-meza` still presents as "Meza" to WhatsApp users. Rebrand to
**XefeBot** = config/persona change in `openclaw.json` + `./deploy.sh`.

### 8. OpenAI key rotation (optional)
The key in `.env.local` leaked into **local** builds only — verified the live CI-built
bundle never contained it. Rotating at platform.openai.com is good hygiene, not urgent.
(Root cause fixed: `client/lib/firebase.ts` no longer uses dynamic `import.meta.env[key]`.)

### 9. Domain naming (decision)
The public URL is still `meza.naroman.tl` (payroll.naroman.tl 301s to it) while the
product is now **Xefe** — consider registering `xefe.tl` and migrating. If the domain
changes: new nginx site + certbot, update CORS allowlist in `server/meza-api/index.js`,
CI deploy target, and Firebase authorized domains.

## Notes for whoever does this (or future Claude sessions)

- **Firebase CLI on this Mac is logged out** (stale session was cleared June 10).
  Run `firebase login` before manual CLI work — or skip it: rules deploy works
  without login via `GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/deploy-rules.mjs`.
- **CI deploys everything now**: hosting + Hetzner rsync + Firestore rules
  (rules via Admin SDK script — the firebase-tools CLI path 403s because neither
  service account has `firebaserules` IAM roles).
- **meza-api deploys are still manual**:
  `rsync -avz --delete --exclude .env --exclude serviceAccountKey.json --exclude node_modules server/meza-api/ hetzner:/opt/meza-api/ && ssh hetzner 'cd /opt/meza-api && npm install --omit=dev && pm2 restart meza-api'`
  (the `--exclude` flags protect the server's `.env` and credentials — do not drop them).
- **nginx security headers** live in `/etc/nginx/snippets/meza-headers.conf` on Hetzner,
  included at server level AND inside each `location` that has its own `add_header`
  (nginx discards inherited headers in those locations — keep the includes if editing).
- **FirebaseExtended/action-hosting-deploy is pinned at @v0** and runs under forced
  Node 24 (`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`) — verified working June 10, but watch
  for an upstream v1 release and adopt it.
- **Leave-type pay rules**: attendance→payroll sync treats unknown/custom leave types
  as PAID by default (see `computeLeaveCredits` in `client/lib/payroll/run-payroll-helpers.ts`).
  If a tenant adds a custom unpaid leave type, it must be the literal `unpaid` type to
  be deducted.
