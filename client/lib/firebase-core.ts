import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

function getRequiredEnv(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Copy .env.example to .env.local and fill in the Firebase config values.`,
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: getRequiredEnv("VITE_FIREBASE_API_KEY", import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: getRequiredEnv("VITE_FIREBASE_AUTH_DOMAIN", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: getRequiredEnv("VITE_FIREBASE_PROJECT_ID", import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: getRequiredEnv("VITE_FIREBASE_STORAGE_BUCKET", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: getRequiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: getRequiredEnv("VITE_FIREBASE_APP_ID", import.meta.env.VITE_FIREBASE_APP_ID),
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const firebaseEmulatorConfig = {
  enabled: import.meta.env.VITE_USE_EMULATORS === "true",
  host: import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "localhost",
  authPort: Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || 9100),
  firestorePort: Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || 8081),
  storagePort: Number(import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_PORT || 9199),
  functionsPort: Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT || 5001),
};

if (firebaseEmulatorConfig.enabled) {
  connectAuthEmulator(
    auth,
    `http://${firebaseEmulatorConfig.host}:${firebaseEmulatorConfig.authPort}`,
    { disableWarnings: true },
  );
}

let storageInstance: import("firebase/storage").FirebaseStorage | null = null;
let functionsInstance: import("firebase/functions").Functions | null = null;
let appCheckPromise: Promise<void> | null = null;

export function ensureAppCheckInitialized(): Promise<void> {
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY;
  if (!recaptchaKey) return Promise.resolve();
  if (!appCheckPromise) {
    appCheckPromise = import("firebase/app-check")
      .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
          isTokenAutoRefreshEnabled: true,
        });
      })
      .catch(() => {
        // App Check must not strand a user when its script is blocked. Firebase
        // security rules remain authoritative and the next load can retry.
        appCheckPromise = null;
      });
  }
  return appCheckPromise;
}

export async function getStorageLazy() {
  if (!storageInstance) {
    const { getStorage, connectStorageEmulator } = await import("firebase/storage");
    storageInstance = getStorage(app);
    if (firebaseEmulatorConfig.enabled) {
      connectStorageEmulator(
        storageInstance,
        firebaseEmulatorConfig.host,
        firebaseEmulatorConfig.storagePort,
      );
    }
  }
  return storageInstance;
}

export async function getFunctionsLazy() {
  if (!functionsInstance) {
    const { getFunctions, connectFunctionsEmulator } = await import("firebase/functions");
    functionsInstance = getFunctions(app);
    if (firebaseEmulatorConfig.enabled) {
      connectFunctionsEmulator(
        functionsInstance,
        firebaseEmulatorConfig.host,
        firebaseEmulatorConfig.functionsPort,
      );
    }
  }
  return functionsInstance;
}
