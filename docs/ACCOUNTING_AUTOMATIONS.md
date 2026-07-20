# Accounting automations — fixed assets, depreciation & recurring journals

Canonical reference for the fixed-asset register + depreciation and the
recurring-journal templates + nightly poster. **Read this before touching
`client/lib/accounting/{depreciation,recurring}.ts`, `client/services/{fixedAssetService,recurringJournalService}.ts`,
`functions/src/accounting.ts`, `client/pages/accounting/FixedAssets.tsx`, or
their Firestore rules/collections.**

These are money-critical, general-ledger-affecting flows. Every invariant below
was either designed in or hardened by the Jul 2026 adversarial review — regress
one and the ledger silently corrupts.

## Where the code lives

| Concern | File |
|---|---|
| Depreciation schedule math (pure, unit-tested) | `client/lib/accounting/depreciation.ts` |
| Recurring date math + validation (pure) | `client/lib/accounting/recurring.ts` |
| Fixed-asset register CRUD + depreciation/disposal posting | `client/services/fixedAssetService.ts` |
| Recurring template CRUD + schedule | `client/services/recurringJournalService.ts` |
| Nightly recurring poster (Cloud Function) | `functions/src/accounting.ts` (`processRecurringJournals`) |
| Fixed-asset UI | `client/pages/accounting/FixedAssets.tsx` |
| Tests | `tests/client/{depreciation,recurring-journals}.test.ts`, `tests/rules/{fixed-assets,recurring-journals}.test.ts` |

All GL postings go through `journalEntryService.createJournalEntry` (see
`docs/`/`accountingService.ts`), which enforces `debits === credits`, fiscal-period
close, and writes the journal + GL rows + audit row in one transaction. **Never
hand-write GL rows** — always post through it.

## Data model

- `tenants/{tid}/fixedAssets/{id}` — the depreciation subledger (cost, residual,
  useful life, `accumulatedDepreciation`, `depreciatedThroughPeriod`, status).
- `tenants/{tid}/fixedAssetPostings/{YYYY-MM}` — **append-only per-period guard**.
  Its existence means that period's aggregate depreciation journal is posted.
- `tenants/{tid}/recurringJournals/{templateId}` — recurring template (lines,
  cadence, `nextRunDate`, `lastRunDate`, active/end).
- `tenants/{tid}/recurringJournalPostings/{templateId}_{YYYY-MM}` — **per-(template,
  period) guard**; existence means that template already posted that period.

Both guard collections are read-only to finance admins for reads, created only by
the finance-admin/CF path, and **never deleted** (a reversal is a manual journal,
not a guard delete). Guards are fetched only by doc id — no composite index needed.

## Invariants (do not break)

### Depreciation math (`depreciation.ts`)
- **Straight-line, cumulative-cap.** Per-period charge = increment of a cumulative
  curve *capped at the depreciable base* (`cost − residual`). This guarantees:
  accumulated depreciation **never exceeds** the base, net book value **never dips
  below residual**, and **no charge is ever negative** — even when the rounded
  monthly charge rounds *up* (`standard × life > base`), in which case the asset
  simply reaches the base a month or two early and later periods charge 0.
  *(The old `total − standard×(life−1)` true-up went negative on round-up and left
  accumulated > cost — never reintroduce it.)*
- **Money math uses `client/lib/currency.ts`** (decimal.js): `addMoney`,
  `subtractMoney`, `multiplyMoney`, `divideMoney`, `maxMoney`. **No `Math.round`
  on money** — it misrounds half-cent cases and drifts when accumulated.
- Land (life 0) never depreciates. The schedule sums exactly to the depreciable base.

### Posting is atomic (`fixedAssetService.ts`)
- `postDepreciationForPeriod` and `dispose` each run as **one Firestore
  transaction**: claim/read the guard (or asset), post the journal via
  `createJournalEntry(…, tx)`, write the guard, and advance the subledger — all
  or nothing. This is what makes them:
  - **exactly-once under concurrency** (the guard read+create is transactional;
    two clicks/tabs can't both post a period, and disposal contention serializes),
  - **crash-safe** (no partial state where the journal/guard posted but assets
    weren't advanced — which would double-charge via next-period catch-up).
  - Charges are **recomputed from fresh in-transaction asset state**, not the
    preview. Preserve read-before-write ordering: all `tx.get`s (guard, assets)
    precede `createJournalEntry(…, tx)` (which reads the entry-number counter,
    then writes) and the subsequent `tx.set`/`tx.update`s.
- **No future-period posting**: the month picker is capped (`max`) and the service
  rejects `period > today` (Asia/Dili).

### Recurring poster (`functions/src/accounting.ts`)
- **Idempotent per (template, period)** via the `recurringJournalPostings` guard,
  created *inside* the posting transaction with `txn.create()` (aborts on a
  concurrent race; the retry sees the guard and returns `already_posted`).
- `nextRunDate` is only ever advanced **forward**. `updateSchedule` clamps a
  recomputed run date forward past `lastRunDate`'s month so an edit can't rewind
  into an already-posted period (belt to the guard's suspenders).
- A generated entry must **balance**, and a line with **both** a positive debit
  and credit is rejected (a two-sided line would falsely pass a naive
  `totalDebit === totalCredit` check). Broken templates are deactivated, not posted.
- Posting respects fiscal-period close; a paused/ended template posts nothing; an
  error in one template does not abort the batch.
- `templateIsDue` lives in the functions module and drives both the sweep and the
  in-transaction check — the **tested code is the running code** (functions can't
  import client `@/` code). Keep it there.

### Statutory export provenance
- Statutory Excel exports mirror **official government templates only** (INSS
  portal DR, ATTL forms — a compliance requirement for portal upload). Everything
  else (fixed-asset register export, Resumo sheets) is **Xefe's own layout** — never
  modeled on a client's or accounting firm's internal workbook.

## Open decision — acquisition posting

`fixedAssetService.create` writes only the register doc; it does **not** post an
acquisition GL journal (`Dr asset / Cr cash-or-payable`). This is deliberate and
**unresolved**: if assets are acquired via a recorded bill, that bill already
debits the asset account, so auto-posting here would double-book it. Before
wiring acquisition posting, decide the acquisition flow (bill-linked vs
standalone) and dedup accordingly. Until then the register can differ from the
ledger's asset account for assets entered without a linked bill.

## Review status (Jul 2026)

Adversarial review confirmed 13 findings; 12 fixed, all invariants above encode
those fixes. The one deferred is the acquisition-journal decision (above). See the
review for the failure scenarios each invariant guards against.
