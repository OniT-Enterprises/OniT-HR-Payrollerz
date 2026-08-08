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
**Now a confirmation rather than an open design question.** The July sweep could
not read this article — the OCR copy truncated it mid-sentence — so we asked
blind. The clean mj.gov.tl copy gives it in full, and it is one sentence:

> Independentemente do motivo, em caso de cessação do contrato de trabalho o
> trabalhador tem direito a uma compensação por tempo de serviço no valor
> correspondente a 1 mês de salário por cada período de 5 anos de trabalho ao
> serviço do empregador.

There is no proration language and no cap. Statutes that intend proration usually
say so, so the silence favours **completed blocks** — which is what Xefe does. Are
we reading that right in practice?

⚠️ **The same sentence opens "Independentemente do motivo".** See A1 below: it was
closed as "justa causa voids severance", and this text is unqualified.

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

### A5. Are holiday and rest-day 2× premiums inside the INSS contribution base? — **we now think NO, please confirm**

Re-read 2026-08-08 against DL 20/2017 in full, and we think the statute answers
it. Three provisions, none of which we had cited before:

- **Art. 8(2)(c)** — "os suplementos relativos a trabalho em regime de turnos e
  **trabalho noturno**" are expressly **IN** the base.
- **Art. 9(c)** — "os valores pagos pela prestação de **trabalho extraordinário**"
  are expressly **OUT**.
- Lei 4/2012 **Art. 27** puts the rest-day / holiday 2× rule *inside* an article
  headed "Horas extraordinárias", and Art. 2(y) defines trabalho extraordinário
  as work beyond the normal period — which a rest day is by definition.

So the 2× line is overtime pay and Art. 9(c) excludes it, which is what Xefe
does. The counter-argument is Art. 8(2)(f) (residual "outros subsídios…"), but a
specific exclusion beats a residual inclusion.

**Is that how it is actually declared on the DR?** Original question below.

### A5. Are holiday and rest-day 2× premiums inside the INSS contribution base?
DL 20/2017 Art. 8(2)(f) includes regular supplements in the base; overtime
("trabalho extraordinário") is excluded. A Sunday or public-holiday premium could
be read either way.

- **Impact:** 4% employee + 6% employer on every premium hour, for every tenant
  that works Sundays — hospitality especially. Structural, not marginal.
- **Xefe today:** treats them as excluded (the smaller base).
- **Question:** in or out of the INSS base?

---

### A6. Which day is a worker's rest day, and which days does the company work?
Filed first as "is Saturday a working day", which was too narrow. Art. 30 reads:

> 1. O trabalhador tem direito a um período de descanso semanal remunerado de,
>    no mínimo, **24 horas consecutivas**.
> 2. O dia de descanso semanal **só pode deixar de ser ao domingo quando** o
>    trabalhador preste trabalhos indispensáveis à continuidade de serviços que
>    não podem ser interrompidos ou que tenham, necessariamente, de ser
>    prestados ao domingo.

So Sunday is the **default**, not a rule — a hotel, restaurant, clinic or
security firm lawfully works Sundays, and those workers rest on another day.
Xefe assumes a Mon–Fri week everywhere, and it is wrong in both directions:

| For a hotel worker resting on Wednesday | Xefe today |
| --- | --- |
| Sunday worked — an ordinary day for them | paid **2×** (overpaid) |
| Wednesday worked — their actual rest day | paid **1×** (underpaid) |
| Sick leave spanning a Sunday | consumes no leave day |
| Sick leave spanning their Wednesday | consumes one |

Payroll half-knows this — `usePayrollCalculator` carries "Non-Sunday
per-employee rest days stay manual (wizard row field)" — so there is a manual
escape hatch for pay. **Leave has none**: `calculateWorkingDays` skips Saturday
and Sunday for everyone, and the server recomputes duration the same way.

Three things we would like settled before building it:

1. **Whose fact is it?** A company-wide working week, or per employee? A hotel
   has reception on rotation and an office on Mon–Fri in the same tenant, which
   argues per employee — but that is a field on every worker.
