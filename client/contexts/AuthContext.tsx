import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, getIdTokenResult } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { authService } from "@/services/authService";
import { UserProfile, createUserProfile } from "@/types/user";
import { paths } from "@/lib/paths";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<User | null>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<User | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Fetch user profile from Firestore (does NOT auto-create)
  const fetchUserProfile = useCallback(async (firebaseUser: User): Promise<UserProfile | null> => {
    if (!db) return null;

    try {
      const userDocRef = doc(db, paths.user(firebaseUser.uid));
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const profile = { ...userDocSnap.data(), uid: firebaseUser.uid } as UserProfile;

        // Update last login
        try {
          await setDoc(userDocRef, { lastLoginAt: serverTimestamp() }, { merge: true });
        } catch (e) {
          // Ignore if we can't update last login (might not have permission yet)
        }

        return profile;
      } else {
        // No profile exists - user needs to complete setup
        // Don't auto-create, let /admin/setup or /auth/signup handle it
        console.log("User has no profile, needs setup");
        return null;
      }
    } catch (error) {
      console.warn("Could not fetch user profile:", error);
      return null;
    }
  }, []);

  // Check if user is superadmin (from custom claims or profile)
  const checkSuperAdmin = useCallback(async (firebaseUser: User, profile: UserProfile | null): Promise<boolean> => {
    // First check custom claims (fast path, set by Cloud Functions)
    try {
      const tokenResult = await getIdTokenResult(firebaseUser, true);
      if (tokenResult.claims.superadmin === true) {
        return true;
      }
    } catch (error) {
      console.warn("Could not get ID token claims:", error);
    }

    // Fall back to Firestore profile
    return profile?.isSuperAdmin === true;
  }, []);

  // Refresh user profile manually
  const refreshUserProfile = useCallback(async () => {
    if (!user) return;

    const profile = await fetchUserProfile(user);
    setUserProfile(profile);

    const isAdmin = await checkSuperAdmin(user, profile);
    setIsSuperAdmin(isAdmin);
  }, [user, fetchUserProfile, checkSuperAdmin]);

  useEffect(() => {
    console.log("AuthProvider initializing with Firebase authentication");

    try {
      if (!auth) {
        console.log("Firebase auth disabled, using fallback mode");
        setUser(null);
        setUserProfile(null);
        setIsSuperAdmin(false);
        setLoading(false);
        return () => {};
      }

      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        try {
          setLoading(true);
          setUser(firebaseUser);

          if (firebaseUser) {
            console.log(
              "User authenticated:",
              firebaseUser.email || firebaseUser.uid,
            );

            // Load user profile from Firestore
            const profile = await fetchUserProfile(firebaseUser);
            setUserProfile(profile);

            // Check superadmin status
            const isAdmin = await checkSuperAdmin(firebaseUser, profile);
            setIsSuperAdmin(isAdmin);

            if (isAdmin) {
              console.log("User is a superadmin");
            }
          } else {
            console.log("User not authenticated");
            setUserProfile(null);
            setIsSuperAdmin(false);
          }
        } catch (error) {
          console.error("Auth state change error:", error);
          setUserProfile(null);
          setIsSuperAdmin(false);
        } finally {
          setLoading(false);
        }
      });

      return () => {
        console.log("Cleaning up auth listener");
        unsubscribe();
      };
    } catch (error) {
      console.warn("Firebase auth listener setup failed, using fallback:", error);

      setUser(null);
      setUserProfile(null);
      setIsSuperAdmin(false);
      setLoading(false);

      return () => {};
    }
  }, [fetchUserProfile, checkSuperAdmin]);

  const signIn = async (email: string, password: string) => {
    try {
      const user = await authService.signIn(email, password);
      return user;
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    try {
      const user = await authService.signUp(email, password, displayName);
      return user;
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await authService.signOut();
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authService.resetPassword(email);
    } catch (error) {
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    isSuperAdmin,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
