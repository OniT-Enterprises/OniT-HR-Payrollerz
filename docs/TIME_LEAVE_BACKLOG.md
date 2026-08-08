# Time & Leave backlog

Everything left open after the 2026-08-07 Time Off / Attendance work (PRs #29–#40).
Ordered by consequence, not by effort. Each item says what is wrong **today**, so
none of them needs this session's context to pick up.

Legal questions are not here — they live in `docs/NICO_OPEN_QUESTIONS.md`
(**A6** Saturday, **A7** Art. 64 childcare — now BUILT, two narrower questions
left, **B13** sick-leave citation and the
certificate, **B14** the annual-leave waiting period). This file is engineering.

---

## 1. Money — do these first

### 1.1 The working week is hardcoded Mon–Fri  ⚠️ real money, both directions

`calculateWorkingDays` (`client/services/leaveService.ts`) skips
`dayOfWeek === 0 || dayOfWeek === 6` for everyone. Art. 30 does not say that:

> 1. …um período de descanso semanal remunerado de, no mínimo, **24 horas
>    consecutivas**.
> 2. O dia de descanso semanal **só pode deixar de ser ao domingo quando** o
>    trabalhador preste trabalhos indispensáveis à continuidade de serviços que
>    não podem ser interrompidos…

Sunday is the **default rest day, not a rule**. A hotel, restaurant, clinic or
security firm lawfully works Sundays, and those workers rest on another day.
Saturday is not a rest day at all unless the company makes it one.

Xefe is wrong in both directions, and silently:

| For a hotel worker resting on Wednesday | Today |
| --- | --- |
| Sunday worked — ordinary for them | paid **2×** (overpaid) |
| Wednesday worked — their real rest day | paid **1×** (underpaid) |
| Leave spanning a Sunday | consumes no day |
| Leave spanning their Wednesday | consumes one |

And for any six-day employer, a worker sick Mon–Sat is counted as **5 days, not
6**: they lose a day of pay and keep a day of entitlement they already spent.
The absence dialog also refuses to record a Saturday, because it asks the same
function whether the day counts.

Payroll half-knows this already — `usePayrollCalculator` carries "Non-Sunday
per-employee rest days stay manual (wizard row field)", a manual escape hatch
for pay. **Leave has none.**

This is the typical employer, not an edge case. The statutory week is **44
hours** (Art. 25) and 44 ≠ 5 × 8 — Mon–Fri is 40. The firms' own 190-hour
divisor, matched to the cent in `docs/MINED_TL_ACCOUNTING_INTEL.md`, is
44 × 52 ÷ 12, which only works on a six-day week.

Do **not** cite the 22-day leave-payout divisor as evidence either way:
`constants-tl.ts` records it as a selectable accounting convention chosen for
being pro-worker, explicitly not a statutory claim about the week.

The pay half is already tracked as **L2** in `TL_LAW_GAP_MATRIX_JUL2026.md`
(Arts. 30(1), 27(2), "no per-employee rest-day concept"). Fix them together —
they are one missing field.

**Why it is not a one-line fix.** `calculateWorkingDays` is the canonical
leave-duration source — the server callable `createLeaveRequest` recomputes
duration with it (`functions/src/timeleave.ts`,
`calculateCanonicalLeaveDuration`), and balances and payroll follow from that.
Needs:

- a **working week** and **rest day**, per employee or per company (a hotel has
  both patterns inside one tenant — see the question below);
- the same rule on the client and in `functions/`, or the duration the UI shows
  disagrees with the one the server stores;
- a decision on whether the 2× rest-day premium follows the worker's actual rest
  day or stays pinned to Sunday;
- a decision on existing data, counted under the old rule.

Blocked on **NICO_OPEN_QUESTIONS A6**, which now asks all three.

### 1.2 An `absent` record cannot be reclassified

#36 records new absences with a reason. There is no way to correct one already
stored as "did not come to work" that was really sickness — and that record
carries Art. 33(5) weight: lost pay, deducted seniority, and grounds for
dismissal. Anything imported by CSV, or marked before #36, is in this state.

Needs: on an `absent` row, "This was actually…" → creates the approved leave
request and removes the attendance record, in one action.

### 1.3 Absences are one whole day at a time

The dialog records a single date, whole-day only. A week off sick is five separate
recordings, and `halfDay` / `halfDayType` are supported by `LeaveRequest` and by
the server duration calculation but never offered.

Needs: a date **range**, and a half-day option. The server already handles both —
`calculateCanonicalLeaveDuration` returns `0.5` for a half-day and rejects a
half-day spanning two dates.

---

## 2. Correctness follow-ups

### 2.1 `StatutoryRatesCard` still calls the sick citation unverified

`client/components/settings/StatutoryRatesCard.tsx:37-39` says *"the article
citation is still being verified"* and flags the row `pendingConfirmation`. The
citation **is** settled — Art. 33(4), from the official Lei 4/2012 text. Update
the comment now; clear the badge when **B13** comes back.

### 2.2 Tenants carrying values the UI no longer lets them set

Three settings became read-only or statutory, each with a one-tap repair — but the
repair only helps someone who opens the row:

| Field | Wrong value | Effect |
|---|---|---|
| `specialLeave.paidPercentage` | `≠ 100` | under-pays an Art. 33(3) paid absence |
| `studyLeave.paidPercentage` | `≠ 100` | under-pays an Art. 76(3) paid absence |
| `sickLeave.requiresCertificate` | `false` | contradicts Art. 33(4) |

Also `isPaid: false` with a positive percentage, which pays **nothing**
(`leavePayFraction` requires `isPaid`).

Needs: a read-only query across tenants to size it, then either a migration or a
prompt. Do not silently overwrite — that principle is why the repair buttons exist.

### 2.3 Art. 32(5) carry-over expiry is unbuilt

The 12-month use-by clock does not exist (gap matrix F2). The Time Off page
deliberately says nothing about carried days lapsing, because saying the wrong
thing is worse. Blocked on the carry-over question in NICO C.

---

## 3. UX

### 3.1 Sync-dock confirm shows hours, not money

The #38 guard lists employees and **hours** to be deducted. The number that would
stop someone is the **dollar** amount — the calculator already has the hourly rate.

### 3.2 `TEMP…` identifiers shown to users

`AddEmployee.tsx:474` falls back to `TEMP${Date.now()}` when no ID document is
recorded — deliberate, and `employeeService` checks `startsWith("TEMP")`. But the
profile renders it as **"ID: TEMP1786113801604"**, which is a raw identifier in
front of a user, against STYLE_GUIDE "never expose database identifiers". The
employee list already has the right string for this: `employees.noIdYet`.

### 3.3 Unrecorded list truncates at 8

`daily` mode lists 8 names then "and N more", with no way to see the rest. Fine
for a small team, useless for the 300-employee tenants payroll was hardened for.

---

## 3b. From the social-security / tax sweep (2026-08-08)

An agent swept DL 20/2017, DL 30/2021 and Lei 8/2008 using the same method.
**Most of the engine verified clean** — all ten Art. 86 year→factor pairs to the
digit, the 4%/6% split, Schedule V rates and excess-only maths, the $20 non-cash
threshold, all eight Schedule VIII withholding rows, and every filing deadline.
What follows is what did not.

### 3b.1 Payroll has no petroleum-regime guard  ⚠️ money

**Fixed today: only the wrong comment.** `constants-tl.ts` claimed a "20% flat"
non-resident rate traced to UNTAET Reg. 2000/32 and was superseded. It is not:
**Schedule IX(b) of Lei 8/2008 is live law**, reached via Sec. 72.2 for employees
of a petroleum Contractor (Sec. 68.1):

| Sched. IX | Rate |
|---|---|
| (a) resident **with** TIN | 10% to $550/mo, then $55 + 30% above |
| (b) non-resident | **20%** flat |
| (c) any other case | **30%** flat (e.g. resident who gave no TIN) |
| ¶3 | $10/month personal credit for residents |

`client/lib/tax/withholding-tl.ts` has always had this right and *refuses to
compute* (`UnsupportedTLPetroleumTaxRegimeError`). **The payroll engine has no
equivalent guard** — `calculateTLPayroll` takes no `taxRegime`, and `TLTaxInfo`
carries only `isResident` / `hasTaxExemption` / `inssExempt`.

So a Contractor's employee is withheld under Schedule V. Non-resident on
$3,000/mo: Xefe withholds $300, Schedule IX requires **$600**. Resident with no
TIN on $3,000: Xefe $250, Schedule IX **$900**. Direction is **under**-withholding
— employer liability under Sec. 25.3.

**To build:** a tenant/employee petroleum flag that makes payroll refuse the run
the way supplier withholding already does. Refusing is right; guessing is not.

This also answers a standing memory question ("how/when is 30% applied to oil &
gas workers?"): 30% is the marginal rate above $550 for a resident *with* a TIN,
and a flat rate for anyone in neither named case.

### 3b.2 Art. 86 has five conditions; Xefe checks one

Art. 86(1) requires ≤10 workers, **≥60% nationals**, and a *situação contributiva
regularizada*. Art. 86(3) **ends** the reduction if headcount is exceeded, a
monthly payment is missed, or a monthly DR is not filed — resuming only from the
month after regularisation, and only for the remainder of the legal period.

`usePayrollCalculator.ts` warns on headcount alone; the rest is one self-attested
switch. **Xefe already holds both missing facts** — nationality is on the employee
record, and `taxFilings` knows whether each month's DR was filed and paid. A
lapsed tenant keeps claiming 5.4% and under-remits 0.6% of the base per month,
with Art. 39 interest at 1%/month on top.

Note: Art. 86(1) says "10 ou menos trabalhadores" with **no** definition — no FTE
rule, no treatment of rotational foreign workers. So **B9 stays open and the
statute does not settle it**, which we can now say positively.

### 3b.3 Smaller, recorded not fixed

- **`TL_INSS.minimumSalary: 115`** is a naming trap. Neither DL 20/2017 nor
  DL 30/2021 sets a minimum contribution base for employed workers — the only
  floor is for *voluntary* enrolment over 50 (DL 30/2021 Art. 20(2)). It is
  consumed as the minimum-**wage** fallback. Harmless today, misleading later.
- **`TL_INSS.excludedItems` is dead** — never read anywhere — and two entries have
  no Art. 9 basis (`housing_allowance`, `reimbursement`; the latter is expressly
  *wages* for WIT under Lei 8/2008 Art. 1(g)).
- **Art. 8(2)(c) names two things**, *turnos* and *noturno*. Xefe models only a
  night premium; a contractual shift-rotation supplement lands in the base only
  by accident, via `regular_allowance`.
- **The per-diem / food-allowance toggles** let a tenant put an Art. 9-excluded
  item into the base. Direction is over-contribution (costs the employer, not the
  worker) and the substance-over-form rationale is defensible — but Art. 9(d) is
  unqualified. Flagged, not called a defect.

### 3b.4 ~~Still unverifiable~~ — DISCHARGED 2026-08-08

**Lei 8/2008 Secs. 36.1–36.11** are now read, from the Government's own published
copy (`timor-leste.gov.tl/.../Law_2008_8_Taxes_and_Duties_.pdf`, saved to
`~/Sites/m365-mail-export/laws/tda2008_official_gov.pdf`). Both earlier sources
were truncated; this one is complete.

Schedule VII makes the pooling mechanics nearly vacuous — **one pool, 100% rate**
— so the deduction is full expensing of additions less disposals. Xefe's land
handling and Form C options both check out. Detail in
`docs/STATUTE_RECHECK_AUG2026.md` §6.

**Newly open, small:** under full expensing the written-down value is always zero,
so Sec. 36.11 makes disposal proceeds taxable income in the year. Whether Form C's
`full_expensing` path nets disposals is unverified.

**Also found:** a separate **Schedule X, "Depreciation and Amortisation for
Contractors"**. Petroleum differs on depreciation as well as wage tax, which
strengthens §3b.1 — refusing a petroleum payroll run is right because it is a
parallel regime, not a rate tweak.

---

## 4. Tooling and docs

### 4.1 Tetun native pass  ⚠️ blocks nothing, degrades a lot

~150 new strings shipped on 2026-08-07, much of it legal: the Art. 33(4) bands,
the Art. 33(5) unjustified-absence warning, DL 18/2017 INSS wording, Art. 20(f)
and 27(6). The Tulun linter passes false friends, and legal copy is exactly where
a false friend does damage. Needs a native reader, not a tool.

### 4.2 `docs/TIME_OFF_REDESIGN_SPEC.md` header is stale

Still says **"Status: designed, NOT implemented."** It shipped in #31 and #33.
Sections (h)1, (h)2, (h)4 and (h)5 are already marked resolved inline; the header
is the last thing left.

### 4.3 `test:api` is not in the local gate

It needs Java and the Firestore emulator, so it sits in its own CI job. That is
how a broken `test:api` reached CI on #40: the local gate (typecheck, lint, unit,
i18n, e2e) was green and silent about it. Worth running before pushing anything
that touches `server/xefe-api/` or `package.json` scripts.

### 4.4 Worktree recipe belongs in CLAUDE.md

Verifying from a git worktree — the right move when another session holds the
shared tree — needs three things or **all four e2e specs fail identically** at the
first `locator.fill`, which reads exactly like a code failure:

```bash
git worktree add --detach "$WT" origin/main
cd "$WT" && pnpm install
cp ~/Sites/xefe/.env.local "$WT/.env.local"          # gitignored: VITE_FIREBASE_*
ln -sfn ~/Sites/xefe/functions/node_modules "$WT/functions/node_modules"
```

`functions/` is on **npm**, so `pnpm install` there does not fix it — you get 1112
tests instead of 1141. Symptom guide: app renders but a control is missing → real
bug; app renders **nothing** and every spec dies on the first fill → environment.

Local Firestore emulator port 8081 is regularly taken by another project; override
it in `firebase.e2e.json` / `firebase.dev.json` **and** export
`FIRESTORE_EMULATOR_HOST`, because `tests/e2e/helpers/admin.ts` hardcodes it with
`||=`.

### 4.5 `split-i18n-locales` round-trip

`check-i18n` now validates the locale files and separately fails when the
generated master has drifted. Confirm `i18n:split-locales` still round-trips
cleanly under the stricter check before anyone runs it.

---

## Shipped 2026-08-07 — context for the above

| PR | What |
|---|---|
| #31, #33 | Time Off settings redesign; **sick leave Art. 33(4)**, **paternity Art. 60** corrected; statute shown inline |
| #34 | Employee profile became a page; its content translated for the first time |
| #35 | Annual leave above the Art. 32 floor honoured at termination; sick certificate made statutory |
| #36 | Record a non-worked day, reason first — sick routes through `leave_requests` so the banding fires |
| #37 | Unrecorded people named and actionable |
| #38 | Attendance sync can no longer dock pay silently |
| #39 | `attendanceMode` defaults to `exceptions`; `i18n:check` reads the locale files that ship |
| #40 | Extraction / import robustness (parallel session) |
