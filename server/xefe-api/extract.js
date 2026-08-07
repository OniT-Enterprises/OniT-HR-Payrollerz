/**
 * AI document extraction — reads a supplier bill / receipt (photo or PDF)
 * and returns structured fields for pre-filling the Bill/Expense forms.
 *
 * Runs the Claude Agent SDK directly (no OpenClaw): auth is a Claude Code
 * OAuth subscription token (CLAUDE_CODE_OAUTH_TOKEN, optional _FALLBACK for
 * account failover), NOT a metered API key — same pattern as
 * timorleste.tl/lib/claude-client.ts. The SDK spawns the `claude` CLI, which
 * must be installed on the host (present at /usr/bin/claude on Hetzner).
 *
 * The model gets exactly ONE tool: Read, HARD-SANDBOXED to the uploaded file's
 * own temp directory (see runOnce). The document itself is attacker-controlled
 * (a supplier's bill/receipt), so a booby-trapped file must never be able to
 * turn Read into "read /opt/xefe-api/serviceAccountKey.json". It never writes
 * anything — the human confirms the extracted fields in the form before any
 * document is created.
 */

const path = require('path');

const EXTRACT_MODEL = process.env.XEFE_EXTRACT_MODEL || 'claude-sonnet-5';
const TIMEOUT_MS = Math.max(20_000, Number(process.env.XEFE_EXTRACT_TIMEOUT_MS) || 90_000);
// Normalising a spreadsheet is a batch job, not a single-document read: one
// chunk of a wide timesheet matrix can expand into hundreds of rows. A real
// 30-day x 30-employee sheet aborted at the 90s document timeout and imported
// nothing, so the table path gets its own, longer ceiling.
const TABLE_TIMEOUT_MS = Math.max(TIMEOUT_MS, Number(process.env.XEFE_EXTRACT_TABLE_TIMEOUT_MS) || 180_000);

// Matches the category options in the Bill/Expense forms (client CATEGORIES).
const CATEGORIES = [
  'rent', 'utilities', 'supplies', 'equipment', 'transport', 'fuel', 'meals',
  'professional_services', 'insurance', 'taxes_licenses', 'marketing',
  'communication', 'maintenance', 'other',
];

const SYSTEM_PROMPT =
  'You extract structured data from business documents. Follow the instructions ' +
  'in the user message exactly. Your final reply must be a single JSON object ' +
  'and nothing else — no prose, no code fences.';

const BUILTIN_DENY = [
  'Bash', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'NotebookEdit', 'TodoWrite', 'Task', 'SlashCommand', 'ExitPlanMode',
];

function buildPrompt(filePath, kind, todayIso) {
  return [
    `Read the file at ${filePath} — it is a ${kind === 'expense' ? 'receipt or supplier document' : 'supplier bill/invoice'} ` +
    'uploaded by a small business in Timor-Leste (documents may be in English, Portuguese, Tetun, or Indonesian; amounts are usually USD).',
    '',
    'Extract what the document actually shows and reply with ONLY this JSON object:',
    '{',
    '  "documentType": "bill" | "receipt" | "payment_proof" | "other",',
    '                                        // A PAYSLIP is never a bill or receipt. Wages are',
    '                                        // owned by payroll, so a "Recibo de Vencimento",',
    '                                        // "Recibo de Salário", payslip or salary advice is',
    '                                        // "other" — booking one as an expense would',
    '                                        // double-count wages and make a vendor of an employee.',
    '                                        // payment_proof = a BANK document evidencing a payment',
    '                                        // (transfer slip, "Comprovativo"/"Contas à Ordem - Movimentos",',
    '                                        // ATM "LEVANTAMENTO" slip) rather than a seller\'s invoice',
    '  "vendorName": string | null,          // the SELLER/supplier on the document, not the customer',
    '  "vendorTaxId": string | null,          // the SELLER\'s tax number: NIF/TIN in Timor-Leste,',
    '                                        // NPWP in Indonesia, NIF/NIPC in Portugal. Never the customer\'s.',
    '  "billNumber": string | null,          // invoice/receipt number',
    '  "billDate": "YYYY-MM-DD" | null,      // document/issue date',
    '  "dueDate": "YYYY-MM-DD" | null,       // payment due date if stated',
    `  "amount": number | null,              // grand total payable, including tax`,
    '  "taxAmount": number | null,           // tax portion if itemized',
    '  "currency": string | null,            // e.g. "USD"',
    '  "description": string | null,         // one short line: what was purchased',
    `  "category": one of ${JSON.stringify(CATEGORIES)},`,
    '  "confidence": number                  // 0..1 — how sure you are overall',
    '}',
    '',
    'Rules:',
    '- Use null for anything not on the document. Never invent values.',
    `- Today is ${todayIso}; DD/MM/YYYY is the local convention, so 06/11/${todayIso.slice(0, 4)} is 6 November.`,
    '- A document cannot be dated in the future. If your reading of the date lands after'
      + ` ${todayIso}, you have the day and month the wrong way round — swap them.`,
    '- Amounts are plain numbers (no currency symbols, no thousands separators).',
    '- If the file is not a bill/receipt at all (or unreadable), return {"documentType":"other","confidence":0} with nulls.',
  ].join('\n');
}

