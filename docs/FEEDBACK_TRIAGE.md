# Open threads — reviewer feedback and unfinished work

_Last updated: 2026-08-22. This file is the INBOX: anything raised that has not
been resolved lives here until it is either done, or recorded as a deliberate
no with a reason. Nothing here should exist only in a chat log or a slide deck._

**Everything marked done or fixed below is LIVE.** Shipped 2026-08-22 in
PRs #76 (payment leg + the offboarding rules bug), #77 (the bot doc index the
deploy needed) and #78 (docs-article body assertion); the Hetzner + Firebase
rules deploy for `14a5812` succeeded and the public pages were verified by
rendering them, not by status code. Anything under *Still open* or *Deliberate
no* is NOT in production.

**This repository is PUBLIC.** Keep entries factual and professional: no
reviewer attributed by name to a criticism, no client or tenant names, no
verbatim quotes that were meant for internal consumption, no evidence sourcing
beyond what the other docs already say. That is also why GitHub Issues is the
wrong home for raw stakeholder feedback here — see *How we track this* below.

## How we track this

| Where | What belongs there |
|---|---|
| **This file** | Reviewer feedback, triage verdicts, and cross-cutting unfinished work. Versioned with the code, reviewed in a PR, and read by whoever picks the work up. |
| `docs/NICO_OPEN_QUESTIONS.md` | Anything that needs a practitioner's ruling on Timor-Leste law. |
| `docs/TIME_LEAVE_BACKLOG.md` | Time & Leave module backlog specifically. |
| `docs/LAUNCH_OPS_TODO.md` | Manual console/infrastructure steps. |
| **GitHub Issues** | Only sanitised, self-contained bug reports. The repo is public, so raw review notes do not go there. |

A verdict of **deliberate no** is a real outcome and must carry its reason — it
stops the same suggestion coming back every review.

---

## A. Product review, 2026 (pre-rebrand screenshots)

The screenshots behind this batch predate the July 2026 rebrand (they still show
the old product name) and the March 2026 SEFOPE removal, so most of it has since
shipped. Verified against the code on 2026-08-22.

### Already done

| # | Raised | Where it landed |
|---|---|---|
| A1 | "Fix N blocking issues" banner disagreed with the count in People | Resolved by removing the blocking framing entirely: `buildEmployeeComplianceSnapshot` now returns `blockingIssueCount: 0` and its comment records why (missing INSS / contract / department are reminders — none affects a payroll calculation). |
| A2 | Manager shown as a raw employee ID (`EMP002`) | `EmployeeProfile` resolves the manager to a real name, falling back to the id only when the record is missing. |
| A3 | Department already set but empty in the edit form | Populated from `employee.jobDetails.department` on load. |
| A4 | Delete the SEFOPE registration number — "it does not exist" | Gone. Only the foreigner **work permit** remains (`documents.sefopeWorkPermit`, gated on non-Timorese) — which the same review asked to keep, because SEFOPE inspects that card on site visits. |
| A5 | ID preference: national ID first for Timorese, electoral card second, passport for foreigners | `AddEmployee` builds contextual document rows from nationality: Timorese → *Bilhete de Identidade* required, electoral card optional; foreigner → passport required. |
| A6 | INSS mandatory, and INSS numbers have no expiry date | Required in both branches, with `hasExpiry: false`. |
| A7 | Nationality first, with a flag, ordered Timor-Leste → regional → alphabetical | `NATIONALITY_OPTIONS` + `NATIONALITY_FLAGS` in `client/lib/constants.ts`, in exactly that order. |
| A8 | Working visa mandatory for foreigners, with an expiry date | Visa number + expiry + upload, plus the SEFOPE permit, shown for non-Timorese. |
| A9 | Address and date of birth flagged as missing with nowhere to enter them | Both are fields on the employee form (`personalInfo.address`, `personalInfo.dateOfBirth`). |
| A10 | Pay frequency on the employee, tied to payroll | `compensation.payFrequency`, defaulting to monthly. |
| A11 | Payment method and bank details on the employee | `paymentMethod` (bank transfer / cash) with bank name and account number. |
| A12 | Tax Information box duplicated the Income Tax (WIT) box | Rebuilt as one row: an explicit **required** tax-residence select plus inline rate text. Residence is never inferred. |
| A13 | Holidays taken / left on the employee profile | Leave used and remaining are shown from `useLeaveBalance`. |
| A14 | Offboarding does not work | See A25 — it was still broken, and is now fixed. |
| A15 | Shifts: copy what the hotel PMS does | Shift scheduling with a coverage grid shipped. |
| A16 | How and when does the 30% oil-and-gas rate apply? | Answered: Law 8/2008 **Schedule IX** for petroleum contractors, not a rate tweak on Schedule V. Xefe refuses to compute it rather than guessing — `docs/PETROLEUM_SCHEDULE_IX.md`. |
| A17 | Money and Accounting dashboard layout requests | Both dashboards have since been redesigned; the screens the requests describe no longer exist. Re-raise against the current UI if the concern stands. |

