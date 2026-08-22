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

**Added 2026-08-13.** A6 gained urgency (see below), and five new items arrived from
building a feature list an HR practitioner running SAP payroll for a large TL
employer said their system has and ours did not. A11–A13 are readings Xefe had to
pick a side on to ship, and each now carries a *pending confirmation* badge on the
statutory rules card in Settings → Payroll, so an operator can see the figure is
provisional. D1–D2 are the two items we deliberately did NOT build, and D3 records
why that list may be a Schedule IX list rather than an ordinary-payroll one.

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

**BUILT 2026-08-08 — the question below is now narrower.** Xefe has a distinct
`childcare` type: 5 days, unpaid, justification required, its own entitlement
bucket so it is never drawn from annual leave. The 5 days are treated as a
**floor** on the employer (Settings warns below 5, as it does for Art. 32's 12),
on the reading that "limite máximo" caps the worker's claim rather than the
employer's generosity.

Two things still worth a second opinion:

1. **Is the floor reading right?** If "limite máximo" is instead a hard cap on
   what may be granted *as this type*, the warning is wrong and days above 5
   should be ordinary unpaid leave.
2. **Does "filhos menores de 10 anos" reach beyond biological children** —
   adopted, fostered, or a dependent child of the household? Xefe does not ask
   who the child is, which is permissive; if the statute is narrower, employers
   relying on Xefe would be granting more than they owe.

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

### A11. After a mid-year pay rise, which salary does the Art. 44 subsídio use?

Art. 44 sets a **floor**, and does not say which month's salary the floor is
measured against:

> 1. O trabalhador tem direito a um subsídio anual de valor **não inferior a 1
>    salário mensal**, que deve ser pago pelo empregador até ao dia 20 de Dezembro
>    de cada ano civil. 2. O cálculo do subsídio anual é proporcional aos meses de
>    trabalho prestado em cada ano civil.

A worker on $500 who rose to $600 in March is owed either $600 (the salary when it
is paid) or about $584 (the year weighted by days at each rate).

**The "não inferior a" wording argues for the current salary**, which is what Xefe
uses. If the entitlement is a minimum of one monthly salary, a weighted average
that comes in below one *current* monthly salary is arguably under the floor. That
makes our choice defensible on the text rather than merely cautious — but it is
still a reading, and 44(2) fixes only the month COUNT, not the rate.

- **Impact:** on that example, $16. On a $2,000→$2,600 rise in July, about $300.
- **Xefe today:** the salary in force when the subsídio is paid — the higher figure
  whenever the year's movement was a rise, which it normally is. This is also
  unchanged behaviour, so no existing tenant's figure moved when salary history
  shipped.
- **What we can now show you:** `timeWeightedMonthlySalary` computes the weighted
  alternative from the recorded history. It is deliberately wired to nothing, so
  answering this is a one-line change either way.
- **Same question applies to** the Art. 32 untaken-leave payout and the Art. 56
  severance month, which use the current salary for the same reason.

### A12. Are back-dated pay arrears taxed in the month paid, or the months they relate to?

A rise agreed in April but effective from March is paid as "retroativos" on the
April run — we see this instruction from clients regularly, and "Retroativos" is a
standing column on the payroll registers we have seen.

- **Xefe today:** taxed in the month PAID. TL WIT is assessed monthly and our
  month-to-date exemption ledger is per calendar month, so re-opening March would
  contradict a DR that has already been filed for it.
- **Why it matters:** with the $500 resident exemption assessed monthly, bunching
  two months of arrears into one month can push a worker over a band they would not
  have crossed had each month been assessed on its own. The month-paid treatment is
  therefore the one that can withhold MORE, not less.
- **What we need:** confirmation that month-paid is right, or the correct rule if
  arrears must be reassessed against the month they relate to.

### A13. Is an attendance premium (prémio de assiduidade) inside the INSS base?

Employers here pay a fixed monthly premium that a period with unjustified absence
forfeits. It is the most repeated payroll instruction we see.

Read against the republished text (DL 30/2021), the question is sharper than
"Art. 8 or Art. 9" — **two** limbs of Art. 8(2) reach it and one limb of Art. 9
excludes it:

> **8(2)** Considera-se igualmente base de incidência contributiva: a) A
> remuneração variável, paga ao trabalhador com base no seu **desempenho ou
> produtividade** […] f) Outros subsídios ou suplementos remuneratórios devidos por
> força do exercício de atividade, **quando previstos em disposição legal, contrato
> ou em acordo coletivo**.
>
> **9** Não se considera base de incidência contributiva: […] e) Outros
> **benefícios extraordinários** concedidos pelo empregador.

