# Firebase Cleanup - January 2026

## Overview

Major cleanup of Firebase integration to remove workarounds, fallbacks, and experimental code. The codebase now uses a clean, direct Firebase connection without any mock data or offline fallbacks.

## Firebase Project

- **Project ID**: `onit-hr-payroll`
- **Console**: https://console.firebase.google.com/project/onit-hr-payroll/overview
- **Created**: January 11, 2026

## Files Deleted

### Firebase Workaround Files (14 files)
| File | Purpose (before deletion) |
|------|---------------------------|
| `firebaseAutoOffline.ts` | Auto-switch to offline mode on errors |
| `firebaseBlocker.ts` | Block Firebase requests |
| `firebaseBypass.ts` | Direct Firestore access bypassing auth |
| `firebaseDiagnostics.ts` | Debug Firebase connection issues |
| `firebaseIsolation.ts` | Isolate Firebase to prevent errors |
| `firebaseManager.ts` | Manage Firebase connection state |
| `firebaseOfflineMode.ts` | Force offline mode |
| `firebaseProxy.ts` | Proxy Firestore queries with fallbacks |
| `emergencyFetchFix.ts` | Fix fetch() being overwritten |
| `fetchRestore.ts` | Restore native fetch function |
| `resizeObserverFix.ts` | Suppress ResizeObserver errors |
| `simpleFirebaseTest.ts` | Test Firebase connection |
| `networkState.ts` | Track network online/offline state |
| `appMode.ts` | App mode detection (local/firebase/hybrid) |

### Authentication Workaround Files (2 files)
| File | Purpose (before deletion) |
|------|---------------------------|
| `localAuth.ts` | Local authentication without Firebase |
| `devAuth.ts` | Development authentication helpers |

### Mock/Fallback Data Files (2 files)
| File | Purpose (before deletion) |
|------|---------------------------|
| `mockDataService.ts` | Mock data when Firebase unavailable |
| `data.ts` | Static data definitions |

### Unused Components (8 files)
| File | Purpose (before deletion) |
|------|---------------------------|
| `FirebaseTestComponent.tsx` | UI to test Firebase connection |
| `FirebaseIsolationControl.tsx` | UI to toggle Firebase isolation |
| `DevAuthControl.tsx` | UI for dev authentication |
| `FetchDiagnostic.tsx` | UI to diagnose fetch issues |
| `DataSourceIndicator.tsx` | Show data source (Firebase/mock) |
| `LocalDataStatus.tsx` | Show local data status |
| `ModeSelector.tsx` | Select app mode |
| `FirestoreRulesDeploy.tsx` | Deploy Firestore rules from UI |

### Backup/Duplicate Files (10+ files)
| File | Reason for deletion |
|------|---------------------|
| `MainNavigation.firebase.backup.tsx` | Backup file |
| `MainNavigation.clean.tsx` | Cleanup version |
| `Dashboard.clean.tsx` | Cleanup version |
| `Dashboard.firebase.backup.tsx` | Backup file |
| `HotDogStyleNavigation.tsx` | Replaced by MainNavigation |
| `HotDogNavigation.tsx` | Replaced by MainNavigation |
| `CreateJob.tsx` | Unused (CreateJobLocal.tsx is used) |
| `CreateJobTenant.tsx` | Unused |
| `TimeLeave Dashboard.tsx` | Duplicate (space in filename) |
| `StaffDashboard.tsx` (in staff/) | Duplicate |
| `SimpleLogin.tsx` | Unused |
| `QuickLogin.tsx` | Unused |
| `DirectEmailLogin.tsx` | Unused |
| `DashboardLogin.tsx` | Unused |

## Files Simplified

### `client/lib/firebase.ts`
**Before**: ~200 lines with emulator detection, connection testing, retry logic, error handling
**After**: 25 lines - clean Firebase initialization

```typescript
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "...",
  authDomain: "onit-hr-payroll.firebaseapp.com",
  projectId: "onit-hr-payroll",
  storageBucket: "onit-hr-payroll.firebasestorage.app",
  messagingSenderId: "...",
  appId: "...",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
```

### `client/contexts/FirebaseContext.tsx`
**Before**: ~150 lines with multiple fallback modes, mock data switching
**After**: ~100 lines - simple connection check, online/offline status

### `client/contexts/AuthContext.tsx`
**Before**: Multiple fallback paths, local auth integration
**After**: Clean Firebase Auth with `onAuthStateChanged`

### Services
All services (`departmentService.ts`, `employeeService.ts`, `candidateService.ts`) simplified:
- Removed all fallback/mock data logic
- Removed `isFirebaseReady()`, `isFirebaseBlocked()` checks
- Direct Firestore operations only

### Navigation
- All pages now use `MainNavigation` component
- Removed `HotDogStyleNavigation` and `HotDogNavigation` variants
- Navigation uses `useAuth` hook for user info

### Settings Page
- Removed debug panels (Firebase isolation, fetch diagnostic, dev auth)
- Shows simple Firebase connection status
- Uses `useAuth` and `useFirebase` hooks

## Current Architecture

```
client/
├── lib/
│   └── firebase.ts          # Firebase initialization (25 lines)
├── contexts/
│   ├── AuthContext.tsx      # Firebase Auth state
│   ├── FirebaseContext.tsx  # Firebase connection state
│   └── TenantContext.tsx    # Multi-tenant context
├── services/
│   ├── authService.ts       # Auth operations
│   ├── employeeService.ts   # Employee CRUD
│   ├── departmentService.ts # Department CRUD
│   └── candidateService.ts  # Candidate CRUD
└── components/
    └── layout/
        └── MainNavigation.tsx  # Single navigation component
```

## Breaking Changes

1. **No offline mode** - App requires Firebase connection
2. **No mock data** - All data comes from Firestore
3. **No local auth** - Must use Firebase Authentication
4. **Single navigation** - All pages use MainNavigation

## Testing

After cleanup:
- Dev server starts without errors
- Firebase connection established
- Auth state properly tracked
- Services query Firestore directly

## Next Steps

1. Set up proper Firestore security rules
2. Create initial data in Firestore (departments, employees)
3. Implement the Payroll module (currently placeholder)
4. Add proper error handling/loading states in UI