### Fixed in this pass

| # | Raised | What it actually was |
|---|---|---|
| A18 | "Leave requests seem to duplicate — each request is repeated" | **Not a Leave bug.** The demo seeder mints a fresh random document id for every record, so a second run doubles everything rather than replacing it. `SeedDatabase` now refuses to seed a tenant that already has data and points at "Clear all data". |
| A25 | "Offboarding does not work" — **it really did not**, and the code looked fine (fix is LIVE) | A `firestore.rules` bug, found by asserting on the written record instead of on the dialog closing. `offboardingService.createCase` runs a transaction that READS the document it is about to create (a deterministic id, so a double-click cannot create two departures). The read rule dereferenced `resource.data.tenantId`, which denies a document that does not exist — so the transaction could never get past its own read. Starting an offboarding was **impossible**: the dialog sat on "Starting…" forever, nothing was written, and no error was shown. Exactly the shape of the documented `invoice_links` invariant ("public `get` must allow `resource == null`", `docs/INVOICING.md`). Fixed, with a rules test that fails without the fix and a browser test that proves a case is written. |
| A19 | Calendar view of all leave, filterable by department, weekly and monthly | **Live** at `/time-leave/leave` (sidebar Time & Leave → Leave), on the **List \| Calendar** toggle above the request list; List stays the default. Month/week, department filter, holidays, and pending drawn differently from approved. **It already existed and was wired to nothing.** `client/components/leave/LeaveCalendar.tsx` — month/week, department filter, holidays, per-leave-type colours — was a complete orphan, reachable from no page. Two things it needed before it could ship, and probably why it never did: it carried hardcoded English (in a four-locale product), and it resolved holidays from the statutory table alone, ignoring the tenant's own overrides — so it could mark a day a holiday that a leave request had counted as working. Both fixed, and it is now a List/Calendar toggle on the Leave page with browser coverage. |

### Still open

| # | Item | Note |
|---|---|---|
| A27 | The instalment-cadence Select would not accept a change in a browser test | Once the settings query had settled, choosing "Monthly (registered with ATTL)" left the trigger reading "Follow the law (from turnover)", so the save wrote the old value. Choosing it *before* settings settled worked. It is a plain `Controller` + shadcn `Select`, identical in shape to the `businessType` control beside it, so a Radix/react-hook-form interaction with `CompanyDetailsTab`'s reset-on-settle effect is the obvious suspect — that effect exists precisely because resetting over unsaved edits used to lose them, and its dirty-check guard may not cover a Select. **Reproduced three times, cause not established, so nothing was changed.** Worth checking by hand first: if a human can change it and save, this is a test-harness artefact; if not, the setting is unusable and the resolver only ever sees `auto`. The accounting e2e seeds the value directly meanwhile, so the payment leg stays covered. |
| A26 | **Creating a leave request never completes** | Narrowed a long way, and no longer suspected to be my machine. The POST to `createLeaveRequest` is issued and **never answered** (captured with Playwright request/response listeners: one request, no response, no failure); the function *is* loaded and served; it is not App Check, not a region mismatch, not a stale build; and callables work in this harness generally — `recordTenantAuditEvent` is one and a passing spec asserts on its output. So something inside that function does not return, and the first suspects are `calculateCanonicalLeaveDuration` and the overlap transaction's `transaction.get(query)` on `leave_requests`. **Whether real users are affected is NOT established** — production is a real Cloud Function against real Firestore. Reproduction kept as `tests/e2e/leave-request-callable.spec.ts`, marked `fixme` so it does not fail the suite. |
| A20 | "Print daily money sheet" — **what it contains is now settled**, the build is not | The artefact is a **Folha de Caixa**, and it is well attested: hundreds of them in the evidence base, emailed per entity per period ("Folha de Caixa de Março", "de Novembro"). Two corrections to the request: it is **monthly, not daily**, and its defining feature is not the totals but that **every line has to have its supporting document** — the covering emails are overwhelmingly people chasing "as faturas dos pagamentos mencionados na Folha de Caixa". A line is a payment made from cash or the local account (salary receipts, electricity, water, telecoms, security, accounting fees, tax, social security), and cash payments are recorded on it so they can be "deduzido do saldo do Petty Cash". Xefe already holds every input: expenses, bills, cash advances and the GL cash accounts. What is still a **decision, not research**: which accounts count as "caixa" (cash only, or cash + local bank), whether it groups by entity/delegation, and — separately — whether it should displace "Create Invoice" as the Money dashboard's primary action, which is a UX call I have not made. |
| A21 | Naming: "Money" vs petty cash / *conta corrente* / *osan kik* | **Answered: do not rename it "Osan Kik".** That phrase appears **zero** times in the evidence base, and `kaixa` only 4 — while "petty cash" appears 3,370 times and "conta corrente" 117. Written business correspondence in Timor-Leste uses the English and Portuguese terms, so "Osan Kik" would be a term Xefe invented for its users rather than one they use. If anything is renamed, *Folha de Caixa* / *Petty Cash* are the phrases with evidence behind them. |
| A22 | Per-module view/edit roles for Money | Module permissions exist (`ModulePermission`); whether Money needs a finer split than the current roles is undecided. |

