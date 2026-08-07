# Time Off settings — visual redesign spec

**Status:** designed, NOT implemented. Ready for a dedicated session.
**Target:** `client/components/settings/TimeOffPoliciesTab.tsx` (~1,430 lines)
**Origin:** 7-agent design workflow, 2026-08-07. Backlog task #22.

---

## Read this first

This is a **presentation** change. The information on that page is good and
hard-won — statutory durations, the INSS subsidy interaction, Art. 62
breastfeeding, the sick-pay bands. **Losing a legal fact is a hard fail.** The
question is only what an owner sees FIRST and what they must dig for.

The spine of the design is one question: *"do I have to think about this, or is
it already handled?"* Most of the page is fixed by Timor-Leste law and the
owner should never touch it. So it groups into **"Your company's decisions"**
and **"Fixed by Timor-Leste law"**, and every row answers itself in one line
before you tap anything — "12 days a year, first 6 at full pay", "INSS pays her,
you pay nothing".

### Three bugs from this review are ALREADY FIXED and shipped (PR #29)

Do not re-do these; they are live:
- the holiday override that deleted a public holiday with no undo,
- unsaved policy edits wiped by a background refetch,
- `isPaid` desync on special/study leave, plus the missing Art. 32 cash-out line.

The redesign below still assumes them; where it describes "Days you changed",
that list now exists (scoped to `isHoliday === false`).

### Rejected: Tino's three-card proposal

Tino suggested three cards, filing Study Leave (Art. 76.3) under "company
discretionary". The repo's own annotation quotes the statute — *"sem perda da
remuneração ou de quaisquer direitos, para realização de provas de avaliação"* —
so it is a **statutory paid entitlement**. Presenting a legal right as optional
is worse than the layout it fixes. The grouping below is the honest version of
the same instinct.

---

# Time Off Settings — implementation-ready redesign spec

**Verdict:** Proposal 3 wins on criterion 1 and is the base. Its always-visible summary line is the only design where a first-time owner learns the answer ("12 days, first 6 at full pay"; "INSS pays her, you pay nothing") **without tapping anything**, and its grouping rule is the only one that classifies Study Leave correctly. Grafted in: Proposal 2's question-phrased headings, templated `{{count}}` answer sentences, and its Radix-unmount warning about the holiday form; Proposal 1's promotion of Art. 62 to its own row, its "pending badge must be paired with an explanation" rule, and its stored-value-mismatch treatment (extended here into a one-tap repair button).

Target file: `/Users/tonyfranklin/Sites/xefe/client/components/settings/TimeOffPoliciesTab.tsx` (1426 lines). No change to `settingsService.updateTimeOffPolicies`, no change to the `TimeOffPolicies` shape, no new files under `client/components/ui/`.

---

## (a) Final section structure, in order

### The one new local component: `PolicyRow`

Defined **inside `TimeOffPoliciesTab.tsx`**, not in `components/ui/`. It is a synthesis of two shipped idioms, not a new primitive:

- Row shell = the hub row at `/Users/tonyfranklin/Sites/xefe/client/pages/Settings.tsx:62-79` — `flex min-h-14 w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 text-left hover:border-primary/30 hover:bg-muted/40` + `PRESSABLE` (`client/lib/pressable.ts`), 36px icon tile `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg`, `text-sm font-medium` title, `text-xs text-muted-foreground` summary.
- Chevron = `ChevronDown` with `transition-transform` + `rotate-180`, taken from `client/components/MoreDetailsSection.tsx:36` (expand, not navigate — so `ChevronRight` from Settings.tsx is wrong here).

**Two deliberate departures from `MoreDetailsSection`, both load-bearing:**

1. **The summary line stays visible when the row is open.** `MoreDetailsSection` replaces its own label with `common.hide` (`MoreDetailsSection.tsx:35`). Here the answer must not vanish the moment you go to edit it.
2. **The body is `<div hidden={!open}>`, not `CollapsibleContent`.** Radix `CollapsibleContent` unmounts by default; the holiday override form is a live `react-hook-form` (`TimeOffPoliciesTab.tsx:193-204`) whose state is loaded by the per-row Override buttons (`:1260-1269`). Unmounting would discard a half-typed override. `hidden` (display:none) keeps it mounted, keeps it out of the tab order, and animates nothing — so no `prefers-reduced-motion` exposure (STYLE_GUIDE.md:206). This is also why `Accordion` is banned here: `client/components/ui/accordion.tsx:47` uses `animate-accordion-down/up`, and neither is named in any guard in `client/global.css`.

Open state is a single `const [openRow, setOpenRow] = useState<string | null>(null)` — **one row open at a time**. On a phone that keeps the scroll predictable, and it incidentally solves the six-identical-legal-paragraphs problem (`parentalInssExplainer` at :618/:704/:786, `parentalPaidWarning` at :622/:708/:790) without deleting a word: you can only ever see one copy.

Three depths:
- **Depth 1** — always visible: icon, title, summary line with the tenant's real numbers, optional badges (`Being confirmed`, `Not saved yet`, amber attention marker).
- **Depth 2** — one tap: the controls for that topic, plus any instruction that is an *action*.
- **Depth 3** — `MoreDetailsSection` titled **"What the law says"**, holding citations, the DL 18/2017 explainer, and the honest gaps.

### Order

