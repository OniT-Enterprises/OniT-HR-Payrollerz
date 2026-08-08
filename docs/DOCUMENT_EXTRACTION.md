# Document extraction — reading an uploaded bill, receipt or timesheet

Read this before touching `server/xefe-api/extract.js`, `client/lib/aiExtract.ts`,
`client/lib/extracted-*.ts`, `client/lib/attendance/spreadsheet-text.ts`, or the
upload paths in `QuickBillDialog.tsx` / `Expenses.tsx` / `Attendance.tsx`.

Everything here was measured against **real** Timor-Leste documents — 151
stratified, then 30 held out that the tuning never saw. The harness and the
baseline live in `scripts/extraction-audit/README.md`.

## The one rule that must not be undone

**Never put a bare `allowedTools: ['Read']` in the extractor's options.**

The document being read is attacker-controlled — it is whatever a "supplier"
emailed or a customer photographed. `extract.js` documented two independent
guards against a booby-trapped file (a relocated workspace, and a `canUseTool`
callback checking the resolved path). A bare entry in `allowedTools` auto-approves
the tool **before the workspace check and before `canUseTool`**, so both guards
were inactive and the model could read any file the process could — on prod that
is `/opt/xefe-api`, where `serviceAccountKey.json` lives. The SDK warns about this
as `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED`; nothing else did.

With the allow-list omitted, reads inside the workspace still work and reads
outside are denied. `node scripts/extraction-audit/probe-read-sandbox.cjs` proves
it either way and exits non-zero if the shipped shape escapes. Run it after any
change to those options or an SDK upgrade.

## What extraction returns, and what the forms do with it

`extractDocumentFields()` returns one object per file. `sanitizeFields()` is the
boundary against hostile model output — a closed set of document types, cent
rounding, strict calendar dates, control characters stripped, length caps — and
has its own tests in `server/xefe-api/test/extract-sanitize.test.mjs`.

| `documentType` | Meaning | Form behaviour |
|---|---|---|
| `bill` / `receipt` | A supplier document to record | Pre-fills, user confirms |
| `payment_proof` | A **bank** document evidencing payment — transfer slip, *comprovativo*, ATM *levantamento* | Does not create a bill; offers the open bill it settles (`payment-match.ts`) |
| `credit_memo` | A credit note: it **reduces** what is owed | Refuses — booking one as a bill pays out money the business is owed |
| `other` | Not a bill/receipt, or unreadable | Confidence ≥ 0.5 → "read it, but it isn't a bill"; below → "couldn't read this file" |

**A payslip is never a bill or receipt.** Payroll owns wages, so a *Recibo de
Vencimento* / *Recibo de Salário* must return `other`. The corpus had ten of
them being booked as expenses, each double-counting wages payroll already books
and making a vendor record out of an employee.

Four guards decide what reaches a money field. Each exists because a real
document broke it:

- **Foreign currency withholds the amount.** Bills and expenses are USD-only
  (`Bill.currency: 'USD'`). 12 of 125 corpus documents were not USD — one euro
  invoice at €8,496.59 would have been saved as dollars. `extracted-currency.ts`.
- **A future date withholds the date *and* the due date.** An invoice printing
  `06/11/2024`, emailed 18 June 2024 and billing "Maio e Junho", was read as 6
  November — five months ahead. Both dates come from the same misreading, so
  neither is trusted. Only future dates are implausible: old documents are
  normal catch-up paperwork. `extracted-date.ts`.
- **Several documents in one file withhold the amount and the number.**
  `containsMultipleDocuments` fires when one upload holds more than one invoice.
  One corpus file held two $3,250 invoices and produced a $6,500 total belonging
  to neither; the form makes one bill, so the rest would be silently lost.
- **A password-protected PDF says so.** Detected by an `/Encrypt` byte scan
  (`pdf-protected.ts`), because "XefeBot couldn't read this file" is true but
  useless. Flags exactly the encrypted document out of 30 held-out files.

Settling from a slip is deliberately strict: only an **exact** cent match against
an open bill is offered, because marking a supplier paid who has not been paid
hides a real payable. A stored `balanceDue` decides alone — falling back to the
bill total when it disagrees would offer a bill owing $900 to settle a $472
payment. Several equal candidates are all shown rather than guessed between.

`taxAmount` is **not extracted**, deliberately. TL has no VAT, and a document's
tax line may be Indonesian PPN, Portuguese IVA, TL services tax or supplier
withholding — four treatments that cannot be told apart from the document alone,
so mapping any of them to `Bill.taxRate` would misstate the tax. It used to be
extracted and read by nothing, which looks like a field somebody forgot to wire.
Decide the per-regime meaning before asking for it again.

## Attendance spreadsheets

`client/lib/attendance/spreadsheet-text.ts` converts a workbook to the text the
extractor reads, and is shared by the strict parser and the AI fallback.

**Excel has no time type.** A time-only cell (`09:23`) is a `Date` on the
1899-12-30 epoch. Rendering every `Date` as `YYYY-MM-DD` turned every clock time
in a real `.xlsx` into the string `1899-12-30`, and those sheets imported zero
rows. Times are read in **UTC** — a local read shifts every clock time by the
machine's offset.

Also handled, each from a real file: workbooks with **one sheet per month** (one
had 73, and only `worksheets[0]` was ever read), print-layout spacer rows that
doubled the payload, and sheet names spelled `Agust 2022`, `Jully 2022`,
`0ct 2019`, `Octoberber 2023`.

**Impossible times are dropped, never repaired.** The sanitizer used to let
`12:99` through and silently clamp `25:30` to `23:30`, inventing a night shift
the sheet never showed — and `Attendance.tsx` pushes these rows into attendance
without re-checking, so they become payroll hours.

**Throughput is about 30 records per call.** A wide monthly grid — employees
across columns, days down rows — expands into one record per employee per day: a
2-row slice of a 30-employee sheet took 88s, a 4-row slice exceeded the 180s
ceiling. `planExtraction()` sizes chunks from that measurement and caps a single
import at 12 calls, **reporting the remainder in the skipped list** rather than
looking complete. Legacy `.xls` (fingerprint-device exports) is unsupported —
exceljs cannot read BIFF.

## Rate limits

`/ai/extract-document` allows 30 requests per 10 minutes; `/ai/extract-table` has
its own, larger budget because ONE attendance import is a dozen chunked calls and
sharing the document budget made a third import 429 partway through, half
importing a month.

## Deployment — both halves, and what watches them

Both halves now deploy on a push to `main` — `deploy-api.yml` gained a trigger
filtered to `server/xefe-api/**` after the box ran two-week-old code while a
security fix sat merged. It reloads through `pm2 startOrReload`, and `index.js`
drains on SIGTERM with `kill_timeout` set above the 180s extraction ceiling, so a
deploy no longer cuts off an upload that is mid-read. Check `/api/health` after a
server-side change; a client shipping ahead of its schema is what the old split
caused.

Extraction authenticates with a Claude Code **subscription** OAuth token
(`CLAUDE_CODE_OAUTH_TOKEN` in `/opt/xefe-api/.env`), not a metered API key. When it
expires every upload 502s while `/api/health` still answers happily, so two probes
in `uptime.yml` cover it: a half-hourly count of request-level failures in the API
log, and a daily synthetic extraction
(`server/xefe-api/scripts/check-extraction-auth.cjs`) that catches a dead token
before a customer does. Replacing the token means editing `/opt/xefe-api/.env` on
the box and reloading — it is deliberately excluded from the deploy rsync.
