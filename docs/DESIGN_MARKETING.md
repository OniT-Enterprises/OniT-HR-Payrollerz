# Xefe Marketing Design Language

_Last updated: 2026-07-19. Scope: the PUBLIC pages — `/`, `/how-it-works`,
`/engine`, `/pricing`, `/accountants`, legal pages. The authenticated app is
governed by `STYLE_GUIDE.md` (calm, no gradients); this document covers the one
place drama is allowed. Read both before touching public pages, and
`docs/PUBLIC_SITE.md` for routing/locales/SEO plumbing._

Format inspired by the design-md project
(github.com/Khalidabdi1/design-ai); reference systems studied: Gusto, Mercury,
Stripe, Deel, Ramp, Xero.

---

## 1. Visual theme & atmosphere

Xefe means "boss" in Tetun. The marketing site should feel like **a confident
local boss, not a Silicon Valley template**: dark, warm, gold-lit — closer to
evening in Dili than to a developer-tool landing page. Payroll is money and
trust, so every decorative choice defers to one thing: **real, legible
numbers**. The hero artifact is a calculated payslip, not an abstract
illustration — that stays our signature.

- Mood: assured, warm, precise, local.
- Density: low. One idea per section. Generous dark space.
- Character: near-black canvas, gold crescent motif, calculation artifacts
  shown as proof.

## 2. Color palette & roles

| Token / class | Value | Role |
|---|---|---|
| Canvas | `#0a0a0b` | Page background, all public pages |
| Gold (brand) | `amber-400` `#fbbf24` | Primary CTAs, Home page accent, price figures |
| Gold text | `amber-300` | Eyebrows, active nav, inline accents on dark |
| Brand green | `#6A9C29` / `lime-400` | How-it-works page accent, success ticks |
| Sky | `sky-300/400` | For-accountants page accent only |
| Ink text | `white` / `zinc-400` / `zinc-500` | Headings / body / captions |
| Hairlines | `white/[0.06–0.10]` | Borders, section dividers |
| Panels | `white/[0.025–0.04]` | Cards; never pure gray fills |

**The per-page accent system is load-bearing**: Home = gold, How-it-works =
lime, The-engine = gold, For-accountants = sky, Security = sky,
Pricing = gold-minimal. Accent
drives the hero eyebrow chip, the H1 gradient line, the section-nav strip dot,
and section eyebrows — nothing else. One accent per page; never mix two accents
in one component.

## 3. Typography

One family everywhere: **Plus Jakarta Sans** (safe across EN/PT/Tetun
diacritics). Distinctiveness comes from treatment, not from adding fonts:

- Marketing H1: `text-4xl…text-[4.1rem] font-extrabold leading-[1.08]
  tracking-tight`, with **exactly one gradient line** (the accent line), never
  the whole heading.
- Eyebrows: 11px bold uppercase `tracking-[0.25em]` + the Crescent mark.
- Body: `text-lg leading-8 text-zinc-400`, max ~2 sentences per paragraph.
- **Money and calculations: always `tabular-nums`**, right-aligned in tables,
  never gradient, never italic. Numbers are the product — treat them like
  Mercury treats balances (large, light, exact), not like decoration.

## 4. Signature motifs (what makes it OURS)

1. **The gold crescent** — the mark above the “x” in the logo. It is the only
   decorative shape allowed: section eyebrows, oversized background watermark
   (≤5% opacity), section-nav dots. No other blobs, orbs, grids, or waves.
2. **Calculation artifacts as heroes** — the payslip example, the worked WIT
   journal, the pricing card. Show the real output with real math; never a
   fake dashboard screenshot or stock illustration.
3. **Tetun-first trust markers** — “Tetun, English and Portuguese”, WhatsApp
   support, TL bank names. Local specificity IS the differentiator; a generic
   competitor cannot say these things.
4. **The section-nav strip** — page name + dot in the page accent, local
   anchors. Every long page carries it; it doubles as the "you are here"
   signal.

## 5. Component patterns

- Cards: `rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6`; icon
  in an 11×11 rounded square tinted with the page accent at /10 opacity.