2. **Does the 2× rest-day premium follow the worker's actual rest day**, or is
   Sunday special for pay even when it is an ordinary working day for them?
3. **Does an employer need to record the Art. 30(2) justification** (that the
   service cannot be interrupted), or is it enough that the roster shows it?

**Cost today:** a six-day employer loses a worker a day of pay per six-day sick
spell; a Sunday-operating employer both overpays Sunday work and underpays the
real rest day. Both silent.

**Why we think Mon–Fri is wrong for the typical employer, not just the edge
case.** The statutory week is **44 hours** (Art. 25) and 44 is not 5 × 8 — a
Mon–Fri week is 40. Your own firm's workpaper convention agrees: the 190-hour
divisor we matched to the cent is exactly 44 × 52 ÷ 12, which only makes sense
on a **six-day** week. Outside guides describe the TL standard week the same
way, Monday to Saturday with 24 consecutive hours of rest usually on Sunday.

One thing we are deliberately NOT treating as evidence: the 22-day divisor used
for the leave payout. `constants-tl.ts` records it as a selectable accounting
convention, chosen because it is the pro-worker of the two, explicitly not a
statutory statement about the length of the week.

`docs/TL_LAW_GAP_MATRIX_JUL2026.md` L2 already flags the pay half of this
against Arts. 30(1) and 27(2) — "no per-employee rest-day concept". The leave
half is new.

### A7. Art. 64 — five days a year to care for a sick child. Are we right to omit it?
"Os trabalhadores com filhos menores de 10 anos têm direito a faltar ao trabalho,
até ao limite máximo de 5 dias por ano, para prestar assistência, inadiável e
imprescindível, em caso de doença ou acidente daquele" — and Art. 64(2) makes it
**unpaid** ("determina apenas a perda de remuneração relativa aos dias em causa").

Xefe has no leave type for this. An employer refusing it would be refusing a
statutory right; today the absence would be recorded as ordinary unpaid leave,
which loses the fact that it could not lawfully be refused. Is a distinct type
worth having, or is unpaid leave with a note good enough in practice?

### A8. Is the leave year the calendar year, or the worker's own year?
Art. 32(1) reads **"O trabalhador tem direito a férias remuneradas por cada ano de
trabalho prestado"** — per year of work *rendered*, which sounds like the
employment anniversary. Xefe counts the **calendar** year: `monthsInEntitlementYear`
opens with `asOfDate.getFullYear()` and runs January to December.

Over a full year the two agree on 12 days. They diverge for anyone hired mid-year,
and the divergence reaches money at termination. Someone hired 1 July 2024 who
leaves 31 March 2025 has, on Xefe's reading, accrued 3 days in 2025; on an
anniversary reading they are 9 months into a cycle that has not completed, so
Art. 32(3) gives 1 day per month worked — 9 days.

In practice the 2024 leave year would usually have been taken or paid already,
which is probably why nobody has noticed. **Which basis do TL employers actually
use, and does the prior year's untaken balance carry into that calculation?**

This was previously unverifiable: the OCR copy the July sweep used had Art. 32(1)
unreadable, and the gap matrix recorded "leave-year basis unverified — code
assumes calendar year". The clean mj.gov.tl copy settles what the article SAYS;
only you can settle what is done.

**What makes this more than a wording quibble:** the same statute says **"cada ano
civil"** for the 13th month (Art. 44(2)) and **"cada ano de trabalho prestado"**
for leave (Art. 32(1)). The drafter used different words in adjacent articles.

**And what argues the other way:** a real final-pay worksheet from your firm paid
2/12 of a month's subsídio and 2 days of leave off one and the same month count —
we pinned that in a test. So practice appears to use the calendar basis for both.
If that is simply what everyone does, say so and we will leave it; we would just
rather it be a decision than an accident.

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

### B10. Does the employer-paid maternity duty revive if the worker fails the INSS garantia? — **we now think NO, and the worker bears it**

Read DL 18/2017 in full on 2026-08-08 (it was in the mining directory all along;
our earlier searches missed it because the text reads "N.º 18 **/**2017" with a
space). Three things are now on the record:

