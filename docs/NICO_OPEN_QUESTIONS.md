# Open questions for Nico — Timor-Leste payroll & tax

Questions where Xefe's engineering has gone as far as it can without a practitioner's
ruling. Each one states what Xefe does *today*, so the shortest useful answer is often
"that's correct" or "no — do X instead". Nothing here needs a written opinion; a
sentence each is enough to unblock it.

Where the answer changes money, the amount is given. Where Xefe had to pick a side
to ship, it picked the **conservative** one — over-withholding rather than under,
disclosure rather than silent inference, never auto-paying a contested amount — so
no answer below can be creating an underpayment or an under-remittance today. The
cost of the current state is precision and, in a few places, an operator being
asked to make a judgement the software could have made for them.

Source detail for all of these is in `docs/TL_LAW_GAP_MATRIX_JUL2026.md`; the
statute references were read from a clean Jornal da República copy.

**This list was ten questions; three are now closed** — see *Already answered* at the
end. Question IDs are unchanged so existing cross-references still resolve. If any of
the three closed readings looks wrong to you, that correction is more valuable than
anything still open below.

---

## A. Money-affecting — worth answering first

### A2. Is Art. 56 service counted in complete 5-year blocks, or prorated?
"um mês de salário por cada período de 5 anos de trabalho" — does a worker with
7 years get 1 month (one complete block) or 1.4 months (prorated)?

- **Impact:** on $600 and 7 years, $600 vs $840.
- **Xefe today:** complete blocks only (the smaller amount).
- **What we already have:** four independent statements of "1 month per 5 years" —
  two from your firm (EN and PT), one from an unrelated HR coordinator, and one real
  final payment. Every one of them is *framed* per block. But every worked example we
  can find has a tenure that is an exact multiple of 5, where both readings give the
  same answer, so none of them actually settles it.
- **Question, as narrowly as we can put it:** *for a leaver with exactly 7 years —
  1 month, or 1.4?* And does a partial final block count at all?

### A5. Are holiday and rest-day 2× premiums inside the INSS contribution base?
DL 20/2017 Art. 8(2)(f) includes regular supplements in the base; overtime
("trabalho extraordinário") is excluded. A Sunday or public-holiday premium could
be read either way.

- **Impact:** 4% employee + 6% employer on every premium hour, for every tenant
  that works Sundays — hospitality especially. Structural, not marginal.
- **Xefe today:** treats them as excluded (the smaller base).
- **Question:** in or out of the INSS base?

---

## B. Precision — smaller amounts, same certainty problem

### B6. For the $500 resident WIT exemption, is "month" the month wages were earned or paid?
Xefe uses the wage-period month everywhere except one place, where the per-period
slice of the $500 is divided by the number of paydays falling in the **pay-date**
month.

- **Impact:** ~$2.50 per affected employee-month, in the **over**-withholding
  direction. A worked example: weekly Friday paydays, the last June period paid
  3 July (a 5-payday month) → June-period income receives $475 of allowance
  instead of $500.
- **Xefe today:** as described. No code changed, because the fix depends on this
  answer.
- **Question:** earned-month or paid-month? If earned, the divisor should key on
  the period month.

### B7. Does a partial week of notice earn the Art. 53(4) job-search credit?
Art. 53(4) gives a paid credit of "dois dias de trabalho por semana" during a
redundancy notice period. The statute does not address a trailing part-week.

- **Impact:** up to 2 days' pay per redundancy leaver.
- **Xefe today:** counts complete weeks only and presents the figure as a minimum
  ("at least N days").
- **Question:** does a trailing partial week earn the 2 days, pro-rata, or nothing?

### B8. Does the $115 minimum wage prorate for a genuine part-timer?
- **Impact:** currently a lawful part-time arrangement below $115/month is hard to
  process — the floor is enforced as an absolute.
- **Question:** does the minimum wage prorate by contracted hours, or is $115 an
  absolute monthly floor regardless of hours?

### B9. Art. 86 small-employer INSS discount — how are workers counted?
Heads or full-time equivalents? And do foreign rotational workers count toward the
10-worker and 60% thresholds?

- **Impact:** the reduced employer rate applies or does not — a rate change across
  the whole payroll, so it is all-or-nothing per tenant.
- **Xefe today:** counts heads on the run.

### B10. Does the employer-paid maternity duty revive if the worker fails the INSS garantia?
DL 18/2017 has INSS pay a parental subsidy at 100% of the reference wage to a
worker with 6 months of contributions in the last 12. If she does **not** qualify,
does Art. 61's employer duty come back?

