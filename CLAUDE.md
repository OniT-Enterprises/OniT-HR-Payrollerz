# CLAUDE.md - Project Context for AI Assistants

## Important
- **Frontend work**: Always check `STYLE_GUIDE.md` for design patterns, colors, and component conventions before making UI changes.

## Project Overview
OniT HR/Payroll System - A React/TypeScript application for managing HR operations including hiring, staff management, time tracking, performance reviews, payroll, and reporting.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite 6
- **UI**: Tailwind CSS, shadcn/ui components, Radix UI primitives
- **State**: React Context (Auth, Firebase, Tenant) + TanStack React Query
- **Backend**: Express.js + SQLite (local), Firebase (Firestore/Auth with emulator support)
- **Deployment**: Firebase Hosting via GitHub Actions

## Firebase Configuration

### Project: `onit-hr-payroll`
- **Project ID**: `onit-hr-payroll`
- **Auth Domain**: `onit-hr-payroll.firebaseapp.com`
- **Storage Bucket**: `onit-hr-payroll.firebasestorage.app`
- **API Key**: `AIzaSyAjCVU27QTqDseLYoP3UyEMV6evVwi_exQ`
- **App ID**: `1:415646082318:web:0c72df4a47d24ea2e4a35f`
- **Messaging Sender ID**: `415646082318`
- **Console**: https://console.firebase.google.com/project/onit-hr-payroll/overview

### Local Development
```bash
# Start emulators (Firestore on 8081, Auth on 9100, UI on 4001)
npm run emulators

# Start dev server
npm run dev
```

### Emulator Ports
- Firestore: `127.0.0.1:8081`
- Auth: `127.0.0.1:9100`
- Emulator UI: `127.0.0.1:4001`

## GitHub Secrets Required
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT
```

## Key Directories
```
client/
├── components/     # React components
│   ├── layout/     # MainNavigation, Header
│   ├── ui/         # shadcn/ui components
│   ├── dashboard/  # Dashboard components
│   ├── hiring/     # Hiring module components
│   ├── staff/      # Staff module components
│   ├── time-leave/ # Time & Leave module components
│   ├── performance/# Performance module components
│   └── payroll/    # Payroll module components
├── contexts/       # React contexts (Auth, Firebase, Tenant)
├── hooks/          # Custom React hooks
├── lib/            # Firebase config, utilities
├── pages/          # Page components by module
├── services/       # Data services (local, mock, Firebase)
└── types/          # TypeScript type definitions

server/             # Express backend with SQLite
shared/             # Shared types between client/server
functions/          # Firebase Cloud Functions
scripts/            # Utility scripts (seeding, migrations)
```

## Modules
1. **Hiring** (`/hiring`) - Job postings, candidates, onboarding/offboarding
2. **Staff** (`/staff`) - Employees, departments, org chart
3. **Time & Leave** (`/time-leave`) - Attendance, leave requests, scheduling
4. **Performance** (`/performance`) - Reviews, goals, training, disciplinary
5. **Payroll** (`/payroll`) - Run payroll, history, taxes, benefits, deductions
6. **Reports** (`/reports`) - Various report types

## Data Model

### Core Entities
- `Employee` - Personal info, job details, compensation, documents, status
- `Department` - Name, description, manager, budget
- `Job` - Title, description, salary range, status (draft/open/closed)
- `Candidate` - Job application with stage tracking
- `Position` - Job grade definitions with compensation
- `Contract` - Employee contracts with terms
- `TenantConfig` - Multi-tenancy configuration
- `TenantMember` - User roles and permissions (owner, hr-admin, manager, viewer)

## Common Issues

### Firebase Emulator
- If Firestore emulator port 8081 is busy, it may conflict with Vite dev server
- Vite will auto-select another port (check console output)
- Emulator data is persisted in `firebaseemulator_payroll/`

### Date Formatting
Firestore returns Timestamps, not Dates. Use safe formatting:
```typescript
const formatDate = (date: Date | string | { toDate?: () => Date } | undefined): string => {
  if (!date) return '';
  if (typeof date === 'object' && 'toDate' in date) {
    return date.toDate().toLocaleDateString();
  }
  return new Date(date).toLocaleDateString();
};
```

## Useful Commands
```bash
# Development
npm run dev              # Start Vite dev server
npm run build            # Production build
npm run typecheck        # TypeScript checking
npm run test             # Run tests

# Firebase
npm run emulators        # Start Firestore & Auth emulators
npm run emulators:ui     # Start all emulators with full UI
firebase deploy          # Deploy to Firebase Hosting

# Database
npm run seed:dev         # Seed development database
npm run reset:emulator   # Reset emulator data
```

## Git Workflow
- Main branch: `main`
- Auto-deploys to Firebase Hosting on push to main
- Always test locally before pushing

## Recent Cleanup (January 2026)

See `docs/FIREBASE_CLEANUP.md` for full details on the cleanup that removed:
- 14 Firebase workaround files
- 2 local auth files
- 8 unused components
- 10+ backup/duplicate files

The codebase now uses clean, direct Firebase integration.

## Remaining Technical Debt
1. Payroll module is mostly placeholder
2. Firebase credentials should move to env variables
3. Need proper Firestore security rules
4. Need initial seed data in Firestore
