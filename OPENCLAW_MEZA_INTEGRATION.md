# OpenClaw Meza Integration — OniT HR Bot

AI assistant for the OniT HR/Payroll system. Provides natural-language access to employee, payroll, leave, recruitment, and financial data via a **web chat widget** and **WhatsApp**.

**Status:** Deployed and live on Hetzner (2026-02-17)

## Architecture

```
HR Manager (Web Dashboard)          HR Manager (WhatsApp)
       |                                    |
  Firebase ID Token                    WhatsApp channel
  POST /api/tenants/:tid/chat              |
       |                                    |
       v                                    v
  Meza API (Express, port 3201)     OpenClaw Gateway (Docker, port 18790)
       |                                    |
       |--- HTTP POST ------>               |
       |  /v1/chat/completions              |
       |  (Bearer gateway-token)            |
       v                                    |
  OpenClaw Gateway  <-----------------------+
  (Meza Assistant agent, 29 tools, 5 commands)
       |
       |--- HTTP GET (X-API-Key) --->  Meza API
       |                                    |
       v                                    v
                   Firebase Firestore
                   tenants/{tenantId}/employees, payroll, leave, etc.
```

**Production server:** Hetzner VPS `65.109.173.122`

## Production URLs

| Endpoint | URL | Auth |
|----------|-----|------|
| API health | `https://meza.naroman.tl/api/health` | None |
| API (data) | `https://meza.naroman.tl/api/tenants/onit-enterprises/...` | `X-API-Key` header |
| API (chat) | `https://meza.naroman.tl/api/tenants/onit-enterprises/chat` | Firebase ID token |
| Bot dashboard | `https://meza.naroman.tl/openclaw/` | Basic auth |
| Frontend SPA | `https://meza.naroman.tl/` | Firebase Auth |

## Services on Hetzner

| Service | Port | Process | Remote path |
|---------|------|---------|-------------|
| Meza API | 3201 | PM2 (`meza-api`) | `/opt/meza-api/` |
| OpenClaw Meza | 18790 | Docker (`openclaw-meza`) | `/opt/openclaw-meza/` |

---

## Components

### 1. Meza API (`server/meza-api/`)

Express REST API that serves two roles:
- **Data API** for the OpenClaw plugin (API key auth, `X-API-Key` header)
- **Chat relay** for the web dashboard (Firebase token auth, `Authorization: Bearer` header)

#### Environment Variables

| Variable | Description |
|----------|------------|
| `PORT` | Listen port (default: 3201) |
| `API_KEY` | Shared secret for OpenClaw plugin auth |
| `ALLOWED_TENANT_ID` | Single-tenant lock (`onit-enterprises`) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON |
| `OPENCLAW_WS_URL` | Gateway address (default: `ws://127.0.0.1:18790`) |
| `OPENCLAW_PASSWORD` | Gateway auth token (same as `OPENCLAW_GATEWAY_TOKEN`) |

#### API Routes

**Health (no auth):**

| Route | Description |
|-------|------------|
| `GET /api/health` | Health check |

**Data routes (API key auth):**

