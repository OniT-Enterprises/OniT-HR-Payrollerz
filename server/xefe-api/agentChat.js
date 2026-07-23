/**
 * XefeBot web chat on the Claude Agent SDK — replaces the OpenClaw gateway
 * for the in-app chat (and /ai/compose). Runs in-process on xefe-api:
 *
 *  - Auth: Claude subscription OAuth (CLAUDE_CODE_OAUTH_TOKEN, optional
 *    _FALLBACK failover) — same as extract.js. No metered API key.
 *  - Tools: ONE SDK-MCP tool, `get_data`, which performs GET requests against
 *    this same server's read-only tenant API (X-API-Key auth, loopback only).
 *    The tenant id is pinned server-side per request — a model-supplied path
 *    can never reach another tenant. This replaces OpenClaw's 29 tools and
 *    removes the single-tenant OPENCLAW_WEB_TENANT_ID restriction: every
 *    tenant gets a working XefeBot.
 *  - Read-only: v1 makes no data changes; write intents get a polite decline.
 *  - Sessions: short in-memory history per (tenantId, sessionKey), 1h TTL.
 */

const CHAT_MODEL = process.env.XEFE_CHAT_MODEL || 'claude-sonnet-5';
const CHAT_TIMEOUT_MS = Math.max(30_000, Number(process.env.XEFE_CHAT_TIMEOUT_MS) || 110_000);
const SELF_BASE = `http://127.0.0.1:${process.env.PORT || 3201}`;

// Read-only endpoint catalog (mirrors the GET routes mounted under
// /api/tenants/:tenantId in index.js). Shown to the model; also used as an
// allowlist for the first path segment.
const ENDPOINT_CATALOG = `
Staff: /employees?status=active|inactive&department=<id>&limit=N · /employees/counts ·
/employees/by-department · /employees/<id> · /departments · /stats
Payroll: /payroll/runs?limit=N · /payroll/runs/<YYYYMM> · /payroll/runs/<YYYYMM>/payslips
Leave: /leave/pending · /leave/balances?year=YYYY · /leave/requests?limit=N ·
/leave/on-leave-today
Attendance: /attendance/daily?date=YYYY-MM-DD
Hiring: /jobs · /jobs/open · /job-applications · /job-applications/pending ·
/interviews · /interviews/today · /interviews/upcoming · /onboarding
Money: /invoices · /invoices/overdue · /bills · /bills/overdue · /expenses ·
/expenses/this-month
Accounting: /accounts · /journal-entries?limit=N · /trial-balance ·
/reports/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD · /reports/balance-sheet ·
/verify/compliance · /verify/trial-balance
`.trim();

const ALLOWED_FIRST_SEGMENTS = new Set([
  'employees', 'departments', 'stats', 'payroll', 'leave', 'attendance',
  'jobs', 'job-applications', 'interviews', 'onboarding', 'invoices', 'bills',
  'expenses', 'accounts', 'journal-entries', 'journals', 'trial-balance',
  'reports', 'verify', 'fiscal-years',
]);

// Per-endpoint-area RBAC. The agent reads through an unrestricted internal
// service credential, so WITHOUT this it would be a confused deputy: any tenant
// member (even a viewer/manager the app denies finance access) could ask the bot
// for payslips, journals, or PII. Each endpoint area maps to the same module the
// web/firestore.rules gate it behind; the bot must honor the caller's modules.
// null = no module required (e.g. health/verify).
const ENDPOINT_AREA_MODULE = {
  employees: 'staff', departments: 'staff', stats: 'staff',
  leave: 'timeleave', attendance: 'timeleave',
  jobs: 'hiring', 'job-applications': 'hiring', interviews: 'hiring', onboarding: 'hiring',
  payroll: 'payroll',
  invoices: 'money', bills: 'money', expenses: 'money',
  accounts: 'accounting', 'journal-entries': 'accounting', journals: 'accounting',
  'trial-balance': 'accounting', 'fiscal-years': 'accounting',
  reports: 'reports',
  // 'verify' is NOT ungated: its sub-areas return the same payroll/accounting/
  // PII data as the gated areas above, so they resolve by second segment via
  // VERIFY_AREA_MODULE below. Unknown verify paths fail closed.
};

// The /verify/* family mirrors finance data and must honor the same modules.
const VERIFY_AREA_MODULE = {
  payroll: 'payroll',
  'trial-balance': 'accounting',
  compliance: 'staff',
};

// Mirrors client/types/tenant.ts DEFAULT_ROLE_PERMISSIONS — the effective
// modules a role has when a member carries no explicit per-member module list.
const DEFAULT_ROLE_MODULES = {
  owner: ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'money', 'accounting', 'reports'],
  'hr-admin': ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'money', 'accounting', 'reports'],
  accountant: ['staff', 'timeleave', 'payroll', 'money', 'accounting', 'reports'],
  manager: ['staff', 'timeleave', 'performance'],
  viewer: [],
  superadmin: ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'money', 'accounting', 'reports'],
};

