# Re-checking the statute against a clean copy (2026-08-08)

## Why this exists

`docs/TL_LAW_GAP_MATRIX_JUL2026.md` was a genuine article-by-article sweep, but it
read `lei_trabalho_ocr.txt`, and its own §7 lists what that file could not deliver:

> Arts. 43–48 scanned upside-down (decoded by reversal) · **Art. 56 truncated
> mid-sentence — the per-5-years divisor is NOT verifiable** · Art. 61 tail cut ·
> Art. 78 body missing · Arts. 60–65 ordering scrambled · Art. 55(3)(g) read from
> garble · **Art. 32 n.º 1 unrecoverable (leave-year basis unverified — code
> assumes calendar year)**
>
> Before implementing … or anything quoting the flagged articles: **pull a clean
> Jornal da República copy.**

We now have one: `~/Sites/m365-mail-export/laws/lei_4_2012_clean.txt` (mj.gov.tl).
It has already corrected two wrong citations the damaged copy propagated — sick
leave is **Art. 33(4)**, not Art. 42 or Art. 34; paternity is **Art. 60**, not
Art. 59.

This file records what the clean copy settles. It is not a new sweep; it is the
discharge list §7 asked for.

---

## 1. Art. 56 — severance. Now readable in full.

> **Artigo 56.º — Compensação por tempo de serviço**
> Independentemente do motivo, em caso de cessação do contrato de trabalho o
> trabalhador tem direito a uma compensação por tempo de serviço no valor
> correspondente a 1 mês de salário por cada período de 5 anos de trabalho ao
> serviço do empregador.

That is the **entire article** — one sentence, no sub-numbers, no cap.

Two things follow, and neither was visible before:

**(a) There is no proration language.** `NICO_OPEN_QUESTIONS` A2 asks whether 7
years earns 1 month or 1.4. The text says "por cada período de 5 anos" and stops.
Portuguese statutes that intend proration normally say so; the silence favours
**completed blocks**, which is what Xefe already does. A2 is now a confirmation
question, not an open design question.

**(b) "Independentemente do motivo" — regardless of the reason.** A1 is recorded
as closed: *justa causa* voids severance, from firm advisories. The plain text
points the other way, and the sentence is unqualified. Either a different article
carves out dismissal for cause, or practice diverges from the text. **This needs
re-asking** — it is the single largest number on a final payslip.

## 2. Art. 32(1) — the leave year is the WORKER'S year, not the calendar's.

> 1. O trabalhador tem direito a férias remuneradas **por cada ano de trabalho
>    prestado**.
> 2. O período de férias não pode ser inferior a 12 dias úteis.
> 3. Nos casos de cessação do contrato de trabalho antes de completado o ciclo de
>    1 ano de trabalho, o trabalhador tem direito a férias proporcionais à razão
>    de **1 dia por cada mês trabalhado**.
> 5. Se o empregador, culposamente, impedir o gozo das férias, **dentro dos 12
>    meses subsequentes** à data em que o trabalhador tenha adquirido o direito,
>    … compensação correspondente ao **dobro**.

§7 flagged (1) as unrecoverable and noted "code assumes calendar year". The clean
text says **"por cada ano de trabalho prestado"** — per year of work rendered,
i.e. the employment anniversary.

`monthsInEntitlementYear` (`client/lib/payroll/calculations-tl.ts`) opens with
`const year = asOfDate.getFullYear()` and counts January→December. **Xefe is
calendar-based; the statute is anniversary-based.**

Over a full year the two converge on 12 days. They diverge for anyone hired
mid-year, and the divergence reaches money at termination — see the new question
A8 in `NICO_OPEN_QUESTIONS`.

**Verified as matching, no action:** (3) is exactly Xefe's 1 day per month
accrual, and (5) is `employerPreventedLeave`, correctly never inferred. (5) also
supplies the only 12-month clock in the article — attached to employer fault, not
to lapse, so it still does **not** authorise expiring carried-over days.

---