// The agent SDK is ESM; this file is CJS. Load lazily on first use.
let _query = null;
async function loadQuery() {
  if (_query) return _query;
  const mod = await import('@anthropic-ai/claude-agent-sdk');
  _query = mod.query;
  return _query;
}

function resolveOauthTokens() {
  const ordered = [
    process.env.CLAUDE_CODE_OAUTH_TOKEN,
    process.env.CLAUDE_CODE_OAUTH_TOKEN_FALLBACK,
  ].filter((token) => typeof token === 'string' && token.length > 0);
  return Array.from(new Set(ordered));
}

function envWithToken(token) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value;
  }
  env.CLAUDE_CODE_OAUTH_TOKEN = token;
  // Make sure a metered key never shadows the subscription token.
  delete env.ANTHROPIC_API_KEY;
  return env;
}

function parseJsonReply(text) {
  const trimmed = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in model reply');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function sanitizeFields(raw) {
  // Control characters have no place in a vendor name or a description, and they
  // are what lets one extracted value break into another cell/row once the bill
  // is exported (see client/lib/csvExport.ts). Strip them at the boundary.
  const str = (v) => {
    if (typeof v !== 'string') return null;
    const cleaned = v.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned.slice(0, 300) : null;
  };
  const num = (v) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);
  // isRealCalendarDate, not just the shape: 2026-02-31 matches the regex.
  const date = (v) => (isRealCalendarDate(v) ? v : null);
  // A tax number is short and structured; anything else is a misread.
  const taxId = (v) => {
    const cleaned = str(v);
    if (!cleaned) return null;
    const compact = cleaned.replace(/[^0-9A-Za-z.\-/ ]/g, '').trim().slice(0, 40);
    return /\d/.test(compact) ? compact : null;
  };
  return {
    documentType: ['bill', 'receipt', 'payment_proof'].includes(raw.documentType)
      ? raw.documentType
      : 'other',
    vendorName: str(raw.vendorName),
    vendorTaxId: taxId(raw.vendorTaxId),
    billNumber: str(raw.billNumber),
    billDate: date(raw.billDate),
    dueDate: date(raw.dueDate),
    amount: num(raw.amount),
    taxAmount: num(raw.taxAmount),
    currency: str(raw.currency),
    description: str(raw.description),
    category: CATEGORIES.includes(raw.category) ? raw.category : 'other',
    // Number.isFinite, not typeof: NaN is a number, and a NaN confidence would
    // pass every `confidence < threshold` check in the forms (NaN comparisons are
    // all false), so an unreadable document would prefill as a confident one.
    confidence: Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, raw.confidence)) : 0,
  };
}

