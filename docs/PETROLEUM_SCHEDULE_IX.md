# Petroleum payroll — Lei 8/2008 Schedule IX

**Status: deliberately NOT implemented. Payroll refuses instead.** This document
exists so that decision stays a decision, and so whoever picks it up does not
re-derive the statute from scratch.

Written 2026-08-13, after a senior contact at a petroleum Contractor described a
feature list. The general-market items from that list shipped the same day (salary
history, retro pay, attendance premium, NISS on the payslip). Schedule IX is the one
piece that serves petroleum Contractors only.

---

## 1. Who is affected — narrower than "works in oil and gas"

| Term (Lei 8/2008 Sec. 68.1) | Definition | Wage regime |
|---|---|---|
| **Contractor** | "a person with whom the Ministry or Designated Authority … has made a **Petroleum Agreement**" | **Schedule IX** (Sec. 72.2) |
| **State-Owned Contractor** | a Contractor incorporated in TL and controlled by TL | Schedule IX |
| **Subcontractor** | "any person supplying goods or services directly or indirectly to a Contractor in respect of Petroleum Operations" | **ordinary Schedule V** |

Read that table before scoping anything. Only parties to a Petroleum Agreement are
caught — a handful of entities. **Every oilfield service, logistics, catering and
engineering company supplying them is a Subcontractor on ordinary rules, and Xefe
already serves them today, unchanged.** So the addressable population for this work
is small and enterprise-shaped; the sector-adjacent business is already unblocked.

## 2. The rates, verbatim

Read from the official government copy of the Act (Schedule IX, ¶¶1–4):

> **1.** The rates of wage income tax for the purposes of Section 72.2 are:
> **(a)** if the employee is a resident natural person and has provided the employer
> with the employee's tax identification number [or is treated by ¶4 as having done
> so]:
>
> | Monthly taxable wages | Rate |
> |---|---|
> | US$0–US$550 | 10% |
> | Above US$550 | US$55 + 30% of the amount of wages above US$550 |
>
> **(b)** if the employee is a non-resident natural person, **20%** of the taxable
> wages received by the employee;
> **(c)** in any other case, **30%** of the taxable wages received by the employee.
>
> **2.** If an employee receives taxable wages for a period of less than one month,
> the rates … in paragraph (a) are imposed on a **pro-rata** basis.
>
> **3.** Each employee who is a resident natural person is allowed a **personal tax
> credit of $10 per month** … If the amount of the credit … exceeds the amount of
> wages income tax payable … the excess is **neither refunded … nor carried forward**.
>
> **4.** The Tax Administration may **designate** those employees that will be treated
> as having provided their employers with the tax identification numbers.

### What is structurally different from Schedule V

1. **No tax-free threshold.** Schedule V gives a resident the first $500/month free.
   Schedule IX taxes from the first dollar and gives a flat $10 credit instead.
2. **The TIN drives the rate, not just the paperwork.** A resident who has not given
   a TIN falls to ¶1(c) — **30% flat**, not the 10%/30% band. Xefe stores an optional
   `documents.taxIdentificationNumber`; under Schedule IX its absence is a money fact.
3. **¶4 designation.** The Tax Administration can deem an employee to have supplied a
   TIN. That is an external fact Xefe cannot derive and would have to store.
4. **Non-residents are 20%, not 10%.**
5. **The credit is use-it-or-lose-it** — no refund, no carry-forward. So it is a
   per-month floor at zero, not a running balance.

### The size of the gap, which is why the engine refuses

| Employee | Schedule V (what Xefe computes) | Schedule IX (what is owed) | Under-withheld by |
|---|---|---|---|
| Resident w/ TIN, $550/mo | $5 | $55 − $10 = **$45** | **9x** |
| Resident w/ TIN, $1,000/mo | $50 | $55 + $135 − $10 = **$180** | 3.6x |
| Resident, **no TIN**, $1,000/mo | $50 | 30% of $1,000 − $10 = **$290** | 5.8x |
| Non-resident, $3,000/mo | $300 | 20% of $3,000 = **$600** | 2x |

(The $10 credit applies to any *resident* natural person, including one who gave no
TIN — ¶3 conditions it on residency, not on the TIN that ¶1(a) turns on.)

Sec. 25.3 makes the shortfall the **employer's** liability. Computing Schedule V for a
Contractor is therefore not a rounding error, it is handing the customer a bill.

## 3. What the refusal looks like today

Two layers, deliberately:

- **Screen.** `client/pages/payroll/RunPayrollWizard.tsx` swaps the whole wizard for a
  refusal panel when `payrollConfig.petroleumContractor` is true
  (`runPayroll.petroleumBlock*` strings, all three locales).
