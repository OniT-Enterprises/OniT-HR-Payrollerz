import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, getIdTokenResult } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { authService } from "@/services/authService";
import { UserProfile } from "@/types/user";
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

// eslint-disable-next-line react-refresh/only-export-components
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
        } catch {
          // Ignore if we can't update last login (might not have permission yet)
        }

        return profile;
      } else {
        // No profile exists - user needs to complete setup
        // Don't auto-create, let /admin/setup or /auth/signup handle it
        return null;
      }
    } catch {
      return null;
    }
  }, []);

  // Refresh user profile manually
  const refreshUserProfile = useCallback(async () => {
    const activeUser = user ?? auth?.currentUser;
    if (!activeUser) return;

    if (!user) {
      setUser(activeUser);
    }

    // Run profile fetch and token claim check in parallel
    const [profile, tokenIsAdmin] = await Promise.all([
      fetchUserProfile(activeUser),
      getIdTokenResult(activeUser, true)
        .then(r => r.claims.superadmin === true)
        .catch(() => false),
    ]);
    setUserProfile(profile);
    // Token claim is authoritative; profile.isSuperAdmin is fallback
    setIsSuperAdmin(tokenIsAdmin || profile?.isSuperAdmin === true);
  }, [user, fetchUserProfile]);

  useEffect(() => {
    try {
      if (!auth) {
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
            // Run profile fetch and token claim check in parallel
            const [profile, tokenIsAdmin] = await Promise.all([
              fetchUserProfile(firebaseUser),
              getIdTokenResult(firebaseUser, true)
                .then(r => r.claims.superadmin === true)
                .catch(() => false),
            ]);
            setUserProfile(profile);
            // Token claim is authoritative; profile.isSuperAdmin is fallback
            setIsSuperAdmin(tokenIsAdmin || profile?.isSuperAdmin === true);
          } else {
            setUserProfile(null);
            setIsSuperAdmin(false);
          }
        } catch {
          setUserProfile(null);
          setIsSuperAdmin(false);
        } finally {
          setLoading(false);
        }
      });

      return () => {
        unsubscribe();
      };
    } catch {

      setUser(null);
      setUserProfile(null);
      setIsSuperAdmin(false);
      setLoading(false);

      return () => {};
    }
  }, [fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    const user = await authService.signIn(email, password);
    return user;
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    const user = await authService.signUp(email, password, displayName);
    return user;
  };

  const signOut = async () => {
    await authService.signOut();
  };

  const resetPassword = async (email: string) => {
    await authService.resetPassword(email);
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
      {loading ? <div className="min-h-screen bg-background" /> : children}
    </AuthContext.Provider>
  );
}
