import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import {
  app,
  ensureAppCheckInitialized,
  firebaseEmulatorConfig,
} from "@/lib/firebase-core";

// HR/payroll data stays in memory on shared devices unless a managed deployment
// explicitly opts into persistent offline storage.
const usePersistentCache =
  import.meta.env.VITE_ENABLE_OFFLINE_FIRESTORE_CACHE === "true";

void ensureAppCheckInitialized();

export const db = initializeFirestore(app, {
  localCache: usePersistentCache
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache(),
  ignoreUndefinedProperties: true,
  // The Firestore emulator's WebChannel streams drop intermittently under
  // many parallel listeners (E2E runs), leaving writes queued "offline" while
  // the UI shows them applied. Long polling is reliable against the emulator;
  // production keeps the SDK's default transport.
  ...(firebaseEmulatorConfig.enabled
    ? { experimentalForceLongPolling: true }
    : {}),
});

if (firebaseEmulatorConfig.enabled) {
  connectFirestoreEmulator(
    db,
    firebaseEmulatorConfig.host,
    firebaseEmulatorConfig.firestorePort,
  );
}
