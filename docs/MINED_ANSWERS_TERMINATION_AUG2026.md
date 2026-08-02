# Mined answers — termination pay (2026-08-02)

Evidence from the Primos Bo'ot mail corpus against the open questions in
[`NICO_OPEN_QUESTIONS.md`](NICO_OPEN_QUESTIONS.md). De-identified per the §8 ground rules: no
client, employer or employee names, and worked figures restated on a round $220/month salary.

Two passes: the first over ~70% of the corpus, the second over **100%** once the archive
completed. The second pass is where most of this came from.

**Status of this evidence.** Two kinds, and the distinction matters:
1. **Computations** by the firm's own Accountant & Auditor — including a correction he issued to a
   client's draft, then revised again himself 26 minutes later. Observed practice.
2. **Written legal advisories** the firm sent to clients, citing Law 4/2012 by article with a link
   to the ILO copy of the statute. Practitioner opinion, stated deliberately and in writing.

Neither is a court ruling, and §8's warning stands — the firm once mis-stated its own WIT rate.
But where (1) and (2) agree, and the reading matches the statute's own wording, that is about as
close to a practitioner's answer as we get without asking Nico.

---

## ✅ A3 — Is untaken annual leave paid out in cash at termination? **YES — confirmed twice**

`NICO_OPEN_QUESTIONS.md` records *"Xefe today: **no payout line exists**"*. Both evidence types say
one is owed.

**From a written advisory** enumerating obligatory final payments:

> Unused leave (Art. 32): 1 day/month worked or 12/year; **paid in full if not used**; double pay
> if the employer unjustly prevents leave.

**From a real final-pay worksheet** — a dedicated **"Ferias não Gozadas"** gross-pay column. The
accountant's own revision is what pins down the rate:

| | formula | on a $220 salary |
|---|---|---|
| first version | `(salary × 2) / 12` | $36.67 |
| **corrected** | **`(salary / 22) × 2`** | **$20.00** |

**The answer, all three parts of A3:**
- **Payable on exit:** yes, as its own line.
- **Rate:** the ordinary daily rate, `monthly salary / 22`.
- **Accrual basis:** **1 day per month worked**, 12/year. The worksheet leaver had worked 2 months
  of the termination year and was paid exactly 2 days — the advisory's accrual rule and the
  accountant's arithmetic agree independently.

The same revision also zeroed the sick-leave top-up; that was still under discussion in the
message body, so draw nothing from it.

**Also lands a section-C question.** The double-pay penalty is conditioned on the employer
*unjustly preventing* leave. So where the employer offered leave and the worker deferred, there is
no employer fault and the 2× should not apply — which is the C item *"if the employer offers leave
and the worker defers it, is the 2× compensation still owed?"*

---

## ✅ A4 — On a rehire, does Art. 56 service restart? **NO — not within 90 days**

`NICO_OPEN_QUESTIONS.md` records *"Xefe today: the rehire action moves the hire date, so service
restarts"*. The advisory gives a bright-line rule Xefe does not implement:

> If a new fixed-term contract is signed with the same worker for the same reason **within 90
> days**, it automatically becomes a **permanent** contract, and **seniority counts from the
> original start date**. Re-engagement after more than 90 days may restart seniority unless
> continuity is proven. Seniority affects severance, service compensation, holiday accrual and the
> legal stability of the contract.

**So Xefe is wrong for the ≤90-day case on two counts:** it restarts the service clock when
seniority should carry back to the original hire date, and it keeps the contract fixed-term when
the law converts it to permanent. The >90-day case is closer to Xefe's current behaviour, but the
default is "may restart **unless continuity is proven**" — not an unconditional reset.

---

## ✅ A1 — Does justa causa void Art. 56 service compensation? **Practitioner reading: yes, it voids termination pay**

The advisory, on just-cause (disciplinary) termination under Arts. 50/23/24:

> Requires a disciplinary procedure with written accusation, right of defence and formal decision.
> Grounds must be serious misconduct. **No severance pay if the process is valid.**

That resolves A1's apparent statutory conflict in favour of Art. 23(4)(d) over Art. 56's
"independentemente do motivo". It is reinforced by Art. 23(4)(d)'s own wording — *"sem qualquer
indemnização ou compensação"* uses **both** terms, and the advisory's final-payments list treats
*indemnização* (Art. 55) and *compensação* (Art. 56) as the two distinct heads.

**Caveat worth keeping:** the advisory says "no severance pay" generically rather than naming
Art. 56, and it stresses **"if the process is valid"** — a procedurally defective dismissal does
not get the exemption. Xefe's current never-auto-pay-and-make-a-reviewer-decide behaviour remains
the right shape; what it can now add is guidance plus a validity prompt.

---

## ⚠️ A2 — Complete 5-year blocks or pro-rata? **Strongly indicated blocks; still not arithmetically settled**

