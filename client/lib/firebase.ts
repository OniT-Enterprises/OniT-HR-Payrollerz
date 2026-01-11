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

// Firebase configuration for onit-hr-payroll project
const firebaseConfig = {
  apiKey: "AIzaSyAjCVU27QTqDseLYoP3UyEMV6evVwi_exQ",
  authDomain: "onit-hr-payroll.firebaseapp.com",
  projectId: "onit-hr-payroll",
  storageBucket: "onit-hr-payroll.firebasestorage.app",
  messagingSenderId: "415646082318",
  appId: "1:415646082318:web:0c72df4a47d24ea2e4a35f",
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
