# Payroll & Accounting launch-readiness TODO

_Started 2026-07-20 from an end-to-end audit of `main` at `aaef82f`._

_Code-side checklist verified 2026-07-20. The unchecked items are external
evidence, production-console, or professional sign-off gates and must remain
open before a broad “ready for everyone” claim._

This is the release checklist for the claim that Xefe can carry a normal
Timor-Leste small business from employee setup through payroll, payment,
statutory remittance, and closed books. A checked item needs both implementation
and automated evidence. Items marked **external** cannot be truthfully completed
from code alone.

## P0 — books and payment state agree

- [x] Keep payroll approval and payment as separate states.
- [x] Require payment date, reference, method, and cash/bank ledger account before
      a run becomes `paid`.
- [x] Post the idempotent payroll settlement journal: Dr `2210` Net Salaries
      Payable / Cr the selected cash or bank account.
- [x] Complete the linked bank-transfer status, payroll status, journal link, and
      recurring-deduction settlement without duplicate postings on retry.
- [x] Track WIT return submission and WIT payment as independent obligations.
- [x] Record WIT payment and post Dr `2220` / Cr cash or bank.
- [x] Record INSS payment and post Dr `2230` + Dr `2240` / Cr cash or bank.
- [x] Prove the accrual and settlement chain in unit, rules, and browser tests.

## P1 — statutory identity and supported employee cases

- [x] Store the worker TIN/NIF on the employee master and carry it into monthly
      WIT, annual WIT, and the official INSS DR export.
- [x] Store employer NISS in company settings and use it in the INSS payment-order
      reference.
- [x] Make part-time payroll representable without silently applying the
      full-time minimum-wage floor. Require contracted weekly hours and an explicit,
      auditable minimum-wage treatment.
- [x] Keep unresolved severance/final-pay interpretations behind an explicit
      accountant/legal-review acknowledgement; never invent a statutory default.

## P1 — accounting completeness

- [x] Make fixed-asset acquisition origin explicit: `already posted via bill`,
      `opening balance`, or `post acquisition now`.
- [x] For `post acquisition now`, require a funding/payable account and post the
      balanced acquisition journal exactly once.
- [x] Add an annual business-income-tax preparation record and deadline so Form C
      cannot disappear from the compliance calendar.
- [ ] **External — official Form C:** obtain the current official form/instructions
      and accountant sign-off before claiming that Xefe calculates or files Form C.

## P1 — self-service operations

- [x] Expose tenant member invitation, role/module editing, password reset, and
      removal to owners/admins in Settings (the callable backend already exists).
- [x] Keep the two-person payroll approval path usable without superadmin seeding.
- [x] Make the emulator E2E suite a required dependency of production deployment.
- [x] Assert audit-log creation in the full workflow test.

## P2 — coverage, language, and operations

- [x] Add browser coverage for invoice → receipt → journal → bank reconciliation,
      bill → payment/withholding → journal, payroll → bank settlement, statutory
      payment clearing, fixed-asset acquisition/depreciation, and fiscal close.
- [x] Rebuild the generated translation master, eliminate real runtime key gaps,
      and run `i18n:check` in CI.
- [x] Update stale launch documentation to match the current domain and automated
      Functions deployment.
- [ ] **External — bank formats:** obtain signed-off BNCTL and ANZ/Mandiri samples;
      keep unverified formats labelled best-effort until then.
- [ ] **External — production consoles:** configure and verify Sentry DSN and
      reCAPTCHA/App Check secrets.
- [ ] **External — legal:** have Timor-Leste counsel review the legal pages and the
      open interpretations listed in `docs/TL_LAW_GAP_MATRIX_JUL2026.md`.

## Release acceptance

- [x] `pnpm typecheck`
- [x] `pnpm lint` (zero errors; two pre-existing Fast Refresh warnings)
- [x] `pnpm test`
- [x] `pnpm emul:rules` (Java 21)
- [x] `pnpm test:api` (Java 21)
- [x] `pnpm --dir functions build`
- [x] `pnpm build`
- [x] `pnpm i18n:check`
- [x] `pnpm e2e`
- [x] No unsupported bank/legal scenario is marketed as verified; BNU is the
      only verified salary-pack workflow, while BNCTL/ANZ/Mandiri are visibly
      labelled best-effort.

## Automated evidence

- Unit suite: 81 files / 941 tests passed.
- Rules suite: 20 files / 240 emulator tests passed.
- Browser suite: accounting lifecycle, full taxable payroll/statutory lifecycle,
  and real-month replay all passed. The full payroll journey also persists the
  Form C preparation hand-off and verifies its audit entry.
- API suite: 9/9 authentication and tenant-isolation tests passed.