| # | Element | Collapsed? |
|---|---|---|
| 0 | Back link + `PageHeader` (unchanged, `TimeLeaveSettings.tsx:178-190`) | — |
| 1 | Intro line (replaces the blue panel at `:389-401`) | no |
| 2 | Eyebrow **"Your company's decisions"** | no |
| 3 | Row: **Days off every year** | yes |
| 4 | Row: **Public holidays** | yes |
| 5 | Row: **Extra leave your company offers** | yes |
| 6 | Row: **Waiting time before annual leave** `[Being confirmed]` | yes |
| 7 | Eyebrow **"Fixed by Timor-Leste law"** + caution line | no |
| 8 | Row: **When someone is sick** `[Being confirmed]` | yes |
| 9 | Row: **Maternity leave** | yes |
| 10 | Row: **Paternity leave** | yes |
| 11 | Row: **Leave after a miscarriage** | yes |
| 12 | Row: **Breastfeeding breaks and pregnancy check-ups** | yes |
| 13 | Row: **Weddings, funerals and community days** | yes |
| 14 | Row: **Exam days** | yes |
| 15 | Row: **Unpaid time off** | yes |
| 16 | **Save leave settings** | no |

Eyebrows use the house shape from `Settings.tsx:96` — `<h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">` — already used once on this page at `:937`. The caution line under eyebrow 7 is **the existing string verbatim**, `settings.timeOff.statutoryNote` (`client/i18n/locales/en.ts:1787`), class `mb-3 text-xs text-muted-foreground`, matching `Settings.tsx:271-274` where the identical sentence already sits.

**Intro (1)** — neutral, semantic tokens only, replacing the hardcoded `bg-blue-50 dark:bg-blue-950` block that breaks STYLE_GUIDE.md:38-40:
> "Xefe already follows the Timor-Leste Labour Law (Law 4/2012). You only need to change something if your company gives your staff more than the law asks."

Both `laborCodeTitle` and `laborCodeHint` (`en.ts:1820-1824`) survive in that one sentence. `CardDescription` at `:386` is **deleted** — it renders the same `settings.timeOff.description` string as the `PageHeader` subtitle at `TimeLeaveSettings.tsx:187`, ~40px apart.

### Row contents

**3. Days off every year** — icon `Calendar`, primary.
- D1: `"{{days}} days a year. Up to {{carry}} unused days roll into next year."` / when the switch is off: `"{{days}} days a year. Unused days do not roll over."`
- D2: "Days off each year" (number); **"Let unused days roll into next year"** (Switch with `id` + `htmlFor` so the label is part of the tap target — STYLE_GUIDE.md:167, which `:490-502` breaks); "How many days can roll over" (number, **disabled + dimmed when the switch is off**, fixing the live orphan at `:473-503`); hint "The law does not set this number — it is your company's choice."
- D2 amber, only when days < 12: "The law requires at least 12 days a year (Labour Law Art. 32)." + outline button **"Set to 12 days"**.
- D3 "What the law says": existing `annualLeaveHint` verbatim, **plus** a new sentence — "Days a worker has not taken when they leave your company are paid out in cash on their final payslip (Labour Law Art. 32)." Grounded in `docs/TIME_LEAVE.md:188-193`; absent from this page today and the most financially consequential fact about annual leave.

**4. Public holidays** — icon `Calendar`.
- D1: `"{{count}} days in {{year}}. You have not changed any."` / `"… You changed {{changed}}."` — **`count` is computed**, never the literal 18: `getTLPublicHolidays` returns 14 fixed + Good Friday + Corpus Christi + announced variable dates, and `ANNOUNCED_VARIABLE_HOLIDAYS` (`client/lib/payroll/tl-holidays.ts:24-28`) only covers 2026-2030, so 2031 yields 16, not 18.
- D2, in order:
  1. Year field, full width, labelled "Show holidays for" — moved out of the never-stacking `flex items-start justify-between` + `w-32` header (`:1154`, `:1166`) that squeezes the paragraph to ~160px at 390px, against STYLE_GUIDE.md:84-87.
  2. **"Days you changed"** — built **directly from `holidayOverrides`**, not from `mergedHolidays`. Each row: formatted date via `formatDateTL` (`client/lib/dateUtils.ts:25`) — never `font-mono` raw ISO as at `:1219`, banned by STYLE_GUIDE.md:183-185 — the name, a `Working day` badge when `isHoliday === false`, and Edit + Remove. This is the fix for the invisible/unremovable override (see Traps).
  3. The override form (existing, `:1294-1399`). Switch relabelled **"This is a day off"** with an off-state hint; primary button relabelled **"Save this day"**; a line under it: "This day is saved on its own, straight away."
  4. Nested `MoreDetailsSection` — **"See all {{count}} public holidays for {{year}}"** — the read-only merged list.
- D3: the currently hard-coded English paragraph (`:1160-1164`), localized, plus "Tolerância" kept from `settings.notifications.addOverrideHoliday`.

**5. Extra leave your company offers** — icon `Calendar`, muted.
- D1: "None yet." / the names, inactive ones as `"{{name}} (turned off)"`.
- D2: existing editors (`:950-1042`) and add form (`:1045-1147`), `Add type` stays `outline`. **Drop the mono `custom.id` Badge** (`:959-961`) — a database identifier next to a "Code" the user typed and can no longer edit, two identifiers, neither explained (STYLE_GUIDE.md:183-185). Keep `customTypes.hint`; drop the `saveReminder` footnote (`:1143-1146`) in favour of the depth-1 `Not saved yet` chip.
- D3: "The Labour Law does not cover these. They are entirely your company's."

**6. Waiting time before annual leave** — icon `Clock`, `[Being confirmed]` badge.
- D2 **first line, before any control**: "We are still checking this one with our accounting reviewers. Ask your accountant before you change it." **Page rule: a `Being confirmed` badge never appears without this sentence at depth 2.** Today's badge (`:520-525`) explains nothing.
- D2: months 0-12, label "Months a new worker waits before annual leave".
- D3: "Xefe applies this to annual leave only. An owner or HR admin can allow an earlier request on the leave request itself. Whether the Labour Law allows delaying annual leave for a waiting period is not settled — Xefe does not decide it for you." **Deliberately drops the current Art. 14 claim** in `probationHint` (`en.ts:1825-1826`) — see (h).