- **So the answer may depend on how the premium arises.** Written into the contract
  it falls squarely in 8(2)(f). Handed out at the employer's discretion it starts to
  resemble 9(e). If you confirm that distinction matters, Xefe needs a
  contractual-vs-discretionary flag on the premium; today it has none.
- **Xefe today:** always taxable AND contributable, on the 8(2)(a) reading. On a
  $145 premium that is $5.80 employee INSS (4%) and $8.70 employer (6%).
- **Why we chose that side:** it is the employer-costlier, worker-protective
  reading, so a correction can only ever reduce a contribution and can never create
  an arrear with INSS.
- **It is also the answer A5's own principle gives.** A5 resolves the rest-day
  premium by holding that a *specific* provision beats a *residual* one — Art. 9(c)
  names trabalho extraordinário expressly, so it beats the residual inclusion in
  8(2)(f). Apply that consistently here and the polarity reverses: 8(2)(a) names
  variable pay for desempenho expressly, while 9(e) is the residual "outros
  benefícios extraordinários". Specific inclusion beats residual exclusion, so the
  premium is IN the base. We would rather you confirm the principle holds in both
  directions than have us apply it only where it suits.

## B. Precision — smaller amounts, same certainty problem

### B6. For the $500 resident WIT exemption, is "month" the month wages were earned or paid?
**Resolved 2026-08-13:** payment month. Law 8/2008 ties withholding and
remittance to wages paid, and ATTL describes the monthly liability by wages paid
and tax deducted. Xefe now groups every committed run by `payDate`: a December
salary paid in January shares January's $500 resident threshold with every other
January wage payment. The calendar-month $20 benefits-in-kind test follows that
same payment-month grouping.

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

- ~~**Tax depreciation**~~ **Resolved 2026-08-13:** Xefe follows Schedule VII's
  printed 100% rate. The workpaper no longer offers a yearly useful-life choice;
  changing statutory method requires the Tax Administration's written permission.
- **Unjustified-absence seniority discount:** calendar days or working days?
- **Annual-leave carry-over clock (Art. 32):** how long may an untaken balance be
  carried before it lapses — is there a 12-month use-by, and from when?
- **In-kind wages:** lawful under Art. 40(1)? Moot while Xefe is 100% cash.

## D. Raised by a practitioner, deliberately NOT built yet

Both came from an HR practitioner running SAP payroll for a large TL employer, as
features their system has and ours does not. We built the rest of that list. These
two we stopped on, for opposite reasons.

### D1. What is "retenção para a CAC"?

We cannot identify the acronym, and we would rather ask than guess at something
that withholds money from a worker's pay.

- **What we checked:** Lei 4/2012, DL 18/19/20 2017, DL 30/2021, the Taxes and
  Duties Act 2008 — no occurrence. An archive of 49,629 unique messages of TL
  accounting correspondence spanning 2019–2026 (121,496 rows counting
  per-mailbox copies): zero occurrences of `CAC` as a word, zero of
  "cooperativa de aforro/crédito", zero in seven years of attachment filenames.
  And the open web: in Timor-Leste the acronym resolves to the **Comissão
  Anti-Corrupção** (Lei 8/2009), a state investigative body with no payroll
  withholding attached to it. TL credit cooperatives do exist (the Lei das
  Cooperativas, the Hanai Malu federation) but none of them is abbreviated CAC.
  So please treat the search as exhausted rather than repeat it.
