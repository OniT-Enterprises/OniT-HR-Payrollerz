# Dashboard & UI Simplicity — guardrails for agents

**Audience: AI coding agents (Claude, Codex) working on this repo.** Read this
before adding anything to a dashboard, landing page, or any customer-facing
screen. When a request would violate these rules, **push back first** (see
"How to push back" at the end) rather than silently building the complex thing.

## Who the customer is (this is the whole reason)

Xefe's users are **Timor-Leste small-business owners and HR/finance staff** —
often using business software for the first time, frequently on a **phone over
a slow/expensive mobile connection**, many not accountants and not
native English/Portuguese readers. Market reality (2026 research): ~44%
internet penetration, mobile-first, cash economy, **<1% of MSMEs use any
digital finance platform**.

The implication is not negotiable: **a screen that a confident spreadsheet
user would enjoy can actively fail our actual customer.** Every chart, KPI
tile, and toggle is something they must decode. Default to less.

## The one job of a dashboard here

A dashboard answers three questions, in this order, and nothing else:

1. **What needs my attention right now?** (overdue tax, unrun payroll, pending leave)
2. **What's the one number I care about?** (days to payday, cash in, staff count)
3. **Where do I go next?** (a tap to the actual working screen)

If a proposed addition doesn't serve 1–3, it doesn't belong on the dashboard.
Analysis and history live on their **report pages**, reachable by a tap — not
piled onto the landing screen.

## The pattern we already have (protect it)

`client/pages/Dashboard.tsx` and the module dashboards follow a deliberately
calm structure. Keep new work inside it:

1. **Greeting / assistant strip** — one line of human context.
2. **Overview cards** — a single row (2 cols mobile, up to 4 desktop). Each card
   is **tappable**, shows **one big number + a short label + at most one status
   signal** (a check, an amber warning, a small count badge), and navigates
   somewhere useful. That's it. No mini-charts inside cards.
3. **Things to do** — a short, actionable list; each row links to the fix.
4. Optional: one row of quick links.

That is the whole vocabulary. New dashboard value = **a new action card or a
new to-do row**, not a new visualization.

## Rules

**DON'T**
- ❌ Add charts (bar/line/pie/area/donut/sparkline) to a dashboard or a report
  page's summary. We have `recharts` available; that is not permission to use it.
  Charts currently live only in deep report pages (e.g. Department Reports,
  Custom Reports) and marketing pages — keep it that way.
- ❌ Add "stat card" grids (the 4-up colored-number tiles) to **report pages**.
  Report pages use report cards (title, description, label:value rows, export
  button) + data tables. (This rule predates you — see CLAUDE.md.)
- ❌ Add filters, date-range pickers, segment toggles, or "views" to a dashboard.
  Those belong on the report page the card links to.
- ❌ Show a number the user can't act on or doesn't already understand.
- ❌ Add a second row of overview cards to "fit more in." If it doesn't fit in
  one row, you're showing too much — cut, don't wrap.
- ❌ `border-l-4` left-accent stripes on cards; hardcoded `text-green-500` for
  the brand (use `text-primary` / `#6A9C29`). (Existing CLAUDE.md rules.)

**DO**
- ✅ Prefer one clear number over three hedged ones.
- ✅ Make every card and row a tap-target that goes to the real screen.
- ✅ Put the scary/urgent thing (overdue compliance) where the eye lands first.
- ✅ Keep it working on a narrow phone screen and a slow connection — fewer
  queries, no heavy client-side charting libs on the landing screen.
- ✅ Localize every label (en/pt/tet) — a chart axis nobody can read is worse
  than no chart.

## The test before adding anything to a dashboard

Ask, in order — if any answer is "no", don't add it:
1. Does it answer "what needs attention", "the one number", or "where next"?
2. Can a first-time, non-accountant user grasp it in **under 3 seconds** without
   a legend or tooltip?
3. Does it still work one-handed on a phone over 3G?
4. Would removing it lose anything the user can't get by tapping into a report?

A good rule of thumb: **the dashboard should get shorter over time, not longer.**
New detail almost always belongs on a report page, one tap away.

## How to push back (do this, don't just comply)

If asked to "add some charts / KPIs / analytics to the dashboard" or similar:

1. **Name the risk in one sentence**: "That adds decode-cost for first-time,
   mobile users — the dashboard's job is attention + next action, not analysis."
2. **Offer the simpler alternative that meets the real goal**, e.g.:
   - "I'll add one action card ('Revenue this month — tap for the P&L')
     instead of an embedded chart."
   - "The trend chart fits the Reports section — I'll put it there and link
     the dashboard card to it."
3. **Build the simple version by default.** Only build the heavier version if the
   human explicitly reaffirms after seeing the trade-off — and even then, put
   charts on a report page, never the landing dashboard.

Simplicity is the feature. When in doubt, ship less and link deeper.
