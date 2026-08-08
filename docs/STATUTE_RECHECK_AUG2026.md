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

## 3. Still to discharge from §7

Not yet read against the clean copy. Ordered by how much money rides on them:

| Articles | Why they matter | §7 status |
|---|---|---|
| **43–48** | Wage protection, deductions, the 30%/month cap chain around Art. 42 | "decoded by reversal, medium-high confidence" |
| **55(3)(g)** | Notice/termination conditions | "read from garble" |
| **60–65** | Parental protections, Art. 62 breastfeeding, Art. 64 childcare | "ordering scrambled" |
| **78** | Body missing entirely | unknown content |
| **61** | Employer pay duty during parental leave | tail cut (already settled separately via DL 18/2017) |

Arts. 49, 50, 52, 53 were already discharged on 2026-07-31 (PR #23).

**Method that worked:** read the article in the clean text, quote it in full, then
check the code path that claims to implement it. Both findings above came from a
quotation disagreeing with a comment, not from reading code.
