# Xefe rebrand + xefe.tl launch — handoff (2026-07-13)

Status doc for the meza → Xefe / xefe.tl migration. What shipped, what's still open, and how to roll back.

## ✅ Done & verified live

| Area                | Result                                                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domain**          | `xefe.tl` live — Cloudflare (proxied, SSL **strict**, HSTS) → Hetzner. LE origin cert `xefe.tl`+`www.xefe.tl` (exp **2026-10-11**).                                                                                                       |
| **Redirects**       | `meza.naroman.tl` + `payroll.naroman.tl` → **301 → xefe.tl**. `meza.naroman.tl/api/` + `/openclaw/` kept as legacy shims.                                                                                                                 |
| **Public branding** | canonical / OG / Twitter / `SEO.tsx` `BASE_URL` / robots / sitemap / llms.txt → `xefe.tl`; `index.html` theme-color → brand green `#6A9C29`.                                                                                              |
| **Infra rename**    | PM2 `meza-api`→`xefe-api` (`/opt/xefe-api`); Docker `openclaw-meza`→`openclaw-xefe` (`/opt/openclaw-xefe`, 8 volumes migrated with data); plugin `meza-hr`→`xefe-hr`.                                                                     |
| **openclaw**        | **PINNED `openclaw@2026.4.15`** in the Dockerfile. Plugin loads 65 tools + 5 commands.                                                                                                                                                    |
| **CI**              | `deploy.yml` Hetzner rsync target → `/var/www/xefe.tl/dist/spa`.                                                                                                                                                                          |
| **Local**           | working dir `~/Sites/meza` → `~/Sites/xefe`; Claude memory dir mirrored to the `-xefe` key.                                                                                                                                               |
| **Firebase**        | display name → **"Xefe"** (project id `onit-hr-payroll` **unchanged — immutable**).                                                                                                                                                       |
| **Auth domain**     | custom auth domain **`auth.xefe.tl`** (Firebase Hosting custom domain + CNAME→`onit-hr-payroll.web.app` + LE cert; added to authorized domains; `VITE_FIREBASE_AUTH_DOMAIN` secret flipped; verified shipped to xefe.tl **and** web.app). |
| **OAuth consent**   | App name "Xefe" + logo (`public/icon-512x512.png`) submitted to Google review (required Search Console DNS-TXT verification of `xefe.tl`).                                                                                                |

## ⏳ Continue later

1. **[TEST] Google sign-in on xefe.tl** — should read _"to continue to auth.xefe.tl"_ and complete. Final confirmation of the auth-domain flip.
2. **OAuth branding review** — check Google **Verification Center** in a few days; the "Xefe" name shows immediately, the logo displays once approved.
3. **Bot model-auth 403** — `openclaw-xefe` agent returns `403 OAuth authentication is currently not allowed for this organization`. This is the **dead shared `sk-ant-oat01-` subscription token**, down fleet-wide (see `~/Sites/ops/ISSUES.md`). Not caused by the rename — the `xefe-hr` plugin is healthy. **Fix:** drop a fresh Anthropic token with headroom into `/opt/openclaw-xefe/.env`, **or** move the agent to `openai/gpt-5.5` like emis did.
4. **~~Cloud Functions `DEFAULT_APP_URL`~~ — DONE July 20 2026.** CI now
   deploys Functions before the Hetzner client after the full release gates,
   using the dedicated `FIREBASE_DEPLOYER_JSON` service account.
5. **Retire `meza.naroman.tl` shims** — once confirmed nothing external hits `meza.naroman.tl/api/` (e.g. Rezerva/Esplanada sync), collapse that vhost to a pure 301.
6. **ops repo edits** — `~/Sites/ops/CLAUDE.md` + `ISSUES.md` have **uncommitted** path-reference updates (`~/Sites/meza` → `~/Sites/xefe`). Review/commit.
7. **Optional — apex auth domain** — sign-in screen currently reads `auth.xefe.tl`. To make it read `xefe.tl` (apex) you'd reverse-proxy `/__/auth/*` on the xefe.tl nginx (higher effort/risk). Not done.
8. **Stale memory copy** — `~/.claude/projects/-Users-tonyfranklin-Sites-meza/` is superseded by the `-xefe` copy; can be deleted.

## Rollbacks & gotchas

- **Auth domain rollback:** `gh secret set VITE_FIREBASE_AUTH_DOMAIN --body "onit-hr-payroll.firebaseapp.com"` then `gh run rerun <deploy-run-id>`.
- **openclaw must stay pinned `2026.4.15`** — `@latest` (2026.5.20) breaks plugin tool loading (0 tools). Bump only with a plugin-compat check.
- **`gh secret set NAME --body -` sets the literal value `-`** (does NOT read stdin). Use `--body "value"` or `printf value | gh secret set NAME`.
- **Cloudflare:** token in `~/Sites/ops/SERVER.md`; `xefe.tl` zone `fff5c3076670a5e327862fbc3a731d3c`.
- **gcloud:** default project is `onit-hotel` — pass `--project onit-hr-payroll`; Firebase Admin/Identity Toolkit APIs need `-H "x-goog-user-project: onit-hr-payroll"`.
