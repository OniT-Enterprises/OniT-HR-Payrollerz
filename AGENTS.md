# AGENTS.md — Xefe (OniT HR/Payroll)

Guidance for AI coding agents (Codex, Claude, etc.) working in this repo. For
the full project map see **CLAUDE.md**; for visual patterns see
**STYLE_GUIDE.md**.

## Stack & commands
- React 18 + TypeScript + Vite, Tailwind + shadcn/ui, Firebase (Firestore/Auth).
- Package manager: **pnpm** (`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`).
- Before committing: `pnpm typecheck && pnpm test` must pass (CI also lints and
  runs the Firestore rules suite).
- Money/currency math goes through `client/lib/currency.ts` (Decimal.js) — never
  raw `+`/`*` on money.

## Product simplicity mandate (read before building UI)

Xefe's customers are **Timor-Leste small businesses** — often first-time
software users, on a **phone over a slow connection**, frequently not
accountants. **Simplicity is a hard requirement, not a preference.** A screen
that a power user would enjoy can actively fail our real customer.

Default to **less**. Ship the smallest thing that does the job and link deeper
for detail. The product should feel calm, not busy.

### Dashboards — the trap to avoid

Full rules: **`docs/DASHBOARD_DESIGN.md`** (read it before touching any
dashboard). The short version:

- A dashboard answers only: **what needs attention · the one number · where to
  go next.** Analysis belongs on report pages, one tap away.
- **Do NOT add charts** (bar/line/pie/area/sparkline) to dashboards or report
  summaries. `recharts` being installed is not permission to use it — charts
  live only in deep report pages and marketing pages today.
- **Do NOT add stat-card grids to report pages**, filters/date-pickers/toggles
  to dashboards, or a second row of overview cards to "fit more in."
- Keep the existing pattern in `client/pages/*Dashboard.tsx`: greeting →
  one row of tappable single-number action cards → "things to do" list.

### When a request would over-complicate

**Push back before building.** Don't silently implement a wall of charts/KPIs.
1. State the risk in one line ("adds decode-cost for first-time mobile users").
2. Offer the simpler alternative (an action card that links to a report, not an
   embedded chart).
3. Build the simple version by default; only go heavier if the human reaffirms
   after seeing the trade-off — and even then, put charts on a report page, not
   the landing dashboard.

The dashboard should get **shorter** over time, not longer. When in doubt, ship
less and link deeper.
