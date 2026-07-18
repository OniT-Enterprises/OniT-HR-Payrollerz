# TL accounting evidence matrix

Updated 2026-07-17. This document separates four things that must not be
conflated:

1. a rule in primary law;
2. a practitioner's statement in an email;
3. a calculation the firm actually prepared; and
4. behavior Xefe can execute and test.

An email can corroborate practice, but it is not legal authority. A statutory
rule may be fully supported by primary law even when the corpus has no worked
example. Any row below that lacks a real calculation is labelled that way.

## Confidentiality and reproducibility

The local corpus contains 49,124 unique RFC messages across 27 completed
mailboxes. Raw mail, names, employer details, message identifiers, attachment
names, workbook hashes, and exact source dates remain outside this repository.

The payroll audit found three distinct completed schedules, with 30, 28, and 28
rows. Each schedule was matched to its exact source workbook. The committed
fixture retains only calculation inputs, residency/INSS flags, and anonymous
money outputs under stable labels such as `firm-period-2-12`.

Local reproduction, from the private toolkit:

```bash
python audit_payroll_parity.py schedules
python audit_payroll_parity.py raw-summary --schedule 1
python audit_payroll_parity.py raw-summary --schedule 2
python audit_payroll_parity.py raw-summary --schedule 3
python audit_payroll_parity.py raw-export-all \
  | pnpm exec tsx run_xefe_payroll_parity.ts --source-convention
```

The committed regression is
[`real-firm-payroll-parity.test.ts`](../tests/client/real-firm-payroll-parity.test.ts);
its data is
[`deidentified-firm-payroll.ts`](../tests/client/fixtures/deidentified-firm-payroll.ts).

## Real payroll-workpaper parity

These are completed firm calculations, not live Xefe payroll runs. Xefe did not
process the original payroll, transmit payments, or file returns.

| Comparison | Exact complete rows | Component result |
|---|---:|---|
| Existing weekly-average default | 8 / 85 | Hourly rate 10/85; absence 51/85; overtime 15/85; gross 12/85; WIT 73/85; employee INSS 72/85; net 11/85; employer INSS 58/85 |
| Explicit 190-hour workpaper method | **79 / 85** | Hourly rate, absence, overtime, employee INSS, and employer INSS **85/85**; gross 84/85; WIT 84/85; net 81/85 |
| Not representable without invention | 1 / 86 | One workbook uses one absence day while Xefe accepts absence hours; the test leaves it unsupported |

The six non-exact comparable rows differ by exactly one cent. All six emailed
rows were independently classified as `source-rounding-within-0.02` before the
Xefe comparison: one gross difference, one WIT difference, and four net
differences. The test locks each exact delta; it does not use a blanket
tolerance.

### Why the method is configurable