- Primary CTA: solid `bg-amber-400 text-zinc-950 font-bold` with a soft amber
  shadow. Secondary: `border-white/10 bg-white/5`. Never two solid CTAs
  side-by-side.
- Sections: `py-20 lg:py-24`, separated by hairline `border-t`, one eyebrow +
  one H2 + one paragraph before any grid.
- Numbered steps: oversized ghost numerals (`01…04`) + short titles — keep.
- **Founding-offer callout** (`components/marketing/FoundingOffer.tsx`): a
  single-accent gold flat-tint card (`border-amber-400/25 bg-amber-400/[0.04]`,
  matching the pricing card) — badge + a bold **paragraph** title (not an `<h*>`,
  so it doesn't disturb the page heading outline) + one solid CTA + fine print.
  Shown as a band below the Home hero and above the Pricing card. Copy is i18n
  (`landing.simple.founding.*`). Stays gold-only on both pages — do **not**
  reintroduce a second accent (see §2, §7).
- **FAQ accordion** (`components/marketing/MarketingFaq.tsx`): native
  `<details>`/`<summary>` cards, single page accent, a `Plus` glyph that rotates
  to `×` on open. Emits **FAQPage JSON-LD via Helmet built from the same visible
  strings**, so structured data can't drift from the copy. Content in
  `landing.simple.faq.*` (6 Q&A). No emoji, no gradient — on-palette.

## 6. Motion

Marketing pages are **still**. No scroll-triggered reveals, parallax, marquee
logos, typewriter effects, or counter animations. Transitions are hover-only,
150–250ms, color/opacity. (Slow TL connections and low-end phones are the
audience; stillness reads as confidence.)

## 7. Anti-vibe-code rules (hard bans)

The fastest tells that a site was generated, and therefore banned:

- Purple→blue gradients, or gradients on more than one element per viewport.
- Glassmorphism blur cards, neon glows, grid-paper backgrounds, floating 3D
  blobs.
- Emoji as icons or bullet points anywhere on the site.
- Fake social proof: invented testimonials, logo walls of companies that are
  not customers, "Trusted by 10,000+ businesses" without a real number.
- Stat counters animating up; fake "live" activity feeds.
- Default shadcn look shipped unstyled (default radius + default slate +
  default shadows together).
- Big generic value words as H1 ("Supercharge", "Revolutionize", "Unleash").
  Xefe headlines state a plain outcome: "Pay your team correctly."
- Dead links, placeholder Lorem, `#` hrefs, or anchor menu items that pretend
  to be pages (see the Jul 18 nav rework — menu items are real pages only).

## 8. Borrowed principles (and from whom)

- **Gusto**: payroll software may be warm; data displayed "with care, not
  density"; approachable sentence-case microcopy.
- **Mercury**: calm precision; balances big and light-weight; thin hairlines
  instead of boxes; restrained luxury on dark surfaces.
- **Stripe**: drama with discipline — kinetic marketing but calm docs;
  gradients budgeted; real product output as the hero visual.
- **Xero/Deel**: plain-language compliance claims beat feature lists for SMB
  buyers.

## 9. Current improvement backlog

1. ✅ (2026-07-18) `tabular-nums` on public-page money figures — payslip
   example, pricing card, landing price teaser; calculation tables were
   already monospace.
2. ✅ (2026-07-18) Crescent watermark on every hero — Pricing and
   Accountants heroes now carry it in their page accent.
3. ☐ Real TL photography or drawn Dili scenes for the support/local sections
   instead of icon grids, when assets exist (content task, not code).
4. ✅ (2026-07-18) Subtle grain on the canvas (`.public-grain` in global.css,
   ~1KB SVG noise tile, no JS) — applied to all four public page roots.
5. ✅ (2026-07-18) Section-nav strip added to the Home page (amber accent);
   landing workflow numerals enlarged to the oversized ghost style; off-palette
   blue icon on the payslip block corrected to amber; WhatsApp number updated
   sitewide to +670 7337 1307.
6. ✅ (2026-07-19) Founding-user offer ("6 months free") callout on Home +
   Pricing, and a FAQ section on Home with FAQPage schema. Kept single-accent
   gold — an initial amber→lime gradient on the callout was corrected to a flat
   amber tint (it broke the one-accent-per-page rule in §2/§7).