- **Why that matters:** a deduction absent from all of that is unlikely to be a
  general TL obligation. It is more likely specific to one large employer, or an
  acronym we are simply reading wrong.
- **What we need:** the full name, who the money is remitted to, whether it is a
  percentage or a fixed amount, and whether it comes off gross (reducing the WIT
  base) or net.
- **What already exists if the answer is mundane:** the Deductions & Advances
  register can carry it today as a recurring deduction. What it lacks is a named
  type, a remittance report to whoever receives it, and a liability account.

### D2. Medical expenses — we think a *deduction* would be the wrong treatment

Asked for as "incorporação de dedução de despesas médicas". We believe TL law puts
this the other way round, and would rather be corrected than ship it.

- **What the statute says:** TDA 2008 §(g) makes "the reimbursement or discharge by
  an employer of any expense of the employee, including utilities or **medical
  expenses**" wage INCOME. Health-insurance premiums paid by an employer for an
  employee are deductible to the employer but taxable to the employee. Only a
  payout *from an insurance company* to a person is exempt income.
- **Corroborating practice:** your own firm's audit finding against a client (May
  2024) was precisely that they had *excluded* the medical allowance from the
  wage-tax base — written up as an error, citing Tax Law 8/2008 Art. 1.
- **So a "medical expense deduction" that reduced taxable pay** would manufacture
  the very finding your firm bills to correct. What can legitimately exist is a
  post-tax recovery of a company-paid medical bill, which the existing deductions
  register already handles.
- **We checked the one place it could have lived, and it is not there.** The
  practitioner who asked runs payroll for a petroleum employer, whose staff are taxed
  under Schedule IX rather than the ordinary Schedule V we build against. Schedule IX
  read in full is three rates, a pro-rata rule and a flat $10/month personal credit:
  no personal deductions of any kind, medical or otherwise. So **there is no
  medical-expense relief anywhere in TL wage income tax**, on either schedule.
- **What we need:** confirmation, or the instrument we have not read. The remaining
  candidate is not wage tax at all — a medical cost may well be a deductible
  *business expense* to the employer under corporate income tax, which is a different
  tax and does nothing for the employee's take-home pay. If that is what the request
  actually means, it is an expense-recording feature, not a payroll one.

### D3. Xefe cannot run payroll for a petroleum Contractor at all — is that where this list came from?

Worth stating plainly because it reframes D1 and D2. `RunPayrollWizard` replaces the
whole wizard with a refusal when a tenant is flagged as a party to a Petroleum
Agreement: Schedule IX is a different regime with a different filing desk, and
running those employees at Schedule V rates under-withholds, which Sec. 25.3 makes
the *employer's* liability.

So if the features on this list come from a Schedule IX employer, some of them may be
Schedule IX features rather than gaps in ordinary TL payroll. That does not devalue
them — the attendance premium, back-dated raises and NISS-on-payslip are all clearly
general-market and are now built — but it does mean **CAC and the medical deduction
should be read as possibly petroleum-specific** before anyone treats them as
missing general functionality.

One engineering note while this is in view: the refusal lives in the WIZARD, not in
`calculateTLPayroll`, which still has no `taxRegime` input. Any non-wizard caller
would compute Schedule V silently. `withholding-tl.ts` throws
`UnsupportedTLPetroleumTaxRegimeError` rather than guess; the engine has no
equivalent. Tracked in `docs/TIME_LEAVE_BACKLOG.md`.

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

### B16. May a notice shortfall be set off against the final wage?
When a worker resigns without serving the full notice, **Art. 49(9)** makes them
owe the employer "uma indemnização … de valor igual à remuneração correspondente
aos dias não cumpridos". Xefe states that debt next to the final payslip, which
invites the obvious next step — hold it back.

