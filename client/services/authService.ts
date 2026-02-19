import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  role?: "admin" | "hr" | "manager" | "employee";
  department?: string;
}

class AuthService {
  async signIn(email: string, password: string): Promise<User | null> {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  }

  async signUp(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<User | null> {
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      if (displayName && result.user) {
        await updateProfile(result.user, { displayName });
        await sendEmailVerification(result.user);
      }

      return result.user;
    } catch (error) {
      console.error("Error signing up:", error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      sessionStorage.removeItem("impersonatingTenantId");
      sessionStorage.removeItem("impersonatingTenantName");
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
    }
  }

  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  async updateUserProfile(updates: {
    displayName?: string;
    photoURL?: string;
  }): Promise<void> {
    try {
      const user = auth.currentUser;
      if (user) {
        await updateProfile(user, updates);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  }

  getUserProfile(): UserProfile | null {
    const user = auth.currentUser;
    if (!user) return null;

    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
    };
  }
}

export const authService = new AuthService();
