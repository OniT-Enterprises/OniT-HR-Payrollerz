/**
 * Auth store — manages Firebase auth state for Kaixa
 */
import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

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

  signOut: async () => {
    try {
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