## 3. Arts. 39–45 read against the clean copy (2026-08-08)

§7 had 43–48 as "scanned upside-down, decoded by reversal, medium-high
confidence". Read properly, four confirm Xefe and two sharpen open questions.

### Art. 42 — the 30% cap. Xefe's reading is right.

> 2. …o empregador está autorizado a efetuar descontos ou retenções para o
>    Sistema de Segurança Social, bem como noutros casos determinados por lei ou
>    por decisão judicial.
> 3. **Os descontos efetuados não podem exceder, por mês, 30 por cento** do valor
>    total da remuneração recebida pelo trabalhador.

`42(3)` caps "os descontos efetuados" — the deductions `42(2)` has just defined,
which include social security and judicial decisions. There is **no carve-out for
court orders**, so the mined answer "court orders sit outside the cap" is not what
the text says.

`calculations-tl.ts` already handles this correctly, and better than the summary
suggested: tax, INSS and court orders are `protectedDeductions` — they **consume**
the cap (`availableCap = totalCap − protectedTotal`) and only discretionary lines
are reduced. A tribunal amount that breaches the cap on its own is **warned about,
not silently reduced**. That is the right call: the cap binds the employer's
discretion, and a court order is not the employer's discretion.

**No action.** The only nit is wording — the warning calls Art. 42(3) a
"guideline" where the statute says "não podem exceder".

### Art. 44 — subsídio anual. Confirms Xefe, and sharpens A8.

> 1. …subsídio anual de valor não inferior a 1 salário mensal, pago **até ao dia
>    20 de Dezembro** de cada ano civil.
> 2. O cálculo é proporcional aos meses de trabalho prestado em **cada ano civil**.

Dec-20 deadline ✅, proportional-by-months ✅, and the basis is **explicitly
"ano civil"**.

That is the sharp edge of A8: the same statute says **"ano civil"** for the
subsídio and **"ano de trabalho prestado"** for leave (Art. 32(1)). The drafter
distinguished them. Xefe uses one month count for both — and
`tests/client/untaken-leave-payout.test.ts` *pins* that conflation:

> it('uses the SAME month count as the Art. 44 subsidio') … "the observed
> worksheet paid 2/12 of a month's subsidio and 2 days of leave off one and the
> same month count."

So real practice conflates them too. Text and practice disagree, which is why A8
is a question rather than a bug report.

### Confirmed, no action

| Article | Says | Xefe |
|---|---|---|
| **40(5)** | Pay on the due date, or the preceding working day if it falls on a Saturday, Sunday or holiday | ✅ implemented (`getInitialPayrollDates`) |
| **43** | No set-off of employer credits against wages; wage credits rank ahead of the State in insolvency | ✅ nothing to build; Xefe never sets off |
| **45** | Dismissal without just cause prohibited; union activity is never just cause | ✅ NOT-SOFTWARE (employer conduct) |

### Two articles that answer OPEN questions

- **Art. 41** — "O trabalhador a tempo parcial é remunerado, **proporcionalmente**,
  pelas horas prestadas", calculated on the hourly rate of a **full-time worker in
  the same post**. That is direct support for pro-rata in **B8** (does the $115
  minimum wage prorate for a genuine part-timer?), which Xefe already offers as
  its `pro_rata` treatment.
- **Art. 39(4)** — expressly excludes from "remuneração": allowances (transport,
  food, lodging, transfer), profit shares, **overtime payments**, and other
  extraordinary benefits. Relevant to **A5** (are the 2× premiums inside the INSS
  base?) — though the INSS base is DL 20/2017's to define, so this is evidence,
  not an answer.

---

## 4. §7 is now fully discharged (2026-08-08)

Every article the July sweep flagged as unreadable has been read against the
clean copy. **Nothing it guessed was wrong except where the OCR lost the article
entirely** — and the two real findings are in §1–§3 above.

