# Xefe Interface Style Guide

This guide describes the visual and interaction rules for the Xefe product.
Read `AGENTS.md` first. For landing-dashboard decisions, also read
`docs/DASHBOARD_DESIGN.md`.

## Product standard

Xefe is used by Timor-Leste small businesses, often on a phone, over a slow
connection, by people who are new to business software.

The interface must be:

- calm before impressive;
- understandable without accounting knowledge;
- usable with one thumb;
- resilient on a narrow or slow connection;
- explicit about status and the next action;
- shorter over time, especially on dashboards.

When two designs solve the same problem, ship the one with fewer decisions,
less text, and less data on screen.

## Brand and color

The Xefe logo owns the top-left position in app chrome. Tenant logos belong on
customer documents, invoices, and PDFs only.

- Brand green: `#6A9C29`, used in logos and decorative brand moments.
- Action green: the accessible `primary` token, used for buttons, links, focus,
  and selection.
- Module colors identify destinations and small icons. They do not replace the
  primary action color.
- Red means blocking, overdue, destructive, or failed.
- Amber means attention or pending.
- Green means complete or healthy.

Always use semantic tokens such as `bg-background`, `bg-card`, `text-foreground`,
`text-muted-foreground`, `border-border`, and `bg-primary`. Do not hardcode gray
surfaces or use white text on an unverified color.

Gradients are reserved for public marketing artwork. Do not use gradients for
authenticated-app buttons, page headers, setup steps, dashboard cards, or icon
badges.

## Typography

Xefe uses Plus Jakarta Sans with the system stack as fallback.

```css
font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
```

Use a compact hierarchy:

- Page title: `text-2xl font-bold tracking-tight`
- Section title: `text-base` or `text-lg font-semibold`
- Card title: `text-sm` or `text-base font-semibold`
- Body: `text-sm`
- Supporting text: `text-xs text-muted-foreground`

Do not use oversized hero headings inside the authenticated app. Labels must
remain readable at 200% zoom and in English, Tetun, and Portuguese.

## Page layout

Use the established authenticated shell and `PageHeader`.

```tsx
<div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
  <PageHeader title={title} subtitle={subtitle} icon={Icon} />
  <div className="space-y-6">...</div>
</div>
```

- Phone padding: 16px.
- Desktop padding: 24px.
- Default vertical rhythm: 24px.
- Prefer one content column on phones.
- Introduce two or more form columns only at `sm`, `md`, or `lg` when fields
  retain a useful width.
- Never force a two-, three-, or four-column form on a phone.

Do not add colored hero bands, decorative orbs, large shadows, or left-border
accent cards to product pages.

## Dashboards

Dashboards answer only:

1. What needs attention?
2. What is the one useful number?
3. Where should I go next?

Use the existing order: greeting, one compact row of tappable numbers, things
to do, and module destinations. On phones, cut lower-priority cards instead of
wrapping an orphan card into another row.

Never put charts, filter bars, date pickers, report summaries, or a second KPI
grid on a dashboard. Link to the relevant report page.

## Cards and navigation surfaces

Cards are neutral containers, not decoration.

```tsx
<Card className="border-border/70 shadow-sm">
  <CardHeader>
    <CardTitle className="text-base">Title</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

Tappable navigation cards must have a clear label, one short supporting line,
and a minimum 44px target. On phones, module cards use a compact two-column
grid; illustrations are 48px and supporting copy is clamped to two lines.

Do not lift, bounce, or scale cards on hover. A border or background color
change is enough.

## Buttons and actions

- One primary action per page or decision step.
- Use the default `Button` variant for the primary action.
- Use `outline` for a legitimate secondary action.
- Use `ghost` for navigation, dismissal, and low-emphasis utilities.
- Move rarely used actions into an overflow menu.
- Destructive actions require a destructive style and confirmation when data
  cannot be recovered.

On phones, keep the primary and secondary completion actions in a sticky bottom
bar when a form is long. Important targets are at least 44px high and wide.

## Forms

- Mobile input, select, and textarea text is at least 16px.
- Labels sit above controls and remain visible; placeholders are examples, not
  labels.
- Required fields are limited to what the current workflow truly needs.
- Explain why tax, payroll, or identity information is required.
- Defer optional fields behind “More details” or a later settings screen.
- Checkbox and radio labels are part of the tap target.
- Errors appear next to the field and in plain language.

For long workflows, use a stepper with one decision per step. Phones show
“step X of Y” plus the current step name; the full diagram is desktop-only.

## Status and language

Status must never rely on color or an unexplained dot. Pair color with an icon
and explicit words such as:

- `64 days overdue`
- `Due today`
- `Draft — send when ready`
- `Paid — no action needed`

Use localized date and currency helpers. Never expose raw ISO dates, negative
day counts, database identifiers, or accounting implementation terms when a
plain phrase exists.

Prefer “Set up accounts for me” over “Initialize default chart of accounts.”
Introduce legal Portuguese terms in parentheses only when customers need them.

## Loading, empty, and error states

- Use skeletons that match the final layout.
- Do not preload optional PDF, spreadsheet, or upload code.
- Empty states say what happened and offer one next action.
- Connection errors preserve entered data and offer Retry.
- Avoid decorative animation during loading; a spinner or shimmer is enough.

## Motion

Motion communicates state, not polish.

- Keep transitions at 150–250ms.
- Prefer color and opacity transitions.
- No page-load slide-ups, staggered card entrances, hover translation, bouncing,
  or ambient animation in the authenticated app.
- Respect `prefers-reduced-motion`.

## Accessibility and localization

- Normal text contrast must be at least 4.5:1.
- Keyboard focus is visible on every interactive element.
- Icon-only buttons have an accessible name.
- Tap targets are 44px where practical and never depend on pixel-perfect aim.
- Tables convert to cards or controlled horizontal regions on phones; the page
  itself must not scroll horizontally.
- Test representative screens at 390px in English, Tetun, and Portuguese.
- Do not concatenate sentence fragments when a translated template is possible.

## Review checklist

Before merging interface work, verify:

- the phone view exposes the main task above the fold;
- no required interaction is smaller than the shared mobile target;
- there is only one obvious primary action;
- optional detail is deferred;
- statuses have words, not only colors or dots;
- dates, money, and deadlines are formatted for display;
- dark and light themes pass contrast checks;
- English, Tetun, and Portuguese do not clip;
- loading and error states preserve user confidence;
- `pnpm typecheck && pnpm test` pass.
