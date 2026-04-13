// Firebase SDK imports — Storage and Functions are lazy-loaded (only used by 2-3 files)
import { initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { connectStorageEmulator } from "firebase/storage";

/**
 * Firebase configuration loaded from environment variables.
 *
 * SECURITY: No hardcoded fallbacks - environment variables are REQUIRED.
 * Copy .env.example to .env.local and fill in the values.
 *
 * Note: Firebase API keys are safe to expose client-side since access
 * is controlled by Firestore Security Rules, not the API key itself.
 */
function getRequiredEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Copy .env.example to .env.local and fill in the Firebase config values.`
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: getRequiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getRequiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getRequiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getRequiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getRequiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getRequiredEnv('VITE_FIREBASE_APP_ID'),
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "localhost";
const authEmulatorPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || 9100);
const firestoreEmulatorPort = Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || 8081);
const storageEmulatorPort = Number(import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_PORT || 9199);
const functionsEmulatorPort = Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT || 5001);

// Initialize Firestore with persistent cache for offline reads and faster repeat loads
// Safari 15+ (2021) has stable IndexedDB; Firebase SDK v11 handles edge cases
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Auth is always needed (blocking) — init eagerly
export const auth = getAuth(app);

if (useEmulators) {
  connectAuthEmulator(auth, `http://${emulatorHost}:${authEmulatorPort}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, emulatorHost, firestoreEmulatorPort);
}

// Storage and Functions are rarely used (2-3 files) — lazy-init on first access.
// Keeps vendor-firebase-storage (~33KB) and vendor-firebase-functions out of the critical path.
let _storage: import("firebase/storage").FirebaseStorage | null = null;
let _functions: import("firebase/functions").Functions | null = null;

export async function getStorageLazy() {
  if (!_storage) {
    const { getStorage } = await import("firebase/storage");
    _storage = getStorage(app);
    if (useEmulators) {
      connectStorageEmulator(_storage, emulatorHost, storageEmulatorPort);
    }
  }
  return _storage;
}

export async function getFunctionsLazy() {
  if (!_functions) {
    const { getFunctions } = await import("firebase/functions");
    _functions = getFunctions(app);
    if (useEmulators) {
      connectFunctionsEmulator(_functions, emulatorHost, functionsEmulatorPort);
    }
  }
  return _functions;
}

// Initialize App Check (protects Firebase APIs from abuse)
// Requires VITE_RECAPTCHA_ENTERPRISE_KEY env var; skipped in dev if not set
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY;
if (recaptchaKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
    isTokenAutoRefreshEnabled: true,
  });
}

