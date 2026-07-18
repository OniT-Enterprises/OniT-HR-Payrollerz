# Bank Payments — how salary money actually moves in Timor-Leste

_Last updated: 2026-07-18. Read before touching `client/lib/bank-transfers/*`
or the Bank Transfers page._

## The core fact

**BNU and BNCTL execute salary batches from an emailed instruction, not a file
upload.** Verified against multi-year real correspondence (de-identified
evidence in the gitignored `docs/MINED_TL_ACCOUNTING_INTEL.md`, Appendix C).
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
- BNU/BNCTL get the pack; **ANZ and Mandiri keep the CSV formats** — ANZ runs
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
  corpus-verified against 200+ real transfer confirmations (beneficiary
  "SEGURANCA SOCIAL MSS"). Credit-description convention:
  `Ref <employer NISS> Seg Soc <TIN> <MES> <ANO>`. The employer NISS is not
  yet a settings field, so the generated reference leaves a blank —
  **follow-up: add an employer NISS field to company settings**.
  The INSS portal's own "Guia de Pagamento" carries a reference of the form
  `<NISS><MM><YYYY><seq>` (e.g. 900000447 + 05 + 2024 + 01).
- **ATTL monthly WIT** (Monthly WIT page) — pays the published
  `ATTL_TAX_ACCOUNTS.accounts.wageIncomeTax` IBAN; the sheet reminds the user
  to mark the advice "electronic payment" per ATTL.
- **Supplier bills** (Bills page action) — "Pagamento <vendor> Fatura n.º…";
  vendor bank fields fill in when stored, blanks otherwise.

## Verified non-findings (don't build these without new evidence)

- **Tax-clearance certificates**: zero outbound email requests to government
  in the corpus — certidões are requested via portal/in person and only
  circulate firm↔client by email. No letter format exists to generate.
- **BNCTL**: no BNCTL-specific salary list appeared in the corpus (the mined
  firm's clients bank at BNU); the BNU layout is assumed for BNCTL on shared
  local practice — verify against a real example when a BNCTL customer shows
  up.
- **ANZ**: correspondence is exclusively automated "Payment advice" PDFs from
  a Transactive-style channel; no upload file ever crossed email, so ANZ's
  real file spec remains unverified. The generated ANZ CSV is best-effort.
