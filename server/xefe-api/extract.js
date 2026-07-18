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
 * The model gets exactly ONE tool: Read, pointed at the uploaded temp file.
 * It never writes anything — the human confirms the extracted fields in the
 * form before any document is created.
 */

const EXTRACT_MODEL = process.env.XEFE_EXTRACT_MODEL || 'claude-sonnet-5';
const TIMEOUT_MS = Math.max(20_000, Number(process.env.XEFE_EXTRACT_TIMEOUT_MS) || 90_000);

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
    '  "documentType": "bill" | "receipt" | "other",',
    '  "vendorName": string | null,          // the SELLER/supplier on the document, not the customer',
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
    `- Today is ${todayIso}; resolve ambiguous dates sensibly (DD/MM/YYYY is the local convention).`,
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
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null);
  const num = (v) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);
  const date = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return {
    documentType: ['bill', 'receipt'].includes(raw.documentType) ? raw.documentType : 'other',
    vendorName: str(raw.vendorName),
    billNumber: str(raw.billNumber),
    billDate: date(raw.billDate),
    dueDate: date(raw.dueDate),
    amount: num(raw.amount),
    taxAmount: num(raw.taxAmount),
    currency: str(raw.currency),
    description: str(raw.description),
    category: CATEGORIES.includes(raw.category) ? raw.category : 'other',
    confidence: typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0,
  };
}

async function runOnce(filePath, kind, token) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), TIMEOUT_MS);
  const todayIso = new Date().toISOString().slice(0, 10);

  const options = {
    model: EXTRACT_MODEL,
    maxTurns: 6,
    systemPrompt: SYSTEM_PROMPT,
    allowedTools: ['Read'],
    disallowedTools: BUILTIN_DENY,
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

module.exports = { extractDocumentFields };