Two provisions pull opposite ways and we cannot settle it from the text:

- **Art. 43(1)** — "Salvo nos casos expressamente previstos na lei, o empregador
  **não pode**, através da remuneração, compensar créditos que tenha sobre o
  trabalhador."
- **Art. 42(2)** — authorises deductions for social security "**bem como noutros
  casos determinados por lei** ou por decisão judicial". Art. 49(9) *is* a case
  determined by law.

So: is Art. 49(9) one of the "casos expressamente previstos" that Art. 43(1)
exempts? And if a worker's written authorisation under Art. 42(1) unlocks it,
does the **Art. 42(3) 30% cap** apply to a one-off final settlement, which is not
obviously the "remuneração recebida pelo trabalhador" in a month that the cap is
worded against?

- **Impact:** on a $180/month worker a 30-day shortfall is the whole final month.
  If the cap applies, at most ~$54 could ever be taken.
- **Xefe today:** states the debt, deducts nothing, and does not tell the employer
  either way — because we would be asserting a rule the statute does not settle.

### B17. Which Art. 55 routes should Xefe actually surface?
Art. 55's banded scale is imported by four articles that mention **no court**:
Art. 15(9) (cessation agreed after a suspension), Art. 17(3) (worker rescinds
after a harmful transfer), Art. 45(3) (dismissal on a prohibited ground, which is
*nulo*), and Art. 49(5) (resignation for just cause, **doubled**). Our copy said
this money was court-only; that is now corrected.

Before wiring any of them we would like two things settled:

1. **How much do the first three actually import?** Only Art. 49(5) uses the
   quantum formula "é calculada nos termos do disposto no artigo 55.º". The other
   three say "a indemnização prevista no artigo 55.º", and Art. 55(3)'s chapeau is
   itself conditional on reinstatement being declined or refused. Do they import
   the n.º 3 bands outright?
2. **Art. 49(5) in practice.** Art. 49(6) lets the employer challenge within 60
   days and Art. 49(7) can invert the claim onto the worker. Is the doubled figure
   something an employer should be provisioning for, or exposure to disclose?

We have deliberately NOT widened the offboarding card to resignations or mutual
agreements. An ordinary resignation is owed nothing (Art. 49(8)), and the ordinary
agreed cessation is **Art. 48** — "a compensação a receber pelo trabalhador" is
whatever the parties agree, "se couber" — not the Art. 55 scale.


## Added 2026-08-22 — the ATTL payment leg

Both of these came out of building the business-tax payment leg (see
`docs/BANK_PAYMENTS.md` and `docs/MONEY_CHAIN.md` §3). Remittance evidence
settled every question about *where* the money goes; these two are about what
ATTL is entitled to charge and what it is asking for.

### B18. ~~What is the actual late-payment regime for domestic taxes?~~ CLOSED 2026-08-22
Every ATTL "Aviso de Avaliação" has `PENALIDADES` and `INTERET` lines and cites
**Secção 73 do Regulamento 2000/18** for additional tax, Secção 69 for a 60-day
objection and Secção 70 for collection pending it. Lei 8/2008 itself carries no
general late-payment penalty — its only penalty provisions are the petroleum
instalment shortfalls in Secs. 82.8 and 90.5.

What is in circulation among practitioners is "**a $100 administrative fine, a
5% late penalty, and 1% monthly interest on the unpaid balance**", attributed to
"Taxes and Duties Act 2008, Sections 81 & 82". Those sections are the petroleum
Contractor instalment rules and say nothing of the kind, so the numbers may
still be right while the citation is certainly wrong.

