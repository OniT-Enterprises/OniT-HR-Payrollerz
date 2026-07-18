# Mined regression cases for Xefe (synthetic, TL-rule-derived)

Derived from rules **verified** in `MINED_TL_ACCOUNTING_INTEL.md` (ATTL + Labour Code +
statute + de-identified calculation schedules). **All names/numbers below are synthetic** —
no identity-bearing client data. Executable synthetic coverage lives in
`tests/client/mined-tl-accounting.test.ts` and exercises payroll, non-payroll tax, and
compliance helpers. Real worked-schedule parity lives in
`tests/client/real-firm-payroll-parity.test.ts`, backed by an 86-row de-identified fixture;
it does not claim a live Xefe payroll run.

## Wage Income Tax (WIT)

| # | Input (monthly) | Expected WIT | Rule |
|---|---|---|---|
| W1 | resident, base $450 | **$0** | ≤ $500 exempt |
| W2 | resident, base $500 | **$0** | threshold boundary |
| W3 | resident, base $800 | **$30** | 10% × ($800−$500) |
| W4 | resident, base $10,000 | **$950** | 10% × $9,500 |
| W5 | **non-resident**, base $800 | **$80** | 10% from first $ (no threshold) |
| W6 | non-resident, base $450 | **$45** | no exemption for non-residents |
| W7 | resident, base $700 + annual allowance $700 + severance $2,000 | WIT computed on **all** comp ($3,400) → 10% × ($3,400−$500) = **$290** | WIT base = "all forms of compensation" incl. severance, allowances, 13th |

## INSS (social security)

| # | Input | Employee 4% | Employer 6% | Rule |
|---|---|---|---|---|
| I1 | contributable base $1,000 | **$40** | **$60** | 4% / 6% split |
| I2 | base $1,000 + overtime + per-diem/food/transport expense allowances | **$40** | **$60** | overtime and listed expense allowances are excluded |
| I3 | `inssExempt` employee, base $1,000 | **$0** | **$0** | exemption honoured |
| I4 | base $1,000 + performance award $100 + commission $50 | **$46** | **$69** | performance/productivity pay is included |
| I5 | base $1,000 + company-profit award $100 | **$40** | **$60** | employer-economic-performance award is excluded |

## 13th month / Subsídio Anual

| # | Input | Expected | Rule (Labour Code Art. 44º) |
| S1 | base $600, + food $50, + insurance $30, worked 12/12 months | **$600** | base salary **only** — excludes SS, insurance, allowances, other bonuses |
| S2 | base $600, worked 6/12 months | **$300** | pro-rata by months worked / 12 |

## Article 56 service compensation

| # | Explicit source values | Expected | Rule |
|---|---|---|---|
| A56-1 | $700 monthly salary; 4 years 364 days | **$0** | only completed five-year periods count |
| A56-2 | $700 monthly salary; exactly 5 years | **$700** | one salary month for one completed block |
| A56-3 | $700 monthly salary; 11 years 364 days | **$1,400** | two completed blocks; no fractional block |

The offboarding service freezes salary, start date, last working day, completed blocks,
salary months, amount, and WIT/INSS treatment in one final-pay snapshot. It does not use an
annual-salary fallback and does not mark payroll paid merely because the snapshot is saved.

## Overtime (Labour Law Art. 27º)

| # | Input (normal hourly $5) | Expected | Rule |
|---|---|---|---|
| O1 | 10 regular OT hours | **$75** | 1.5× |
| O2 | 8 hours on a public holiday | **$80** | 2.0× (normal + 100%) |
| O3 | 8 hours on weekly rest day | **$80** | 2.0× |

## Withholding beyond payroll (Art. 57º) — *new coverage (money module)*

| # | Input | Expected WHT | Rule |
|---|---|---|---|
| H1 | $1,000 service payment to non-resident supplier | **$100** | 10% non-resident WHT |
| H2 | same, with applicable treaty | **$50** | reduced 5% treaty rate |
| H3 | dividend paid to resident | **$0** | dividends exempt in TL |
| H4 | $1,000 construction bill paid by an Lda | **$20 withheld; $980 supplier cash** | 2% payer withholding |
| H5 | $1,000 construction bill paid by an ENIN | **$20 tax due; $0 withheld; $1,000 supplier cash** | recipient self-withholds; payer must not reduce cash |
| H6 | $333.33 construction-consulting partial settlement | **$13.33 withheld; $320 cash; $333.33 AP cleared** | gross AP = cash + withholding at cent precision |
| H7 | statutory 10% and treaty 5% payments on one official line | **export rejected** | do not conceal mixed rates behind a fixed label |
| H8 | domestic bill selects petroleum tax regime | **unsupported-regime error** | never apply domestic rates to the separate petroleum regime |

The bill workflow also refuses missing vendor residence/regime, missing non-resident PE
status, undocumented treaty rates, and incomplete payer Company Details. Payment snapshots
freeze gross, cash, tax, collection method, rate, recipient facts, and legal basis. Only
`payer_withholding` snapshots enter Section 2 of the ATTL consolidated monthly workbook.
Journal amounts are tested as Debit 2110 gross, Credit cash net, and Credit 2320 tax; payroll
WIT remains separate in 2220.

