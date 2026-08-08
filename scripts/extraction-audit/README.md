# Extraction audit harness

Measures Xefe's AI document extraction against **real** Timor-Leste business
documents, and attacks it. Every guard in `server/xefe-api/extract.js` and
`client/lib/extracted-*.ts` exists because one of these runs found a defect that
unit tests could not: synthetic fixtures are written by whoever writes the
parser, so they encode the same assumptions.

## Where the documents live

**Not in this repo, and they must not be.** They are third-party client
documents. The corpus lives outside the tree in `~/Sites/m365-mail-export`
(not a git repo, so nothing there can be committed by accident):

| Path | What |
|---|---|
| `mail.db` | Message + attachment **metadata only** — no file bytes |
| `doc-extract-audit/` | 151 stratified documents + `manifest.json` |
| `doc-holdout/` | 30 randomly chosen documents the tuning never saw |
| `doc-extract-audit/tables/` | Real attendance/timesheet workbooks |

Attachment bytes are refetched from Microsoft Graph on demand by the two Python
scripts (credentials in that directory's `.env`). Only **de-identified** fixtures
ever enter this repo — see `tests/client/fixtures/`.

## Running

The Node scripts are `.cjs` on purpose — the repo is `"type": "module"`, and these
load the CommonJS extractor directly. They call `extractDocumentFields()` / `extractTableRows()` directly,
bypassing HTTP and auth, so they measure the extractor itself. They need
`server/xefe-api/.env` (for `CLAUDE_CODE_OAUTH_TOKEN`) and the `claude` CLI on
PATH. Run them from the repo root:

```bash
CORPUS=~/Sites/m365-mail-export/doc-extract-audit

# Accuracy over the corpus (resumable; ~35 min at concurrency 4)
node scripts/extraction-audit/run-audit.cjs --corpus "$CORPUS" --out /tmp/results.json

# Score it — no hand-labelling needed (see "How it scores" below)
node scripts/extraction-audit/score-audit.cjs /tmp/results.json

# Did a prompt change break anything? Compare two runs of the same corpus
node scripts/extraction-audit/compare-runs.cjs /tmp/baseline.json /tmp/results.json

# Adversarial: injection + malformed files (~16 cases, a few minutes)
cd server/xefe-api && node ../../scripts/extraction-audit/stress-documents.cjs

# Attendance spreadsheets, real and hostile
cd server/xefe-api && node ../../scripts/extraction-audit/stress-tables.cjs "$CORPUS/tables"

# Is the Read sandbox still enforcing? (see the warning below)
cd server/xefe-api && node ../../scripts/extraction-audit/probe-read-sandbox.cjs
```

Fetching more documents (needs Graph credentials):

```bash
cd ~/Sites/m365-mail-export
./.venv/bin/python ~/Sites/xefe/scripts/extraction-audit/fetch-stratified.py --outdir ./doc-extract-audit
./.venv/bin/python ~/Sites/xefe/scripts/extraction-audit/fetch-holdout.py \
  --audit-dir ./doc-extract-audit --outdir ./doc-holdout
```

## How it scores without hand-labelled data

Labelling 151 documents by hand is the reason this kind of measurement never
happens. Three sources of ground truth avoid it:

- **The filename** often carries the real invoice number (`Invoice_5797_from_…`,
  `Factura nº 127`), so `billNumber` can be checked automatically.
- **The email date** in `manifest.json` bounds the document date: an invoice
  cannot be issued after the message that carried it. This is what caught the
  day/month swap.
- **Cross-run comparison** catches regressions without any labels at all —
  `compare-runs.cjs` reports per-document changes, and flags any case where the
  amount or date moved on a document that was already reading fine.

Anything flagged is a **candidate**; open the file before believing it.

## Baseline — 2026-08-07, 151 documents

| | |
|---|---|
| Usable reads | 117 (89% of documents that reach the extractor) |
| Amount present on a usable read | 100% |
| Non-USD documents | 12 (10 EUR, 2 PHP) |
| Supplier tax number captured | 45 |
| Latency | p50 12.7s, p95 21.6s |
| Adversarial cases passed | 16/16 — no leak, no writes, no schema violation |

Wide-matrix attendance sheets return roughly **30 records per call**; a 2-row
slice of a 30-employee grid took 88s and a 4-row slice exceeded the ceiling.
`planExtraction()` sizes chunks from that measurement — treat it as a real limit,
not a tuning knob.

## ⚠️ The Read sandbox

`probe-read-sandbox.cjs` checks a security control, not a feature. The extractor
reads an **attacker-controlled** file (whatever a "supplier" emailed), and a bare
`allowedTools: ['Read']` entry auto-approves the tool *before* the workspace check
and before `canUseTool` — which is how an arbitrary-file-read went unnoticed while
the code carried a comment claiming two guards. Run this probe after any change to
`extract.js` options or an SDK upgrade. It must report `escaped: false`.
