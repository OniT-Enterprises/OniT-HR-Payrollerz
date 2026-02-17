# CLAUDE.md - Project Context

## Important
- **Frontend work**: Check `STYLE_GUIDE.md` for design patterns and colors before UI changes.
- **Roadmap**: See `docs/IMPLEMENTATION_ROADMAP.md` for feature plans and TL legal requirements.
- **Code quality**: See `docs/CODE_REVIEW_JAN2026.md` for technical debt and pending items.
- **Bot integration**: See `OPENCLAW_MEZA_INTEGRATION.md` for the Meza AI assistant (WhatsApp + web dashboard).

## Project Overview
OniT HR/Payroll System - React/TypeScript app for HR operations (hiring, staff, time tracking, performance, payroll, reporting) targeting Timor-Leste market.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite 6
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: React Context + TanStack React Query
- **Backend**: Firebase (Firestore/Auth)
- **Server**: Express.js REST API (Meza API) + OpenClaw bot gateway
- **Deployment**: Firebase Hosting + Hetzner VPS

## Firebase Configuration

### Project: `onit-hr-payroll`
```
Project ID: onit-hr-payroll
Auth Domain: onit-hr-payroll.firebaseapp.com
Storage Bucket: onit-hr-payroll.firebasestorage.app
Console: https://console.firebase.google.com/project/onit-hr-payroll/overview
```

### Local Development
```bash
npm run dev          # Start Vite dev server
```

### Deploy Commands
```bash
firebase deploy                      # Deploy everything
firebase deploy --only firestore:rules  # Deploy rules only
firebase deploy --only hosting       # Deploy hosting only
```

### Firestore Rules
- Production: `firestore.rules`
- Dev: `firestore-dev.rules` (currently deployed)

## Hetzner VPS

**Production**: payroll.naroman.tl (65.109.173.122)

```bash
ssh hetzner
# Manual deploy:
npm run build && rsync -avz --delete dist/spa/ hetzner:/var/www/payroll.naroman.tl/dist/spa/
```

## Key Directories
```
client/
├── components/     # React components (ui/ for shadcn)
├── contexts/       # Auth, Firebase, Tenant contexts
├── hooks/          # React Query hooks (useEmployees, useInvoices, etc.)
├── lib/            # Firebase config, payroll calculations
├── pages/          # Page components by module
├── services/       # Firestore data services
└── types/          # TypeScript definitions

server/
├── meza-api/       # Express REST API for bot (port 3201, PM2)
│   └── index.js    # 26 read-only Firestore endpoints
└── openclaw-meza/  # OpenClaw Docker gateway (port 18790)
    ├── extensions/meza-hr/  # Plugin: 29 tools + 5 commands
    ├── docker-compose.yml
    ├── Dockerfile
    └── deploy.sh

routes.tsx          # All route definitions (extracted from App.tsx)
```

## Common Commands
```bash
npm run dev          # Dev server (Vite frontend)
npm run build        # Production build
npm run typecheck    # TypeScript check
```

## Meza Bot (Server)

The Meza AI assistant lets HR managers query company data via WhatsApp and a web dashboard.

```bash
# Meza API (local dev)
cd server/meza-api && npm install && npm run dev

# Deploy Meza API to Hetzner (PM2)
rsync -avz --delete server/meza-api/ hetzner:/opt/meza-api/
ssh hetzner 'cd /opt/meza-api && npm install && pm2 restart meza-api'

# Deploy OpenClaw bot
cd server/openclaw-meza && ./deploy.sh

# Pair WhatsApp (on server)
docker exec -it openclaw-meza openclaw channels login
```

**Ports on Hetzner:**
| Service | Port | Process |
|---------|------|---------|
| Meza API | 3201 | PM2 |
| OpenClaw Meza | 18790 | Docker |
| Hotel API | 3100 | PM2 |
| OpenClaw Hotel | 18789 | Docker |

**Sensitive files (never commit):**
- `server/meza-api/.env` — API key, tenant ID
- `server/meza-api/serviceAccountKey.json` — Firebase Admin credentials
- `server/openclaw-meza/.env` — Anthropic API key
- `server/openclaw-meza/openclaw.json` — Bot config with API keys

## Firestore Timestamps
Always handle Firestore Timestamps properly:
```typescript
// In mapper functions:
createdAt: data.createdAt instanceof Timestamp
  ? data.createdAt.toDate()
  : data.createdAt || new Date()
```

## Page Patterns
All pages follow consistent patterns:
- `useTenantId()` - tenant isolation for multi-tenant support
- `useToast()` - user feedback for success/error states
- `Skeleton` loading states during data fetches
- Proper error handling with try/catch and toast notifications
- `Dialog` for forms, `AlertDialog` for confirmations

## Git
- Main branch: `main`
- Auto-deploys on push to main (Firebase + Hetzner)