| §7 item | Verdict |
|---|---|
| **Arts. 43–48** "upside-down, decoded by reversal" | Read. 42 cap is right (§3), 43 wage protection and 45 dismissal grounds are NOT-SOFTWARE, 44 confirms the subsídio, **46–47 map cleanly onto Xefe's departure reasons** |
| **Art. 55(3)(g)** "read from garble" | **Confirmed** — "6 meses … superior a 5 anos". `art55IndemnityMonths` matches all seven rungs exactly |
| **Art. 56** "truncated, divisor NOT verifiable" | Read in full (§1). Answers A2; re-opens A1 |
| **Art. 32 n.º 1** "unrecoverable" | Read (§2). **Mismatch** → A8 |
| **Art. 61** "tail cut" | Already settled separately via DL 18/2017 |
| **Arts. 60–65** "ordering scrambled" | Read in full on 2026-08-07: 60 paternity (corrected from 59), 62 breastfeeding (handled, note-only by design), **64 childcare — missing, now A7** |
| **Art. 78** "body missing" | Read: *Princípios gerais* of **freedom of association / trade-union freedom**. NOT-SOFTWARE. The gap was benign |

### Arts. 46–47 vs Xefe's departure reasons — full coverage

Art. 46 lists five cessation forms and Art. 47 three caducidade grounds. Every one
has a Xefe reason:

| Statute | Xefe |
|---|---|
| 46(b) agreement / Art. 48 | `mutual_agreement` |
| 46(c) worker-initiated | `resignation` |
| 46(d) employer, just cause | `termination` |
| 46(e) market/technological/structural | `redundancy` |
| 47(1)(a) fixed-term expiry | `contract_end` |
| 47(1)(b) death | `death` |
| 47(1)(c) retirement, old age or invalidity | `retirement` |

Worth noting because Art. 56 pays severance **"independentemente do motivo"** — so
retirement and contract expiry earn it too, not just dismissal.

### One new gap: Art. 76(4)

The study-leave article has more in it than Xefe implements. 76(3) (paid exam
absence) is built; **76(4) is not**:

> Traballadór-estudante idade menór iha direitu hodi hatuur ho loloos períudu
> férias traballu ho períudu férias eskola nian.

A **minor** worker-student may align their annual leave with the school holidays.
Xefe has no concept of a worker-student, let alone a minor one, so nothing
surfaces this when leave is scheduled. Small, and it needs the `dateOfBirth` and
student status Xefe already stores — but it is a right, not a courtesy.

### Art. 77 — foreign workers

Same rights and duties as nationals; the contract **must be written and
authorised by the competent authority**. Xefe tracks `workingVisaResidency` for
non-Timorese and holds a work-contract document, so the pieces exist. Whether the
*authorisation* is evidenced anywhere is a separate question.

---

## 5. What this exercise says about method

Two wrong citations and two mismatched assumptions came out of one clean PDF and
about an hour of reading. All four were invisible to typecheck, lint and 1,250
unit tests, because they are disagreements between a comment and a statute — not
between code and its own expectations.

The productive move each time was the same: **quote the article in full, then
read the code that claims to implement it.** Reading the code first found
nothing; the code was internally consistent every time.


---

## 6. Tax Act §§36.1–36.11 — discharged from the official copy (2026-08-08)

The last "could not verify" on the tax side. Both local sources were truncated —
`tda2008.txt` jumps from Sec. 35 straight to 36.12, and
`Lei_Tributaria_2008_Salarios.pdf` is only pp. 2414–15 — so the July §7 caveat
had stood since then.

They are published. **Source:** the Government's own copy,
`timor-leste.gov.tl/wp-content/uploads/2010/03/Law_2008_8_Taxes_and_Duties_.pdf`,
saved as `~/Sites/m365-mail-export/laws/tda2008_official_gov.pdf` (+ `.txt`).
Complete, all ten Schedules.

### What they say

