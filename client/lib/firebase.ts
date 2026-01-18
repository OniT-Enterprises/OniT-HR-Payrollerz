// Firebase SDK imports
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

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

// Initialize Firestore with memory cache (avoids Safari IndexedDB issues)
// Using memory cache for better cross-browser compatibility
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

// Initialize other services
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