**8. When someone is sick** — icon `Clock`, `[Being confirmed]`.
- D1: `"{{days}} days a year. First 6 days at full pay, next 6 at half pay."`
- D2: pending-explainer sentence; the bands as read-only text; certificate line as read-only (see (c)).
- D3: `sickPayBandsTitle` + `sickPayBandsText` verbatim, including "These bands cannot be edited." **No article number** — see (h).

**9/10/11. Maternity / Paternity / Miscarriage** — icons `Users` pink, `Users` blue, `Heart` rose.
- D1 default: `"{{days}} days (12 weeks). INSS pays the mother — you pay nothing."` / `"{{days}} days. INSS pays the father — you pay nothing."` / `"{{days}} days (4 weeks). INSS pays the worker — you pay nothing."`
- **D1 escalation — this overrides collapse.** When `paidPercentage > 0`, the line becomes `"{{days}} days (12 weeks). Your company pays {{percent}}% — this cancels the INSS subsidy for those days."` and the row carries an amber `AlertCircle`. A risk the tenant configured is never one tap away.
- D2: "Days off" (number).
- D3: the statutory duration hint + `parentalInssExplainer` verbatim.
- D3 nested — **"Pay salary instead of the INSS subsidy"**: the `paidPercentage` input, with `parentalPaidWarning` in the module amber shape (`border-amber-500/30 bg-amber-500/10` + `AlertCircle`, as at `:624`, `ShiftScheduling.tsx:620`) rendered **above** it unconditionally, not only after the value goes positive. Keep the `isPaid` sync exactly as written at `:599-612`, `:686-698`, `:768-780`.
- The miscarriage D1 says "(4 weeks)" in prose and the maternity D1 says "(12 weeks)" in prose. **Delete the computed weeks Badge** at `:566-571` (`Math.round(days / 7)`): it divides by calendar weeks while miscarriage's 20 days are 4 *working* weeks, and the two sit in identical-looking cards today.

**12. Breastfeeding breaks and pregnancy check-ups** — icon `Heart`, new row.
- D1: "Paid — and nothing to set up here."
- D2: existing `breastfeedingNote` verbatim (`en.ts:1804-1805`). Promoted out of the bottom of the tallest block on the page (`:640-643`) because it is an **operator instruction** — record as worked time, never dock — and missing it costs the worker money. `docs/TIME_LEAVE.md:126-139` establishes it is deliberately note-only.

**13. Weddings, funerals and community days** — icon `Calendar` teal.
- D1: `"{{days}} paid days a year, shared between all of them."` — "shared between" is the plain-language version of "one pooled allotment", the phrase most likely to be misread as three separate allowances.
- D2: "Days a year" (number) **only**; paid % is now read-only (see (c)).
- D3: `specialLeaveHint` verbatim (Art. 33.3 + proof).

**14. Exam days** — icon `GraduationCap` violet. **This is the row that must not be misfiled.**
- D1: `"{{days}} paid days a year for exams. The law sets no limit — this number is yours."` Both halves of the truth in one sentence, in the **statutory** group.
- D2: "Exam days your company allows each year" (number) only; paid % read-only.
- D3: `studyLeaveHint` verbatim (Art. 76.3, exams only, Art. 76.5 proof, no annual cap).

**15. Unpaid time off** — icon `Calendar` muted. New row, pure information add.
- D1: `"Up to {{days}} days a year."`
- D2: `"Xefe will not approve more than {{days}} unpaid days in a year for one worker."` Read-only. Enforced today at `functions/src/timeleave.ts:1224-1240` via `findEntitlementBreaches`, configured at `client/types/settings.ts:424-434`, with **no UI anywhere** — an employee is blocked and nobody can find out why.
- D3: "The Labour Law does not set this number — it is a Xefe limit." `docs/TIME_LEAVE.md:119` leaves the statute column empty for `unpaid`; no article may be cited.

**16. Save leave settings** — one `Button`, default variant, `className="min-h-11 w-full sm:w-auto"`, last in the scroll. The pattern and the reasoning are `client/pages/settings/CompanySettings.tsx:177-178` ("on a phone this is the last thing in the scroll, which is where the thumb already is"). Label changes from "Save Time Off Policies" so it is obvious it does not save the holiday override, which has its own "Save this day". `Add type` and `Save this day` are `outline` and live inside collapsed rows, so **only one button is on screen at rest** (STYLE_GUIDE.md:148).

---

## (b) What a user sees on a 390px phone before touching anything

