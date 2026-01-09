// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getFirestore,
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork,
} from "firebase/firestore";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Import emergency fetch fix to completely resolve "Failed to fetch" errors
import "./emergencyFetchFix";

// Global Firebase status
let firebaseInitialized = false;
let firebaseError: string | null = null;
let networkEnabled = false;
let connectivityCheckInProgress = false;
let firebaseBlocked = false;

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVdpT-32mvHyfJi03eHVN4IkZtnFVh3xs",
  authDomain: "onit-payroll.firebaseapp.com",
  projectId: "onit-payroll",
  storageBucket: "onit-payroll.firebasestorage.app",
  messagingSenderId: "797230079174",
  appId: "1:797230079174:web:c95536b46c82eea6300bc7",
  measurementId: "G-G2SP080W34",
};

// Initialize Firebase with error handling
let app: any = null;
let db: any = null;
let auth: any = null;
let storage: any = null;
let analytics: any = null;

const shouldUseEmulator = () => {
  // Use emulator in development
  const isDev = import.meta.env.DEV || process.env.NODE_ENV === "development";
  return isDev;
};

try {
  app = initializeApp(firebaseConfig);

  // Initialize Firestore with emulator connection
  try {
    db = getFirestore(app);
    if (shouldUseEmulator()) {
      try {
        connectFirestoreEmulator(db, "127.0.0.1", 8081);
        console.log("✅ Connected to Firestore Emulator on port 8081");
      } catch (error: any) {
        // Already connected or other error
        if (!error.message?.includes("already called")) {
          console.warn("⚠️ Firestore Emulator connection issue:", error.message);
        }
      }
    }
    firebaseInitialized = true;
    console.log("✅ Firestore initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Firestore:", error);
    firebaseError = "Failed to initialize Firestore";
  }

  // Initialize Auth with emulator connection
  try {
    auth = getAuth(app);
    if (shouldUseEmulator()) {
      try {
        connectAuthEmulator(auth, "http://127.0.0.1:9100", {
          disableWarnings: true,
        });
        console.log("✅ Connected to Auth Emulator on port 9100");
      } catch (error: any) {
        // Already connected or other error
        if (!error.message?.includes("already called")) {
          console.warn("⚠️ Auth Emulator connection issue:", error.message);
        }
      }
    }
  } catch (error) {
    console.error("❌ Failed to initialize Auth:", error);
  }

  try {
    storage = getStorage(app);
  } catch (error) {
    console.error("❌ Failed to initialize Storage:", error);
  }

  try {
    analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
  } catch (error) {
    console.warn("⚠️ Analytics not available:", error);
  }
} catch (error) {
  console.error("❌ Failed to initialize Firebase:", error);
  firebaseError = `Firebase initialization failed: ${error}`;
  firebaseBlocked = true;
}

// Removed fetch wrapper that was interfering with Firebase operations

// Authentication helper (optional, not required for basic operations)
export const tryAuthentication = async (): Promise<boolean> => {
  if (!auth) {
    console.warn("Auth not initialized");
    return false;
  }

  try {
    // If user is already signed in, return true
    if (auth.currentUser) {
      console.log("✅ User already authenticated");
      return true;
    }

    // Try anonymous authentication for development
    console.log("🔐 Attempting anonymous authentication...");
    const userCredential = await signInAnonymously(auth);
    console.log(
      "✅ Anonymous authentication successful",
      userCredential.user.uid,
    );

    // Enable Firebase network after successful authentication
    await enableFirebaseNetwork();

    return true;
  } catch (error: any) {
    console.warn("❌ Authentication failed:", error);
    // Check if it's a permissions error and provide guidance
    if (
      error.code === "permission-denied" ||
      error.message?.includes("Missing or insufficient permissions")
    ) {
      console.warn(
        "🔒 Permissions issue detected. Check Firestore rules and authentication setup.",
      );
    }
    return false;
  }
};

// Export Firebase status checking functions
export const isFirebaseReady = () => firebaseInitialized && !firebaseBlocked;
export const getFirebaseError = () => firebaseError;
export const isNetworkEnabled = () => networkEnabled && !firebaseBlocked;
export const isFirebaseBlocked = () => firebaseBlocked;
export const blockFirebase = () => {
  firebaseBlocked = true;
  networkEnabled = false;
  console.warn("🚫 Firebase operations blocked due to network issues");
};
export const unblockFirebase = () => {
  firebaseBlocked = false;
  console.log("✅ Firebase operations unblocked");
};

// DEPRECATED: Use firebaseManager instead
// These functions are kept for backward compatibility but delegate to the safe manager
export const enableFirebaseNetwork = async (): Promise<boolean> => {
  const { firebaseManager } = await import("./firebaseManager");
  const result = await firebaseManager.testConnection();
  return result;
};

export const disableFirebaseNetwork = async (): Promise<boolean> => {
  const { firebaseManager } = await import("./firebaseManager");
  return firebaseManager.disableNetwork();
};

// DEPRECATED: Use firebaseManager.testConnection() instead
// This function is kept for backward compatibility but delegates to the safe manager
export const testFirebaseConnection = async (): Promise<boolean> => {
  if (!firebaseInitialized || firebaseBlocked) {
    return false;
  }

  try {
    // Try to authenticate with the emulator
    if (auth && !auth.currentUser) {
      await signInAnonymously(auth);
    }
    return true;
  } catch (error) {
    console.warn("🔥 Firebase connection test failed:", error);
    return false;
  }
};

// Removed error handler that was interfering with Firebase

// Export services (will be null if initialization failed)
export { db, auth, storage, analytics };
export default app;
