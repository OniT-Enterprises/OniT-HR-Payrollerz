# CLAUDE.md - Project Context

## Important
- **Frontend work**: Check `STYLE_GUIDE.md` for design patterns and colors before UI changes.
- **Roadmap**: See `docs/IMPLEMENTATION_ROADMAP.md` for feature plans and TL legal requirements.
- **Code quality**: See `docs/CODE_REVIEW_JAN2026.md` for technical debt and pending items.

## Project Overview
OniT HR/Payroll System - React/TypeScript app for HR operations (hiring, staff, time tracking, performance, payroll, reporting) targeting Timor-Leste market.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite 6
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: React Context + TanStack React Query
- **Backend**: Firebase (Firestore/Auth)
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

routes.tsx          # All route definitions (extracted from App.tsx)
```

## Common Commands
```bash
npm run dev          # Dev server
npm run build        # Production build
npm run typecheck    # TypeScript check
```

## Firestore Timestamps
Always handle Firestore Timestamps properly:
```typescript
// In mapper functions:
createdAt: data.createdAt instanceof Timestamp
  ? data.createdAt.toDate()
  : data.createdAt || new Date()
```

## Git
- Main branch: `main`
- Auto-deploys on push to main (Firebase + Hetzner)