async function runOnce(filePath, kind, token) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), TIMEOUT_MS);
  const todayIso = new Date().toISOString().slice(0, 10);

  // ── Hard-sandbox the Read tool to the uploaded document's own temp dir ──
  // The document content is attacker-controlled, so it could try to prompt-inject
  // "Read /opt/xefe-api/serviceAccountKey.json". Two independent guards close that:
  //   1. Relocate the agent workspace to the temp dir (cwd + additionalDirectories)
  //      so the process CWD (/opt/xefe-api on prod, where the secrets live) is no
  //      longer in scope; combined with permissionMode 'dontAsk', any read outside
  //      the workspace is auto-denied rather than prompted.
  //   2. canUseTool: deny every tool except a Read whose resolved path stays inside
  //      that temp dir — an explicit, code-level backstop independent of the SDK's
  //      directory heuristics.
  const allowedDir = path.resolve(path.dirname(filePath));
  const isInsideAllowedDir = (candidate) => {
    if (typeof candidate !== 'string' || candidate.length === 0) return false;
    const resolved = path.resolve(candidate);
    return resolved === allowedDir || resolved.startsWith(allowedDir + path.sep);
  };

  const options = {
    model: EXTRACT_MODEL,
    maxTurns: 6,
    systemPrompt: SYSTEM_PROMPT,
    // NO bare `allowedTools: ['Read']` here. A bare entry auto-approves the
    // whole tool BEFORE the workspace check and before canUseTool, which
    // defeated both guards below: a probe confirmed the model could then read a
    // file outside the temp dir entirely (the SDK also warns about this as
    // CLAUDE_SDK_CAN_USE_TOOL_SHADOWED). With the allow-list omitted, Read
    // inside the relocated workspace still works and reads outside it are
    // denied. Adding it back re-opens an arbitrary-file-read from an
    // attacker-controlled document.
    disallowedTools: BUILTIN_DENY,
    permissionMode: 'dontAsk',
    settingSources: [],
    cwd: allowedDir,
    additionalDirectories: [allowedDir],
    canUseTool: async (toolName, input) => {
      if (toolName !== 'Read') {
        return { behavior: 'deny', message: 'Only reading the uploaded document is permitted.' };
      }
      const requested = input && (input.file_path || input.path || input.filePath || input.notebook_path);
      if (!isInsideAllowedDir(requested)) {
        return { behavior: 'deny', message: 'Reading files outside the uploaded document is not permitted.' };
      }
      return { behavior: 'allow', updatedInput: input };
    },
    abortController,
    env: envWithToken(token),
    ...(process.env.CLAUDE_CODE_EXECUTABLE
      ? { pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_EXECUTABLE }
      : {}),
  };

  const query = await loadQuery();
  try {
    for await (const message of query({ prompt: buildPrompt(filePath, kind, todayIso), options })) {
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          const usage = message.usage;
          console.log(
            `[extract] ok model=${EXTRACT_MODEL} in=${usage?.input_tokens ?? 0} out=${usage?.output_tokens ?? 0} ` +
            `dur=${Math.round((message.duration_ms ?? 0) / 1000)}s`,
          );
          return typeof message.result === 'string' ? message.result : '';
        }
        throw new Error((message.errors ?? []).join('; ') || message.subtype);
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return '';
}

/**
 * Extract structured fields from a bill/receipt file on disk.
 * @param {string} filePath absolute path to the uploaded temp file
 * @param {'bill'|'expense'} kind which form the extraction is for
 */
async function extractDocumentFields(filePath, kind) {
  const tokens = resolveOauthTokens();
  if (tokens.length === 0) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN is not configured on the server');
  }

  let lastError = null;
  for (let i = 0; i < tokens.length; i++) {
    const isLast = i === tokens.length - 1;
    try {
      const text = await runOnce(filePath, kind, tokens[i]);
      if (text) return sanitizeFields(parseJsonReply(text));
      if (isLast) throw new Error('Model returned empty output from all accounts (usage limit?)');
      console.warn(`[extract] account ${i + 1}/${tokens.length} returned empty output; failing over`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isLast) throw lastError;
      console.warn(`[extract] account ${i + 1}/${tokens.length} failed (${lastError.message}); failing over`);
    }
  }
  throw lastError ?? new Error('Extraction produced no response');
}

// ── Messy-table normalization ────────────────────────────────────────────
// Turns an arbitrary spreadsheet/CSV export (fingerprint devices, hand-made
// sheets, any column names/date formats) into rows of a fixed schema. The
// model only NORMALIZES formatting — matching rows to real employee records
// stays deterministic in the client.

/**
 * A strict `YYYY-MM-DD` calendar date. The regex alone accepts 2024-02-31, which
 * would become an attendance day that does not exist.
 */
function isRealCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

