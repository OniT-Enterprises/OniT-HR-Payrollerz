# Public marketing site — pages, locales, SEO

_Last updated: 2026-07-19. Audience: anyone touching the public pages, their
routing, or their SEO. Design language lives in `docs/DESIGN_MARKETING.md`;
this doc is the plumbing._

## Host split (2026-07-21)

Marketing lives on **xefe.tl**; the authenticated app on **app.xefe.tl**
(noindex, same SPA build). Consequences for this doc's scope:

- Marketing routes are recognized server-side by their **generated static
  head directories** — a marketing page missing from
  `scripts/generate-static-heads.ts` will 301 to app.xefe.tl and bounce
  back via HostGuard (two hops). Always register new pages.
- `/auth/*` belongs to app.xefe.tl (nginx redirects; marketing CTAs may keep
  relative links). `/i/` and `/apply/` share links stay on the apex forever.
- Path ownership logic: `client/lib/hosts.ts` (used by HostGuard in App.tsx).

## The pages

| Page | Route | Component | Accent |
|---|---|---|---|
| Home | `/` (and `/landing`) | `client/pages/Landing.tsx` | gold |
| How it works | `/how-it-works` | `client/pages/ProductDetails.tsx` | lime |
| **The engine** | `/engine` | `client/pages/XefeEngine.tsx` | gold |
| Security | `/security` | `client/pages/SecurityPage.tsx` | sky |
| Pricing | `/pricing` | `client/pages/Pricing.tsx` | gold-minimal |
| For accountants | `/accountants` | `client/pages/AccountantPartners.tsx` | sky |
| **Docs home** | `/docs` | `client/pages/DocsIndex.tsx` | lime |
| Docs: money chain | `/docs/payroll-money-chain` | `client/pages/DocsMoneyChain.tsx` | lime |

Docs articles share the lime accent; /docs sits in the top nav. Public docs
content rule: statutes, deadlines, and Xefe's own product guarantees only —
**never mention data sourcing** (the same rule as the /engine proof wording
below). Internal file paths and sign-off status stay internal; the repo-side
source of truth for the money-chain article is `docs/MONEY_CHAIN.md`.

### Docs framework (full product documentation)

Generic articles are typed data files rendered by ONE page — adding an
article does NOT need a new component:

1. Content: `client/content/docs/<slug>.ts` exporting
   `article: LocalizedDocArticle` (en/pt/tet blocks —
   `client/lib/docs/types.ts` has the block palette: prose, heading, steps,
   list, callout, deadlines, ledger, table).
2. Loader: one line in `client/lib/docs/registry.ts` (lazy chunk per article).
3. Manifest: one entry in `client/lib/docs/manifest.ts` (slug, category,
   per-locale SEO + hub card). The hub, the `/docs/:slug` route, the
   localized-path check and the static heads all read the manifest —
   no further wiring.
4. `public/sitemap.xml` ×3 URLs with alternates.
5. Bespoke visual articles (e.g. the money chain) keep their own component:
   set `custom: true` in the manifest and register explicit routes BEFORE
   `/docs/:slug`.

Current articles: getting-started, running-payroll, tax-and-filings,
invoices-and-money, time-and-leave (guides) + payroll-money-chain
(architecture, custom).

Shared chrome: `PublicNav` (pages-only menu), `PublicSectionNav` (in-page
anchors + page accent), `SectionEyebrow`/`Crescent`, `PublicFooter`.

## Locale-prefixed URLs (Google-indexable translations)

English lives at the bare path; Tetun and Portuguese live under prefixes so
each language is crawlable at its own URL:

```
/pricing        → en (x-default)
/tet/pricing    → Tetun
/pt/pricing     → Português
```

- Helpers: `client/lib/publicLocale.ts` (`localeFromPath`, `stripLocalePrefix`,
  `withLocalePrefix`, `LOCALIZED_PUBLIC_PATHS`). Marketing pages/footer build
  links with `withLocalePrefix` so visitors stay inside their language.
