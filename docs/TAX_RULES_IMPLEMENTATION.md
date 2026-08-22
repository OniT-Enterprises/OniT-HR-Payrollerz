# Tax rules implemented in Xefe

Last primary-law review: **2026-08-13**. This is the implementation contract,
not tax advice. The annual TADR-IT 1 output remains a preparation workpaper for
accountant review; Xefe does not submit returns.

Primary sources:

- [Timor-Leste Taxes and Duties Act, Law 8/2008](https://timor-leste.gov.tl/wp-content/uploads/2010/03/Law_2008_8_Taxes_and_Duties_.pdf)
- [ATTL — Wage Income Tax](https://attl.gov.tl/wage-income-tax/)
- [ATTL — Services Tax](https://attl.gov.tl/services-tax/)
- [ATTL — Income Tax Instalment](https://attl.gov.tl/income-tax-instalment/)

## Wage income tax

- Schedule V: resident wages are taxed at 10% above **$500 per month**;
  non-resident wages are taxed at 10% from the first dollar.
- The month is the **payment calendar month** (`payDate`), because withholding
  applies to wages paid. A January payment for December work belongs to January.
- Tax residence must be recorded explicitly. A natural person is resident when
  present for 183 days in a 12-month period beginning or ending in the year,
  unless their permanent abode is outside Timor-Leste; Timor-Leste government
  employees posted abroad also qualify. Nationality, work-permit status and
  “foreign worker” labels are not substitutes.
- Shareholder/director remuneration run through payroll remains remuneration.
  Ownership alone never exempts WIT, INSS or minimum-wage review. Dividends are
  recorded outside payroll.
- A benefit in kind is excluded only while the employee's combined benefits in
  the **calendar month** do not exceed $20. Once crossed, the whole monthly
  amount is wages, not merely the excess.
- Schedule V rates are constants. Tenant settings retain a compatible document
  shape but cannot override them in the engine or Firestore rules.
- Petroleum Contractors are outside this engine: §72.2/Schedule IX applies and
  Xefe refuses the calculation rather than applying domestic Schedule V.

## Services tax

- Hotel, restaurant/bar and telecommunications services are designated. The
  rate is 0% below $500 of combined designated receipts in a month and 5% of
  the **whole amount** at or above $500.
- The base is consideration received (cash basis). A sector label does not prove
  every receipt is designated: automatic mapping is enabled only after an
  explicit “all receipts designated” confirmation. Mixed businesses enter the
  designated base for review.
- Services-tax filing evidence is a separate `services_tax` record. A WIT
  filing for the same month cannot mark it filed.

## Income-tax installments

- Article 64: 0.5% of turnover after applicable exclusions, paid quarterly
  where prior-year turnover is at most $1 million and monthly above $1 million.
- Frequency is recomputed for each tax year from that year's immediately prior
  year, including across a December/January reminder window.
- Installments use their own `installment_tax` filing record and explicit e-Tax
  confirmation; WIT status is never borrowed.
- **The statutory cadence can be overridden to monthly** (Company Settings →
  instalment cadence, `companyDetails.incomeTaxInstallmentFrequency`). ATTL
  issues monthly "Domestic Installment Tax" assessments to taxpayers well under
  the $1m line, and remittance evidence shows both cadences among small
  businesses. Filing monthly is never a shortfall — Sec. 64.4 credits every
  instalment paid in the year against the same annual liability — so the
  override only tightens. There is deliberately **no quarterly override**:
  above $1m, Sec. 64.1 requires monthly.
- **A late revenue invoice belongs to the NEXT period, not to an amendment.**
  Practitioner correspondence shows invoices that arrive after a quarter's
  declaration was submitted being declared in the following quarter. This is why
  the payment posts from the filing's own frozen `dataSnapshot.taxDue` and never
  from a recomputed turnover: the declaration is a record of what was known when
  it was filed.
- Paying an instalment debits **1330 Prepaid Income Tax**, not an expense:
  Sec. 64.4 credits it against the annual liability and Sec. 31(g) makes
  Timor-Leste income tax non-deductible. The annual return clears the balance.
- Instalments and the annual income-tax settlement are paid into the **same**
  ATTL collection account — see `docs/BANK_PAYMENTS.md`.

## Late payment, penalties and interest

- The regime is **UNTAET Reg. 2000/18 as amended July 2002** (published by ATTL),
  not Lei 8/2008 — whose only penalty provisions are the petroleum instalment
  shortfalls in Secs. 82.8/90.5.
  - **Sec. 72.1** — late tax FORM: $100.
  - **Sec. 73.1** — late PAYMENT: 5% of the tax unpaid at the due date, plus 1%
    of the tax still unpaid **on the 15th of each month following the due
    date**. Not daily, not compounding: paying on the 14th of the next month
    carries the 5% and no 1%.
  - Sec. 73.1(a)/(b) add 25% for gross carelessness and 100% for deliberate
    avoidance. Both need a finding by the Commissioner about the taxpayer's
    state of mind, so `client/lib/tax/attl-late-charges.ts` **never** includes
    them. Sec. 71.4 also lets the Commissioner forgive additional tax.
  - Sec. 69.2 gives 60 days to appeal an assessment; Sec. 70.1 keeps the tax due
    meanwhile.
- Xefe **estimates** these to warn with, and still **posts only what the operator
  entered from the notice** — to **5950**, non-deductible under Lei 8/2008
  Sec. 31(j),(l), which the Form C workpaper excludes by account name.
- INSS is the exception: DL 20/2017 Art. 39 gives an explicit +1% per month or
  fraction, and Xefe computes it.

## Annual income tax depreciation

- Sections 36–37 and Schedule VII set the ordinary depreciation/amortisation
  rate at 100%. Section 36.6 requires one method across depreciable assets and
  §36.7 requires written Tax Administration permission to change it.
- The TADR-IT 1 workpaper therefore replaces book depreciation with the
  Schedule VII 100% tax schedule. The UI has no annual useful-life/full-expense
  switch. Legacy useful-life selections are normalized to the statutory rate.
- Disposal proceeds for previously expensed assets are surfaced for verification
  against gross income. They are not blindly added twice when the disposal
  journal already posted the gain.

## Evidence controls

- Return submission and payment remain separate statuses for WIT and INSS.
- Filing type, tenant, period and creation identity are immutable.
- Once filed, the filed state, `dataSnapshot` and declared WIT/INSS/wage totals
  cannot be changed, and non-superadmins cannot delete the filing. Receipt and
  payment evidence may still be appended.