```
← All settings
[cyan 44px tile] Time Off Policies
                 Configure leave entitlements based on Timor-Leste labor law

Xefe already follows the Timor-Leste Labour Law (Law 4/2012). You only
need to change something if your company gives your staff more than the
law asks.

YOUR COMPANY'S DECISIONS
┌────────────────────────────────────────────────┐
│ [📅] Days off every year                     ⌄ │
│      12 days a year. Up to 6 unused days       │
│      roll into next year.                      │
├────────────────────────────────────────────────┤
│ [📅] Public holidays                         ⌄ │
│      18 days in 2026. You have not changed any.│
├────────────────────────────────────────────────┤
│ [📅] Extra leave your company offers         ⌄ │
│      None yet.                                 │
├────────────────────────────────────────────────┤
│ [🕐] Waiting time before annual leave          │
│      [Being confirmed]                       ⌄ │
│      New workers wait 3 months.                │
└────────────────────────────────────────────────┘

FIXED BY TIMOR-LESTE LAW
These already follow Timor-Leste law. Change them only if your
accountant asks you to.
┌────────────────────────────────────────────────┐
│ [🕐] When someone is sick  [Being confirmed] ⌄ │
│      12 days a year. First 6 days at full pay, │
│      next 6 at half pay.                       │
├────────────────────────────────────────────────┤
│ [👥] Maternity leave                         ⌄ │
│      84 days (12 weeks). INSS pays the mother  │
│      — you pay nothing.                        │
├────────────────────────────────────────────────┤
│ [👥] Paternity leave                         ⌄ │
│      5 days. INSS pays the father — you pay    │
│      nothing.                                  │
├────────────────────────────────────────────────┤
│ [♡] Leave after a miscarriage                ⌄ │
│      20 days (4 weeks). INSS pays the worker   │
│      — you pay nothing.                        │
├────────────────────────────────────────────────┤
│ [♡] Breastfeeding breaks and pregnancy       ⌄ │
│     check-ups                                  │
│      Paid — and nothing to set up here.        │
├────────────────────────────────────────────────┤
│ [📅] Weddings, funerals and community days   ⌄ │
│      3 paid days a year, shared between all    │
│      of them.                                  │
├────────────────────────────────────────────────┤
│ [🎓] Exam days                               ⌄ │
│      3 paid days a year for exams. The law     │
│      sets no limit — this number is yours.     │
├────────────────────────────────────────────────┤
│ [📅] Unpaid time off                         ⌄ │
│      Up to 30 days a year.                     │
└────────────────────────────────────────────────┘

[        Save leave settings        ]
```

**Height:** chrome 130 + intro 62 + eyebrow 28 + 4 rows (~72 each incl. gap-3) 288 + eyebrow&caution 58 + 8 rows 576 + save 80 + page padding 48 ≈ **1,270px**, about **1.6 phone screens**. Today: ~6,200-6,500px, about eight screens.

**Tap targets at rest: 13** (12 rows + Save), every one ≥56px. Today: 48, plus 5 per custom type.

Above the fold (~780px usable) sits everything under "Your company's decisions" and the sick-leave row — the owner's entire job, plus the answer to the question she came for.

---

## (c) Read-only vs editable

### Becomes READ-ONLY

| Control | Current lines | Why |
|---|---|---|
| **Special leave `paidPercentage`** → "Paid in full — the law requires it." | `:843-863` | Art. 33(3) days are paid (`docs/TIME_LEAVE.md:118`, `client/types/settings.ts:410-423`). Lowering it under-pays a statutory paid absence — and this handler **never syncs `isPaid`**, unlike `:599-612`, so a stored `isPaid:false` makes `leavePayFraction` (`functions/src/timeleave.ts:554-556`) return 0 whatever the box reads. Deleting the control deletes the defect. |
| **Study leave `paidPercentage`** → "Paid in full — the law requires it (Art. 76.3)." | `:906-926` | Art. 76(3) "sem perda da remuneração" (`client/types/settings.ts:435-440`). Same missing `isPaid` sync at `:914-922`. |
| **Sick leave `requiresCertificate` switch** → a sentence reflecting the stored value | `:540-553` | It enforces nothing. The only reader in the codebase is `client/pages/time-leave/LeaveRequests.tsx:1068-1073`, and only when `certificateType` is also set; `grep requiresCertificate` across `functions/src`, `mobile/ekipa` and `server/xefe-api` returns no consumer. A switch that promises a rule and enforces none is worse for a first-time user than a sentence. **See (h)** — wire it or drop it is a human call. |
| **Sick days / bands** | already no input (`:510-512`) | Unchanged. Three layers agree: no input, `TL_SICK_LEAVE` banding in `client/lib/payroll/constants-tl.ts:295-309`, and `leavePayFraction` hard-returns 1 for `sick` (`functions/src/timeleave.ts:534-537`). |
| **Unpaid leave 30 days** | no UI today | New read-only. Presented explicitly as a Xefe limit, not law. |
| **Art. 62 breastfeeding / prenatal** | `:640-643` | Note-only by design (`docs/TIME_LEAVE.md:126-139`). |

**Stored-value repair, not silent overwrite.** Where a tenant has already stored special/study `paidPercentage ≠ 100`, the read-only line renders the **stored** value plus an amber sentence — "Your company has this set to 50%. The law requires these days to be paid in full." — and an outline button **"Set to paid in full"** that writes `{ paidPercentage: 100, isPaid: true }` into local state, persisted by the page Save. Read-only must never lie about what payroll will do (`docs/TIME_LEAVE.md:164-166`: existing tenants keep persisted behaviour). This is how the migration hazard is closed without reintroducing a free input.

### Stays EDITABLE

| Control | Class | Depth | Justification |
|---|---|---|---|
| Annual `daysPerYear` | **FLOOR** (Art. 32 min 12) | 2 | A floor is not fixed — an employer may give more. Rendering it read-only would misclassify a genuine choice. Amber warning + "Set to 12 days" below the minimum. |
| Annual `maxCarryOverDays`, `carryOverAllowed` | **CHOICE** | 2 | `en.ts:1843` "Carry-over limits are your company's policy"; read by `annualCarryOverPolicyFromConfig` (`functions/src/leave-logic.ts:19-32`). |
| `probationMonthsBeforeLeave` | **CHOICE in code, UNSETTLED in law** | 2 | Tenant policy enforced at `functions/src/timeleave.ts:1188-1199`. Kept editable but badged and hedged. |
| Maternity / paternity / miscarriage `daysPerYear` | **FLOOR** | 2 | 84 / 5 / 20 are statutory durations an employer may exceed. Read-only would present a floor as a ceiling. |
| Maternity / paternity / miscarriage `paidPercentage` | **CHOICE** (deliberate, rare) | 3 (nested) | `docs/TIME_LEAVE.md:159-166` — an explicit employer-paid option that replaces the INSS subsidy. Legal, so it must remain reachable; rare and consequential, so it is the deepest thing on the page. |
| Special `daysPerYear` | **FLOOR** (Art. 33(3)) | 2 | |
| Study `daysPerYear` | **CHOICE** | 2 | `docs/TIME_LEAVE.md:120` — "the statute sets no cap". The one statutory block where the number genuinely belongs to the company; D1 says so. |
| Custom leave types | **CHOICE** (fully) | 2 | |
| Holiday overrides + year | **Mixed**, editable | 2 | |

