// Firebase SDK imports
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

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

// Initialize Firestore with persistent cache for offline reads and faster repeat loads
// Safari 15+ (2021) has stable IndexedDB; Firebase SDK v11 handles edge cases
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Initialize other services
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
