# Bank Payments — how salary money actually moves in Timor-Leste

_Last updated: 2026-07-20. Read before touching `client/lib/bank-transfers/*`
or the Bank Transfers page._

## The core fact

**BNU executes salary batches from an emailed instruction, not a file upload.**
That workflow is verified against multi-year real-world practice during
compliance research (internal evidence notes, kept out of the repo). Xefe also
prepares the same style of pack for BNCTL, but that output is explicitly
best-effort until a branch-approved sample is obtained.
The monthly ritual a business performs:

1. Email their branch a short **Portuguese** cover message
   ("Transferências de pagamento de salários de <Month>").
2. Attach an Excel transfer list — the accepted layout is exactly four
   columns: `Nº Ord | Nome | Conta <bank> | Salário líquido`, with a grand
   total at the bottom.
3. Attach a numbered, signed payment order ("Ordem de Pagamento / OT n.º x
   / year") authorizing the debit.
4. The bank executes and replies with a stamped
   "Confirmação Pagamento Transferências Bancárias" PDF.

## What Xefe generates

`client/lib/bank-transfers/payment-pack.ts` (lazy-loads ExcelJS):

- A two-sheet `.xlsx`: **Transferências** (the 4-column list, account numbers
  forced to text format) and **Ordem de Pagamento** (print-and-sign sheet
  with a blank `OT n.º ____ / year` — businesses keep their own OT sequence).
- The Portuguese cover-email text, surfaced with a copy button in a dialog on
  `BankTransfers.tsx` after the download.

Invariants:

- **Bank-facing text is Portuguese regardless of app locale** — that is the
  language TL banks correspond in. Only the surrounding UI is translated.
- BNU gets the verified pack. BNCTL gets a clearly labelled best-effort pack;
  **ANZ and Mandiri keep clearly labelled best-effort file formats** — ANZ runs
  a different channel (Transactive-style, automated "Payment advice"
  confirmations) and its real file spec is unverified. Do not extend the
  emailed-pack pattern to them without evidence.
- The old BNU/BNCTL CSV generators still exist but are no longer downloaded
  for those banks; `generateBankFile` remains the validation/summary step for
  every bank.

## One-off payment orders (added 2026-07-18)

`generateSinglePaymentOrderXlsx` in `payment-pack.ts` produces the signed
one-off "Ordem de Pagamento" sheet, surfaced via `paymentOrders.*` i18n keys:

- **INSS monthly contribution** (INSS Monthly report page). The INSS
  collection account at BNU is `INSS_PAYMENT_ACCOUNT` in `tlBanking.ts` —
  verified against 200+ real transfer confirmations (beneficiary
  "SEGURANCA SOCIAL MSS"). Credit-description convention:
  `Ref <employer NISS> Seg Soc <TIN> <MES> <ANO>`. Company Settings stores the
  employer NISS and the export refuses to invent it when missing.
  The INSS portal's own "Guia de Pagamento" carries a reference of the form
  `<NISS><MM><YYYY><seq>` (synthetic example: 900001234 + 05 + 2024 + 01).
- **ATTL monthly WIT** (Monthly WIT page) — pays the published
  `ATTL_TAX_ACCOUNTS.accounts.wageIncomeTax` IBAN; the sheet reminds the user
  to mark the advice "electronic payment" per ATTL.
- **Supplier bills** (Bills page action) — "Pagamento <vendor> Fatura n.º…";
  vendor bank fields fill in when stored, blanks otherwise.

## Verified non-findings (don't build these without new evidence)

- **Tax-clearance certificates**: certidões are requested via portal or in
  person — there is no emailed request-letter format to generate.
- **BNCTL**: no BNCTL-specific salary list has been sighted; the BNU layout
  is assumed for BNCTL on shared local practice — verify against a real
  example when a BNCTL customer shows up.
- **ANZ**: ANZ runs a Transactive-style online channel (automated "Payment
  advice" confirmations); its real file spec remains unverified. The
  generated ANZ CSV is best-effort.