---

## (d) Disclosure mechanism

- **Depth 1→2:** local `PolicyRow`, plain `useState` + `hidden`. No Radix Collapsible (unmount hazard for the holiday form), no `Accordion` (unguarded height animation vs STYLE_GUIDE.md:206; one legacy usage in `QuickBooksSettings.tsx`), no `Tabs` (explicitly rejected in `client/pages/settings/CompanySettings.tsx:1-9`: "'Structure' is untranslatable jargon for a first-time TL owner").
- **Depth 2→3:** `MoreDetailsSection` (`client/components/MoreDetailsSection.tsx`), `title="What the law says"`, `defaultOpen={false}`. 32 usages across 29 files, including two already in Time & Leave (`Attendance.tsx:1271,1381`, `ShiftScheduling.tsx:709`), so the module already speaks this idiom.
- **Read-only fact lists** inside depth 2/3 use the `StatutoryRatesCard` shape — `border rounded-lg divide-y` → `p-3 space-y-1` → `text-sm font-medium` label over `text-sm text-muted-foreground` sentence (`client/components/settings/StatutoryRatesCard.tsx:59-78`). Stacked, never a `<Table>`, never horizontally scrolling.
- **`Being confirmed` badge** = the exact `StatutoryRatesCard.tsx:67-70` markup, reusing key `settings.payroll.statutory.pending`.
- **Amber** stays reserved for a state the tenant caused: `border-amber-500/30 bg-amber-500/10` + `AlertCircle`, per `:624` / `ShiftScheduling.tsx:620` / `LeaveRequests.tsx:778`.

---

## (e) File-by-file change list

### 1. `client/components/settings/TimeOffPoliciesTab.tsx` — the whole change