- **URL↔locale sync lives in `PublicNav`**: navigating to a prefixed URL
  switches the i18n locale (URL wins); switching locale via the switcher
  rewrites the URL prefix (replace, keeps hash). A bare URL on first load does
  NOT override a stored preference — shared English links never force a
  language.
- `client/lib/publicPaths.ts` strips the prefix before the public-path check —
  `/tet/...` must never render the authenticated app shell.
- Routes are registered three times in `client/routes.tsx` (bare + `/tet` +
  `/pt`), all through `marketingRoute()`.

## SEO

- `client/lib/seo-config.ts`: each marketing entry carries `alternates.tet` and
  `alternates.pt` (translated title + description). Kept react-free so build
  scripts can import it.
- `client/components/SEO.tsx`: when `alternates` is present it follows the
  **URL's** locale (crawlers have no stored preference) — localized
  title/description, self-referencing canonical per language, an hreflang
  cluster (`en`, `tet`, `pt`, `x-default` → en) and `og:locale`.
- `scripts/generate-static-heads.ts` (runs in `npm run build`): writes a no-JS
  `index.html` per route **per locale** (21 files as of /security) with translated meta,
  `<html lang>`, canonical and the hreflang cluster. nginx `try_files` picks
  the directories up with zero config.
- `public/sitemap.xml`: every marketing URL × 3 locales with
  `xhtml:link rel="alternate"` entries.
- Caveat: Tetun has no ISO 639-1 code; we use `tet` (ISO 639-2/3) in paths and
  hreflang. Google may ignore that hreflang value, but the pages still index
  normally via sitemap + internal links. Portuguese (`pt`) clusters fine.

## Adding a new public page — checklist

1. Page component in `client/pages/`, built from the shared marketing
   components; pick ONE accent per `docs/DESIGN_MARKETING.md`.
2. `client/routes.tsx`: bare route + `/tet` + `/pt` variants (marketingRoute).
3. `client/lib/publicLocale.ts`: add to `LOCALIZED_PUBLIC_PATHS`.
4. `client/lib/publicPaths.ts`: add to `PUBLIC_PATHS` (bare path).
5. `PublicFooter`, plus `PublicNav` `NAV_LINKS` only when the page earns a
   top-nav slot (the menu stays short; /security is deliberately footer-only).
6. i18n strings in `client/i18n/locales/{en,tet,pt}.ts` +
   `npm run i18n:rebuild-master`. Tetun copy needs a native-speaker pass.
7. `client/lib/seo-config.ts` entry **with `alternates`**.
8. `scripts/generate-static-heads.ts` `ROUTES` list.
9. `public/sitemap.xml` (×3 URLs with alternates) + `public/llms.txt`.
10. `pnpm typecheck && pnpm test`, then build and eyeball
    `dist/spa/<page>/index.html` and the `/tet/`+`/pt/` variants.

## Content invariants

- **Worked payroll figures on public pages must be engine-exact.** The current
  example set (PayslipExample, Landing calc card, ProductDetails journal,
  `howItWorks.example.formulas` in all three locales, and the /engine trace):
  $1,200 base · hourly $6.29 (annualized 44×52÷12) · overtime 12 h ×1.5 =
  $113.22 · food allowance $100 · gross $1,413.22 · WIT −$91.32 · employee
  INSS −$48.00 (4% × $1,200 — **overtime and the food allowance are outside
  the INSS base**, DL 20/2017 Art. 9) · net $1,273.90 · employer INSS $72.00 ·
  employer cost $1,485.22 · 13th-month accrual $100.00/mo. If you change the
  example, recompute through `client/lib/payroll/calculations-tl.ts` and update
  every surface + locale together.
- **/engine proof wording stays vague about sourcing.** It may say the engine
  is checked against "real-world practice" and "official assessments" — it must
  never mention the mail corpus, message counts, firm identities, or
  identifiable assessment amounts. Statute citations and test counts are fine;
  understate drifting numbers ("600+ tests").
- The engine page's rate table lists statutory withholding rates; rows are
  badged either "matches official assessments" or "statutory rate" — never
  expose internal sign-off status publicly.
