import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, getIdTokenResult } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";
import { auth, db } from "@/lib/firebase";
import { authService } from "@/services/authService";
import {
  clearPersistedQueryCache,
  hydrateQueryClient,
  setupQueryPersistence,
} from "@/lib/queryCache";
import { UserProfile } from "@/types/user";
import { paths } from "@/lib/paths";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  /** The outcome of the latest Firestore profile read. `missing` is only set
   * after a successful read confirms that the document does not exist. */
  profileStatus: "idle" | "loading" | "found" | "missing" | "error";
  profileError: string | null;
  loading: boolean;
  /** True once the latest Firebase auth-state callback has finished resolving.
   * Until then, guards must not make redirect decisions. */
  authResolved: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<User | null>;
  signInWithGoogle: () => Promise<User | null>;
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

const AUTH_CACHE_KEY = 'meza-auth-cache';
const AUTH_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface AuthCache {
  uid: string;
  email: string | null;
  displayName: string | null;
  profile: UserProfile | null;
  isSuperAdmin: boolean;
  timestamp: number;
}

function readAuthCache(expectedUid: string): AuthCache | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const data: AuthCache = JSON.parse(raw);
    if (
      data.uid !== expectedUid ||
      typeof data.timestamp !== "number" ||
      Date.now() - data.timestamp > AUTH_CACHE_TTL
    ) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(AUTH_CACHE_KEY);
    return null;
  }
}