Now **four independent** statements of the rule, from the firm and from an unrelated HR
coordinator, in English and Portuguese:
- "Service compensation (Art. 56): 1 month's salary per **5 years of continuous service**"
- "Compensação por tempo de serviço (Art. 56.º): 1 mês de salário por **cada 5 anos** de trabalho"
- "Indeminização tempo de serviço 1 salário por **cada 5 anos**"
- a real final payment awarding "Compensação 1 mês por cada 5 anos **(1 mês)**"

Every framing is per-block. **But no worked example has a tenure that is not a multiple of 5**, so
none of them arithmetically distinguishes 1 month from 1.4 months at 7 years. The one worked case
whose tenure is knowable was exactly 10 years → 2 months, which both readings produce.

Sharpen the question to Nico rather than re-asking it: *"Your worksheets all say 1 month per 5
years. For a leaver with 7 years — 1 month or 1.4?"*

---

## ❌ A5 — Are holiday/rest-day 2× premiums in the INSS base? **Still unanswered**

One message looked like an answer and is not: it describes a base built from monthly salary **plus
productivity bonus, overtime, consumption and attendance allowances** — but it says "de acordo com
as regras **fiscais**" and "antes do desconto da Segurança Social", i.e. it is the **WIT** base,
not the INSS base. It corroborates HANDOFF §4's "WIT base includes overtime and bonuses" and
nothing more.

What the corpus *does* establish, from the final-pay worksheet, is that the two bases differ:

```
gross      = normal salary + severance + annual subsidy + untaken-leave payout
WIT base   = gross − leave-without-pay − part-paid sick leave     ← includes severance + leave payout
INSS base  = (normal salary + annual subsidy)                     ← EXCLUDES severance + leave payout
             − leave-without-pay − part-paid sick leave
WIT        = ROUND(IF(base > 500, (base − 500) / 10, 0), 2)
INSS       = base × 4% employee, × 6% employer
```

Two encodable rules: **severance and the leave payout are inside the WIT base but outside the INSS
base**, and the **$500 exemption is applied once against the whole termination gross**. This
corroborates WIT 10%-over-$500 and INSS 4%/6%. It says nothing about premium hours, because the
leaver had none.

---

## Reference data the advisory gives us for free

Not among the ten questions, but directly useful — and it is the firm's own written reading:

| Item | Rule |
|---|---|
| **Art. 55 severance indemnity** | 0.5–6 months by contract duration; ladder ≈ 1 month if <1 yr, 2 if <2 yrs, … capped at 6 |
| **Art. 53 notice** | 15 days if ≤2 years' service, 30 days if >2 years |
| **Art. 53(4) job-search credit** | 2 paid days per week during notice |
| **Art. 44 annual bonus** | 1 month/year, prorated by months worked |
| **Art. 15 pre-redundancy steps** | suspend contract ≤2 months at 50% pay, **or** cut hours/pay ≤40% for ≤3 months — attempt before dismissing |
| **Economic dismissal process** | written notice with reason, affected roles, objective selection criteria, timeline; workers' reps; **Mediation & Conciliation Service is mandatory** |
| **Mutual agreement (Art. 48)** | must be written, signed, include end date, final-payment terms, and clear non-coercion |

**And one product-shaping observation:** a large NGO client accrues severance monthly into a
clearing account at **1 month per year of service** (`salary / 12` per month) — five times the
Art. 56 statutory floor. Real TL employers run contractual severance well above the minimum, so
Xefe should treat Art. 56 as a **floor with a configurable policy on top**, not as the answer.

---

## Still nothing found

**B6** (earned- vs paid-month for the $500 exemption), **B7** (partial week of notice), **B8**
(minimum-wage proration), **B9** (Art. 86 worker counting), **B10** (maternity duty when the INSS
garantia fails), and the section-C depreciation and absence-discount items. B10 had ~6 candidate
messages, all administrative NISS registrations rather than rulings.

---

## Implemented 2026-08-02

All three answered questions are now in code, with tests naming the evidence.
`npm test` 1112 passing (was 1073), `tsc --noEmit` clean, `npm run build` clean.

| Q | Change | Where |
|---|---|---|
| **A3** | `TL_ANNUAL_LEAVE` constant; `accruedAnnualLeaveDays`, `leavePayoutDailyRate`, `calculateUntakenLeavePayout`; `untakenLeaveDays` + `employerPreventedLeave` inputs; `untaken_leave` earning (taxable, **not** INSS base); `untakenLeavePayout` result | `constants-tl.ts`, `calculations-tl.ts`, `tests/client/untaken-leave-payout.test.ts` |
| **A4** | `resolveRehireSeniority` + `REENGAGEMENT_CONTINUITY_DAYS`; rehire keeps the ORIGINAL hire date inside 90 days; `continuousServiceSince` + `priorServiceCompensationSettled` on `Employee` | `leaver-final-pay.ts`, `AllEmployees.tsx`, `employeeService.ts`, `tests/client/rehire-seniority.test.ts` |
| **A1** | `JustaCausaOption`; `severanceDefaultForReason(reason, {justaCausaEstablished})` suggests OFF; `requiredNoticeDays` returns Art. 50(3) zero notice | `leaver-final-pay.ts`, `tests/client/justa-causa-severance.test.ts` |