### Deliberate no

| # | Item | Why |
|---|---|---|
| A23 | Green border on every filled field, red on every missing one | Red-on-invalid exists (`aria-invalid` + destructive border). Green on every completed field paints most of a long form green and dilutes the signal that something needs attention. Overrule this if you disagree — it is a taste call, not a technical one. |
| A24 | "Is there a new ASEAN rule for regional employees?" | Searched the evidence base: nothing on ASEAN employment or work-permit rules. Not corroborated, so nothing was built. Ask SEFOPE or a practitioner if it matters. |

---

## B. Unfinished work from the ATTL payment leg (2026-08-22)

See `docs/BANK_PAYMENTS.md`, `docs/MONEY_CHAIN.md` §3 and B18/B19 in
`docs/NICO_OPEN_QUESTIONS.md` for the detail.

| # | Item | Blocked on |
|---|---|---|
| B1 | Is "ALL COMMERCIAL ACTIVITIES – 3 MONTHS" a separate quarterly obligation? | **Narrowed to "probably not".** A TL practitioner describes preparing "a declaração trimestral do imposto sobre o rendimento (**Domestic Installment Tax**) referente ao período de abril a junho" — the quarterly cadence of the tax Xefe already tracks, computed from that quarter's revenue invoices. So the notice title looks like the portal's label for it, not a second filing. Still worth one sentence of confirmation. (Care: nearly all other "declaração trimestral" material in circulation is Portuguese, not Timorese.) |
| ~~B2~~ | ~~The late-payment regime~~ **CLOSED** | ATTL publishes the consolidated Reg. 2000/18 itself. Sec. 72.1 = $100 for a late form; Sec. 73.1 = 5% plus 1% of the tax still unpaid on the 15th of each following month; the 25%/100% uplifts need a Commissioner finding and are deliberately excluded. Estimated in `client/lib/tax/attl-late-charges.ts` and shown as a warning; the ledger still posts only what the operator entered from the notice. Residual question in `NICO_OPEN_QUESTIONS.md` B18. |
| ~~B3~~ | ~~Browser verification of offboarding and the leave calendar~~ **CLOSED** | `tests/e2e/leave-calendar-and-offboarding.spec.ts` creates a leave request, finds it on the calendar in both month and week view, and offboards an employee. The instalment payment path is covered in `accounting-workflow.spec.ts`. |
| ~~B4~~ | ~~An IBAN for the services-tax account~~ **CLOSED** | ATTL publishes all four on its own payment page: services tax is `TL38 0020002866361000162` — exactly the value the shared pattern predicted and which was deliberately left `null` rather than derived. The same page labels the instalment account "Corporate Tax / Income Tax", independently confirming it takes the annual settlement. `ATTLTaxAccountDetail.iban` stays nullable so the never-synthesise rule keeps its guard. |
| ~~B5~~ | ~~Legacy curly apostrophes in `tet.ts`~~ **CLOSED** | Swept. One of them sat inside a single-quoted string, where the straight apostrophe terminated it — so the sweep needs a build afterwards, not just a diff read. |
| B6 | Reading the ATTL assessment notice PDF to prefill the payment | Its own scoped piece of work. It is a new attacker-controlled document type pointed at money fields — see the absolute rules in `docs/DOCUMENT_EXTRACTION.md` before starting. |