function writeAuthCache(data: Omit<AuthCache, 'timestamp'>): void {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<AuthContextType["profileStatus"]>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const activeUidRef = useRef<string | null>(null);
  const profileRequestRef = useRef(0);

  // Never hydrate browser-persisted data until Firebase has authenticated a
  // specific user. This blocks old account data from appearing during a
  // shared-device sign-in and scopes every persisted entry by UID.
  useEffect(() => {
    if (!authResolved) return;

    let active = true;
    queryClient.clear();

    if (!user) {
      void clearPersistedQueryCache();
      return () => {
        active = false;
      };
    }

    const unsubscribe = setupQueryPersistence(queryClient, user.uid);
    void hydrateQueryClient(queryClient, user.uid, () => active);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authResolved, queryClient, user]);

  // Fetch user profile from Firestore (does NOT auto-create)
  const fetchUserProfile = useCallback(async (firebaseUser: User): Promise<UserProfile | null> => {
    if (!db) {
      throw new Error("Database is unavailable");
    }

    try {
      const userDocRef = doc(db, paths.user(firebaseUser.uid));
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const profile = { ...userDocSnap.data(), uid: firebaseUser.uid } as UserProfile;

        // Last-login telemetry must never turn a successful profile read into a failed sign-in.
        void setDoc(userDocRef, { lastLoginAt: serverTimestamp() }, { merge: true })
          .catch(() => {
            // Ignore if we can't update last login (might not have permission yet)
          });

        return profile;
      } else {
        // A null result exclusively means Firestore successfully confirmed that
        // no profile exists. Read errors are allowed to reach the caller.
        return null;
      }
    } catch (error) {
      // Preserve the original rejection so callers can distinguish it from a
      // successful read that confirmed a missing document.
      return Promise.reject(error);
    }
  }, []);

  const loadUserState = useCallback(async (firebaseUser: User) => {
    return Promise.allSettled([
      fetchUserProfile(firebaseUser),
      getIdTokenResult(firebaseUser, true),
    ] as const);
  }, [fetchUserProfile]);

  const applySuccessfulProfile = useCallback((
    firebaseUser: User,
    profile: UserProfile | null,
    tokenAdminState: boolean | null,
  ) => {
    // A freshly read profile and a refreshed claim are both current authority
    // sources. The stricter token-over-cache rule is reserved for profile-read
    // failures, where the only alternative is potentially stale browser data.
    const admin = tokenAdminState === true || profile?.isSuperAdmin === true;
    setUserProfile(profile);
    setProfileStatus(profile ? "found" : "missing");
    setProfileError(null);
    setIsSuperAdmin(admin);
    writeAuthCache({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      profile,
      isSuperAdmin: admin,
    });
  }, []);

  // Refresh user profile manually
  const refreshUserProfile = useCallback(async () => {
    const activeUser = auth?.currentUser ?? user;
    if (!activeUser) return;

    const requestId = ++profileRequestRef.current;
    const cached = readAuthCache(activeUser.uid);
    activeUidRef.current = activeUser.uid;
    if (user?.uid !== activeUser.uid) {
      setUser(activeUser);
      setUserProfile(null);
      setIsSuperAdmin(false);
    }

    setLoading(true);
    setProfileStatus("loading");
    setProfileError(null);

    try {
      const [profileResult, tokenResult] = await loadUserState(activeUser);
      if (
        profileRequestRef.current !== requestId ||
        activeUidRef.current !== activeUser.uid
      ) {
        return;
      }

      const tokenAdminState = tokenResult.status === "fulfilled"
        ? tokenResult.value.claims.superadmin === true
        : null;

      if (profileResult.status === "fulfilled") {
        applySuccessfulProfile(activeUser, profileResult.value, tokenAdminState);
      } else {
        console.error("Failed to refresh user profile:", profileResult.reason);
        setUserProfile(cached?.profile ?? null);
        setIsSuperAdmin(tokenAdminState ?? (cached?.isSuperAdmin === true));
        setProfileStatus("error");
        setProfileError(
          profileResult.reason instanceof Error
            ? profileResult.reason.message
            : "Failed to load user profile",
        );
      }
    } finally {
      if (
        profileRequestRef.current === requestId &&
        activeUidRef.current === activeUser.uid
      ) {
        setLoading(false);
        setAuthResolved(true);
      }
    }
  }, [user, loadUserState, applySuccessfulProfile]);

  useEffect(() => {
    try {
      if (!auth) {
        activeUidRef.current = null;
        setUser(null);
        setUserProfile(null);
        setProfileStatus("idle");
        setProfileError(null);
        setIsSuperAdmin(false);
        setLoading(false);
        setAuthResolved(true);
        return () => {};
      }

      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        const requestId = ++profileRequestRef.current;
        const nextUid = firebaseUser?.uid ?? null;
        const accountChanged = activeUidRef.current !== nextUid;
        activeUidRef.current = nextUid;

        setAuthResolved(false);
        setLoading(true);
        setUser(firebaseUser);
        setProfileError(null);
        setProfileStatus(firebaseUser ? "loading" : "idle");

        if (accountChanged) {
          // Clear the previous account before any async work begins. Matching
          // cached state can be restored below only after Firebase supplies UID.
          setUserProfile(null);
          setIsSuperAdmin(false);
          queryClient.clear();
        }

        try {
          if (firebaseUser) {
            const cached = readAuthCache(firebaseUser.uid);
            if (cached) {
              setUserProfile(cached.profile);
              setIsSuperAdmin(cached.isSuperAdmin);
            }

            const [profileResult, tokenResult] = await loadUserState(firebaseUser);
            if (
              profileRequestRef.current !== requestId ||
              activeUidRef.current !== firebaseUser.uid
            ) {
              return;
            }

            const tokenAdminState = tokenResult.status === "fulfilled"
              ? tokenResult.value.claims.superadmin === true
              : null;

            if (profileResult.status === "fulfilled") {
              applySuccessfulProfile(firebaseUser, profileResult.value, tokenAdminState);
            } else {
              console.error("Failed to load user profile:", profileResult.reason);
              setUserProfile(cached?.profile ?? null);
              setIsSuperAdmin(tokenAdminState ?? (cached?.isSuperAdmin === true));
              setProfileStatus("error");
              setProfileError(
                profileResult.reason instanceof Error
                  ? profileResult.reason.message
                  : "Failed to load user profile",
              );
            }
          } else {
            setUserProfile(null);
            setProfileStatus("idle");
            setProfileError(null);
            setIsSuperAdmin(false);
            localStorage.removeItem(AUTH_CACHE_KEY);
          }
        } catch (error) {
          if (profileRequestRef.current === requestId) {
            console.error("Authentication state resolution failed:", error);
            setProfileStatus(firebaseUser ? "error" : "idle");
            setProfileError(
              firebaseUser
                ? error instanceof Error
                  ? error.message
                  : "Failed to restore your account"
                : null,
            );
          }
        } finally {
          if (profileRequestRef.current === requestId) setLoading(false);
          if (profileRequestRef.current === requestId) setAuthResolved(true);
        }
      });

      return () => {
        unsubscribe();
      };
    } catch {
      activeUidRef.current = null;
      setUser(null);
      setUserProfile(null);
      setProfileStatus("idle");
      setProfileError(null);
      setIsSuperAdmin(false);
      setLoading(false);
      setAuthResolved(true);

      return () => {};
    }
  }, [loadUserState, applySuccessfulProfile, queryClient]);

  const signIn = async (email: string, password: string) => {
    const user = await authService.signIn(email, password);
    return user;
  };

  const signInWithGoogle = async () => {
    const user = await authService.signInWithGoogle();
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
    ++profileRequestRef.current;
    activeUidRef.current = null;
    localStorage.removeItem(AUTH_CACHE_KEY);
    queryClient.clear();
    setUser(null);
    setUserProfile(null);
    setProfileStatus("idle");
    setProfileError(null);
    setIsSuperAdmin(false);
    setLoading(true);
    setAuthResolved(false);
    try {
      await clearPersistedQueryCache();
    } catch (error) {
      // A browser-storage failure must not prevent Firebase from signing out.
      console.warn("Failed to clear persisted query cache during sign-out:", error);
    }
    try {
      await authService.signOut();
      // Firebase normally resolves this in onAuthStateChanged. Keep the public
      // app usable if an adapter signs out without emitting another callback.
      if (!auth?.currentUser && activeUidRef.current === null) {
        setLoading(false);
        setAuthResolved(true);
      }
    } catch (error) {
      const currentUser = auth?.currentUser;
      if (currentUser) {
        activeUidRef.current = currentUser.uid;
        setUser(currentUser);
        setAuthResolved(true);
        setLoading(false);
        await refreshUserProfile();
      } else {
        setLoading(false);
        setAuthResolved(true);
      }
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    await authService.resetPassword(email);
  };

  const value: AuthContextType = {
    user,
    userProfile,
    profileStatus,
    profileError,
    loading,
    authResolved,
    isSuperAdmin,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
