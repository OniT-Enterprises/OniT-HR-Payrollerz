/**
 * Auth store — Firebase auth state for Ekipa
 * Adapted from Kaixa — no standalone fallback (employees must have tenantAccess)
 */
import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithGoogleNative, signOutGoogleNative } from '@xefe/mobile';
import { auth, db } from '../lib/firebase';
import { unregisterPushNotifications } from '../lib/notifications';
import { usePayslipStore } from './payslipStore';
import { useTenantStore } from './tenantStore';

interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  tenantAccess?: Record<string, { name: string; role: string }>;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function getAuthErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    if (typeof code === 'string' && code) {
      return code;
    }
  }
  return null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  signIn: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle the rest
    } catch (err: unknown) {
      const code = getAuthErrorCode(err);
      set({
        loading: false,
        error:
          code === 'auth/invalid-credential'
            ? 'invalid'
            : code === 'auth/too-many-requests'
              ? 'tooMany'
              : 'generic',
      });
    }
  },

  signInWithGoogle: async () => {
    set({ error: null });
    try {
      set({ loading: true });
      const result = await signInWithGoogleNative(auth);
      if (result.type === 'cancelled') {
        // User dismissed the account picker — not an error.
        set({ loading: false });
        return;
      }
      // onAuthStateChanged will handle the rest
    } catch (err: unknown) {
      console.warn('Google sign-in failed:', err);
      set({ loading: false, error: 'google' });
    }
  },

  signOut: async () => {
    // Best-effort pre-sign-out cleanup, all while the session is still valid:
    //  - unregister push so the device stops receiving this user's notifications
    //  - wipe sensitive cached salary/tenant data so nothing lingers on a
    //    shared device after sign-out
    //  - drop the Google session so the account picker shows next time
    // NONE of these may block the actual sign-out: if any rejects, the session
    // must still be dropped (a prior regression left users signed in when a
    // pre-clear threw). allSettled ensures each runs and no rejection escapes.
    const currentUserId = auth.currentUser?.uid;
    await Promise.allSettled([
      currentUserId
        ? unregisterPushNotifications(currentUserId)
        : Promise.resolve(),
      usePayslipStore.getState().clearCache(),
      useTenantStore.getState().clearTenant(),
      signOutGoogleNative(),
    ]);

    try {
      await firebaseSignOut(auth);
      set({ user: null, profile: null });
    } catch {
      // Silent fail on sign out
    }
  },

  clearError: () => set({ error: null }),
}));

// Listen for auth state changes and load user profile
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      const profileData = profileDoc.exists() ? profileDoc.data() : null;

      useAuthStore.setState({
        user,
        profile: profileData
          ? {
              uid: user.uid,
              displayName: profileData.displayName || user.displayName || '',
              email: user.email,
              tenantAccess: profileData.tenantAccess,
            }
          : {
              uid: user.uid,
              displayName: user.displayName || '',
              email: user.email,
            },
        loading: false,
      });
    } catch {
      useAuthStore.setState({
        user,
        profile: {
          uid: user.uid,
          displayName: user.displayName || '',
          email: user.email,
        },
        loading: false,
      });
    }
  } else {
    useAuthStore.setState({ user: null, profile: null, loading: false });
  }
});