- **Impact:** up to 12 weeks of salary per affected worker.
- **Xefe today:** employer-unpaid by default (INSS pays), with the tenant able to
  configure a paid percentage. So a non-qualifying worker currently receives
  nothing from either side unless the tenant intervenes.
- **Question:** does the employer owe maternity pay when the worker fails the INSS
  contribution test?

---

### B11. Must a new worker have a NISS before their first payroll, or before the first DR?

Xefe now lets an employer create an employee **without** an INSS/NISS number and
chases it later — the Add Employee form was previously unusable for a shop owner
who did not have the card to hand. The customer-facing copy says the number is
"needed before your first INSS filing".

- **Impact:** none on money; entirely on what we tell an employer they may
  postpone. If enrolment is actually due within N days of hiring, our copy is
  telling them the opposite.
- **Xefe today:** the number is optional at hire; the monthly DR export refuses
  to generate for any employee missing one, naming that employee.
- **What we could not establish:** `docs/TL_LAW_GAP_MATRIX_JUL2026.md` finds no
  employer register duty beyond Art. 20(f) / 27(6), and nothing in the corpus
  sets an enrolment deadline.
- **Question:** *is there a deadline to enrol a new worker with INSS, and does
  anything go wrong if the number only appears at the first monthly DR?*

### B12. Is an individual worker TIN ever mandatory, or only above a threshold?

- **Impact:** none today — the DR writes the worker TIN column blank when absent
  and no calculation reads it.
- **Xefe today:** optional everywhere, collected behind a disclosure.
- **What we already have:** the only TIN-conditional rule found anywhere is the
  petroleum regime (30% flat with no TIN, `docs/MINED_SIGNOFF_ANSWERS_JUL2026.md`).
  We deliberately did **not** invent a domestic threshold.
- **Question:** *for ordinary non-petroleum employment, is a worker TIN required
  at any income level — or is it genuinely optional?*

## C. Low stakes — answer if convenient

- **Tax depreciation:** Schedule VII prints 100% first-year expensing, but
  practitioners reportedly use useful-life rates. Which does ATTL actually accept
  on Form C?
- **Unjustified-absence seniority discount:** calendar days or working days?
- **Annual-leave carry-over clock (Art. 32):** how long may an untaken balance be
  carried before it lapses — is there a 12-month use-by, and from when?
- **In-kind wages:** lawful under Art. 40(1)? Moot while Xefe is 100% cash.

---

## Already answered — please correct us if any of this is wrong

Closed on 2026-08-02 from your firm's own written advisories and a final-pay
worksheet, not from our reading of the statute. All three are now live in Xefe, so a
correction changes real behaviour.

### A1. Does justa causa void Art. 56 service compensation? — **no severance, if the process is valid**
Art. 23(4)(d) ("sem qualquer indemnização ou compensação") prevails over Art. 56's
"independentemente do motivo". We took "valid" to mean written accusation, right of
defence and a formal decision, so Xefe asks a reviewer to attest to the process
rather than inferring it from the departure reason — a procedurally defective
dismissal keeps the entitlement. We also applied Art. 50(3): no prior notice.

- **Still open on this topic:** whether Art. 55 sits on top in an unlawful-dismissal
  finding.

### A3. Is untaken annual leave paid out in cash at termination? — **yes**
Paid in full on exit, accruing **1 day per month worked** (12/year), valued at the
**ordinary daily rate = monthly salary ÷ 22**. Taxable, but outside the INSS base.
The ÷22 convention came from your worksheet; we made it configurable per tenant
because the statute does not prescribe a divisor and our hourly-rate maths uses the
annualized 44-hour week (~23.83 days) instead.

- **Also taken from this:** the Art. 32(5) double pay attaches to the employer
  having *prevented* the leave, so leave a worker chose to defer carries no penalty.
  Xefe asks; it never infers fault.
- **Worth confirming:** does an untaken balance carried over from an *earlier* year
  also get cashed out, or only the current year's accrual? (See section C.)

### A4. On a rehire, does Art. 56 service restart? — **not within 90 days**
Re-engagement within 90 days carries seniority from the original start date (and
makes a new fixed-term contract permanent); beyond 90 days service restarts unless
continuity is proven. Xefe previously reset the clock unconditionally, which
under-paid short-break returners; it now keeps the original date inside the window
and shows the reviewer which rule applied.

- **What we could not implement:** Xefe does not record the *motive* of a
  re-engagement, so the automatic fixed-term→permanent conversion is flagged to the
  reviewer rather than applied. If the motive rarely differs in practice, we would
  rather just apply it.
