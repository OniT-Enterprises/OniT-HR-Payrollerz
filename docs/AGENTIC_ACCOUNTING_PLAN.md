# Agentic Accounting — OpenClaw Write + Self-Audit Plan

> Making Meza's AI assistant go from "read-only reporter" to "accountant that checks its own work."

---

## What We Have Today

| Layer | Status | Details |
|-------|--------|---------|
| **Bot (OpenClaw)** | 29 read tools, 5 commands | Can look at everything, touch nothing |
| **Meza API** | 26 GET + 1 POST (blocked) | Journal entry POST exists but returns "not yet available" |
| **Confirmation flow** | Scaffolded | Intent classifier (read/write/confirm/cancel), `chat_pending` with 10-min TTL |
| **Audit trail** | Full | Every chat interaction logged to `chat_audit`, every accounting action to `auditLogs` |
| **Payroll engine** | Complete | TL-compliant calculations with `warnings[]` output, validation functions, Decimal.js precision |
| **Accounting** | Complete | Double-entry JE + GL (atomic transactions), fiscal periods, trial balance, P&L, balance sheet |
| **Reversibility** | Built | Journal void creates reversing GL entries (swap debit/credit), full audit trail |

### Key Existing Code

- **`callApi(endpoint)`** — plugin helper, GET-only today, uses `X-API-Key` + `X-Request-Id`
- **`classifyChatIntent(message)`** — returns `'read' | 'write' | 'confirm' | 'cancel'`
- **`setPendingChatAction()`** — stores pending write in Firestore with 10-min TTL
- **`buildChatSystemPrefix()`** — includes `WRITE_CONFIRMATION_STATE: confirmed|not-confirmed`
- **`calculateTLPayroll(input)`** — returns `TLPayrollResult` with `warnings: string[]`
- **`validateTLPayrollInput(input)`** — returns `string[]` of validation errors
- **`assertFiscalPeriodAllowsPosting()`** — blocks writes to closed/locked periods

---

## The Vision: Three Levels

### Level 1 — Action + Confirm (Human-in-the-loop)

```
User: "Run payroll for March 2026"
Bot:  Calculates → shows summary → "Confirm to post?"
User: "Yes"
Bot:  Posts payroll + journal entry + audit log
```

### Level 2 — Action + Self-Audit (Bot checks its own work)

```
Bot runs payroll → then automatically:
  ✓ Cross-checks each employee's INSS base excludes overtime
  ✓ Validates WIT threshold (resident vs non-resident)
  ✓ Compares totals to last month (flags >15% deviation)
  ✓ Checks trial balance still balances after JE
  ✓ Verifies fiscal period is open

"Payroll ready but I found 2 issues:
 (1) João's WIT was calculated as non-resident but he's flagged as resident
 (2) Total gross is 23% higher than Feb — 3 new hires, looks intentional.
 Fix issue 1 and proceed?"
```

### Level 3 — Continuous Monitoring (Scheduled/triggered checks)

```
Bot checks on schedule:
  "WIT filing for Feb is due in 14 days, hasn't been generated"
  "3 invoices are 45+ days overdue, totaling $2,300"
  "Leave balance for Ana shows -2 days — approved without balance"
  "JE-0042 was voided but no correcting entry was posted"
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  User (Web Chat / WhatsApp)                               │
└───────────────┬──────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────┐
│  Meza API (Express, port 3201)                            │
│                                                           │
│  Auth: X-API-Key (bot) or Firebase Token (web)            │
│  Middleware: requireApiKey → requireTenant → rate limit    │
│                                                           │
│  ┌─────────────────┐  ┌──────────────────┐               │
│  │  READ endpoints  │  │  WRITE endpoints │  ◄── NEW      │
│  │  (26 existing)   │  │  (Phase 1)       │               │
│  └────────┬────────┘  └────────┬─────────┘               │
│           │                     │                          │
│           ▼                     ▼                          │
│  ┌──────────────────────────────────────────┐             │
│  │  Firestore (tenants/{tid}/...)           │             │
│  │  + Audit Logs (automatic)                │             │
│  └──────────────────────────────────────────┘             │
│                                                           │
│  ┌──────────────────────────────────────────┐             │
│  │  VALIDATION endpoints  ◄── NEW (Phase 3) │             │
│  │  verify_payroll, check_trial_balance,    │             │
│  │  audit_journal_entry, compliance_check   │             │
│  └──────────────────────────────────────────┘             │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  OpenClaw Gateway (Docker, port 18790)                    │
│                                                           │
│  meza-hr plugin:                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Read tools   │  │ Write tools  │  │ Verify tools    │ │
│  │ (29 exist)   │  │ (Phase 2)    │  │ (Phase 3)       │ │
│  └─────────────┘  └──────────────┘  └─────────────────┘ │
│                                                           │
│  Agent loop: act → verify → (fix or flag) → respond       │
└──────────────────────────────────────────────────────────┘
```

---

## Phase 1: Write API Endpoints

Add POST/PUT endpoints to `server/meza-api/index.js` alongside the existing read endpoints. All write endpoints follow the same pattern:

### Auth & Safety (applies to all write endpoints)

```javascript
// New middleware for write operations
function requireWriteAuth(req, res, next) {
  // Option A: Same API key (bot writes)
  // Option B: Firebase token + role check (user writes via bot)
  // For Phase 1, use API key — the confirmation flow in the chat
  // endpoint already gates human approval before calling writes
  requireApiKey(req, res, next);
}

// Audit wrapper — every write gets logged
function auditWrite(action, entityType) {
  return async (req, res, next) => {
    req.auditAction = action;
    req.auditEntityType = entityType;
    next();
  };
}
```

### 1.1 Payroll Endpoints