| Route | Description |
|-------|------------|
| `GET /api/tenants/:tid/employees` | List employees (query: status, department, search, limit) |
| `GET /api/tenants/:tid/employees/:id` | Get single employee |
| `GET /api/tenants/:tid/employees/counts` | Counts by status |
| `GET /api/tenants/:tid/employees/by-department` | Group by department |
| `GET /api/tenants/:tid/departments` | List departments |
| `GET /api/tenants/:tid/payroll/runs` | List payroll runs (query: status, limit) |
| `GET /api/tenants/:tid/payroll/runs/:yyyymm` | Get run details |
| `GET /api/tenants/:tid/payroll/runs/:yyyymm/payslips` | Payslips for a run |
| `GET /api/tenants/:tid/leave/requests` | List leave requests (query: status, employeeId) |
| `GET /api/tenants/:tid/leave/pending` | Pending leave requests |
| `GET /api/tenants/:tid/leave/balances` | All leave balances (query: year) |
| `GET /api/tenants/:tid/leave/on-leave-today` | Who's out today |
| `GET /api/tenants/:tid/attendance/daily` | Daily attendance (query: date) |
| `GET /api/tenants/:tid/interviews` | List interviews (query: status) |
| `GET /api/tenants/:tid/interviews/today` | Today's interviews |
| `GET /api/tenants/:tid/interviews/upcoming` | Next 7 days |
| `GET /api/tenants/:tid/jobs` | List jobs (query: status) |
| `GET /api/tenants/:tid/jobs/open` | Open positions |
| `GET /api/tenants/:tid/invoices` | List invoices (query: status, customerId) |
| `GET /api/tenants/:tid/invoices/overdue` | Overdue invoices + total AR |
| `GET /api/tenants/:tid/bills` | List bills (query: status, vendorId) |
| `GET /api/tenants/:tid/bills/overdue` | Overdue bills + total AP |
| `GET /api/tenants/:tid/expenses` | Expenses (query: category, from, to) |
| `GET /api/tenants/:tid/expenses/this-month` | Current month by category |
| `GET /api/tenants/:tid/stats` | Company overview (aggregated) |

**Chat route (Firebase token auth):**

| Route | Description |
|-------|------------|
| `POST /api/tenants/:tid/chat` | AI chat relay (30 req/15 min rate limit) |

#### Rate Limits

- Global: 120 requests/minute
- Chat: 30 requests/15 minutes (expensive AI calls)

---

### 2. OpenClaw Gateway (`server/openclaw-meza/`)

Dockerized OpenClaw instance with the Meza HR plugin.

- **Port:** 18790 (localhost only, proxied by Nginx with basic auth)
- **Container:** `openclaw-meza`
- **AI Model:** Claude Opus 4.6 (via Anthropic API)
- **Security:** Read-only rootfs, all caps dropped, no-new-privileges, 2GB RAM limit

#### Environment Variables (`.env`)

| Variable | Description |
|----------|------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth password |

#### Key Config (`openclaw.json`)

- **Agent:** `main` ("Meza Assistant"), tools restricted to `meza-hr` plugin
- **HTTP API:** `gateway.http.endpoints.chatCompletions.enabled: true` — required for web chat
- **WhatsApp:** allowlist-based DM policy
- **Session memory:** enabled via internal hooks

---

### 3. Meza HR Plugin (`server/openclaw-meza/extensions/meza-hr/`)

OpenClaw plugin providing 29 tools and 5 commands.

#### Tools (29)

| Category | Tools |
|----------|-------|
| Employees (6) | `list_employees`, `search_employees`, `get_employee_details`, `get_employee_counts`, `get_employees_by_department`, `get_active_employees` |
| Payroll (4) | `list_payroll_runs`, `get_payroll_run`, `get_payroll_payslips`, `get_payroll_summary` |
| Leave (5) | `get_pending_leave_requests`, `get_leave_balances`, `get_leave_stats`, `get_employees_on_leave_today`, `get_employee_leave` |
| Attendance (2) | `get_daily_attendance`, `get_attendance_summary` |
| Recruitment (4) | `get_open_jobs`, `get_today_interviews`, `get_upcoming_interviews`, `get_candidates` |
| Finance (5) | `get_overdue_invoices`, `get_overdue_bills`, `get_expenses_this_month`, `get_invoices_by_status`, `get_financial_summary` |
| Overview (1) | `get_company_overview` |
| Departments (2) | `list_departments`, `get_department_headcount` |

#### Commands (5 — WhatsApp auto-replies)

| Command | Description |
|---------|------------|
| `/staff` | Employee headcount by status and department |
| `/payroll` | Current payroll run status |
| `/leave` | Pending leave requests + who's out today |
| `/today` | Today's interviews + on-leave employees |
| `/money` | Financial overview (overdue invoices, bills, expenses) |

#### Plugin Config

```json
{
  "apiBaseUrl": "http://127.0.0.1:3201",
  "apiKey": "<meza-api-key>",
  "defaultTenantId": "onit-enterprises"
}
```

---

### 4. Web Chat Widget (`client/components/chat/`)