- Add local `PolicyRow` component + `openRow` state.
- Delete `<CardDescription>` (`:386`); replace the blue panel (`:389-401`) with the muted intro line.
- Restructure `:403-1400` into 12 rows under 2 eyebrows.
- Build a **new** `changedDays` list from `holidayOverrides` (already in state, `:187-189`); leave `mergedHolidays` (`:238-279`) untouched, it now feeds only the read-only "See all …" list.
- Delete the special/study `paidPercentage` inputs and the weeks Badge (`:566-571`) and the mono id Badge (`:959-961`).
- `formatDateTL` from `@/lib/dateUtils` for every date; drop `font-mono` ISO (`:1219`).
- Add `id`/`htmlFor` to every Switch/Label pair (`:490-502`, `:541-553`, `:970-978`, `:1030-1039`, `:1119-1131`, `:1309-1319`).
- Add `dirty` derivation for the `Not saved yet` chip: compare the relevant slice of `timeOffPolicies` against the `initialTimeOff` prop (a shallow per-field compare is safer than `JSON.stringify` — key order is stable under spread today, but `addCustomType` and future edits shouldn't have to think about it). No change to `useState`, no change to `saveTimeOffPolicies`.
- Replace the hardcoded English toast at `:1299`.

### 2. `client/pages/time-leave/TimeLeaveSettings.tsx`

Rewrite the loading skeleton (`:44-167`, 120 lines mirroring the old layout) as 12 row-height placeholders under two short eyebrow bars. STYLE_GUIDE.md:192 requires skeletons that match the final layout, and 12 rows are far cheaper to skeleton than 8 expanded blocks.

### 3. `client/i18n/locales/en.ts` — new keys under `settings.timeOff`

All ~55 keys need **matching entries in `client/i18n/locales/pt.ts` and `client/i18n/locales/tet.ts`** (both live — `client/i18n/I18nProvider.tsx:26-28` imports the three `locales/*` files; `client/i18n/translations.ts` is the generated master and is not loaded at runtime, do not hand-edit it). The `|| "English"` fallbacks in JSX are a safety net, not a substitute.

```
intro: "Xefe already follows the Timor-Leste Labour Law (Law 4/2012). You only need to change something if your company gives your staff more than the law asks."
groupYours: "Your company's decisions"
groupLaw: "Fixed by Timor-Leste law"
whatTheLawSays: "What the law says"
notSavedYet: "Not saved yet"
paidInFull: "Paid in full — the law requires it."
paidInFullStudy: "Paid in full — the law requires it (Labour Law Art. 76.3)."
paidMismatch: "Your company has this set to {{percent}}%. The law requires these days to be paid in full."
setPaidInFull: "Set to paid in full"

rows.annual.title: "Days off every year"
rows.annual.summaryCarry: "{{days}} days a year. Up to {{carry}} unused days roll into next year."
rows.annual.summaryNoCarry: "{{days}} days a year. Unused days do not roll over."
rows.annual.daysLabel: "Days off each year"
rows.annual.carryQuestion: "Let unused days roll into next year"
rows.annual.carryMaxLabel: "How many days can roll over"
rows.annual.carryIsYours: "The law does not set this number — it is your company's choice."
rows.annual.belowMinimum: "The law requires at least 12 days a year (Labour Law Art. 32)."
rows.annual.setMinimum: "Set to 12 days"
rows.annual.cashOut: "Days a worker has not taken when they leave your company are paid out in cash on their final payslip (Labour Law Art. 32)."

rows.holidays.title: "Public holidays"
rows.holidays.summaryNone: "{{count}} days in {{year}}. You have not changed any."
rows.holidays.summaryChanged: "{{count}} days in {{year}}. You changed {{changed}}."
rows.holidays.yearLabel: "Show holidays for"
rows.holidays.changedHeading: "Days you changed"
rows.holidays.changedEmpty: "You have not changed any day this year."
rows.holidays.workingDayBadge: "Working day"
rows.holidays.seeAll: "See all {{count}} public holidays for {{year}}"
rows.holidays.isDayOff: "This is a day off"
rows.holidays.isDayOffHint: "Turn this off to tell Xefe that a public holiday is a normal working day at your company."
rows.holidays.saveDay: "Save this day"
rows.holidays.savesImmediately: "This day is saved on its own, straight away."
rows.holidays.formIncomplete: "Fill in the date and the name before saving."
rows.holidays.law: "The built-in list has the fixed legal dates, the Easter ones (Good Friday, Corpus Christi), and the announced Muslim holidays. Add a change for a day the Government declares later (Tolerância), or a day your company closes."

rows.custom.title: "Extra leave your company offers"
rows.custom.summaryNone: "None yet."
rows.custom.turnedOff: "{{name}} (turned off)"
rows.custom.noLaw: "The Labour Law does not cover these. They are entirely your company's."

rows.probation.title: "Waiting time before annual leave"
rows.probation.summary: "New workers wait {{months}} months."
rows.probation.summaryNone: "New workers can take annual leave straight away."
rows.probation.monthsLabel: "Months a new worker waits before annual leave"
rows.probation.pendingExplainer: "We are still checking this one with our accounting reviewers. Ask your accountant before you change it."
rows.probation.law: "Xefe applies this to annual leave only. An owner or HR admin can allow an earlier request on the leave request itself. Whether the Labour Law allows delaying annual leave for a waiting period is not settled — Xefe does not decide it for you."

rows.sick.title: "When someone is sick"
rows.sick.summary: "{{days}} days a year. First 6 days at full pay, next 6 at half pay."
rows.sick.pendingExplainer: "We are still checking the exact article number for these bands with our accounting reviewers. The pay rule itself is what payroll applies."
rows.sick.certificateOn: "A medical certificate is required for sick leave."
rows.sick.certificateOff: "Your company does not require a medical certificate for sick leave."

rows.parental.daysLabel: "Days off"
rows.parental.payYourselfTitle: "Pay salary instead of the INSS subsidy"
rows.maternity.title: "Maternity leave"
rows.maternity.summary: "{{days}} days (12 weeks). INSS pays the mother — you pay nothing."
rows.maternity.summaryPaid: "{{days}} days (12 weeks). Your company pays {{percent}}% — this cancels the INSS subsidy for those days."
rows.paternity.title: "Paternity leave"
rows.paternity.summary: "{{days}} days. INSS pays the father — you pay nothing."
rows.paternity.summaryPaid: "{{days}} days. Your company pays {{percent}}% — this cancels the INSS subsidy for those days."
rows.miscarriage.title: "Leave after a miscarriage"
rows.miscarriage.summary: "{{days}} days (4 weeks). INSS pays the worker — you pay nothing."
rows.miscarriage.summaryPaid: "{{days}} days (4 weeks). Your company pays {{percent}}% — this cancels the INSS subsidy for those days."

rows.breastfeeding.title: "Breastfeeding breaks and pregnancy check-ups"
rows.breastfeeding.summary: "Paid — and nothing to set up here."

rows.special.title: "Weddings, funerals and community days"
rows.special.summary: "{{days}} paid days a year, shared between all of them."
rows.special.daysLabel: "Days a year"

rows.study.title: "Exam days"
rows.study.summary: "{{days}} paid days a year for exams. The law sets no limit — this number is yours."
rows.study.daysLabel: "Exam days your company allows each year"

rows.unpaid.title: "Unpaid time off"
rows.unpaid.summary: "Up to {{days}} days a year."
rows.unpaid.detail: "Xefe will not approve more than {{days}} unpaid days in a year for one worker."
rows.unpaid.noStatute: "The Labour Law does not set this number — it is a Xefe limit."
```

**Changed value, same key:** `settings.timeOff.save` → `"Save leave settings"`.
**Kept verbatim, still rendered:** `statutoryNote`, `annualLeaveHint`, `maternityHint`, `paternityHint`, `miscarriageLeaveHint`, `specialLeaveHint`, `studyLeaveHint`, `parentalInssExplainer`, `parentalPaidWarning`, `breastfeedingNote`, `sickPayBandsTitle`, `sickPayBandsText`, `customTypes.*`, `invalidValues`.
**Now unused (leave in the file, do not delete):** `laborCodeTitle`, `laborCodeHint`, `entitlements`, `probationLabel`, `probationHint`, `maternityDaysHint`, `carryOverDays`, `allowCarryOver`, `requiresMedicalCert`, `weeks`, `customTypes.saveReminder`.
**Stop borrowing:** `settings.notifications.holidayName` as the switch label (`:1319`) — it means "Holiday name", not "is a day off".

Every `{{count}}` is interpolated through `t(key, params)` — the signature at `client/components/settings/types.ts:38` supports it, and `:1205` already uses it. Never concatenate fragments (STYLE_GUIDE.md:230).

---

## (f) TRAPS

1. **Two save models survive, and must be labelled, not unified.** `onSaveHolidayOverride` (`:281-332`) and `removeHolidayOverride` (`:334-351`) write Firestore **immediately**. `saveTimeOffPolicies` (`:353-380`) writes leave policies **and custom types** only on the bottom button. Unifying them is an architectural change out of scope. The spec defuses it with "This day is saved on its own, straight away.", the renamed buttons, and the depth-1 `Not saved yet` chip.

2. **`useEffect` at `:106-108` overwrites local edits from the prop.** `setTimeOffPolicies(initialTimeOff)` fires whenever the parent's React Query object identity changes. `onReload()` after a successful save is fine (baseline updates, chip clears). But a background refetch (`staleTime: 5 min`, `TimeLeaveSettings.tsx:32`) mid-edit **silently discards** unsaved work. This exists today; the chip makes the loss visible but does not prevent it. Do not "fix" it by removing the effect — that breaks the post-save reload.

3. **The holiday form is a live `react-hook-form` and must never be unmounted.** `holidayOverrideForm` (`:193-204`) is populated by the per-row Override buttons via `reset()` (`:1260-1269`). If it goes inside a Radix `CollapsibleContent`, closing the row throws away a half-typed override. Use `hidden`, or `forceMount`. Single-open `openRow` is fine precisely because `hidden` does not unmount.

4. **The invisible, unremovable "working day" override.** `mergedHolidays` calls `map.delete(o.date)` when `isHoliday === false` (`:261-265`) and the trash button only renders inside a merged row (`:1275-1286`). Turn Christmas off today and the row disappears together with the only way to undo it — and payroll loses a legal public holiday. **Fix by addition, not surgery:** build "Days you changed" from the `holidayOverrides` array (`:187`), which already contains every override for the year, and hang Edit + Remove there. `mergedHolidays` keeps its current behaviour and its current shape, so nothing downstream moves. Re-skinning this section without this fix ships a prettier trap.

5. **Saving an override in another year silently jumps the list.** `:300-303` calls `setHolidayYear(savedYear)`, which re-runs `loadHolidayOverrides` (`:228-230`). Keep the year field inside the same open row so the jump is visible.

6. **`isPaid` desync — correct the research brief on one point.** Special (`:851-859`) and study (`:914-922`) genuinely fail to sync; removing both inputs removes both defects. The custom **add** form does *not* have this bug: `addCustomType` derives `isPaid: newCustomType.paidPercentage > 0` at `:157` before storing. The custom **edit** path (`:1014-1023`) is already correct.

7. **Do not wire `disabled={saving || !policiesAreValid}` without a decision.** `policiesAreValid` is computed at `:103` but only `saving` disables the button (`:1411`). Hard-disabling would lock any tenant carrying legacy out-of-range data out of saving *anything*. The safe change is to move the `role="alert"` message (`:1403-1407`) from the page bottom into the offending row and **auto-open that row** on a failed save — STYLE_GUIDE.md:168 — while leaving the button enabled and the toast (`:356-361`) in place.

8. **Duplicate holiday fetch on mount.** `TimeLeaveSettings.tsx:35-40` fetches overrides for the current year and passes them as `initialHolidayOverrides`; the child's `loadHolidayOverrides` effect (`:228-230`) immediately fetches again. Pre-existing, harmless, easy to "helpfully" break — leave it.

9. **Tests.** No test asserts on this component's markup and no e2e test visits `/time-leave/settings` (`tests/e2e/full-workflow.spec.ts` only hits `/settings/{company,payments,integrations,departments,access}`). Two to keep green:
   - `tests/client/interface-guardrails.test.ts:25-69` AST-scans **every** `client/**/*.tsx` for `<Button size="icon">` without `aria-label`. The holiday Remove button carries one at `:1280` — any new icon button in "Days you changed" needs one too.
   - `tests/client/settings-wiring.test.ts:118-138` pins `annualCarryOverPolicyFromConfig` including the **top-level `maxCarryOverDays` fallback**. The carry-over field must keep writing `annualLeave.maxCarryOverDays`; do not retire the top-level field in this change.
   Run: `pnpm typecheck && pnpm test`. Rules and functions are untouched, so `emul:rules` is not required for this diff — but CI runs it regardless.

10. **`ANNOUNCED_VARIABLE_HOLIDAYS` runs out.** `client/lib/payroll/tl-holidays.ts:24-28` only bundles Idul Fitri / Idul Adha through 2030 (2027+ are astronomical estimates). Never hardcode "18" in copy — always `mergedHolidays.length`.

---

## (g) What I deliberately did NOT do

- **Did not build a read-only "everything the law says" wall** (Proposal 1's nine-row list). It is honest and preserves every fact, but ~810px of continuous legal prose is not "know in seconds" — it is a second reading task. The depth-1 summary lines carry the same facts in scannable form, and depth 3 keeps the full text one tap away.
- **Did not merge maternity + paternity + miscarriage into one "when a worker has a baby" block** (Proposal 2). It is the better *copy* insight and the deduplication argument is right, but each has a distinct policy slot, distinct `daysPerYear`, and distinct `paidPercentage`, and merging them means rewriting three independent editors into one — a bigger diff against criterion 5. Single-open rows achieve the same result: you can only ever see one copy of `parentalInssExplainer`.
- **Did not remove any legal sentence.** Only one *control* disappears without replacement text: the sick medical-certificate switch, and its meaning survives as a sentence.
- **Did not unify the two save models, add a route-leave guard, or add a dirty-state confirmation dialog.** Behaviour changes, not presentation. The chip surfaces the risk; fixing it is a separate ticket.
- **Did not hard-disable Save on invalid** — see Trap 7.
- **Did not print an article number for sick leave or paternity leave** — see (h).
- **Did not add a sticky mobile action bar.** `CompanySettings.tsx:177-178` deliberately chose end-of-scroll for settings pages; at ~1,270px the Save is two flicks away.
- **Did not make the day-count fields for maternity/paternity/miscarriage read-only.** They are floors. Presenting a floor as fixed is the mirror image of the classification error in criterion 3.
- **Did not add a control for `unpaidLeave`, `holidayCarryOver`, or the top-level `maxCarryOverDays`.** Surfacing the 30-day limit as a read-only fact turns a mystery block into an explained rule with zero behaviour change; making it editable is a product decision. `holidayCarryOver` (`client/types/settings.ts:452`) is read nowhere in the repo — leaving it invisible is correct.
- **Did not use `Tabs`, `Accordion`, or `Alert`.** All three are explicitly out of favour: tabs rejected in `CompanySettings.tsx:1-9`, accordion's height animation escapes the reduced-motion guard, and `alert.tsx` appears in no settings page — the house hand-rolls notice divs.
- **No charts, no filters, no stat tiles, no left-border accents, no gradients, no tinted brand surfaces** — per `docs/DASHBOARD_DESIGN.md:51-65` and STYLE_GUIDE.md:89-90, 111-115.

---

## (h) What the repo could not settle — needs a human

1. ~~**Sick-leave article.**~~ **RESOLVED 2026-08-07 from the primary source.**
   Both repo values were wrong. The official Lei 4/2012 text (mj.gov.tl,
   `~/Sites/m365-mail-export/laws/lei_4_2012_clean.txt`) puts sick leave in
   **Art. 33(4)** — the same article as special leave (33(3)) and the proof
   rule (33(7)):

   > "O trabalhador pode igualmente faltar justificadamente ao trabalho por
   > motivo de doença ou acidente, mediante a apresentação de atestado
   > médico, até 12 dias por ano, dos quais 6 são remunerados por inteiro e
   > os 6 dias restantes remunerados a 50 por cento do valor da remuneração
   > diária."

   Art. 42 is the wage-**deduction** article (42(3) = the 30%/month cap);
   Art. 34 is "Princípios gerais" of the occupational-safety section. The UI
   now prints Art. 33.4. `constants-tl.ts` and `TIME_LEAVE.md` corrected.
   The row keeps its `Pending confirmation` badge until Nico signs off on the
   reading — the *citation* is settled, the reviewer sign-off is not.
   `StatutoryRatesCard.tsx:37-39` still carries the old open question.

   **Follow-on this opens:** Art. 33(4) makes the medical certificate
   statutory ("mediante a apresentação de atestado médico"), so item 5 below
   is no longer "wire it or drop it" — it is "the law requires it".

2. ~~**Paternity-leave article.**~~ **RESOLVED 2026-08-07: Art. 60.** Same
   source: "Artigo 60.º — Licença por paternidade. 1. O trabalhador tem
   direito a uma licença remunerada de 5 dias úteis por paternidade…".
   `docs/TIME_LEAVE.md` was right; `en.ts` said Art. 59, which is maternity.
   Corrected in en/pt/tet. The row is NOT badged — the spec's own order
   table, 390px mockup and key list all show it unbadged, and nothing about
   it is pending any more.

3. **STILL OPEN — but no copy regression shipped.** Tony's call (2026-08-07):
   keep the articles visible. `probationHint` ships **verbatim**, Art. 14
   intact; the row carries the `Pending confirmation` badge and the
   "ask your accountant" sentence instead, so the claim is flagged rather
   than deleted. The concern below stands and still needs Nico.

   **Whether Art. 32 permits deferring annual leave for a waiting period at all.** `probationHint` (`en.ts:1825-1826`) currently asserts Art. 14 authority. But `client/lib/probation.ts` puts statutory probation at 8/15/30/90 **days** (Art. 14), so the 3-month default (`client/types/settings.ts:336`) exceeds statutory probation for every category except managerial, and `docs/TL_LAW_GAP_MATRIX_JUL2026.md` F19 records only that it "gates leave eligibility". The spec downgrades this to "not settled". **This is a copy regression from a confident claim to a hedged one — confirm before shipping.**

4. **Annual leave above 12 is only half-honoured.** Raising it increases the leave balance (`functions/src/timeleave.ts:333-355`), but the termination cash-out accrual is hard-capped at `TL_ANNUAL_LEAVE.daysPerYear = 12` (`client/lib/payroll/constants-tl.ts:206-210` via `accruedAnnualLeaveDays`, `calculations-tl.ts:748-762`, consumed at `client/pages/hiring/Offboarding.tsx:1591`). An employer who sets 15 sees 15 accrue and 12 suggested in final pay. Adding the Art. 32 cash-out sentence makes that gap visible to a customer for the first time. **This is a money-chain question, not a UI question** — resolve or document before the copy ships.

5. **The sick medical-certificate switch.** It enforces nothing anywhere in the repo. Wire it (a real rule in `createLeaveRequest`) or drop it. The spec renders the stored value as a sentence in the meantime, which is honest either way.

6. **Should the special/study "Set to paid in full" repair button exist, or should a one-off data audit fix affected tenants?** The button is safe and reversible-by-not-saving, but a tenant who never opens the row keeps under-paying a statutory absence. A query for tenants with `specialLeave.paidPercentage != 100 || studyLeave.paidPercentage != 100` would say how big the problem is.

7. **Whether carried-over days may lawfully lapse.** The Art. 32(5) 12-month use-by clock is explicitly unbuilt (`docs/TIME_LEAVE.md:206`, gap matrix F2), so the carry-over row says nothing about expiry. Do not add a sentence here without a ruling.

8. **Tetun native pass.** ~55 new strings, several of them legal statements. The linter passes false friends, and legal copy is exactly where a false friend does damage. A half-translated page is worse for a Tetun reader than the current one — ship en/pt/tet together, and test at 390px in all three (TET row titles run longer than EN).
