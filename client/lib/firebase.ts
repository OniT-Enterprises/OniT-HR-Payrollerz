// Firebase SDK imports
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED
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

// Initialize Firestore with offline persistence
export const db = getFirestore(app);

// Enable offline persistence to reduce reads and enable offline access
// This caches data locally so repeated reads don't hit the server
enableIndexedDbPersistence(db, {
  forceOwnership: true // Take ownership if another tab has it
}).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
    console.warn('Firebase persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser doesn't support persistence
    console.warn('Firebase persistence not supported in this browser');
  }
});

// Initialize other services
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
