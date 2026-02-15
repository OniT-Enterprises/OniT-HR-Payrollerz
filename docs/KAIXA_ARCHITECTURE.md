# Kaixa — Technical Architecture

## Overview

Kaixa is a React Native (Expo) mobile app that shares Firebase backend and business logic with the Meza web platform. Meza is the engine — Kaixa is a client.

```
┌─────────────────────────────────────────────────────────┐
│                    SHARED CORE                          │
│              (@onit/shared package)                     │
│                                                         │
│  types/        - Employee, PayrollRun, Invoice, etc.    │
│  lib/currency  - Decimal.js money math                  │
│  lib/payroll/  - TL tax constants + calculations        │
│  lib/paths     - Firestore collection paths             │
│  lib/dateUtils - TL timezone helpers                    │
│  i18n/         - translations (Tetum/EN/PT)             │
│  validations/  - Zod schemas                            │
└────────────────────┬────────────────────────────────────┘
                     │ workspace dependency
          ┌──────────┴──────────┐
          ▼                     ▼
┌──────────────────┐  ┌──────────────────────┐
│   Meza (Web)     │  │   Kaixa (Mobile)     │
│   apps/web/      │  │   apps/mobile/       │
│                  │  │                      │
│  Full admin UI   │  │  Simplified views    │
│  All modules     │  │  Offline-first       │
│  Tailwind/shadcn │  │  React Native Paper  │
│  React Query     │  │  or NativeWind       │
│  Direct FS SDK   │  │  Zustand + MMKV      │
└────────┬─────────┘  └──────────┬───────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────┐
│         Firebase (onit-hr-payroll)           │
│                                             │
│  Firestore  - Single source of truth        │
│  Auth       - Email (web) + Phone (mobile)  │
│  Functions  - Server-side business logic    │
│  Storage    - Documents, photos             │
│  FCM        - Push notifications            │
└─────────────────────────────────────────────┘
```

---

## Monorepo Structure

Non-disruptive approach: existing web code stays in place. New directories added alongside.

```
onit-hr-payrollerz/              # Root (existing repo)
├── package.json                  # Add "workspaces" field
├── tsconfig.base.json            # Shared TS config
│
├── client/                       # Meza web app (UNCHANGED)
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/                      # → imports from @onit/shared
│   ├── pages/
│   ├── services/
│   └── types/                    # → imports from @onit/shared
│
├── functions/                    # Cloud Functions (UNCHANGED)
│
├── packages/
│   └── shared/                   # NEW — extracted shared code
│       ├── package.json          # name: "@onit/shared"
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts          # Barrel export
│       │   ├── types/
│       │   │   ├── employee.ts   # From client/types/
│       │   │   ├── payroll.ts
│       │   │   ├── payroll-tl.ts
│       │   │   ├── accounting.ts
│       │   │   ├── money.ts
│       │   │   ├── tenant.ts
│       │   │   ├── settings.ts
│       │   │   ├── user.ts
│       │   │   └── firebase.ts
│       │   ├── lib/
│       │   │   ├── currency.ts
│       │   │   ├── paths.ts
│       │   │   ├── dateUtils.ts
│       │   │   └── payroll/
│       │   │       ├── constants-tl.ts
│       │   │       ├── calculations-tl.ts
│       │   │       └── tl-holidays.ts
│       │   ├── validations/
│       │   │   └── index.ts
│       │   └── i18n/
│       │       └── translations.ts
│       └── dist/                 # Compiled output
│
└── mobile/                       # NEW — Kaixa app
    ├── package.json
    ├── tsconfig.json
    ├── app.json                  # Expo config
    ├── app/                      # Expo Router
    │   ├── _layout.tsx           # Root layout
    │   ├── (auth)/               # Auth screens
    │   │   ├── _layout.tsx
    │   │   ├── login.tsx         # Phone/email login
    │   │   └── verify.tsx        # OTP verification
    │   ├── (tabs)/               # Main tab navigation
    │   │   ├── _layout.tsx       # Tab bar config
    │   │   ├── index.tsx         # Home / Dashboard
    │   │   ├── money.tsx         # Money In/Out (Tier 1)
    │   │   ├── sales.tsx         # POS (Tier 2)
    │   │   └── profile.tsx       # Settings, language, account
    │   ├── payslip/[id].tsx      # View payslip detail
    │   ├── leave/request.tsx     # Submit leave request
    │   └── approve/[id].tsx      # Approve timesheet/leave
    ├── components/
    │   ├── ui/                   # Base UI components
    │   ├── MoneyEntry.tsx        # Money In/Out form
    │   ├── TransactionList.tsx   # Transaction history
    │   ├── PayslipCard.tsx       # Payslip summary
    │   └── DailySummary.tsx      # Daily totals
    ├── services/
    │   ├── firebase.ts           # Firebase init for RN
    │   ├── authService.ts        # Phone + email auth
    │   ├── transactionService.ts # Money tracking CRUD
    │   ├── payslipService.ts     # Read payslips
    │   └── leaveService.ts       # Leave requests
    ├── stores/
    │   ├── authStore.ts          # Zustand auth state
    │   ├── tenantStore.ts        # Current tenant context
    │   └── transactionStore.ts   # Offline transaction queue
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useTenant.ts
    │   └── useTransactions.ts
    ├── lib/
    │   ├── storage.ts            # MMKV for fast local storage
    │   └── sync.ts               # Offline sync engine
    └── assets/
        ├── icon.png
        └── splash.png
```