// Whether the caller (req.tenantAccess) may read a given endpoint area.
function accessAllowsEndpoint(access, endpoint) {
  const segments = String(endpoint).slice(1).split(/[/?]/);
  const first = segments[0];
  let required;
  if (first === 'verify') {
    // Resolve by the second segment; an unmapped verify path is denied.
    required = VERIFY_AREA_MODULE[segments[1]];
    if (required === undefined) return false;
  } else {
    required = ENDPOINT_AREA_MODULE[first];
  }
  if (required === null || required === undefined) return true; // ungated area
  if (!access) return false; // fail closed if access wasn't threaded through
  if (access.isSuperAdmin || access.role === 'owner' || access.role === 'hr-admin') return true;
  const effective = (Array.isArray(access.modules) && access.modules.length > 0)
    ? access.modules
    : (DEFAULT_ROLE_MODULES[access.role] || []);
  return effective.includes(required);
}

const STEP_LABELS = [
  [/^\/(employees|departments|stats)/, 'Checking your team'],
  [/^\/payroll/, 'Checking payroll'],
  [/^\/leave/, 'Checking leave'],
  [/^\/attendance/, 'Checking attendance'],
  [/^\/(jobs|job-applications|interviews|onboarding)/, 'Checking hiring'],
  [/^\/(invoices|bills|expenses)/, 'Checking money records'],
  [/^\/(accounts|journal|trial-balance|reports|verify|fiscal)/, 'Checking the books'],
];

function stepLabelFor(endpoint) {
  for (const [re, label] of STEP_LABELS) {
    if (re.test(endpoint)) return label;
  }
  return 'Looking up your data';
}

let _sdk = null;
async function loadSdk() {
  if (_sdk) return _sdk;
  _sdk = await import('@anthropic-ai/claude-agent-sdk');
  return _sdk;
}

function agentChatEnabled() {
  return Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN);
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
  delete env.ANTHROPIC_API_KEY;
  return env;
}

// ── In-memory session history ────────────────────────────────────────────
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 12;
const sessions = new Map(); // `${tenantId}::${sessionKey}` -> { at, messages: [{role, text}] }

// Session history is keyed by tenant + USER + sessionKey. userId is essential:
// sessionKey comes from the client body, so without the uid one member could
// pass another member's sessionKey and read their conversation history within
// the tenant. 'anon' only occurs if a caller fails to thread the uid.
function sessionId(tenantId, userId, sessionKey) {
  return `${tenantId}::${userId || 'anon'}::${sessionKey || 'default'}`;
}

function sessionEntry(tenantId, userId, sessionKey) {
  const id = sessionId(tenantId, userId, sessionKey);
  const now = Date.now();
  for (const [key, value] of sessions) {
    if (now - value.at > SESSION_TTL_MS) sessions.delete(key);
  }
  if (!sessions.has(id)) sessions.set(id, { at: now, messages: [] });
  const entry = sessions.get(id);
  entry.at = now;
  return entry;
}

function rememberTurn(tenantId, userId, sessionKey, userText, assistantText) {
  const entry = sessionEntry(tenantId, userId, sessionKey);
  entry.messages.push({ role: 'user', text: userText.slice(0, 1500) });
  entry.messages.push({ role: 'assistant', text: assistantText.slice(0, 1500) });
  if (entry.messages.length > MAX_HISTORY_MESSAGES) {
    entry.messages.splice(0, entry.messages.length - MAX_HISTORY_MESSAGES);
  }
}

function clearSession(tenantId, userId, sessionKey) {
  sessions.delete(sessionId(tenantId, userId, sessionKey));
}

// ── Tool: tenant-pinned read-only data access ────────────────────────────
function validateEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('/')) return 'Endpoint must start with /';
  if (endpoint.includes('..') || endpoint.includes('//') || /\s/.test(endpoint)) return 'Invalid endpoint';
  // Reject percent-encoded dot/slash/backslash. A literal ".." is caught above,
  // but the WHATWG URL parser also collapses %2e%2e (and %2f / %5c) once the
  // string reaches fetch(), which would rewrite the pinned tenant prefix and
  // reach another tenant. Block the encoded forms before they get there.
  if (/%2e|%2f|%5c/i.test(endpoint)) return 'Invalid endpoint';
  const first = endpoint.slice(1).split(/[/?]/)[0];
  if (!ALLOWED_FIRST_SEGMENTS.has(first)) return `Unknown endpoint area "${first}" — see the catalog in your instructions`;
  return null;
}

