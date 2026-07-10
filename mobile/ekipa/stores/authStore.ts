/**
 * Auth store — Firebase auth state for Ekipa
 * Adapted from Kaixa — no standalone fallback (employees must have tenantAccess)
 */
import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, db } from '../lib/firebase';
import { unregisterPushNotifications } from '../lib/notifications';

// Web OAuth client of the onit-hr-payroll project (a public identifier, not a
// secret — it ships in every client). Native Google Sign-In mints an idToken
// for this audience, which Firebase Auth accepts via signInWithCredential.
const GOOGLE_WEB_CLIENT_ID =
  '415646082318-97umvlac4hkl7kk321gcnu0hv9lb16u9.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

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
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') {
        // User dismissed the account picker — not an error.
        return;
      }
      const idToken = result.data.idToken;
      if (!idToken) throw new Error('Google sign-in returned no idToken');
      set({ loading: true });
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      // onAuthStateChanged will handle the rest
    } catch (err: unknown) {
      console.warn('Google sign-in failed:', err);
      set({ loading: false, error: 'google' });
    }
  },

  signOut: async () => {
    try {
      const currentUserId = auth.currentUser?.uid;
      if (currentUserId) {
        await unregisterPushNotifications(currentUserId);
      }
      // Also drop the Google session so the account picker shows next time.
      await GoogleSignin.signOut().catch(() => {});
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