In-app chat panel that lets authenticated users query HR data from the dashboard.

#### Files

| File | Purpose |
|------|---------|
| `client/stores/chatStore.ts` | Zustand store (messages, loading, session) |
| `client/components/chat/ChatWidget.tsx` | Floating bubble (bottom-right), auth-gated |
| `client/components/chat/ChatPanel.tsx` | Chat UI: messages, markdown, input, confirm buttons |

#### Behavior

- Visible only to authenticated users (checks `useAuth()`)
- Floating button in bottom-right corner, opens chat panel on click
- Responsive: full-width on mobile, 380px fixed width on desktop
- Messages rendered with `react-markdown` (assistant) or plain text (user)
- Links sanitized to http/https/mailto/tel only
- Auto-detects confirmation questions and shows Confirm/Cancel buttons
- Session key format: `chat-{timestamp36}-{random6}` (resets on "New Chat")
- API base URL: `VITE_MEZA_API_URL` env var (defaults to `https://meza.naroman.tl`)

#### Mounted in `client/App.tsx`

```tsx
<TenantProvider>
  <ChatWidget />
  <Suspense fallback={<PageLoader />}>
    <Routes>...</Routes>
  </Suspense>
</TenantProvider>
```

---

## How the Chat Works

### Web Chat (Dashboard)

```
1. User types message in ChatPanel
2. ChatPanel POSTs to /api/tenants/{tid}/chat
   - Header: Authorization: Bearer <firebase-id-token>
   - Body: { message, sessionKey }
3. Meza API:
   a. Validates Firebase token (authenticateFirebaseToken middleware)
   b. Classifies intent (read/write/confirm/cancel) via chatUtils.js
   c. Builds system prefix with user context + Tetun personality
   d. POSTs to http://127.0.0.1:18790/v1/chat/completions
      - Header: Authorization: Bearer <gateway-token>
      - Header: x-openclaw-agent-id: main
      - Header: x-openclaw-session-key: agent:main:{tid}:webchat-{uid}:{session}
      - Body: { model: "openclaw:main", messages, stream: false, user }
4. OpenClaw Gateway:
   a. Routes to "main" agent (Meza Assistant)
   b. Claude processes using meza-hr plugin tools
   c. Tools call back to Meza API (X-API-Key auth)
   d. Returns OpenAI-compatible completion
5. Meza API:
   a. Extracts reply from completion
   b. Logs to tenants/{tid}/chat_audit collection
   c. Returns { reply, actions } to frontend
6. ChatPanel renders markdown response
```

**Important:** The web chat uses the OpenAI-compatible HTTP API (`/v1/chat/completions`), NOT the WebSocket protocol. The WebSocket protocol's `chat.send` method requires `operator.write` scope which is not granted by password auth in OpenClaw v2026.2.15.

### WhatsApp

```
1. User sends message to paired WhatsApp number
2. OpenClaw Gateway receives via WhatsApp channel
3. Routes to "main" agent (Meza Assistant)
4. Claude processes with meza-hr plugin tools
5. Reply sent back via WhatsApp
```

Commands (`/staff`, `/payroll`, etc.) are handled directly by the plugin without AI inference.

### Chat Intent Classification

The `chatUtils.js` module classifies user messages:

- **confirm** — "yes", "proceed", "go ahead", etc.
- **cancel** — "no", "cancel", "stop", etc.
- **write** — action verbs (create, add, update, delete, approve, hire, run payroll)
- **read** — query verbs (show, list, get, find, how many, what)

Write operations are blocked in Phase 1 (read-only). A confirmation flow with 10-minute Firestore TTL is implemented for Phase 2.

---

## Firestore Collections

All under `tenants/onit-enterprises/`:

| Collection | Path |
|-----------|------|
| Employees | `tenants/onit-enterprises/employees` |
| Departments | `tenants/onit-enterprises/departments` |
| Payroll runs | `tenants/onit-enterprises/payruns/{yyyymm}` |
| Payslips | `tenants/onit-enterprises/payruns/{yyyymm}/payslips` |
| Leave requests | `tenants/onit-enterprises/leaveRequests` |
| Leave balances | `tenants/onit-enterprises/leaveBalances` |
| Interviews | `tenants/onit-enterprises/interviews` |
| Jobs | `tenants/onit-enterprises/jobs` |
| Invoices | `tenants/onit-enterprises/invoices` |
| Bills | `tenants/onit-enterprises/bills` |
| Expenses | `tenants/onit-enterprises/expenses` |
| Chat audit | `tenants/onit-enterprises/chat_audit` |
| Chat pending | `tenants/onit-enterprises/chat_pending` |

---

## Deployment

### Redeploy Meza API

```bash
scp server/meza-api/index.js hetzner:/opt/meza-api/index.js
scp server/meza-api/chatUtils.js hetzner:/opt/meza-api/chatUtils.js
ssh hetzner 'cd /opt/meza-api && pm2 restart meza-api'
```

For dependency changes:
```bash
rsync -avz --exclude='node_modules' --exclude='.env' --exclude='serviceAccountKey.json' \
  server/meza-api/ hetzner:/opt/meza-api/
ssh hetzner 'cd /opt/meza-api && npm install --omit=dev && pm2 restart meza-api'
```

### Redeploy OpenClaw Bot

```bash
# Quick: deploy script handles everything
cd server/openclaw-meza && ./deploy.sh

# Or manual:
rsync -avz --exclude='.env' --exclude='openclaw.json' --exclude='node_modules' \
  server/openclaw-meza/ hetzner:/opt/openclaw-meza/
ssh hetzner 'cd /opt/openclaw-meza && docker compose build && docker compose down && docker compose up -d'
```

For plugin changes only (rebuild required):
```bash
./deploy.sh --rebuild
```

### Redeploy Frontend

```bash
npm run build && rsync -avz --delete dist/spa/ hetzner:/var/www/payroll.naroman.tl/dist/spa/
```

---

## Nginx Config (on meza.naroman.tl)

```nginx
# Meza API proxy
location /api/ {
    proxy_pass http://127.0.0.1:3201;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}

# OpenClaw Meza dashboard (basic auth)
location ^~ /openclaw/ {
    auth_basic "Meza Bot Dashboard";
    auth_basic_user_file /etc/nginx/.meza_openclaw_htpasswd;

    proxy_pass http://127.0.0.1:18790/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## Sensitive Files (on server only, never in git)

| File | Location | Contains |
|------|----------|----------|
| Meza API .env | `/opt/meza-api/.env` | API_KEY, ALLOWED_TENANT_ID, OPENCLAW_PASSWORD |
| Firebase SA key | `/opt/meza-api/serviceAccountKey.json` | Firebase Admin credentials |
| OpenClaw .env | `/opt/openclaw-meza/.env` | ANTHROPIC_API_KEY, OPENCLAW_GATEWAY_TOKEN |
| OpenClaw config | `/opt/openclaw-meza/openclaw.json` | API keys, tenant ID, WhatsApp allowlist |
| Nginx htpasswd | `/etc/nginx/.meza_openclaw_htpasswd` | Dashboard basic auth |

---

## Verification

```bash
# 1. API health (no auth)
curl https://meza.naroman.tl/api/health

# 2. Data endpoint (API key auth)
curl -H "X-API-Key: KEY" https://meza.naroman.tl/api/tenants/onit-enterprises/employees/counts

# 3. OpenClaw HTTP API directly (on server)
ssh hetzner 'source /opt/openclaw-meza/.env && curl -s -X POST http://127.0.0.1:18790/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -d "{\"model\":\"openclaw:main\",\"messages\":[{\"role\":\"user\",\"content\":\"How many employees?\"}],\"stream\":false}"'

# 4. Plugin loaded
ssh hetzner 'docker logs openclaw-meza 2>&1 | grep "Plugin loaded"'
# Expected: [meza-hr] Plugin loaded — 29 tools, 5 commands registered

# 5. PM2 status
ssh hetzner 'pm2 status meza-api'

# 6. Docker status
ssh hetzner 'docker ps | grep openclaw-meza'

