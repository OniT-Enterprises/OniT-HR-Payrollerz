# Time & Leave backlog

Everything left open after the 2026-08-07 Time Off / Attendance work (PRs #29–#40).
Ordered by consequence, not by effort. Each item says what is wrong **today**, so
none of them needs this session's context to pick up.

Legal questions are not here — they live in `docs/NICO_OPEN_QUESTIONS.md`
(**A6** Saturday, **A7** Art. 64 childcare, **B13** sick-leave citation and the
certificate, **B14** the annual-leave waiting period). This file is engineering.

---

## 1. Money — do these first

### 1.1 Saturday is treated as a non-working day  ⚠️ real money

`calculateWorkingDays` (`client/services/leaveService.ts`) skips
`dayOfWeek === 0 || dayOfWeek === 6`. But **only Sunday** is the Art. 30(2) weekly
rest day, and the rest of the codebase agrees: `attendanceCalculations.ts` and
`usePayrollCalculator.ts` pay the 2× rest-day rate for **Sunday** and treat
Saturday work as ordinary.

So the leave engine and the payroll engine disagree about what Saturday is. For a
six-day business — common in Dili — a worker sick Mon–Sat is counted as **5 days,
not 6**: they lose a day of pay and keep a day of entitlement they already spent.

It also blocks recording: the absence dialog refuses a Saturday, because it asks
the same function whether the day counts.

**Why it is not a one-line fix.** `calculateWorkingDays` is the canonical
leave-duration source — the server callable `createLeaveRequest` recomputes
duration with it (`functions/src/timeleave.ts`, `calculateCanonicalLeaveDuration`),
and balances and payroll follow from that. Changing it needs:

- a per-tenant **working week** setting (which days the company opens);
- the same rule on the client and in `functions/`, or duration disagrees between
  what the UI shows and what the server stores;
- a decision on existing data — past requests were counted under the old rule.

Blocked on **NICO_OPEN_QUESTIONS A6**.

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