- **Engine.** `calculateTLPayroll` throws `UnsupportedTLPetroleumPayrollError` as its
  first act, and `validateTLPayrollInput` reports the same as an error string. Added
  2026-08-13 because the screen was the only guard, so an import, an API caller or a
  future assistant would have computed Schedule V silently.

The flag rides on `TLPayrollCalculationConfig`, **not** on `TLPayrollInput`. That is
intentional: the config is already built from tenant settings by every real caller, so
new callers inherit the refusal without knowing the regime exists. A per-employee input
field would be one more thing to forget.

Supplier withholding has refused for the same reason since earlier: see
`UnsupportedTLPetroleumTaxRegimeError` in `client/lib/tax/withholding-tl.ts`.

## 4. What implementing it would actually take

**Small — the maths.** A second rate table behind the config flag. Xefe already has
banded tax, month-to-date accumulation and part-month pro-rata, which is most of what
¶¶1–2 need. Estimate: a couple of days including tests, and the golden-month pattern
gives a ready shape for pinning it against a real filed month.

Order of work if it is ever commissioned:

1. `TL_INCOME_TAX` gains a Schedule IX table; `calculateWIT` (or a sibling) branches on
   the regime rather than the current single path.
2. The `$10` credit applies **after** tax is computed, floored at zero, never carried.
3. Resident-without-TIN becomes a *rate* decision — needs the TIN presence, and the ¶4
   designation flag, on the employee.
4. Replace the throw with the computation; keep the throw as the default for any regime
   that is still unimplemented (ToBUCA — see §5).

**Not small — and the actual blocker.** The monthly return does not go to the ordinary
wage-tax desk. It goes to ATTL's petroleum-revenues directorate (DNRPM), by emailed
forms, with payment to the TL Petroleum Fund. We do not hold that form, and
`docs/ACCOUNTING_AUTOMATIONS.md` records the standing rule: **statutory exports mirror
official templates only — never a template we invent.** So:

> **The gating artefact is a blank or redacted copy of the Schedule IX monthly wage-tax
> return a Contractor actually files.** Any Contractor's payroll team files it monthly
> and can supply one. Until then the calculation could be right and the filing still
> unusable, which is the worse failure.

**Also unresolved before shipping:**

- **INSS.** Does DL 20/2017 apply unchanged to a Contractor's employees? Nothing found
  either way. Assume yes, verify before relying on it.
- **Corporate side.** Sec. 72.1 sets Contractor CIT at **30%**, and depreciation moves
  to **Schedule X**. Out of scope for payroll, but a Contractor using Xefe's accounting
  needs that too — a separate and much larger job.
- **Which regime.** See below.

## 5. There are TWO petroleum regimes, not one

`withholding-tl.ts` already records both, and any implementation must ask which applies
before picking rates:

- **TDA Sec. 72.2 + Schedule IX** — "other petroleum". The rates in §2 above.
- **Revised ToBUCA** (Bayu-Undan / former JPDA) — different again: non-resident 18%
  flat, resident annual bands 10/15/30%.

A tenant flagged `petroleumContractor` does not tell you which. Implementing Schedule IX
alone must therefore keep refusing ToBUCA rather than silently applying Schedule IX to
it. Source detail: `docs/MINED_SIGNOFF_ANSWERS_JUL2026.md` §1.

## 6. Two questions that are NOT about the code

Recorded here because they decide whether §4 ever happens:

1. **Is there a buyer?** A Contractor is by definition a large organisation, and the one
   that prompted this runs SAP. A feature list from a senior contact is interest, not a
   procurement. Worth establishing which it is before spending the fortnight.
2. **What is actually painful for them?** SAP calculates pay perfectly well. What it
   almost certainly does not do is produce TL's statutory outputs — the INSS monthly DR
   in the portal's own Excel layout, the ATTL forms, NISS completeness. Note that the
   feature list that prompted this was mostly compliance-output items (NISS on the
   payslip, accumulated contributions, emailed receipts), not calculation items. If the
   pain is outputs rather than maths, Schedule IX may not even be the thing to sell.

## 7. Related open questions

`docs/NICO_OPEN_QUESTIONS.md`:

- **D1** — "retenção para a CAC": unidentified. Absent from all five statutes, from a
  TL accounting corpus of 49,629 unique messages, and from the open web (in TL the acronym is the
  Comissão Anti-Corrupção, which has no payroll withholding). May be Contractor-specific.
- **D2** — medical-expense deduction: **closed by reading Schedule IX.** It is three
  rates, a pro-rata rule and a flat credit — no personal deductions of any kind. There is
  no medical relief anywhere in TL wage income tax, on either schedule.
- **D3** — the record that this refusal exists and that the list may be a Schedule IX
  list rather than a gap in ordinary payroll.
