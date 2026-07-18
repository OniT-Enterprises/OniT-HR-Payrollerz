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

## Known gaps / next candidates (same evidence base)

- **INSS monthly payment instruction** — "Pagamento à Segurança Social" is the
  same letter-to-bank pattern; Xefe produces the INSS DR spreadsheet but not
  the payment order.
- **ATTL tax payment order** — `tlBanking.ts` already has the published ATTL
  BNU accounts; the monthly WIT payment could reuse the payment-pack letter.
- **Supplier/bill payments** — one-off "Pagamento <vendor> Fatura n.º…"
  emails follow the same shape; the Money module could generate them.
- **BNCTL layout is assumed identical to BNU** (same local practice) but not
  yet verified against a BNCTL-specific example.