---

## Shared Code Extraction Plan

### Files to Extract (zero React dependency)

| Source | Destination | Changes Needed |
|--------|-------------|----------------|
| `client/types/*.ts` (10 files) | `packages/shared/src/types/` | Remove UI-specific types (bgClass, textClass) |
| `client/lib/currency.ts` | `packages/shared/src/lib/currency.ts` | None — pure Decimal.js |
| `client/lib/paths.ts` | `packages/shared/src/lib/paths.ts` | None — pure string functions |
| `client/lib/dateUtils.ts` | `packages/shared/src/lib/dateUtils.ts` | None — pure Intl API |
| `client/lib/payroll/constants-tl.ts` | `packages/shared/src/lib/payroll/constants-tl.ts` | Replace `@/` import alias |
| `client/lib/payroll/calculations-tl.ts` | `packages/shared/src/lib/payroll/calculations-tl.ts` | Replace `@/` import alias |
| `client/lib/payroll/tl-holidays.ts` | `packages/shared/src/lib/payroll/tl-holidays.ts` | None |
| `client/lib/validations/index.ts` | `packages/shared/src/validations/index.ts` | Replace `@/` import alias |
| `client/i18n/translations.ts` | `packages/shared/src/i18n/translations.ts` | None — just a nested object |

### Import Alias Changes

Current web app uses `@/` Vite alias (e.g., `import { sumMoney } from '@/lib/currency'`).

In shared package, use relative imports:
```typescript
// Before (web): import { sumMoney } from '@/lib/currency';
// After (shared): import { sumMoney } from '../currency';
```

Web app can then import from shared:
```typescript
// Before: import { sumMoney } from '@/lib/currency';
// After:  import { sumMoney } from '@onit/shared/lib/currency';
// Or via barrel: import { sumMoney } from '@onit/shared';
```

### Migration Strategy

Phase 1 (now): Copy files to shared package. Both web and mobile import from shared.
Phase 2 (later): Update web app imports to use `@onit/shared`. Remove duplicates from `client/lib/`.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Expo SDK 52+ | OTA updates, no Play Store friction for patches |
| Navigation | Expo Router v4 | File-based routing, deep linking |
| State | Zustand | Lightweight, works with RN, no boilerplate |
| Storage | MMKV | Fast key-value for preferences, auth tokens |
| Offline DB | WatermelonDB or expo-sqlite | Offline-first transactions |
| Backend | Firebase JS SDK v11 | Same SDK as web, compatible config |
| Auth | Firebase Auth | Phone (mass market) + Email (Meza users) |
| Push | FCM via expo-notifications | "Payroll ready", "Leave approved" |
| Styling | NativeWind v4 (Tailwind for RN) | Familiar patterns from web codebase |
| Icons | Lucide React Native | Same icon set as web |
| Charts | react-native-gifted-charts | Simple bar/line charts for summaries |
| Printing | react-native-ble-manager | Bluetooth thermal printer (ESC/POS) |
| Sharing | expo-sharing | WhatsApp receipt sharing |
| i18n | Shared translations.ts | No extra library needed |

---

## Firebase Integration

### Same Project, Same Data

Both Meza and Kaixa connect to `onit-hr-payroll` Firebase project.

```typescript
// mobile/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'onit-hr-payroll.firebaseapp.com',
  projectId: 'onit-hr-payroll',
  storageBucket: 'onit-hr-payroll.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// RN needs AsyncStorage persistence (not browser localStorage)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
```

### Auth Strategy

| User Type | Auth Method | Why |
|-----------|------------|-----|
| Kiosk owner (Tier 1) | Phone number | No email needed, SMS verification |
| Meza employee (Tier 3) | Email + password | Same as web login |
| Meza admin (Tier 3b) | Email + password | Same as web login |

Phone auth requires Firebase phone auth setup + Expo `expo-auth-session` or `@react-native-firebase/auth`.

### Firestore Paths (from shared package)

Kaixa reads/writes the same collections as Meza:

```typescript
import { paths } from '@onit/shared';

// Read employee payslips (same data as web)
const payslipRef = doc(db, paths.payslip(tenantId, '202602', employeeId));

// Write money transactions (new collection for Kaixa)
const txRef = doc(collection(db, paths.transactions(tenantId)));
```

New paths needed for Kaixa-specific data:

```typescript
// Add to packages/shared/src/lib/paths.ts
transactions: (tid: string) => `tenants/${tid}/transactions`,
transaction: (tid: string, txId: string) => `tenants/${tid}/transactions/${txId}`,
products: (tid: string) => `tenants/${tid}/products`,
product: (tid: string, prodId: string) => `tenants/${tid}/products/${prodId}`,
customerTabs: (tid: string) => `tenants/${tid}/customerTabs`,
customerTab: (tid: string, tabId: string) => `tenants/${tid}/customerTabs/${tabId}`,
```