**Answered from the primary source.** ATTL publishes the consolidated text
itself (attl.gov.tl → Domestic Tax Laws → "UNTAET Regulation 2000/18 as amended
July 2002"), and it is unambiguous:

- **Sec. 72.1** — failure to deliver a tax FORM by the due date: additional tax
  of **$100**.
- **Sec. 73.1** — failure to deliver the PAYMENT: **5%** of the tax not paid by
  the due date, "plus an additional **1%** of the tax that remains unpaid **on
  the 15th day of each month following the due date**"; plus **25%** if the
  failure was due to gross carelessness, or **100%** if it was a deliberate
  attempt to avoid payment.
- **Sec. 74** — understatement of tax: 15%, with the same 25%/100% uplifts.
- **Sec. 71.4** — the Commissioner may forgive some or all additional tax where
  the taxpayer shows good reason.
- **Sec. 69.2** — appeal within **60 days** of receiving the notice; **Sec. 70.1**
  — the tax stays due and collectable meanwhile.

So the figure circulating among practitioners ($100 + 5% + 1% per month) was
numerically right and only its citation was wrong. Two details matter and both
cut the amount down:

1. The 1% is **not** interest that accrues with time and does not compound. It
   is a discrete stamp on the 15th of each month after the due date, so a
   payment made on the 14th of the following month carries the 5% and no 1%.
2. The 25% and 100% uplifts turn on a finding about the taxpayer's state of
   mind, which only the Commissioner can make.

- **Xefe today:** `client/lib/tax/attl-late-charges.ts` estimates the $100 (only
  when the RETURN was late), the 5%, and 1% per stamp actually fallen — and
  never the carelessness or avoidance uplifts. The payment panel shows it as a
  warning to check the notice against; the figures posted to the ledger are
  still the ones ENTERED from the notice, on GL 5950 (non-deductible,
  Sec. 31(j),(l)).
- **Still worth a sentence from you:** whether ATTL applies Sec. 72.1 per
  return or per taxpayer per period, and in practice how often Sec. 71.4
  forgiveness is granted.
- **Also worth confirming:** whether the day-15 deadline has a same-day cut-off
  time. Client-facing instructions in evidence variously say 12:00, 17:00 and
  17:30 Timor-Leste time, and one firm tells clients to pay between the 1st and
  the 13th to be safe.

### B19. Is "ALL COMMERCIAL ACTIVITIES – 3 MONTHS" a separate obligation? — NARROWED
A taxpayer who receives **monthly** `Domestic Installment Tax` assessments also
received a notice titled `ALL COMMERCIAL ACTIVITIES - 3 MONTHS` (Aug 2026).
Nothing in the email record mentions it — it appears to exist only inside the
portal — so we cannot tell whether it is:

1. the Sec. 64.2 quarterly instalment, running alongside the monthly ones; or
2. a separate quarterly commercial-activities declaration; or
3. an information notice with no filing attached.

**Most likely (1), on evidence.** A Timor-Leste practitioner describes preparing
"a **declaração trimestral do imposto sobre o rendimento (Domestic Installment
Tax)** referente ao período de abril a junho" — an explicitly QUARTERLY
declaration of the Domestic Installment Tax over a three-month period, computed
from the revenue invoices for that quarter. That is the same obligation Xefe
tracks, at the cadence Sec. 64.2 prescribes, so the portal notice title reads
like the portal's own label for it rather than a second tax.

Beware the false positives here: most "declaração trimestral" material in
circulation is **Portuguese** (modelo 10, trabalhadores independentes,
Segurança Social) and has nothing to do with Timor-Leste. Only the sentence
above is TL.

- **What is still worth one sentence from you:** confirmation that the notice
  headed "ALL COMMERCIAL ACTIVITIES – 3 MONTHS" is the quarterly instalment and
  not an extra filing.
- **Xefe today:** tracks the Sec. 64 instalment only, at whichever cadence the
  tenant is registered for — which, if the reading above is right, is complete.

**A practice detail worth knowing, from the same source:** revenue invoices that
arrive after a quarter's declaration was submitted are declared in the FOLLOWING
quarter, not by amending the filed one. That is exactly why the as-filed
snapshot is frozen and the payment is posted from it rather than from a
recomputed turnover — Xefe's behaviour already matches how the work is really
done.