| | |
|---|---|
| **36.3–36.4** | Business buildings depreciate **individually, straight-line**, at the Schedule VII rate. Cost **excludes the land** |
| **36.5** | Other depreciable assets: individually straight-line **or** pooled on declining balance |
| **36.6** | **One method for ALL** of a taxpayer's depreciable assets |
| **36.7** | Changing method needs the Tax Administration's **written permission** |
| **36.8** | Pool classification and rates are in Schedule VII |
| **36.9–36.10** | Deduction = rate × written-down value at year END; WDV = prior WDV **+ additions − disposals** (including compensation for involuntary loss) |
| **36.11** | A **negative** WDV is **included in income**, and the pool resets to zero |

And Schedule VII, verbatim:

> The depreciation rate for the purposes of Section 36 and the amortisation rate
> for the purposes of Section 37 **is 100%**. If pooling applies under Section 36,
> **all depreciable assets shall be included in a single pool**.

So `36.8`'s "classification of assets into pools" is trivial — one pool — and at a
100% rate `36.9`/`36.10` collapse to **full expensing of additions less
disposals**. The mechanics the sweep could not read are real but nearly vacuous
under this Schedule.

### Xefe against it

- **Land does not depreciate** — `depreciation.ts` has
  `{ key: 'land', … defaultLifeMonths: 0 }`, commented `0 = does not depreciate`.
  ✅ Matches 36.4.
- **Form C offers both treatments** — `FormCTaxDepreciationMethod =
  'useful_life' | 'full_expensing'`, the latter documented as "Schedule VII,
  observed filed practice". ✅ Right to offer both while the open question is what
  ATTL *accepts*; the statute itself is unambiguous.
- The fixed-asset register's straight-line schedules are **book** depreciation, a
  different thing from the Sec. 36 tax deduction. No conflict.

**Newly open, small:** under full expensing WDV is always zero, so `36.11` makes
disposal proceeds taxable income in the year. Whether Form C's `full_expensing`
path nets disposals is unverified.

### Schedule VII is headed "Other Than Contractors"

There is a separate **Schedule X — Depreciation and Amortisation for
Contractors**, with its own Section A for business buildings. So a petroleum
Contractor differs from the domestic regime on **depreciation as well as wage
tax** (Schedule IX — `TIME_LEAVE_BACKLOG.md` §3b.1). That widens the case for
payroll refusing a petroleum run rather than guessing: it is a parallel regime,
not a rate tweak.


---

## 7. DL 18/2017 — it was local all along (2026-08-08)

Reported as "not present in the mining directory". It is present, at
`~/Sites/m365-mail-export/mining/signoff-jul20/serie_I_20_2017a.txt` lines
5864–6305 — exactly where the July gap matrix's own header said it was.

**Why it was missed twice:** the text reads `DECRETO-LEI N.º 18 /2017`, with a
space before the slash, so every `grep "18/2017"` returned nothing. A negative
result from a search is not evidence of absence — it is evidence about the search
string. Worth remembering before trusting the next "could not verify", including
one produced by an agent.

### What it says

| | |
|---|---|
| **Art. 15(1)** | Garantia: **six civil months, consecutive or interpolated**, with remuneration records in the last 12 — confirms Xefe's 6-in-12 |
| **Art. 15(3)** | After six consecutive months with no record, the garantia clock **restarts** from the next record |
| **Art. 18(1)** | Reference wage = **R/180**, R = remuneration in the six civil months preceding the second month before the event |
| **Art. 18(3)** | The **subsídio anual is excluded** from R |
| **Art. 19(1)** | Subsidies run from the **first day of the month following the claim** — a late claim loses months |
| **Art. 19(2)** | If requirements are unmet, benefits run only from when the deficiencies are cured |

Xefe computes none of this (INSS pays the worker directly), so it is reference
rather than implementation. The two operationally useful facts are Art. 19(1) —
which is why the employer declaration PDF matters, and why prompting the worker
to claim promptly is worth real money — and Art. 18(3), if Xefe ever estimates a
subsidy.

**B10 updated:** neither DL 18/2017 nor Lei 4/2012 Art. 61 creates an employer
fallback for a worker who misses the garantia. Art. 61's duty was conditioned on
the SYSTEM being established, not on the individual qualifying.
