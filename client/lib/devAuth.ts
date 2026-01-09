import { auth } from "./firebase";
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User,
} from "firebase/auth";

/**
 * Development authentication helper
 * Provides easy authentication for testing Firebase permissions
 */

export const devAuthConfig = {
  // Test user credentials (you can change these)
  testEmail: "test@example.com",
  testPassword: "testpass123",

  // Development mode settings - DISABLED when Firebase is not available
  autoSignIn: false, // Disabled for local development mode
  useAnonymous: true, // Use anonymous auth if email/password fails
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string,
): Promise<User | null> => {
  if (!auth) {
    console.error("❌ Firebase Auth not initialized");
    return null;
  }

  try {
    console.log("🔐 Attempting email/password authentication for:", email);
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    console.log(
      "✅ Email authentication successful:",
      userCredential.user.email,
    );

    return userCredential.user;
  } catch (error: any) {
    console.error("❌ Email authentication failed:", error);

    // Provide helpful error information
    if (error.code === "auth/user-not-found") {
      console.warn("💡 User not found - the email may not be registered");
    } else if (error.code === "auth/wrong-password") {
      console.warn("💡 Wrong password provided");
    } else if (error.code === "auth/invalid-email") {
      console.warn("💡 Invalid email format");
    } else if (error.code === "auth/user-disabled") {
      console.warn("💡 User account has been disabled");
    }

    throw error; // Re-throw for UI handling
  }
};

/**
 * Sign in with development test user (anonymous)
 */
export const signInDev = async (): Promise<User | null> => {
  if (!auth) {
    console.error("❌ Firebase Auth not initialized");
    return null;
  }

  try {
    // If user is already signed in, return current user
    if (auth.currentUser) {
      console.log(
        "��� User already authenticated:",
        auth.currentUser.email || "Anonymous",
      );
      return auth.currentUser;
    }

    // Try anonymous authentication for development
    console.log("🔐 Attempting anonymous authentication for development...");
    const userCredential = await signInAnonymously(auth);
    console.log(
      "✅ Anonymous authentication successful:",
      userCredential.user.uid,
    );

    return userCredential.user;
  } catch (error: any) {
    console.error("❌ Development authentication failed:", error);

    // Provide helpful error information
    if (error.code === "auth/operation-not-allowed") {
      console.warn(
        "💡 Anonymous authentication is not enabled in Firebase Console",
      );
      console.warn(
        "   Go to Authentication > Sign-in method > Anonymous > Enable",
      );
    } else if (error.code === "permission-denied") {
      console.warn("💡 Permission denied - check Firestore rules");
    }

    return null;
  }
};

/**
 * Sign out current user
 */
export const signOutDev = async (): Promise<void> => {
  if (!auth) return;

  try {
    await auth.signOut();
    console.log("✅ User signed out successfully");
  } catch (error) {
    console.error("❌ Sign out failed:", error);
  }
};

/**
 * Get current authentication status
 */
export const getAuthStatus = () => {
  if (!auth) {
    return {
      isSignedIn: false,
      user: null,
      uid: null,
      email: null,
      isAnonymous: false,
    };
  }

  const user = auth.currentUser;
  return {
    isSignedIn: !!user,
    user,
    uid: user?.uid || null,
    email: user?.email || null,
    isAnonymous: user?.isAnonymous || false,
  };
};

/**
 * Auto sign in for development (called automatically)
 */
export const autoSignInDev = async (): Promise<User | null> => {
  if (!devAuthConfig.autoSignIn) {
    return null;
  }

  return signInDev();
};

// Log current auth status
if (typeof window !== "undefined") {
  console.log("🔐 Development authentication helper loaded");

  // Auto-sign in after a short delay to let Firebase initialize
  setTimeout(() => {
    if (devAuthConfig.autoSignIn && auth) {
      autoSignInDev().then((user) => {
        if (user) {
          console.log("✅ Auto sign-in successful");
        } else {
          console.warn(
            "⚠️ Auto sign-in failed - you may need to manually authenticate",
          );
        }
      });
    } else if (!auth) {
      console.log("🔧 Firebase auth disabled - skipping auto sign-in");
    }
  }, 1000);
}
