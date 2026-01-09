import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authService, UserProfile } from "@/services/authService";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User | null>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<User | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
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

  useEffect(() => {
    console.log("🔧 AuthProvider initializing with Firebase authentication");

    // Try to set up Firebase auth state listener safely
    try {
      if (!auth) {
        console.log("🔧 Firebase auth disabled, using fallback mode");
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        return () => {};
      }

      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        try {
          setLoading(true);
          setUser(firebaseUser);

          if (firebaseUser) {
            console.log(
              "✅ User authenticated:",
              firebaseUser.email || firebaseUser.uid,
            );
            // Load user profile if available
            try {
              const profile = await authService.getUserProfile(firebaseUser.uid);
              setUserProfile(profile);
            } catch (error) {
              console.warn("Could not load user profile:", error);
              setUserProfile(null);
            }
          } else {
            console.log("❌ User not authenticated");
            setUserProfile(null);
          }
        } catch (error) {
          console.error("Auth state change error:", error);
        } finally {
          setLoading(false);
        }
      });

      return () => {
        console.log("🧹 Cleaning up auth listener");
        unsubscribe();
      };
    } catch (error) {
      console.warn("🚨 Firebase auth listener setup failed, using fallback:", error);
      
      // Fallback: Set default state without Firebase listener
      setUser(null);
      setUserProfile(null);
      setLoading(false);
      
      return () => {
        // No cleanup needed for fallback
      };
    }
  }, []);

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
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