**Three design decisions worth not undoing:**

1. **`monthsInEntitlementYear` was extracted and is now shared** by the Art. 44 subsidio
   pro-rata and the Art. 32 leave accrual. The observed worksheet used one and the same month
   count for both lines, so letting them drift would put Xefe out of step on one of them. Pure
   refactor — the subsidio's behaviour is unchanged and the existing tests prove it.
2. **A4's fix introduced a double-pay hazard, and it is guarded.** Carrying seniority back means
   a later termination computes Art. 56 over the *whole* carried-back service — and
   `yearPayDateWindow` only looks at the termination year ±~2 months, so a severance settled
   before that window is invisible. Hence `priorServiceCompensationSettled`, stamped at rehire
   and suppressing all-time. It is a boolean, not an amount, because what is knowable at rehire
   is *that* severance was decided, not what was disbursed; it can only ever suppress. The
   scenario is tested explicitly (settled Nov 2026 → rehired Jan 2027 → terminated Aug 2027).
3. **A1 is a flag, not a new `DepartureReason`.** The exemption is conditional on a *valid*
   disciplinary process, which only a human can attest; a defective dismissal keeps the
   entitlement. Defaults to absent, so nothing changes until a caller opts in.

### UI wiring — done (same day)

`npm test` **1117 passing**, `tsc` clean, `build` clean, `i18n:check` 0 missing / 0 extra across
en + tet + pt.

- **Offboarding final-pay panel** now collects all three reviewer inputs: the **untaken-leave day
  count** (with an accrual suggestion from `accruedAnnualLeaveDays` shown beside it — accrual only,
  since Xefe cannot know what was taken), the **Art. 32(5) employer-fault** checkbox (appears only
  once a balance is entered), and the **justa-causa attestation** (appears only for
  `departureReason === "termination"`). Persisted on the case via `useSetFinalPayReviewInputs`,
  stamped onto the employee at completion, and read by payroll.
- **Rehire dialog** shows the live Art. 12 determination — gap in days, whether service continues
  or restarts, which date will count, and the permanent-conversion note — instead of deciding
  silently. The old `serviceResetNote` asserted that service always restarts from the new date,
  which is now false, so it was rewritten.
- **Payslip** shows an "Untaken Leave (Art. 32)" earning line.
- **New plumbing:** `untaken_leave` added to `EarningType`; `Employee.untakenLeaveDays` /
  `employerPreventedLeave`; `OffboardingCase.untakenLeaveDays` / `employerPreventedLeave` /
  `justaCausaEstablished`.

**A fourth safety fix fell out of the wiring.** Once the payout became a real payroll earning it
inherited the double-pay problem Art. 56 already had: two runs covering the same termination period
would each pay it. So `CommittedFinalPay.untakenLeavePayout` now sums committed `untaken_leave`
earnings and `resolveLeaverFinalPay` returns 0 days once any payout is committed — year-agnostic,
exactly like Art. 56, because the balance is a once-per-departure entitlement. Tested, including
that it stays payable when severance is refused (a justa-causa dismissal loses severance but keeps
accrued leave).

## What to do with this

1. **A3 and A4 are the two where Xefe's current behaviour is arguably wrong, not merely
   imprecise** — a leaver is under-paid, and a re-hired worker loses seniority they are owed.
   Both deserve implementation plus a test:
   - A3: `accrued_days × (monthly_salary / 22)`, accruing 1 day per month worked, day count shown
     to the reviewer.
   - A4: a ≤90-day re-engagement should carry the original hire date **and** flip the contract to
     permanent; >90 days should prompt rather than silently reset.
2. **A1** — keep never-auto-pay, add reviewer guidance: valid just-cause process ⇒ no Art. 55/56;
   and prompt on procedural validity, since that is the condition the advisory hangs it on.
3. **The WIT/INSS base split** is a cheap regression test against a real practitioner worksheet.
4. **A2 and A5 stay open** — ask Nico the sharpened A2 question above; A5 needs a payroll with
   Sunday or holiday premium hours, which this corpus does not appear to contain.
5. Verify anything legal against ATTL or the statute before shipping, per §8. The article numbers
   here are the firm's citations, not our own reading of Law 4/2012.

**Source:** full-fidelity mail archive at `/Volumes/DiskName/primosboot-mail-archive/`
(see `~/Sites/ops/plans/primosboot-mail-archive.md`) — 49,597 messages, 2019-01 → 2026-08. The
`.eml` files and extracted spreadsheets are **local-only and contain client PII**: never commit
them, and keep every Xefe artifact de-identified as this file is.