- **Art. 15(1)** — "A atribuição dos subsídios depende de os beneficiários, à data
  do facto determinante da proteção, terem cumprido um prazo de garantia de
  **seis meses civis, seguidos ou interpolados**, com registo de remunerações nos
  últimos 12 meses." Confirms the 6-in-12 rule Xefe states.
- **Art. 18** — reference wage is **R/180**, R being the remuneration registered in
  the six civil months preceding the second month before the event. And
  "**não é considerado o subsídio anual**" — the 13th month is excluded from it.
- **Art. 19(1)** — subsidies are due "a partir do primeiro dia do mês **seguinte**
  à data de apresentação do requerimento". A late claim loses months.

**On the question itself: neither instrument creates an employer fallback.**
DL 18/2017 governs only the subsidy and is silent on the employer. Lei 4/2012
Art. 61 conditioned the employer's duty on "**até ao estabelecimento do sistema de
segurança social**" — a condition about the SYSTEM existing, not about an
individual qualifying. The system exists, so on the plain text the duty is spent
for everyone, and a worker who misses the garantia is simply unprotected.

That is what Xefe assumes (employer-unpaid, with a "confirm with your accountant"
note). We would rather hear you say it than keep inferring it — and if the real
practice is that the employer pays anyway, that is a money default we have wrong.

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

### B13. Sick leave is Art. 33(4) — please confirm the reading
We had this wrong in two places (`Art. 42`, which is wage deductions, and
`Art. 34`, which is occupational-safety principles). The official Lei 4/2012 text
puts it in **Art. 33(4)**, the same article as the three days of special leave:

> "O trabalhador pode igualmente faltar justificadamente ao trabalho por motivo de
> doença ou acidente, mediante a apresentação de atestado médico, até 12 dias por
> ano, dos quais 6 são remunerados por inteiro e os 6 dias restantes remunerados a
> 50 por cento do valor da remuneração diária."

That is exactly what Xefe's engine pays, so no money moves either way. Two things
follow that we would like confirmed rather than assumed:

1. **The citation itself** — the sick-leave row in Settings still carries a
   "Pending confirmation" badge waiting on you.
2. **The certificate is statutory, not optional.** "mediante a apresentação de
   atestado médico" reads as a condition of the absence being justified. Xefe used
   to offer a company toggle for it; that toggle is gone and the requirement is now
   stated as law. Is that right — and should Xefe ever *block* a sick day with no
   certificate, or only record that one is outstanding? We do the latter, on the
   grounds that the certificate usually arrives after the absence starts.

### B14. Does Art. 14 authorise deferring annual leave for a waiting period?
Xefe lets a company set a waiting period (default 3 months) before a new worker may
take annual leave, and the copy cites **Art. 14**. But Art. 14 probation is
8/15/30/90 **days** depending on category, so a 3-month wait exceeds statutory
probation for everyone except managerial staff, and we cannot find the provision
that permits delaying Art. 32 leave specifically.

The row is badged "Pending confirmation" and tells the owner to ask their
accountant. Is the practice lawful, and if so under what? If it is not, the setting
should go.

### B15. Art. 76(4) — may a minor worker-student align leave with school holidays?
Art. 76(4) gives a worker-student who is a **minor** the right to line their annual
leave up with the school holidays. Xefe implements 76(3) (paid absence to sit
exams) but has no concept of a worker-student at all, so nothing prompts this when
leave is scheduled.

Is this something employers here actually field, or is it dormant in practice? We
already store date of birth, so the minor half is free; the student half would be
a new flag on the employee.

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

### A1. Does justa causa void Art. 56 service compensation? — **RE-OPENED 2026-08-08**

⚠️ Closed on your firm's advisories, but the clean statute copy now readable says
Art. 56 applies **"Independentemente do motivo"** — regardless of the reason — in
an unqualified single sentence. Either another article carves out dismissal for
cause, or practice diverges from the text.

This is the largest single number on a final payslip, so we would rather ask twice
than be wrong once. Xefe currently follows your advisory (cause-aware, no
severance). **Is that still right?** Original answer below.


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
