/**
 * Firebase configuration for Kaixa mobile app
 * Connects to the same onit-hr-payroll Firebase project as Meza web
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: 'onit-hr-payroll.firebaseapp.com',
  projectId: 'onit-hr-payroll',
  storageBucket: 'onit-hr-payroll.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

// Prevent re-initialization in dev (hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth with AsyncStorage persistence (not browser localStorage)
// Wrapped in try/catch — initializeAuth throws on hot reload if already initialized
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}
export { auth };

// Firestore with memory cache
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
} catch {
  db = getFirestore(app);
}
export { db };

// Cloud Functions
export const functions = getFunctions(app);

export default app;
