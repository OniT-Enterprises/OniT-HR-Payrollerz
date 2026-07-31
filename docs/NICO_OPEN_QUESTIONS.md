# Open questions for Nico — Timor-Leste payroll & tax

Ten questions where Xefe's engineering has gone as far as it can without a
practitioner's ruling. Each one is blocking a real decision in the product.

**How to use this:** every question states what Xefe does *today*, so the shortest
useful answer is often "that's correct" or "no — do X instead". Nothing here needs
a written opinion; a sentence each is enough to unblock it.

Where the answer changes money, the amount is given. Where Xefe had to pick a side
to ship, it picked the **conservative** one — over-withholding rather than under,
disclosure rather than silent inference, never auto-paying a contested amount — so
no answer below can be creating an underpayment or an under-remittance today. The
cost of the current state is precision and, in a few places, an operator being
asked to make a judgement the software could have made for them.

Source detail for all of these is in `docs/TL_LAW_GAP_MATRIX_JUL2026.md`; the
statute references were read from a clean Jornal da República copy.

---

## A. Money-affecting — worth answering first

### A1. Does a justa-causa dismissal void Art. 56 service compensation?
Art. 23(4)(d) says a worker dismissed for just cause gets "sem qualquer
indemnização ou compensação". Art. 56 says service compensation is owed
"independentemente do motivo". These read in opposite directions for a
dismissed-for-cause worker with 5+ years of service.

- **Impact:** one month's salary per completed 5-year block. On a $600 salary with
  12 years' service that is $1,200 either paid or not paid.
- **Xefe today:** never auto-pays it. A reviewer must explicitly decide and
  acknowledge severance for each departure, and the decision is stamped on the
  employee. So the risk is a reviewer being given no guidance, not a wrong payment.
- **Question:** for a dismissal with just cause under Art. 23(4)(d), is Art. 56
  compensation payable or not?

### A2. Is Art. 56 service counted in complete 5-year blocks, or prorated?
"um mês de salário por cada período de 5 anos de trabalho" — does a worker with
7 years get 1 month (one complete block) or 1.4 months (prorated)?

- **Impact:** on $600 and 7 years, $600 vs $840.
- **Xefe today:** complete blocks only (the smaller amount).
- **Question:** blocks or pro-rata? And does a partial final block count at all?

### A3. Is accrued-but-untaken annual leave paid out in cash at termination?
Art. 32 gives 12 working days a year. Nothing in the statute text we have says
explicitly whether an unused balance converts to cash when employment ends.

- **Impact:** up to 12 days' pay per leaver — on $600/month roughly $276.
- **Xefe today:** **no payout line exists.** A leaver's final pay is wages +
  Art. 56 + Art. 44 only. If a payout is owed, Xefe is currently silent about it
  and the employer would have to add it manually.
- **Question:** is untaken annual leave payable on exit? If so, at the ordinary
  daily rate, and is it capped at the current year's accrual or does carry-over
  count too?

### A4. On a rehire, does Art. 56 service restart?
A worker leaves, is paid Art. 56 for their completed blocks, and is later rehired.

- **Impact:** whether their next departure counts service from the original hire
  date (paying for the same years twice) or from the rehire date.
- **Xefe today:** the rehire action moves the hire date, so service restarts and
  the 13th month prorates from the new start. Xefe also suppresses a second
  severance for any already-committed amount in the lookup window.
- **Question:** is that right — does a rehire start a fresh service clock for
  Art. 56?

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

## C. Low stakes — answer if convenient

- **Tax depreciation:** Schedule VII prints 100% first-year expensing, but
  practitioners reportedly use useful-life rates. Which does ATTL actually accept
  on Form C?
- **Unjustified-absence seniority discount:** calendar days or working days?
- **Carry-over and "culposamente" (Art. 32(5)):** if the employer *offers* leave and
  the worker defers it, is the 2× compensation still owed?
- **In-kind wages:** lawful under Art. 40(1)? Moot while Xefe is 100% cash.

---

## What Xefe will do with the answers

A1–A5 change engine behaviour or reviewer guidance and each has a test waiting to
be written against the answer. B6–B7 are one-line changes once the basis is known.
B8–B10 remove hard blocks or defaults that currently need an operator to work
around them. Nothing here is waiting on more engineering — only on the ruling.
