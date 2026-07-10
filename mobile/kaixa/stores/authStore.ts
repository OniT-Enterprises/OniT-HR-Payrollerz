/**
 * Auth store — manages Firebase auth state for Kaixa
 */
import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, db } from '../lib/firebase';

// Web OAuth client of the onit-hr-payroll project (a public identifier, not a
// secret). Native Google Sign-In mints an idToken for this audience, which
// Firebase Auth accepts via signInWithCredential.
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

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
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
    } catch (err: any) {
      set({
        loading: false,
        error: err.code === 'auth/invalid-credential'
          ? 'Invalid email or password'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please try again later.'
          : 'Sign in failed. Please try again.',
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
    } catch (err) {
      console.warn('Google sign-in failed:', err);
      set({ loading: false, error: 'Google sign-in failed. Please try again.' });
    }
  },

  resetPassword: async (email: string) => {
    set({ loading: true, error: null });
    try {
      await sendPasswordResetEmail(auth, email);
      set({ loading: false });
    } catch (err: any) {
      const message = err.code === 'auth/invalid-email'
        ? 'Enter a valid email address.'
        : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please try again later.'
          : 'Could not send the reset email. Please try again.';
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },

  signOut: async () => {
    try {
      // Also drop the Google session so the account picker shows next time.
      await GoogleSignin.signOut().catch(() => {});
      await firebaseSignOut(auth);
      set({ user: null, profile: null });
    } catch (err) {
      console.error('Sign out error:', err);
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
    } catch (err) {
      console.error('Error loading profile:', err);
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
