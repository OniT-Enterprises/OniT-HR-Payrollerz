/**
 * Shared Firebase bootstrap for the Xefe mobile family.
 *
 * Both apps talk to the same onit-hr-payroll project with the same setup:
 *  - Auth persisted in AsyncStorage (sessions survive restarts)
 *  - Firestore memory-only cache (business data is not persisted on device)
 *
 * EXPO_PUBLIC_* env vars are inlined per-app at bundle time, so each app keeps
 * providing them via its own .env.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  // @ts-ignore - getReactNativePersistence is exported by the React Native
  // bundle; whether the types see it depends on each app's module resolution.
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

export interface XefeFirebase {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

export function initXefeFirebase(): XefeFirebase {
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

  // Auth with AsyncStorage persistence — initializeAuth throws on hot reload
  // if already initialized, so fall back to the existing instance.
  let auth: Auth;
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }

  // Firestore with memory cache
  let db: Firestore;
  try {
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
  } catch {
    db = getFirestore(app);
  }

  return { app, auth, db };
}