---

## Offline-First Strategy

### Architecture

```
┌─────────────────────────────────┐
│         Kaixa App               │
│                                 │
│  ┌───────────────────────────┐  │
│  │    Local DB (SQLite)      │  │  ← User interacts with this
│  │    Tables:                │  │     Always fast, always works
│  │    - transactions         │  │
│  │    - products (POS)       │  │
│  │    - employees (cache)    │  │
│  │    - payslips (cache)     │  │
│  │    - sync_queue           │  │  ← Writes go here first
│  └─────────┬─────────────────┘  │
│            │                    │
│  ┌─────────▼─────────────────┐  │
│  │    Sync Engine            │  │
│  │    - On connectivity:     │  │
│  │      Push sync_queue →    │──┼──→ Firestore
│  │      Pull changes ←      │──┼──← Firestore
│  │    - Conflict: server wins│  │
│  │    - Retry with backoff   │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### What Works Offline

| Feature | Offline | Notes |
|---------|---------|-------|
| Money In/Out | Full | Writes to local DB, syncs later |
| POS sales | Full | Local product catalog, local sales log |
| View cached payslips | Read-only | Cached from last sync |
| View employee list | Read-only | Cached from last sync |
| Create leave request | Queue | Queued, submitted on sync |
| Login | No | Requires network |
| Process payroll | No | Cloud Function |
| Approve requests | No | Needs real-time state |

### Sync Strategy

1. **Optimistic writes**: All user actions write to local DB immediately
2. **Background sync**: When connectivity detected, push queue to Firestore
3. **Conflict resolution**: Server wins (last-write-wins for transactions, merge for settings)
4. **Pull sync**: Snapshot listeners for payslips, leave balances (when online)
5. **Retry**: Exponential backoff with max 5 retries

---

## New Cloud Functions Needed

```typescript
// functions/src/mobile.ts

// 1. Dashboard summary — single round-trip for slow networks
exports.getMobileDashboard = onCall(async (request) => {
  // Validates tenant access
  // Returns: employee count, pending approvals,
  // current payrun status, recent transactions, leave balance
});

// 2. Batch sync offline transactions
exports.syncTransactions = onCall(async (request) => {
  // Receives array of offline transactions
  // Validates, deduplicates, writes to Firestore
  // Returns sync status + server timestamps
});

// 3. Generate receipt for thermal printer
exports.generateReceipt = onCall(async (request) => {
  // Returns ESC/POS formatted receipt data
  // For Bluetooth thermal printer
});
```

---

## Screen Map

```
Auth Flow:
  login.tsx ──→ verify.tsx ──→ (tabs)/

Tab Navigation:
  ┌──────────────────────────────────┐
  │ Home │ Money │ Sales │ Profile   │
  └──┬───┘───┬───┘───┬───┘────┬─────┘
     │       │       │        │
     │       │       │        ├── Settings
     │       │       │        ├── Language (TET/EN/PT)
     │       │       │        └── Switch Tenant
     │       │       │
     │       │       ├── Product Catalog
     │       │       ├── Sell Screen
     │       │       ├── Customer Tabs
     │       │       └── Daily Sales Summary
     │       │
     │       ├── Money In form
     │       ├── Money Out form
     │       ├── Transaction History
     │       └── Weekly/Monthly Summary
     │
     ├── Dashboard (role-dependent)
     │   ├── Employee: Payslip, Leave, Timesheet
     │   └── Manager: Approvals, Payroll Status
     ├── payslip/[id] detail
     ├── leave/request form
     └── approve/[id] detail
```

---

## Firestore Security Rules (Additions)

```javascript
// Add to firestore.rules for Kaixa-specific collections
match /tenants/{tenantId}/transactions/{txId} {
  allow read, write: if isAuthenticated()
    && isTenantMember(tenantId);
}

match /tenants/{tenantId}/products/{prodId} {
  allow read: if isAuthenticated() && isTenantMember(tenantId);
  allow write: if isAuthenticated()
    && isTenantMember(tenantId)
    && hasRole(tenantId, ['owner', 'hr-admin', 'manager']);
}

match /tenants/{tenantId}/customerTabs/{tabId} {
  allow read, write: if isAuthenticated()
    && isTenantMember(tenantId);
}
```

---

## Environment Variables

```bash
# mobile/.env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=onit-hr-payroll.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=onit-hr-payroll
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=onit-hr-payroll.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

Same values as web app `VITE_FIREBASE_*` — just different prefix (`EXPO_PUBLIC_`).

---

## Key Dependencies

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "react-native": "0.76.x",
    "@react-native-async-storage/async-storage": "^2.0.0",
    "firebase": "^11.10.0",
    "zustand": "^5.0.0",
    "react-native-mmkv": "^3.0.0",
    "decimal.js": "^10.6.0",
    "zod": "^3.23.8",
    "expo-notifications": "~0.29.0",
    "nativewind": "^4.0.0",
    "lucide-react-native": "^0.462.0",
    "react-native-svg": "^15.0.0",
    "expo-sharing": "~12.0.0"
  }
}
```
