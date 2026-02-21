/**
 * Firebase configuration for Ekipa mobile app
 * Connects to the same onit-hr-payroll Firebase project as Meza web and Kaixa
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  // @ts-ignore - getReactNativePersistence is exported in the RN bundle
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

// Auth with AsyncStorage persistence
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

// Storage for attendance photos
import { getStorage, type FirebaseStorage } from 'firebase/storage';
export const storage: FirebaseStorage = getStorage(app);

export default app;