# 7. Dashboard (browser, behind basic auth)
# https://meza.naroman.tl/openclaw/

# 8. Web chat: log into meza.naroman.tl, click chat bubble, send a message
```

---

## Troubleshooting

### Chat returns 502

Gateway not running or HTTP API not enabled.

```bash
ssh hetzner 'docker ps | grep openclaw-meza'
ssh hetzner 'docker logs openclaw-meza --tail 20 2>&1 | grep -v "Config was last"'
```

Verify HTTP API is enabled: check `openclaw.json` has `gateway.http.endpoints.chatCompletions.enabled: true`. Restart container after config changes.

### Chat returns 401

Firebase token issue. User must be logged in. Check browser console for auth errors.

### Chat returns 403

Tenant ID mismatch. Verify `ALLOWED_TENANT_ID=onit-enterprises` in `/opt/meza-api/.env` matches the tenant ID from the web app.

### "missing scope: operator.write"

This happens if the Meza API is using the WebSocket protocol instead of the HTTP API. The `chat.send` WS method requires `operator.write` scope which password auth doesn't grant in OpenClaw v2026.2.15.

**Fix:** Ensure `openClawChat()` in `index.js` uses `fetch()` to `http://127.0.0.1:18790/v1/chat/completions`, not WebSocket. Then restart: `pm2 restart meza-api`.

### "EACCES: permission denied, mkdir agents/main"

Docker volume owned by root instead of node (uid 1000).

```bash
cd /opt/openclaw-meza
docker compose stop openclaw-meza
docker run --rm -v openclaw-meza_openclaw-meza-agents:/data alpine chown -R 1000:1000 /data
docker compose start openclaw-meza
```

### Plugin not loading

```bash
docker exec openclaw-meza ls -la /home/node/.openclaw/extensions/meza-hr/
docker logs openclaw-meza 2>&1 | grep -i "plugin\|error"
```

Rebuild if needed: `./deploy.sh --rebuild`

### WhatsApp not connected

```bash
docker exec openclaw-meza openclaw channels status
docker exec -it openclaw-meza openclaw channels login   # QR scan
```

### API not responding

```bash
ssh hetzner 'pm2 status meza-api && pm2 logs meza-api --lines 20 --nostream'
```

### Nginx 502 errors

```bash
ssh hetzner 'nginx -t && curl -s http://127.0.0.1:3201/api/health && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18790/'
```

---

## File Reference

```
server/
  meza-api/
    index.js              # Express API (27 data routes + chat endpoint)
    chatUtils.js          # Intent classification, action detection
    package.json          # Dependencies (express, firebase-admin, etc.)
    .env.example          # Environment template
    .gitignore            # Excludes .env, serviceAccountKey.json
  openclaw-meza/
    docker-compose.yml    # Docker config (security-hardened, host networking)
    Dockerfile            # Build: node:22-slim + openclaw@latest + plugin
    deploy.sh             # Automated Hetzner deployment script
    openclaw.json.example # Gateway + agent + plugin config template
    .env.example          # ANTHROPIC_API_KEY, OPENCLAW_GATEWAY_TOKEN
    .gitignore            # Excludes .env, openclaw.json
    extensions/
      meza-hr/
        index.ts          # Plugin: 29 tools + 5 commands
        openclaw.plugin.json  # Plugin manifest + config schema
        package.json      # @sinclair/typebox dependency

client/
  stores/chatStore.ts               # Zustand chat state management
  components/chat/ChatWidget.tsx     # Floating chat bubble (auth-gated)
  components/chat/ChatPanel.tsx      # Chat conversation UI (markdown, confirm buttons)
```

---

## Remaining TODO

- [ ] Pair WhatsApp (requires physical QR scan on device)
- [ ] Update WhatsApp allowlist with actual phone numbers in `openclaw.json`
- [ ] Phase 2: Add write endpoints (approve leave, run payroll actions)
- [ ] Phase 2: Enable write confirmation flow in chat (already scaffolded)
- [ ] Add hotel-style `webchat` agent with restricted tools (deny write operations)