```
POST /api/tenants/:tenantId/payroll/calculate
  Body: { employees: [...], periodStart, periodEnd, payDate, payFrequency }
  Returns: { summary, records[], warnings[] }
  Does NOT write to Firestore — dry run only
  Purpose: Bot calculates payroll, shows user, asks for confirmation

POST /api/tenants/:tenantId/payroll/runs
  Body: { payrollRun, records[] }
  Returns: { runId, recordIds[], journalEntryId? }
  Guards: Fiscal period open, valid dates, balance check
  Writes: PayrollRun + PayrollRecords (batched) + JournalEntry (optional)
  Audit: payroll.run (severity: info)

PUT /api/tenants/:tenantId/payroll/runs/:runId/approve
  Body: { approvedBy }
  Guards: Status must be draft/processing, two-person rule (approver ≠ creator)
  Audit: payroll.approve (severity: critical)

PUT /api/tenants/:tenantId/payroll/runs/:runId/reject
  Body: { rejectedBy, reason }
  Guards: Status must be processing, reason required
  Audit: payroll.reject (severity: warning)

PUT /api/tenants/:tenantId/payroll/runs/:runId/mark-paid
  Guards: Status must be approved
  Audit: payroll.mark_paid (severity: info)

POST /api/tenants/:tenantId/payroll/runs/:runId/repair
  Guards: Status must be writing_records (stuck)
  Returns: { result: 'repaired' | 'deleted' }
  Audit: payroll.repair (severity: warning)
```

### 1.2 Accounting Endpoints

```
POST /api/tenants/:tenantId/journal-entries
  (Already exists but blocked — unblock it)
  Body: { date, description, source, lines[], status }
  Guards: Lines balance, fiscal period open, amounts valid
  Writes: JournalEntry + GL entries (if posted) — atomic transaction
  Audit: accounting.journal_create / accounting.journal_post

PUT /api/tenants/:tenantId/journal-entries/:id/post
  Body: { postedBy }
  Guards: Status must be draft, fiscal period open
  Writes: JE status → posted, creates GL entries — atomic transaction
  Audit: accounting.journal_post (severity: info)

PUT /api/tenants/:tenantId/journal-entries/:id/void
  Body: { voidedBy, reason }
  Guards: Status must be posted, fiscal period open, reason required
  Writes: JE status → void, creates reversing GL entries — atomic transaction
  Audit: accounting.journal_void (severity: critical)
```

### 1.3 Fiscal Period Endpoints

```
POST /api/tenants/:tenantId/fiscal-years
  Body: { year }
  Returns: { fiscalYearId, periodIds[] }
  Writes: FiscalYear + 12 FiscalPeriod documents (batch)
  Audit: accounting.period_create_year

PUT /api/tenants/:tenantId/fiscal-periods/:id/close
  Body: { closedBy }
  Guards: Status must be open
  Audit: accounting.period_close (severity: warning)

PUT /api/tenants/:tenantId/fiscal-periods/:id/reopen
  Body: { reopenedBy }
  Guards: Status must NOT be locked
  Audit: accounting.period_reopen (severity: warning)

PUT /api/tenants/:tenantId/fiscal-periods/:id/lock
  Body: { lockedBy }
  Guards: Status must be closed (not open, not already locked)
  Audit: accounting.period_lock (severity: critical)

POST /api/tenants/:tenantId/fiscal-years/:yearId/opening-balances
  Body: { lines: [{ accountId, accountCode, accountName, debit, credit }], createdBy }
  Guards: Debits must equal credits, fiscal year exists, not already posted
  Writes: JournalEntry (source: 'opening') + GL entries + FiscalYear update
  Audit: accounting.opening_balances_posted (severity: info)
```

### 1.4 Leave Management Endpoints

```
PUT /api/tenants/:tenantId/leave/requests/:id/approve
  Body: { approvedBy }
  Audit: leave.approve (severity: info)

PUT /api/tenants/:tenantId/leave/requests/:id/reject
  Body: { rejectedBy, reason }
  Audit: leave.reject (severity: info)
```

### Implementation Pattern

Every write endpoint follows this template:

```javascript
router.post('/:tenantId/payroll/runs',
  requireWriteAuth,
  auditWrite('payroll.run', 'payroll_run'),
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { payrollRun, records } = req.body;

      // 1. Input validation (shape + business rules)
      if (!payrollRun || !records?.length) {
        return res.status(400).json({ success: false, message: 'Missing payrollRun or records' });
      }

      // 2. Business logic (reuse existing Firestore patterns)
      const runsCol = tenantCol(tenantId, 'payrollRuns');
      // ... (batch writes, same pattern as client service)

      // 3. Audit log
      await tenantCol(tenantId, 'auditLogs').add({
        userId: req.body.createdBy || 'bot',
        userEmail: req.body.createdBy || 'bot',
        action: 'payroll.run',
        module: 'payroll',
        description: `Created payroll run for ${payrollRun.periodStart} to ${payrollRun.periodEnd}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        tenantId,
        entityId: runId,
        entityType: 'payroll_run',
        metadata: { employeeCount: records.length, totalGross: payrollRun.totalGrossPay },
        severity: 'info',
      });

      // 4. Return result
      res.json({ success: true, runId, recordIds });
    } catch (error) {
      console.error(`[payroll/runs] Error:`, error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);
```

### Firestore Write Patterns on Server Side

The server uses Firebase Admin SDK (not client SDK), so the patterns differ slightly:

```javascript
// Transaction (atomic JE + GL)
await db.runTransaction(async (txn) => {
  const jeRef = tenantCol(tenantId, 'journalEntries').doc();
  txn.set(jeRef, { ...entry, createdAt: admin.firestore.FieldValue.serverTimestamp() });

  for (const line of entry.lines) {
    const glRef = tenantCol(tenantId, 'generalLedger').doc();
    txn.set(glRef, { ...glEntry, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  // Audit inside same transaction
  const auditRef = tenantCol(tenantId, 'auditLogs').doc(`acct_${jeRef.id}_post`);
  txn.set(auditRef, { ... });
});

// Batch write (payroll — 500+ records)
const BATCH_LIMIT = 499;
const runRef = tenantCol(tenantId, 'payrollRuns').doc();
let batch = db.batch();
let batchCount = 0;

batch.set(runRef, { ...payrollRun, status: 'writing_records', expectedRecordCount: records.length });
batchCount++;

for (const record of records) {
  if (batchCount >= BATCH_LIMIT) {
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }
  const recRef = tenantCol(tenantId, 'payrollRecords').doc();
  batch.set(recRef, { ...record, payrollRunId: runRef.id });
  batchCount++;
}
await batch.commit();

// Finalize
await runRef.update({ status: targetStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
```

---

## Phase 2: Write Tools in OpenClaw Plugin

Add action tools to `server/openclaw-meza/extensions/meza-hr/index.ts`. These call the new write endpoints through the existing `callApi` pattern, extended for POST/PUT.

### 2.1 Extend callApi for Write Operations

```typescript
// Current: GET only
async function callApi(endpoint: string) { ... }

// New: supports POST/PUT with body
async function callApi(endpoint: string, options?: {
  method?: 'GET' | 'POST' | 'PUT';
  body?: Record<string, unknown>;
}) {
  const requestId = createRequestId();
  const url = `${apiBaseUrl}/api/tenants/${tenantId}${endpoint}`;
  const method = options?.method || 'GET';

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "X-Request-Id": requestId,
      },
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error: any) {
    throw new Error(`[${requestId}] Network error calling ${method} ${endpoint}: ${error?.message}`);
  }

  // ... same error handling as existing
}
```

### 2.2 Write Tools

Each write tool follows this pattern — it describes what it will do, calls the API, and returns structured results.

```typescript
// ── Payroll ──────────────────────────────────────────────

api.registerTool({
  name: "calculate_payroll",
  description: "Calculate payroll for a period WITHOUT posting. Returns summary and per-employee breakdown with warnings. Use this first, then confirm with the user before calling run_payroll.",
  parameters: Type.Object({
    periodStart: Type.String({ description: "Period start date (YYYY-MM-DD)" }),
    periodEnd: Type.String({ description: "Period end date (YYYY-MM-DD)" }),
    payDate: Type.String({ description: "Pay date (YYYY-MM-DD)" }),
    payFrequency: Type.Optional(Type.String({ description: "monthly (default), biweekly, weekly" })),
  }),
  async execute(_id, params) {
    const result = await callApi("/payroll/calculate", {
      method: "POST",
      body: params,
    });
    // Format: summary table + warnings (if any) + ask for confirmation
    let text = `**Payroll Calculation — ${params.periodStart} to ${params.periodEnd}**\n\n`;
    text += `| | Amount |\n|---|---:|\n`;
    text += `| Employees | ${result.summary.employeeCount} |\n`;
    text += `| Gross Pay | $${result.summary.totalGross.toFixed(2)} |\n`;
    text += `| WIT | $${result.summary.totalWIT.toFixed(2)} |\n`;
    text += `| INSS (Employee 4%) | $${result.summary.totalINSSEmployee.toFixed(2)} |\n`;
    text += `| INSS (Employer 6%) | $${result.summary.totalINSSEmployer.toFixed(2)} |\n`;
    text += `| Net Pay | $${result.summary.totalNet.toFixed(2)} |\n\n`;

    if (result.warnings?.length) {
      text += `⚠️ **Warnings:**\n`;
      result.warnings.forEach((w: string) => { text += `- ${w}\n`; });
      text += '\n';
    }

    text += `Say **"confirm"** to post this payroll run.`;
    return { content: [{ type: "text", text }] };
  },
});

api.registerTool({
  name: "run_payroll",
  description: "Post a calculated payroll run to the system. Creates payroll records, updates status, and optionally generates the accounting journal entry. Only call this AFTER calculate_payroll and user confirmation.",
  parameters: Type.Object({
    periodStart: Type.String({ description: "Period start date" }),
    periodEnd: Type.String({ description: "Period end date" }),
    payDate: Type.String({ description: "Pay date" }),
    createdBy: Type.String({ description: "Email of the person authorizing" }),
    createJournalEntry: Type.Optional(Type.Boolean({ description: "Auto-create accounting JE (default true)" })),
  }),
  async execute(_id, params) {
    const result = await callApi("/payroll/runs", {
      method: "POST",
      body: params,
    });
    let text = `✅ Payroll run created (ID: ${result.runId})\n`;
    text += `- ${result.recordIds.length} employee records written\n`;
    if (result.journalEntryId) {
      text += `- Journal entry posted: ${result.journalEntryId}\n`;
    }
    text += `- Status: draft (needs approval)\n`;
    return { content: [{ type: "text", text }] };
  },
});

api.registerTool({
  name: "approve_payroll",
  description: "Approve a payroll run. The approver must be a different person than the creator (two-person rule).",
  parameters: Type.Object({
    runId: Type.String({ description: "Payroll run ID" }),
    approvedBy: Type.String({ description: "Email of the approver (must differ from creator)" }),
  }),
  async execute(_id, params) {
    await callApi(`/payroll/runs/${params.runId}/approve`, {
      method: "PUT",
      body: { approvedBy: params.approvedBy },
    });
    return { content: [{ type: "text", text: `✅ Payroll run ${params.runId} approved by ${params.approvedBy}` }] };
  },
});

// ── Accounting ───────────────────────────────────────────

api.registerTool({
  name: "create_journal_entry",
  description: "Create a manual journal entry. Debits must equal credits. Can be created as draft or posted.",
  parameters: Type.Object({
    date: Type.String({ description: "Entry date (YYYY-MM-DD)" }),
    description: Type.String({ description: "What this entry is for" }),
    lines: Type.Array(Type.Object({
      accountCode: Type.String(),
      accountName: Type.String(),
      debit: Type.Number(),
      credit: Type.Number(),
      description: Type.Optional(Type.String()),
    })),
    status: Type.Optional(Type.String({ description: "'draft' (default) or 'posted'" })),
    createdBy: Type.String({ description: "Email of creator" }),
  }),
  async execute(_id, params) {
    const result = await callApi("/journal-entries", {
      method: "POST",
      body: { ...params, source: "manual" },
    });
    return { content: [{ type: "text", text: `✅ Journal entry created: ${result.entryNumber} (${result.status})` }] };
  },
});

api.registerTool({
  name: "void_journal_entry",
  description: "Void a posted journal entry. Creates reversing GL entries. Requires a reason.",
  parameters: Type.Object({
    entryId: Type.String({ description: "Journal entry ID" }),
    voidedBy: Type.String({ description: "Email of person voiding" }),
    reason: Type.String({ description: "Why this entry is being voided" }),
  }),
  async execute(_id, params) {
    await callApi(`/journal-entries/${params.entryId}/void`, {
      method: "PUT",
      body: { voidedBy: params.voidedBy, reason: params.reason },
    });
    return { content: [{ type: "text", text: `✅ Journal entry ${params.entryId} voided. Reversing entries created.` }] };
  },
});

// ── Fiscal Periods ───────────────────────────────────────

api.registerTool({
  name: "close_fiscal_period",
  description: "Close a fiscal period. No new entries can be posted to closed periods.",
  parameters: Type.Object({
    periodId: Type.String({ description: "Fiscal period ID" }),
    closedBy: Type.String({ description: "Email of person closing" }),
  }),
  async execute(_id, params) {
    await callApi(`/fiscal-periods/${params.periodId}/close`, {
      method: "PUT",
      body: { closedBy: params.closedBy },
    });
    return { content: [{ type: "text", text: `✅ Fiscal period ${params.periodId} closed.` }] };
  },
});

// ... lock_fiscal_period, reopen_fiscal_period, create_fiscal_year similarly

// ── Leave ────────────────────────────────────────────────

api.registerTool({
  name: "approve_leave_request",
  description: "Approve a pending leave request.",
  parameters: Type.Object({
    requestId: Type.String({ description: "Leave request ID" }),
    approvedBy: Type.String({ description: "Email of approver" }),
  }),
  async execute(_id, params) {
    await callApi(`/leave/requests/${params.requestId}/approve`, {
      method: "PUT",
      body: { approvedBy: params.approvedBy },
    });
    return { content: [{ type: "text", text: `✅ Leave request ${params.requestId} approved.` }] };
  },
});
```

### 2.3 Update Confirmation Flow

The existing confirmation flow in the chat endpoint needs one change — when `WRITE_CONFIRMATION_STATE` is `confirmed`, the bot should be allowed to call write tools:

```javascript
// In buildChatSystemPrefix(), update CAPABILITIES section:
const writeCapabilities = allowWrites
  ? `\n- WRITE MODE ACTIVE: You may call write tools (run_payroll, create_journal_entry, etc.) for the confirmed action ONLY.`
  : `\n- Read-only mode. If the user asks you to do something, show them what you would do and ask them to confirm.`;
```

The existing `classifyChatIntent()` already handles this — no changes needed to the intent classification logic.

---

## Phase 3: Verification Tools (The "Debugging" Part)

This is what makes it an agentic loop instead of just an action bot. These are read-only tools the bot calls *after* performing an action to check its own work.

### 3.1 Verification API Endpoints

```
GET /api/tenants/:tenantId/verify/payroll/:runId
  Returns: {
    valid: boolean,
    checks: [
      { name: "inss_base_excludes_overtime", passed: true, details: "..." },
      { name: "wit_threshold_correct", passed: true, details: "..." },
      { name: "net_pay_positive", passed: true, details: "..." },
      { name: "total_balance", passed: true, details: "..." },
      { name: "month_over_month_deviation", passed: false, deviation: 23, details: "..." },
    ],
    warnings: ["Total gross 23% higher than last month (3 new hires)"],
    errors: [],
  }

GET /api/tenants/:tenantId/verify/trial-balance?fiscalYear=2026&asOfDate=2026-03-31
  Returns: {
    balanced: boolean,
    totalDebits: number,
    totalCredits: number,
    difference: number,
    accountCount: number,
    zeroBalanceAccounts: number,
  }

GET /api/tenants/:tenantId/verify/journal-entry/:id
  Returns: {
    valid: boolean,
    checks: [
      { name: "debits_equal_credits", passed: true },
      { name: "fiscal_period_open", passed: true },
      { name: "all_accounts_exist", passed: true },
      { name: "no_negative_amounts", passed: true },
      { name: "gl_entries_match", passed: true, glEntryCount: 6 },
    ],
  }

GET /api/tenants/:tenantId/verify/compliance
  Returns: {
    issues: [
      { type: "wit_filing_due", severity: "warning", message: "WIT filing for Feb due in 14 days", dueDate: "..." },
      { type: "inss_filing_due", severity: "warning", message: "INSS filing for Feb due in 14 days" },
      { type: "negative_leave_balance", severity: "error", employee: "Ana", balance: -2 },
      { type: "voided_without_correction", severity: "warning", entryId: "JE-0042" },
      { type: "overdue_invoices", severity: "info", count: 3, total: 2300 },
    ],
  }
```

### 3.2 Payroll Verification Logic (Server-Side)

```javascript
// GET /api/tenants/:tenantId/verify/payroll/:runId
router.get('/:tenantId/verify/payroll/:runId', requireApiKey, requireTenant, async (req, res) => {
  const { tenantId, runId } = req.params;
  const checks = [];
  const warnings = [];
  const errors = [];

  // 1. Load run + records
  const runDoc = await tenantCol(tenantId, 'payrollRuns').doc(runId).get();
  if (!runDoc.exists) return res.status(404).json({ success: false, message: 'Run not found' });
  const run = runDoc.data();

  const recordsSnap = await db.collectionGroup('payrollRecords')
    .where('payrollRunId', '==', runId).get();
  const records = recordsSnap.docs.map(d => d.data());

  // 2. Check: record count matches
  checks.push({
    name: 'record_count_matches',
    passed: records.length === run.employeeCount,
    details: `Expected ${run.employeeCount}, found ${records.length}`,
  });

  // 3. Check: totals reconcile
  const sumGross = records.reduce((s, r) => s + (r.totalGrossPay || 0), 0);
  const sumNet = records.reduce((s, r) => s + (r.netPay || 0), 0);
  checks.push({
    name: 'gross_total_reconciles',
    passed: Math.abs(sumGross - run.totalGrossPay) < 0.01,
    details: `Sum: $${sumGross.toFixed(2)}, Header: $${run.totalGrossPay.toFixed(2)}`,
  });

  // 4. Check: INSS base excludes overtime for each employee
  for (const rec of records) {
    const earnings = rec.earnings || [];
    const overtimeInINSS = earnings.find(e =>
      e.type === 'overtime' && e.isINSSBase === true
    );
    if (overtimeInINSS) {
      errors.push(`${rec.employeeName}: Overtime ($${overtimeInINSS.amount}) incorrectly included in INSS base`);
    }
  }
  checks.push({
    name: 'inss_base_excludes_overtime',
    passed: errors.filter(e => e.includes('INSS base')).length === 0,
    details: errors.length ? errors.join('; ') : 'All employees OK',
  });

  // 5. Check: WIT threshold applied correctly
  for (const rec of records) {
    // Load employee to check resident status
    const empDoc = await tenantCol(tenantId, 'employees').doc(rec.employeeId).get();
    const emp = empDoc.data();
    const isResident = emp?.taxInfo?.isResident ?? true;
    const deductions = rec.deductions || [];
    const witDeduction = deductions.find(d => d.type === 'income_tax');
    const witAmount = witDeduction?.amount || 0;

    if (isResident && rec.totalGrossPay <= 500 && witAmount > 0) {
      errors.push(`${rec.employeeName}: WIT charged ($${witAmount}) but gross ($${rec.totalGrossPay}) is below $500 resident threshold`);
    }
    if (!isResident && rec.totalGrossPay > 0 && witAmount === 0) {
      warnings.push(`${rec.employeeName}: Non-resident with $${rec.totalGrossPay} gross but no WIT charged`);
    }
  }
  checks.push({
    name: 'wit_threshold_correct',
    passed: errors.filter(e => e.includes('WIT')).length === 0,
    details: 'Resident/non-resident thresholds verified',
  });

  // 6. Check: month-over-month deviation
  const prevMonth = getPreviousMonth(run.periodStart);
  const prevRunSnap = await tenantCol(tenantId, 'payrollRuns')
    .where('periodStart', '==', prevMonth.start)
    .where('periodEnd', '==', prevMonth.end)
    .limit(1).get();

  if (!prevRunSnap.empty) {
    const prevRun = prevRunSnap.docs[0].data();
    const deviation = ((run.totalGrossPay - prevRun.totalGrossPay) / prevRun.totalGrossPay) * 100;
    const passed = Math.abs(deviation) <= 15;
    checks.push({
      name: 'month_over_month_deviation',
      passed,
      deviation: Math.round(deviation),
      details: `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}% vs previous month`,
    });
    if (!passed) {
      warnings.push(`Gross pay ${deviation > 0 ? 'increased' : 'decreased'} by ${Math.abs(deviation).toFixed(1)}% vs last month`);
    }
  }

  // 7. Check: net pay positive for all employees
  const negativeNet = records.filter(r => r.netPay < 0);
  checks.push({
    name: 'net_pay_positive',
    passed: negativeNet.length === 0,
    details: negativeNet.length ? `${negativeNet.length} employees have negative net pay` : 'All positive',
  });

  // 8. Check: journal entry balances (if one was created)
  if (run.journalEntryId) {
    const jeDoc = await tenantCol(tenantId, 'journalEntries').doc(run.journalEntryId).get();
    if (jeDoc.exists) {
      const je = jeDoc.data();
      const balanced = Math.abs(je.totalDebit - je.totalCredit) < 0.01;
      checks.push({
        name: 'journal_entry_balanced',
        passed: balanced,
        details: `Debit: $${je.totalDebit.toFixed(2)}, Credit: $${je.totalCredit.toFixed(2)}`,
      });
    }
  }

  res.json({
    success: true,
    valid: errors.length === 0,
    checks,
    warnings,
    errors,
  });
});
```

### 3.3 Verification Tools in Plugin

```typescript
api.registerTool({
  name: "verify_payroll",
  description: "Run validation checks on a payroll run. Checks INSS base, WIT thresholds, totals, month-over-month deviation, net pay, and journal entry balance. Call this AFTER running payroll to verify correctness.",
  parameters: Type.Object({
    runId: Type.String({ description: "Payroll run ID to verify" }),
  }),
  async execute(_id, params) {
    const result = await callApi(`/verify/payroll/${params.runId}`);

    let text = `**Payroll Verification — ${params.runId}**\n\n`;
    for (const check of result.checks) {
      text += `${check.passed ? '✅' : '❌'} ${check.name}: ${check.details}\n`;
    }
    if (result.warnings.length) {
      text += `\n⚠️ **Warnings:**\n`;
      result.warnings.forEach((w: string) => { text += `- ${w}\n`; });
    }
    if (result.errors.length) {
      text += `\n🚨 **Errors:**\n`;
      result.errors.forEach((e: string) => { text += `- ${e}\n`; });
    }
    text += `\n**Result: ${result.valid ? 'PASSED' : 'ISSUES FOUND'}**`;
    return { content: [{ type: "text", text }] };
  },
});

api.registerTool({
  name: "check_trial_balance",
  description: "Check if the trial balance is balanced. Use after posting journal entries to verify the books are still in order.",
  parameters: Type.Object({
    fiscalYear: Type.Number({ description: "Fiscal year (e.g. 2026)" }),
    asOfDate: Type.Optional(Type.String({ description: "As-of date (YYYY-MM-DD), defaults to today" })),
  }),
  async execute(_id, params) {
    const dateParam = params.asOfDate ? `&asOfDate=${params.asOfDate}` : '';
    const result = await callApi(`/verify/trial-balance?fiscalYear=${params.fiscalYear}${dateParam}`);

    let text = `**Trial Balance Check — FY${params.fiscalYear}**\n\n`;
    text += `| | Amount |\n|---|---:|\n`;
    text += `| Total Debits | $${result.totalDebits.toFixed(2)} |\n`;
    text += `| Total Credits | $${result.totalCredits.toFixed(2)} |\n`;
    text += `| Difference | $${result.difference.toFixed(2)} |\n`;
    text += `| Accounts | ${result.accountCount} |\n\n`;
    text += result.balanced ? '✅ **Trial balance is balanced.**' : '🚨 **Trial balance is NOT balanced!**';
    return { content: [{ type: "text", text }] };
  },
});

api.registerTool({
  name: "run_compliance_check",
  description: "Check for compliance issues: upcoming filing deadlines, negative leave balances, voided entries without corrections, overdue invoices, etc.",
  parameters: Type.Object({}),
  async execute() {
    const result = await callApi("/verify/compliance");

    if (result.issues.length === 0) {
      return { content: [{ type: "text", text: "✅ No compliance issues found." }] };
    }

    let text = `**Compliance Check — ${result.issues.length} issues found**\n\n`;
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '🚨' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      text += `${icon} ${issue.message}\n`;
    }
    return { content: [{ type: "text", text }] };
  },
});
```

---

## Phase 4: Agent Loop Pattern

This is what makes the bot "debug" like Claude Code does. Instead of:

```
User asks → Bot calls one tool → Bot responds
```

It becomes:

```
User asks → Bot calls action tool → Bot calls verify tool → Bot decides (fix or flag) → Bot responds
```

### How It Works with OpenClaw

OpenClaw uses Claude under the hood. Claude naturally does multi-step tool calls — it can call `run_payroll`, read the result, then call `verify_payroll`, read that result, and formulate a response that includes both the action and the verification. No special "loop" code needed — it's Claude's native behavior.

### System Prompt Update

```
AGENTIC BEHAVIOR:
After performing any write action, ALWAYS verify your work:
- After run_payroll → call verify_payroll
- After create_journal_entry or post_journal_entry → call check_trial_balance
- After close_fiscal_period → call check_trial_balance for that period
- After any accounting action → call run_compliance_check

If verification finds issues:
1. Report the issues clearly to the user
2. If you can fix it (e.g., void a bad entry and re-create), offer to do so
3. If it requires human judgment (e.g., month-over-month deviation), explain and ask
4. Never proceed past a failing verification without user acknowledgment
```

### Example Flow: Full Payroll Cycle

```
User: "Run payroll for March 2026"

Bot internally:
  1. call calculate_payroll(periodStart: "2026-03-01", periodEnd: "2026-03-31", payDate: "2026-03-31")
  2. Read result → format summary for user

Bot: "Here's the March payroll calculation:
  12 employees, Gross $8,450, WIT $295, INSS $338/$507, Net $7,310
  ⚠️ 1 warning: João used 10 of 12 annual sick days
  Confirm to post?"

User: "Yes"

Bot internally:
  3. call run_payroll(...)
  4. Read result → got runId: "abc123"
  5. call verify_payroll(runId: "abc123")
  6. Read result → 7 checks passed, 1 warning (23% MoM increase)
  7. call check_trial_balance(fiscalYear: 2026)
  8. Read result → balanced ✅

Bot: "✅ Payroll posted for March 2026
  - 12 records written, JE-2026-0028 posted
  - Verification: 7/7 checks passed
  - Trial balance: balanced
  - Note: Gross is 23% higher than Feb due to 3 new hires (María, Pedro, Lisa)
  - Status: draft — needs approval from a different user"
```

### Example Flow: Self-Correction

```
User: "Create a journal entry: debit Office Supplies $500, credit Cash $500"

Bot internally:
  1. call create_journal_entry(lines: [...], status: "posted")
  2. Read result → JE-2026-0029 created
  3. call check_trial_balance(fiscalYear: 2026)
  4. Read result → balanced ✅

Bot: "✅ JE-2026-0029 posted. Trial balance verified — still balanced."

--- later ---

User: "Wait, that should have been $300 not $500"

Bot internally:
  1. call void_journal_entry(entryId: "JE-2026-0029", reason: "Incorrect amount — should be $300")
  2. Read result → voided, reversing entries created
  3. call create_journal_entry(lines: [...$300...], status: "posted")
  4. Read result → JE-2026-0030 created
  5. call check_trial_balance(fiscalYear: 2026)
  6. Read result → balanced ✅

Bot: "Done:
  - Voided JE-2026-0029 ($500) — reversing entries created
  - Posted JE-2026-0030 ($300) — correct amount
  - Trial balance verified — balanced"
```

---

## Phase 4b: Live Progress Feed (On-Screen Logging)

Instead of a spinner that says "Thinking..." for 30 seconds, the user sees each step as it happens — like watching a build log or CI pipeline.

### What It Looks Like

```
┌─────────────────────────────────────────────┐
│  You: Run payroll for March 2026            │
│                                             │
│  ┌─ Meza ──────────────────────────────────┐│
│  │  Running payroll for March 2026...      ││
│  │                                         ││
│  │  ✓ Fetched 12 active employees          ││
│  │  ✓ Loaded INSS rates (4% / 6%)         ││
│  │  ✓ Loaded WIT brackets ($500 threshold) ││
│  │  ● Calculating gross salary...          ││ ← spinner on current step
│  │                                         ││
│  │  ━━━━━━━━━━━━━━━━━━━░░░░░  3/7          ││ ← progress bar
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

When complete, the step log collapses and the final summary appears:

```
┌─────────────────────────────────────────────┐
│  ┌─ Meza ──────────────────────────────────┐│
│  │  ▶ Payroll calculation (7 steps)  0.8s  ││ ← collapsed, expandable
│  │                                         ││
│  │  March 2026 Payroll Summary             ││
│  │  ┌──────────────┬───────────┐           ││
│  │  │ Employees    │ 12        │           ││
│  │  │ Gross Pay    │ $8,450.00 │           ││
│  │  │ WIT          │ $295.00   │           ││
│  │  │ INSS (4%/6%) │ $338/$507 │           ││
│  │  │ Net Pay      │ $7,310.00 │           ││
│  │  └──────────────┴───────────┘           ││
│  │                                         ││
│  │  ⚠ João: 10 of 12 sick days used       ││
│  │                                         ││
│  │  Confirm to post?                       ││
│  │  [Confirm]  [Cancel]                    ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### Architecture: Server-Sent Events (SSE)

The current chat endpoint returns a single JSON response. We add a streaming variant that sends progress chunks as the bot works.

**New endpoint: `POST /api/tenants/:tenantId/chat-stream`**

```javascript
// Server-side (Meza API)
router.post('/:tenantId/chat-stream',
  authenticateFirebaseToken,
  requireTenant,
  chatLimiter,
  async (req, res) => {
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    // Step tracker — called by tool execution
    const onStep = (step) => {
      sendEvent('step', step);
    };

    try {
      // 1. Intent classification
      sendEvent('status', { content: 'Understanding your request...' });
      const intent = classifyChatIntent(message);

      // 2. Start OpenClaw call with step hooks
      sendEvent('status', { content: 'Working on it...' });
      const { reply, steps } = await openClawChatWithSteps(message, sessionKey, onStep);

      // 3. Send final response
      sendEvent('complete', { content: reply, steps });
    } catch (error) {
      sendEvent('error', { content: error.message });
    } finally {
      res.end();
    }
  }
);
```

**SSE event format:**

```typescript
// Progress events (sent as bot works)
{ type: "status",   content: "Understanding your request..." }
{ type: "step",     step: 1, total: 7, content: "Fetched 12 active employees", status: "done" }
{ type: "step",     step: 2, total: 7, content: "Loaded INSS rates", status: "done" }
{ type: "step",     step: 3, total: 7, content: "Calculating gross salary...", status: "running" }
{ type: "complete", content: "<full markdown response>", steps: [...] }
{ type: "error",    content: "Failed to calculate: fiscal period closed" }
```

### How Steps Get Generated

When the bot calls a tool (e.g., `calculate_payroll`), the tool execution wrapper emits step events. Two approaches:

**Approach A: Tool-level logging (simpler)**

Each tool registers its steps when it runs:

```typescript
api.registerTool({
  name: "calculate_payroll",
  // ...
  async execute(_id, params, context) {
    // context.emitStep is injected by the framework
    context.emitStep("Fetching active employees...");
    const employees = await callApi("/employees?status=active");

    context.emitStep(`Loaded ${employees.length} employees`);

    context.emitStep("Loading tax configuration...");
    const config = await callApi("/settings/payroll");

    context.emitStep("Calculating payroll...");
    const result = await callApi("/payroll/calculate", { method: "POST", body: params });

    context.emitStep(`Calculation complete — ${result.warnings.length} warnings`);
    return { content: [{ type: "text", text: formatResult(result) }] };
  },
});
```

**Approach B: API-level logging (works without OpenClaw changes)**

The Meza API write endpoints themselves emit progress. Since the chat endpoint *calls* the API internally, it can relay events:

```javascript
// In the /payroll/calculate endpoint:
router.post('/:tenantId/payroll/calculate', async (req, res) => {
  const steps = [];
  const log = (msg) => steps.push({ content: msg, timestamp: Date.now() });

  log('Fetching active employees...');
  const employees = await tenantCol(tenantId, 'employees')
    .where('status', '==', 'active').get();

  log(`Loaded ${employees.size} employees`);

  log('Loading payroll configuration...');
  // ...

  log('Running TL payroll calculations...');
  // ...

  log('Checking for warnings...');
  // ...

  res.json({ success: true, summary, records, warnings, steps });
});
```

The chat-stream endpoint then relays these steps to the frontend:

```javascript
// In chat-stream handler:
sendEvent('status', { content: 'Calculating payroll...' });
const calcResult = await callApiInternal(`/payroll/calculate`, { body: params });

// Relay the steps from the calculation
for (const step of calcResult.steps) {
  sendEvent('step', { content: step.content });
}
```

### Frontend: ChatPanel Changes

**Update `ChatMessage` type:**

```typescript
// stores/chatStore.ts
type StepStatus = 'pending' | 'running' | 'done' | 'error';

type ProgressStep = {
  content: string;
  status: StepStatus;
  timestamp?: number;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  // New fields for progress tracking
  isStreaming?: boolean;
  steps?: ProgressStep[];
  collapsed?: boolean;
  duration?: number;  // ms, set when complete
};
```

**Add streaming fetch:**

```typescript
// ChatPanel.tsx — replace the current fetch call
async function sendMessageStreaming(text: string) {
  const { addMessage, updateLastMessage } = useChatStore.getState();

  // Add user message
  addMessage({ role: 'user', text });

  // Add placeholder assistant message
  addMessage({ role: 'assistant', text: '', isStreaming: true, steps: [] });

  const res = await fetch(`${API_BASE}/api/tenants/${tenantId}/chat-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message: text, sessionKey }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const event = JSON.parse(line.slice(6));

      switch (event.type) {
        case 'status':
          updateLastMessage({ text: event.content, isStreaming: true });
          break;
        case 'step':
          updateLastMessage((prev) => ({
            steps: [...(prev.steps || []), { content: event.content, status: 'done' }],
          }));
          break;
        case 'complete':
          updateLastMessage({
            text: event.content,
            isStreaming: false,
            collapsed: true,
            duration: event.duration,
          });
          break;
        case 'error':
          updateLastMessage({ text: `Error: ${event.content}`, isStreaming: false });
          break;
      }
    }
  }
}
```

**Render the steps:**

```tsx
// ChatPanel.tsx — new StepLog component
function StepLog({ steps, collapsed, duration, onToggle }: {
  steps: ProgressStep[];
  collapsed: boolean;
  duration?: number;
  onToggle: () => void;
}) {
  if (!steps?.length) return null;

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ChevronRight className="h-3 w-3" />
        <span>{steps.length} steps</span>
        {duration && <span className="text-muted-foreground/60">{(duration / 1000).toFixed(1)}s</span>}
      </button>
    );
  }

  return (
    <div className="mb-3 space-y-1">
      <button onClick={onToggle} className="flex items-center gap-2 text-xs text-muted-foreground">
        <ChevronDown className="h-3 w-3" />
        <span>Steps</span>
      </button>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-xs ml-2">
          {step.status === 'done' ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : step.status === 'running' ? (
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          ) : (
            <Circle className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={step.status === 'running' ? 'text-foreground' : 'text-muted-foreground'}>
            {step.content}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### Fallback for Non-Streaming

If SSE isn't available (some corporate proxies block it), fall back to the current polling approach with a smarter loading state:

```tsx
// Instead of just "Thinking...", show a rotating set of contextual messages:
const THINKING_MESSAGES = {
  payroll: ["Calculating salaries...", "Checking tax rates...", "Running compliance checks..."],
  accounting: ["Checking accounts...", "Verifying balances...", "Reviewing entries..."],
  default: ["Looking into it...", "Checking the data...", "Almost there..."],
};
```

This gives the illusion of progress even without real-time streaming — it's better than a static spinner.

---

## Phase 5: Continuous Monitoring (Future)

### Scheduled Compliance Check

OpenClaw supports cron-based scheduling via its cron volume. Add a scheduled task that runs the compliance check tool daily:

```json
// In openclaw.json, under agents:
{
  "id": "monitor",
  "name": "Meza Monitor",
  "schedule": "0 8 * * *",  // Daily at 8am TL time
  "tools": { "allow": ["meza-hr"] },
  "systemPrompt": "You are a compliance monitor. Run run_compliance_check and report any issues."
}
```

### Alert Channels

- **Web dashboard**: Compliance issues shown as notifications in the chat widget
- **WhatsApp**: Critical alerts sent to configured admin numbers
- **Firestore**: Issues written to `tenants/{tid}/compliance_alerts` for dashboard display

### Smart Alerts (Not Just Dumb Triggers)

The bot doesn't just check "is X overdue" — it can reason about context:

```
Bot: "3 invoices are 45+ days overdue ($2,300 total).
  - INV-042 to TelcoTL ($1,200) — they paid the last 3 invoices within 60 days, probably just slow
  - INV-048 to BuildCo ($800) — this is their first invoice, might need a follow-up
  - INV-051 to GovMinistry ($300) — government clients typically pay within 90 days per your history

  Suggest: Send payment reminder for INV-048. The others are likely fine."
```

---

## Implementation Order

| Phase | What | Effort | Depends On |
|-------|------|--------|------------|
| **1a** | `callApi` POST/PUT support in plugin | 30 min | Nothing |
| **1b** | Payroll write endpoints (`calculate`, `runs`, `approve`) | 1 day | Nothing |
| **1c** | Accounting write endpoints (unblock JE POST, add `post`, `void`) | 1 day | Nothing |
| **1d** | Fiscal period write endpoints (`close`, `reopen`, `lock`) | 0.5 day | Nothing |
| **1e** | Leave approve/reject endpoints | 0.5 day | Nothing |
| **2a** | Write tools in plugin (payroll) | 0.5 day | 1a, 1b |
| **2b** | Write tools in plugin (accounting, fiscal, leave) | 0.5 day | 1a, 1c, 1d, 1e |
| **2c** | Update system prompt + confirmation flow | 0.5 day | 2a |
| **3a** | Verification endpoints (`verify/payroll`, `verify/trial-balance`) | 1 day | 1b, 1c |
| **3b** | Compliance check endpoint | 1 day | Nothing |
| **3c** | Verification tools in plugin | 0.5 day | 3a, 3b |
| **3d** | Agent loop system prompt (verify after every action) | 0.5 day | 3c |
| **4a** | SSE chat-stream endpoint on Meza API | 1 day | Nothing |
| **4b** | Step logging in write/verify endpoints | 0.5 day | 1b, 3a |
| **4c** | Frontend StepLog component + streaming fetch | 1 day | 4a |
| **4d** | Collapsible step history in messages | 0.5 day | 4c |
| **5** | Continuous monitoring (cron + alerts) | 1-2 days | 3b |
| **6** | Testing + hardening | 1-2 days | All |

**Total estimate: ~13-15 days of focused work**

### Suggested Starting Point

Start with **1a + 1b + 2a** (payroll calculate + run + plugin tools). This gives the most impressive demo:

> "Run payroll for March" → Bot calculates → Shows summary → User confirms → Bot posts → Verifies → Reports

The payroll `calculate` endpoint is the safest starting point because it doesn't write anything — it's a "dry run." You can test the entire flow (chat → intent → confirmation → calculation → response) without touching any data.

---

## Safety Mechanisms Summary

| Mechanism | Status | Where |
|-----------|--------|-------|
| **Confirmation flow** | Exists | `classifyChatIntent()` + `chat_pending` in Meza API |
| **Two-person rule** | Exists | `approvePayrollRun()` — approver ≠ creator |
| **Fiscal period enforcement** | Exists | `assertFiscalPeriodAllowsPosting()` |
| **Double-entry validation** | Exists | `createJournalEntry()` — debits must equal credits |
| **Audit trail** | Exists | Every action logged with severity, old/new values |
| **Reversing entries (void)** | Exists | `voidJournalEntry()` — swap debit/credit, never delete |
| **Rate limiting** | Exists | 120 req/min API, 30 req/15min chat |
| **Tenant isolation** | Exists | `ALLOWED_TENANT_ID` env var + path-based scoping |
| **API key auth** | Exists | `X-API-Key` header for bot |
| **Firebase token auth** | Exists | Bearer token for web users |
| **Self-verification** | NEW | `verify_payroll`, `check_trial_balance`, `run_compliance_check` |
| **Dry run mode** | NEW | `calculate_payroll` — calculates without writing |

---

## What Makes This Different From "AI Chatbot Does CRUD"

Most AI integrations are glorified form fillers: "Create an invoice for $500" → bot fills form → done.

This is different because:

1. **The bot checks its own work** — after every action, it verifies the output against accounting rules, tax law, and historical patterns. Like an auditor that runs after every transaction.

2. **Mistakes are mathematically detectable** — in accounting, you know something is wrong when debits ≠ credits or INSS base includes overtime. The bot can catch these programmatically, not just guess.

3. **Context-aware reasoning** — the bot doesn't just flag "gross pay increased 23%", it looks up *why* (3 new hires) and tells you whether it's expected or suspicious.

4. **Safe by default** — every action goes through confirmation, every write is audited, every mistake is reversible (void + re-post), and the bot verifies after every action.

5. **Gets smarter over time** — the compliance check tool can be expanded with new rules without changing the bot. Add "check for duplicate payments" or "verify INSS monthly filing" as new checks and the bot automatically includes them.