All three matched workbooks calculate the normal hourly rate as
`ROUNDUP(monthly salary / 190, 2)` and round the combined overtime amount once.
A practitioner email explains 190 as a fixed approximation of
`44 × 52 / 12`. The [Labour Law 4/2012](https://www.mj.gov.tl/jornal/?q=node%2F789)
sets the maximum normal work period at 8 hours/day and 44 hours/week (Article
25) and the overtime premiums (Article 27), but it does not prescribe a
monthly-hours divisor or a rounding method.

The wider attachment scan also found formula-bearing workbooks using 190,
190.67, 176, and 200 hours. Those counts include workbook versions, not unique
employers. Xefe therefore keeps the existing weekly-average default and offers
the 190-hour behavior only as an explicit payroll setting.

## Claim-by-claim payroll evidence

| Claim | Email or workbook evidence | Primary authority | Xefe evidence | Status |
|---|---|---|---|---|
| Ordinary overtime is 1.5×; rest-day/mandatory-holiday work is 2× | The three matched workbooks contain ordinary and holiday hours and calculated outputs; practitioner mail also describes 150% and normal +100% | Labour Law 4/2012, Article 27 | `calculateOvertimePay`; real fixture plus synthetic O1–O3 | Confirmed |
| A 190-hour, upward-rounded rate matches these schedules | All 85 representable source rows reproduce their source hourly rate; the workbook formulas are explicit | The Labour Law is silent on the divisor and rounding | Explicit `fixed_190_round_up` setting | Confirmed as firm workpaper convention, **not law** |
| Unpaid hour absences use the same workpaper hourly rate | 85/85 representable rows match the emailed absence amount | Contract/workplace basis is required; no universal divisor found in the Labour Law | Real fixture; one day-based row deliberately unsupported | Confirmed for these schedules only |
| Resident WIT is 0% through $500/month, then 10% | Actual schedules exercise below- and above-threshold rows | Tax Law 8/2008, Articles 20–22 and Annex V | Payroll tests and real fixture | Confirmed |
| Non-resident WIT is 10% from the first dollar | The schedules include non-resident rows with 10% WIT; other operational computations corroborate it | Tax Law 8/2008, Articles 20–22 and Annex V | Payroll and supplier-withholding tests | Confirmed |
| INSS is 4% employee and 6% employer | Both shares are present in the schedules and match 85/85; a separate email gives a combined $697.67 worked total | DL 20/2017, Article 10, as amended | Real fixture and aggregate parity test | Confirmed |
| Overtime is outside the INSS base, while annual subsidy is included | The matched workbooks exclude overtime and include annual subsidy in the contributable calculation | DL 20/2017, Articles 8–9, as amended by DL 30/2021 | Real fixture and synthetic INSS tests | Confirmed |
| A non-resident is not automatically INSS-exempt | Some source rows are explicitly treated as unenrolled, but the corpus does not establish a universal residence exemption | Social-security coverage depends on statutory scope and any applicable foreign-system evidence | Xefe requires a separate `inssExempt` input | Guardrail confirmed; no residence fallback |
| Annual subsidy is prorated and paid as a distinct payroll component | Source schedules contain full and prorated subsidy amounts | Labour Law 4/2012, Article 44 | Real fixture and synthetic subsidy tests | Confirmed |
| Day absence can be inferred from a dollar deduction | One source row has a day input, but no trustworthy conversion to Xefe hours | No general conversion identified | Explicitly unsupported | **Rejected**; no fallback |

Primary sources:
[Labour Law 4/2012](https://www.mj.gov.tl/jornal/?q=node%2F789) ·
[Tax Law 8/2008](https://attl.gov.tl/wp-content/uploads/2020/01/Lei_2008_8_Lei_Tributaria_Por..pdf) ·
[INSS DL 20/2017](https://www.mj.gov.tl/jornal/public/docs/2017/serie_1/SERIE_I_NO_20.pdf) ·
[INSS amendment DL 30/2021](https://www.mj.gov.tl/jornal/public/docs/2021/serie_1/SERIE_I_NO_49.pdf)

## Other mined product work

| Product area | Corpus backing | Authority or independent check | Evidence level |
|---|---|---|---|
| Construction-consulting and non-resident supplier withholding | Four de-identified worked payment computations are executable in `mined-firm-parity.test.ts` | Tax-law classification is checked separately in the mined intelligence document | Real calculation parity |
| Article 56 service compensation | Termination and end-of-contract workflows occur in mail; the corpus was not used to invent the formula | Labour Law 4/2012, Article 56 | Primary-law implementation with synthetic boundary tests; **no real payout parity claimed** |
| Taxable non-cash benefit threshold | No sufficiently complete worked email calculation was found | Tax Law 8/2008, Articles 1 and 21 | Primary-law implementation with synthetic tests |
| Payslip line-item detail | Client correspondence asks for normal, overtime, and holiday hours and amounts separately | Product output checked in tests | Direct workflow evidence |
| SERVE/NIF/TIN unification | Firm correspondence and legal footers use the single enterprise number as NIF/TIN | Registration source checked separately | Direct document evidence |
| Petroleum regime boundary | Corpus contains separate petroleum filings and different rates | Separate statutory regime | Explicitly unsupported in domestic calculators |
| Tax-clearance tracking | 394 corpus matches, including 110 matching subjects, establish a recurring workflow | ATTL document requirements checked independently | Workflow evidence; no claim that Xefe files requests |
| Staff cash advances | 1,118 term matches, but the corpus does not support merging staff advances, petty cash, supplier deposits, and salary loans | Double-entry and evidence controls | Conservative explicit-input workflow; no inferred clearing |
| VAT activation | Mail contains VAT discussion, not proof of enactment | Activation requires enacted official configuration | Disabled unless explicit enacted configuration exists |

## Release rule

A future change passes this evidence gate only if it does one of the following:

- reproduces a de-identified completed computation;
- implements a cited primary-law rule with boundary tests; or
- adds a conservative product control without inventing a tax, payroll, filing,
  or payment fact.

Practitioner prose alone is never enough to change a statutory default.

