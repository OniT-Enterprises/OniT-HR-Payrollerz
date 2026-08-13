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