const TABLE_KINDS = {
  attendance: {
    maxRows: 1000,
    prompt: (tableText, todayIso) => [
      'Below is a raw spreadsheet export of employee attendance / clock times from a',
      'Timor-Leste small business (any layout, any language, possibly extra header or',
      'summary rows, dates in any format, times in any format).',
      '',
      'Normalize it and reply with ONLY a JSON array. One object per attendance row:',
      '[{',
      '  "employee": string,        // the employee identifier or full name EXACTLY as written in the sheet',
      '  "date": "YYYY-MM-DD",',
      '  "clockIn": "HH:MM",        // 24-hour',
      '  "clockOut": "HH:MM" | null',
      '}]',
      '',
      'Rules:',
      '- Skip summary/total/blank rows and rows without a usable date or clock-in time.',
      `- Today is ${todayIso}; DD/MM/YYYY is the local date convention.`,
      '- Convert AM/PM and decimal times ("7.30am", "17h05") to 24-hour HH:MM.',
      '- If one row holds multiple punches, first punch = clockIn, last = clockOut.',
      '- LAYOUT: the sheet may be a WIDE MATRIX instead of one row per record —',
      '  employee names spread ACROSS the columns (often in repeating groups of',
      '  "Start / Finish / Hours"), with the days of the month running DOWN the rows.',
      '  Read the header rows to learn which employee owns which column group, then',
      '  emit ONE object per employee per day that has a start time. Ignore a',
      '  computed "Hours" column — clockIn and clockOut are what is wanted.',
      '- The month and year may only appear in a header row or the sheet name rather',
      '  than on each row; use them to complete a day-only date like "3" or "Monday 3".',
      '- Do not invent rows or values. Reply with [] if nothing usable.',
      '',
      '--- SPREADSHEET START ---',
      tableText,
      '--- SPREADSHEET END ---',
    ].join('\n'),
    sanitizeRow: (row) => {
      const employee = typeof row.employee === 'string' ? row.employee.trim().slice(0, 120) : '';
      const date = isRealCalendarDate(row.date) ? row.date : '';
      // These rows become attendance, then hours, then pay, and the client pushes
      // them in without re-checking (client/pages/time-leave/Attendance.tsx), so
      // an impossible time must be DROPPED here, never repaired. Clamping 25:30
      // to 23:30 would invent a night shift the sheet never showed; letting 12:99
      // through would put 99 minutes into an hours calculation.
      const time = (v) => {
        if (typeof v !== 'string') return '';
        const m = v.trim().match(/^(\d{1,2}):(\d{2})/);
        if (!m) return '';
        const hours = parseInt(m[1], 10);
        const minutes = parseInt(m[2], 10);
        if (hours > 23 || minutes > 59) return '';
        return `${String(hours).padStart(2, '0')}:${m[2]}`;
      };
      const clockIn = time(row.clockIn);
      if (!employee || !date || !clockIn) return null;
      return { employee, date, clockIn, clockOut: time(row.clockOut) || null };
    },
  },
};

function parseJsonArrayReply(text) {
  const trimmed = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start === -1 || end <= start) throw new Error('No JSON array in model reply');
  const parsed = JSON.parse(trimmed.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Model reply is not an array');
  return parsed;
}

async function runTextOnce(prompt, token) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), TABLE_TIMEOUT_MS);
  const options = {
    model: EXTRACT_MODEL,
    maxTurns: 1,
    systemPrompt: SYSTEM_PROMPT,
    allowedTools: [],
    disallowedTools: [...BUILTIN_DENY, 'Read'],
    permissionMode: 'dontAsk',
    settingSources: [],
    abortController,
    env: envWithToken(token),
    ...(process.env.CLAUDE_CODE_EXECUTABLE
      ? { pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_EXECUTABLE }
      : {}),
  };
  const query = await loadQuery();
  try {
    for await (const message of query({ prompt, options })) {
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          const usage = message.usage;
          console.log(
            `[extract-table] ok model=${EXTRACT_MODEL} in=${usage?.input_tokens ?? 0} out=${usage?.output_tokens ?? 0} ` +
            `dur=${Math.round((message.duration_ms ?? 0) / 1000)}s`,
          );
          return typeof message.result === 'string' ? message.result : '';
        }
        throw new Error((message.errors ?? []).join('; ') || message.subtype);
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return '';
}

/**
 * Normalize a messy spreadsheet/CSV text into rows of a fixed schema.
 * @param {string} tableText raw table text (CSV or TSV), capped by the route
 * @param {'attendance'} kind which schema to normalize into
 */
async function extractTableRows(tableText, kind) {
  const spec = TABLE_KINDS[kind];
  if (!spec) throw new Error(`Unknown table kind: ${kind}`);

  const tokens = resolveOauthTokens();
  if (tokens.length === 0) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN is not configured on the server');
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  const prompt = spec.prompt(tableText, todayIso);

  let lastError = null;
  for (let i = 0; i < tokens.length; i++) {
    const isLast = i === tokens.length - 1;
    try {
      const text = await runTextOnce(prompt, tokens[i]);
      if (text) {
        const rows = parseJsonArrayReply(text)
          .slice(0, spec.maxRows)
          .map((row) => spec.sanitizeRow(row))
          .filter(Boolean);
        return rows;
      }
      if (isLast) throw new Error('Model returned empty output from all accounts (usage limit?)');
      console.warn(`[extract-table] account ${i + 1}/${tokens.length} returned empty output; failing over`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isLast) throw lastError;
      console.warn(`[extract-table] account ${i + 1}/${tokens.length} failed (${lastError.message}); failing over`);
    }
  }
  throw lastError ?? new Error('Table extraction produced no response');
}

// sanitizeFields and parseJsonReply are the boundary against hostile model
// output (the document being read is attacker-controlled), so they are
// exported for test/extract-sanitize.test.mjs.
module.exports = {
  extractDocumentFields, extractTableRows, sanitizeFields, parseJsonReply,
  sanitizeAttendanceRow: TABLE_KINDS.attendance.sanitizeRow,
  isRealCalendarDate,
};
