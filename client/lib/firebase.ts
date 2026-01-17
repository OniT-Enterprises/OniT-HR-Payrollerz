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
 * Note: Firebase API keys are generally safe to expose client-side since
 * access is controlled by Firestore Security Rules, not the API key.
 * Environment variables are used for configuration flexibility.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAjCVU27QTqDseLYoP3UyEMV6evVwi_exQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "onit-hr-payroll.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "onit-hr-payroll",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "onit-hr-payroll.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "415646082318",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:415646082318:web:0c72df4a47d24ea2e4a35f",
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
