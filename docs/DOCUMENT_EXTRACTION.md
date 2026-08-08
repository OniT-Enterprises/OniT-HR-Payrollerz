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

## After extraction: what the bill forms still refuse

Two guards sit past the extractor, because the upload path is exactly where the
same document arrives twice or under a new spelling.

**A duplicate invoice is flagged, never blocked** (`money/duplicate-bill.ts`).
Same vendor plus the same normalised number wins — `INV-0473`, `inv 0473` and
`INV0473` are one number. Amount-within-five-days is the weaker fallback and is
only considered when NEITHER side carries a number, because two real invoices of
equal value on one day with distinct numbers exist in the corpus
(`GLA_Invoices_5389_e_5390`). Cancelled bills are excluded — re-entering one is
how a correction is made — and a bill is never a duplicate of itself while being
edited. It warns rather than blocks: a supplier really can issue two invoices in
a day, so the person decides with both records in front of them.

**A supplier does not become three vendors** (`money/vendor-match.ts`). The
corpus carries one company as `Primo's Boot`, `Primos Boot` and `Primos Boot
Unipessoal Lda`. The extracted tax number decides when the document has one, since
a NIF identifies the legal entity however the name was typed. Otherwise close
names are OFFERED, never auto-selected: significant words are compared with legal
forms (`lda`, `unipessoal`, `ep`, `ltd`…) dropped, every word of the shorter name
must appear in the longer, and at least one must be four characters or more — so
`TI` is never offered for `Timor Telecom`.

**A payment slip can settle the bill it paid** (`money/payment-match.ts`), and the
slip file is attached to that bill as the evidence the business keeps. Only an
EXACT cent match against an open bill is offered, a stored `balanceDue` decides
alone, and when several bills match equally all are shown rather than guessed
between — offering the wrong bill marks a supplier paid who has not been paid and
hides a real payable.

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
looking complete.

**Legacy `.xls` is detected and refused with instructions, not parsed.** Ten of
twenty-four real attendance exports are that format, straight off fingerprint
devices; exceljs reads only `.xlsx`, and the old fallback turned the binary into
garbage that wasted an extraction call and imported nothing. `looksLikeLegacyXls`
spots the OLE2 signature and the import says to save as `.xlsx` or CSV.

SheetJS is the only maintained JS reader for the format and was **deliberately
not added**: npm serves `xlsx@0.18.5`, which predates the fix for the
prototype-pollution advisory CVE-2023-30533, and the fixed builds are published
on the vendor's own CDN rather than the registry. Pointing a known-vulnerable
parser at files arriving from third-party devices is a poor trade in a payroll
app when the user can convert the file in one step. If full `.xls` support is
wanted later, the CDN route is a deliberate decision with that risk in view.

## How this is tested

Three layers, deliberately separate:

- **Unit tests** pin each rule (`extracted-currency`, `extracted-date`,
  `pdf-protected`, `duplicate-bill`, `payment-match`, `spreadsheet-text`), and
  `server/xefe-api/test/extract-sanitize.test.mjs` covers the hostile-output
  boundary — the model's reply is untrusted input, since the document is.
- **e2e** (`tests/e2e/bill-upload-guards.spec.ts`) drives the real UI and
  **intercepts the extraction call**. CI has no `CLAUDE_CODE_OAUTH_TOKEN`, and a
  test that depends on a model's answer proves nothing about our code while
  failing for reasons that are not defects.
- **The extractor itself** is measured against real documents by
  `scripts/extraction-audit`, never in CI. Re-run the 30-document holdout after
  any prompt change.

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
