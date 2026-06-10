# Icons vs. images — scope & rules

Decided June 10, 2026. Goal: richer imagery where it reads, without putting
XefeBot on every surface.

## The rule of thumb
- **< ~40px (nav, page-header badge, table actions):** keep Lucide line icons.
  Images don't read at this size. Tint the icon to the **section color**.
- **Card size (~48–96px):** themed **object** illustration (NO bot), in the
  section color.
- **96px+ emotional/identity moments (empty state, success, 404, the AI
  assistant, onboarding/welcome):** **XefeBot** illustrations. Bot lives here
  and ONLY here — never as a routine icon.

## Section color palette (canonical, already in code)
| Section | Color |
|---|---|
| People (Staff / Hiring / Performance) | blue |
| Time & Leave | cyan |
| Payroll | primary green `#6A9C29` |
| Money | indigo |
| Accounting | orange |
| Reports | violet |

(Payroll-tax reports under Reports — WIT/INSS/allocation — intentionally keep
payroll green to signal they're payroll artifacts; analytics reports use violet.)

## Status
- ✅ Page-header badges + hub-card badges already tinted per section.
- ✅ XefeBot pulled OFF the People hub cards (was 4 bots on one page).
- ✅ Bot retained only on: empty states, success dialog, 404, dashboard
  assistant (`xefebot.webp`).
- ⏳ **Pending art:** themed NON-bot object illustrations for the module hub
  cards (below). Until generated, hub cards show the tinted Lucide icon badge.

## Generation spec — themed object illustrations (NO bot)
Same flat-kawaii style as the XefeBot set (thick clean outlines, soft shading,
transparent background, soft glow, reads on dark `#0a0a0b`), but **the subject
is the object, not the bot.** One per hub card, dominant color = section color.
Square-ish, ~512px, transparent PNG.

1. **people** (blue) — three friendly diverse employee avatars grouped
2. **hiring** (blue) — a CV/résumé document with a magnifying glass
3. **timeleave** (cyan) — a calendar with a small clock
4. **performance** (blue) — a gold star/target with an upward sparkle
5. **payroll** (green) — a stack of cash + a coin
6. **money** (indigo) — an invoice document with a $ badge
7. **accounting** (orange) — a balance scale / ledger book
8. **reports** (violet) — a bar chart trending up

Drop generated files on the Desktop; processing pipeline = trim → resize 512 →
cwebp q88 → `public/images/illustrations/xefe-card-<name>.webp`, then wire into
each dashboard's hub cards (replacing the icon badge with the image, same
pattern used briefly on People).