## Supplier-withholding remittance control

| # | Period position / input | Expected | Control |
|---|---|---|---|
| R1 | liability $120; no payment | **$120 outstanding / unpaid** | filing liability and cash payment are separate |
| R2 | payments $40.01 + $9.99 | **$50 remitted / $70 outstanding / partial** | cent-precise partial clearing |
| R3 | payment $120 | **paid** | paid only at exact cent equality |
| R4 | payment $120.01 | **rejected** | no over-clearing of account 2320 |
| R5 | missing reference or proof | **rejected** | filing status is not payment evidence |

The service writes the immutable remittance, period position, and balanced 2320-to-bank/cash
journal atomically. Same-ID retries are idempotent; the live outstanding balance is checked
inside the transaction.

## Filing deadlines (`taxFilingService.ts`)

| # | Event | Expected due date | Rule |
|---|---|---|---|
| D1 | June WIT | **15 July** | 15th of month *after* deduction |
| D2 | annual WIT return, TY2025 | **31 March 2026** | annual employer withholding |
| D3 | due date falls on weekend/holiday | next business day (Asia/Dili) | `adjustToNextBusinessDayTL` |

## Income-tax installments (Law 8/2008 Art. 64)

| # | Input | Expected | Rule |
|---|---|---|---|
| IT1 | prior-year turnover $1,000,000 | **quarterly** | quarterly through the inclusive boundary |
| IT2 | prior-year turnover $1,000,000.01 | **monthly** | monthly only above $1 million |
| IT3 | period turnover $80,000 | **$400** | 0.5% of period turnover |

## Domestic services tax (Law 8/2008 Arts. 5–8; Annex I)

| # | Monthly designated receipts | Expected | Rule |
|---|---|---|---|
| ST1 | hotel $300 + restaurant/bar $199.99 | **$0** | combined receipts below $500 are 0% |
| ST2 | hotel $300 + restaurant/bar $150 + telecom $50 | **$25** | exact $500 boundary: 5% of the whole total |
| ST3 | hotel $500.10 | **$25.01** | Decimal half-up cent rounding |

## Statutory-record integrity

WIT/INSS filing generation requires explicitly stored statutory amounts and classifications.
Missing `witTaxableAmount`, `inssBase`, contribution values, `wagesPaid`, `netPay`, employee,
or residency data raises `MissingStatutoryPayrollDataError`. Xefe does **not** divide tax by
a rate, inspect free-text deduction labels, assume residency, or rebuild net pay. Missing
employer legal name, NIF/TIN, or registered address raises `MissingStatutorySourceDataError`;
the filing path does not substitute a trading name or export blank identity fields. The
same strict source check validates payroll, hire, and terminated-worker end dates as real
`YYYY-MM-DD` calendar dates.

## ATTL tax-clearance tracker

| # | Input | Expected | Control |
|---|---|---|---|
| TC1 | undocumented purpose | **rejected** | only four official ATTL document types |
| TC2 | one-month commercial or visa type | **coordination warning** | ATTL officer + justification required |
| TC3 | issued result without PDF, issue date, or expiry date | **rejected** | no guessed certificate evidence |
| TC4 | expiry equal to issue date or issue before request | **rejected** | strict calendar sequence |
| TC5 | stored expiry was yesterday | **display expired** | derived display status; stored evidence is not mutated |

## Accountable staff cash advances

| # | Input | Expected | Control |
|---|---|---|---|
| CA1 | $300 issued; $125.55 receipts; $24.45 returned | **$150 outstanding** | receipt and cash-return totals stay distinct |
| CA2 | $300 issued; $233.33 receipts; $66.67 returned | **cleared exactly** | Decimal cent precision |
| CA3 | clearing $300.01 against $300 | **rejected** | no over-clearing |
| CA4 | receipt without category/proof, or return without destination/reference/proof | **rejected** | independent evidence is mandatory |
| CA5 | clearing dated before issue or posted after already cleared | **rejected** | valid event order and immutable close |

Issue accounting is Debit 1230 Staff Expense Advances and Credit bank/cash. A receipt debits
the selected expense and credits 1230; returned money debits bank/cash and credits 1230.
Direct petty-cash purchases, supplier deposits, and salary loans are deliberately excluded.

## VAT activation boundary

`tests/client/vat-config.test.ts` proves that draft, legacy-boolean, future-effective, and
incomplete/zero-rate configurations all stay inactive. Only an enacted, complete config on
or after its Timor-Leste effective date can activate; a registered/enabled tenant is then
required separately.

All cases above are executable coverage. H1–H8 exercise both the non-payroll calculator and
the vendor bill/payment/export workflow; D1 guards the “following month” anchor flagged in
the intel document. Bonus, non-cash INSS, filing-record, services-tax, VAT, supplier-tax,
remittance, tax-clearance, and staff-advance tests all require explicit inputs rather than
guessing.