async function buildXefeMcpServer(tenantId, onToolCall, access) {
  const { tool, createSdkMcpServer } = await loadSdk();
  const { z } = require('zod');

  const getData = tool(
    'get_data',
    'Read data from the Xefe HR/payroll system for this business. GET-only. ' +
      'Pass a relative endpoint from the catalog in your instructions, e.g. ' +
      '"/employees?status=active" or "/payroll/runs?limit=3".',
    { endpoint: z.string() },
    async ({ endpoint }) => {
      const problem = validateEndpoint(endpoint);
      if (problem) {
        return { content: [{ type: 'text', text: `Error: ${problem}` }], isError: true };
      }
      // Enforce the caller's module access — the internal credential below is
      // unrestricted, so this is the only thing stopping the bot from reading
      // data the signed-in member is not allowed to see (payslips, financials,
      // PII). Refuse rather than fetch when the member lacks the module.
      if (!accessAllowsEndpoint(access, endpoint)) {
        return {
          content: [{ type: 'text', text:
            'Error: you do not have access to this information in Xefe. ' +
            'Ask an owner or admin if you need it.' }],
          isError: true,
        };
      }
      onToolCall?.(endpoint);
      try {
        const { INTERNAL_AGENT_KEY } = require('./internalAuth');
        // Resolve the final URL and confirm it still points inside this
        // tenant's namespace after the parser normalizes the path. This is the
        // backstop for any traversal that slips past validateEndpoint.
        const target = new URL(`${SELF_BASE}/api/tenants/${tenantId}${endpoint}`);
        if (!target.pathname.startsWith(`/api/tenants/${tenantId}/`)) {
          return {
            content: [{ type: 'text', text: 'Error: invalid endpoint' }],
            isError: true,
          };
        }
        const response = await fetch(target, {
          headers: { 'X-Internal-Agent-Key': INTERNAL_AGENT_KEY },
        });
        const text = await response.text();
        if (!response.ok) {
          return {
            content: [{ type: 'text', text: `HTTP ${response.status}: ${text.slice(0, 500)}` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: text.slice(0, 40_000) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Request failed: ${error.message}` }], isError: true };
      }
    },
  );

  return createSdkMcpServer({ name: 'xefe', version: '1.0.0', tools: [getData] });
}

// ── Prompts ───────────────────────────────────────────────────────────────
function systemPrompt(tenantId) {
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dili' });
  return [
    'You are XefeBot, the assistant inside Xefe — an HR, payroll and accounting app for small businesses in Timor-Leste.',
    `You are answering for one business (tenant "${tenantId}"). Today is ${todayIso} (Timor-Leste). Currency is USD.`,
    '',
    'Use the mcp__xefe__get_data tool to look up real data before answering questions about the business. Available endpoints:',
    ENDPOINT_CATALOG,
    '',
    'Rules:',
    '- Reply in the language the user writes in (English, Portuguese, or Tetun).',
    '- Be concise and friendly. Summarize — never dump raw JSON.',
    '- Format money as $1,234.56 and dates like 25 Jul 2026.',
    '- You are READ-ONLY. If asked to change, create, approve, or delete anything, explain politely that you can only look things up, and point to the right screen in Xefe to do it.',
    '- If a lookup fails or returns nothing, say so honestly.',
  ].join('\n');
}

function buildPrompt(tenantId, userId, sessionKey, message) {
  const { messages } = sessionEntry(tenantId, userId, sessionKey);
  if (messages.length === 0) return message;
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'XefeBot'}: ${m.text}`)
    .join('\n');
  return `Earlier in this conversation:\n${transcript}\n\nUser: ${message}`;
}

// ── Core runner ───────────────────────────────────────────────────────────
async function runOnce({ tenantId, prompt, token, onEvent, access }) {
  const { query } = await loadSdk();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), CHAT_TIMEOUT_MS);

  const activeSteps = [];
  const mcpServer = await buildXefeMcpServer(tenantId, (endpoint) => {
    const label = stepLabelFor(endpoint);
    if (!activeSteps.includes(label)) {
      activeSteps.push(label);
      onEvent?.({ type: 'step', content: label, status: 'active' });
    }
  }, access);

  const options = {
    model: CHAT_MODEL,
    maxTurns: 12,
    systemPrompt: systemPrompt(tenantId),
    mcpServers: { xefe: mcpServer },
    allowedTools: ['mcp__xefe__get_data'],
    disallowedTools: [
      'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
      'NotebookEdit', 'TodoWrite', 'Task', 'SlashCommand', 'ExitPlanMode',
    ],
    permissionMode: 'dontAsk',
    includePartialMessages: true,
    settingSources: [],
    abortController,
    env: envWithToken(token),
    ...(process.env.CLAUDE_CODE_EXECUTABLE
      ? { pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_EXECUTABLE }
      : {}),
  };

  let buf = '';
  let emitted = false;
  try {
    for await (const m of query({ prompt, options })) {
      if (m.type === 'stream_event') {
        const ev = m.event;
        if (
          ev?.type === 'content_block_delta' &&
          ev.delta?.type === 'text_delta' &&
          typeof ev.delta.text === 'string' &&
          ev.delta.text.length > 0
        ) {
          for (const label of activeSteps.splice(0)) {
            onEvent?.({ type: 'step', content: label, status: 'done' });
          }
          buf += ev.delta.text;
          emitted = true;
          onEvent?.({ type: 'chunk', content: ev.delta.text });
        }
        continue;
      }
      if (m.type === 'result') {
        if (m.subtype === 'success') {
          const u = m.usage;
          console.log(
            `[agent-chat] ok model=${CHAT_MODEL} in=${u?.input_tokens ?? 0} out=${u?.output_tokens ?? 0} ` +
              `cacheRead=${u?.cache_read_input_tokens ?? 0} dur=${Math.round((m.duration_ms ?? 0) / 1000)}s`,
          );
          const result = typeof m.result === 'string' ? m.result.trim() : '';
          return { text: buf.trim() || result, emitted };
        }
        throw new Error((m.errors ?? []).join('; ') || m.subtype);
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return { text: buf.trim(), emitted };
}

/**
 * Run one XefeBot chat turn. Emits ChatPanel SSE events via onEvent
 * ({type: status|step|chunk|complete|error}) and returns the final text.
 */
async function runAgentChat({ tenantId, message, sessionKey, onEvent, access, userId }) {
  const tokens = resolveOauthTokens();
  if (tokens.length === 0) throw new Error('Agent chat is not configured');

  onEvent?.({ type: 'status', content: 'Thinking...' });
  const prompt = buildPrompt(tenantId, userId, sessionKey, message);

  let lastError = null;
  for (let i = 0; i < tokens.length; i++) {
    const isLast = i === tokens.length - 1;
    try {
      const { text, emitted } = await runOnce({ tenantId, prompt, token: tokens[i], onEvent, access });
      if (text) {
        rememberTurn(tenantId, userId, sessionKey, message, text);
        onEvent?.({ type: 'complete', content: text });
        return text;
      }
      if (emitted) {
        onEvent?.({ type: 'complete', content: text || "Sorry, I couldn't generate a response." });
        return text;
      }
      if (isLast) throw new Error('Empty response from all accounts (usage limit?)');
      console.warn(`[agent-chat] account ${i + 1}/${tokens.length} empty; failing over`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isLast) {
        onEvent?.({ type: 'error', content: 'XefeBot is having trouble right now — please try again.' });
        throw lastError;
      }
      console.warn(`[agent-chat] account ${i + 1}/${tokens.length} failed (${lastError.message}); failing over`);
    }
  }
  throw lastError ?? new Error('Chat produced no response');
}

/**
 * One-shot text generation for /ai/compose (no tools, no history).
 */
async function runAgentCompose({ systemPrompt: sys, userPrompt }) {
  const tokens = resolveOauthTokens();
  if (tokens.length === 0) throw new Error('Agent compose is not configured');
  const { query } = await loadSdk();

  let lastError = null;
  for (let i = 0; i < tokens.length; i++) {
    const isLast = i === tokens.length - 1;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), CHAT_TIMEOUT_MS);
    try {
      const options = {
        model: CHAT_MODEL,
        maxTurns: 1,
        systemPrompt: String(sys || 'You are a helpful assistant.').slice(0, 8000),
        allowedTools: [],
        disallowedTools: [
          'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
          'NotebookEdit', 'TodoWrite', 'Task', 'SlashCommand', 'ExitPlanMode',
        ],
        permissionMode: 'dontAsk',
        settingSources: [],
        abortController,
        env: envWithToken(tokens[i]),
        ...(process.env.CLAUDE_CODE_EXECUTABLE
          ? { pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_EXECUTABLE }
          : {}),
      };
      for await (const m of query({ prompt: String(userPrompt || '').slice(0, 30_000), options })) {
        if (m.type === 'result') {
          if (m.subtype === 'success') {
            const text = typeof m.result === 'string' ? m.result.trim() : '';
            if (text) return text;
            break;
          }
          throw new Error((m.errors ?? []).join('; ') || m.subtype);
        }
      }
      if (isLast) throw new Error('Empty response from all accounts (usage limit?)');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isLast) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error('Compose produced no response');
}

module.exports = { agentChatEnabled, runAgentChat, runAgentCompose, clearSession, accessAllowsEndpoint };
