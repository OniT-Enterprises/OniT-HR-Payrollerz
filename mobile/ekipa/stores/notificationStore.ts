/**
 * Notification store — FCM token management + notification preferences
 * Token stored in: users/{uid}/devices/{token}
 * Preferences stored in AsyncStorage
 */
import { create } from 'zustand';
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../lib/firebase';

const PREFS_KEY = '@ekipa/notification_prefs';

export interface NotificationPreferences {
  payslips: boolean;
  leave: boolean;
  announcements: boolean;
  shifts: boolean;
  expenses: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  payslips: true,
  leave: true,
  announcements: true,
  shifts: true,
  expenses: true,
};

interface NotificationState {
  fcmToken: string | null;
  preferences: NotificationPreferences;
  loading: boolean;
  error: string | null;

  registerToken: (uid: string, token: string) => Promise<void>;
  unregisterToken: (uid: string, token: string) => Promise<void>;
  loadPreferences: () => Promise<void>;
  getPreferences: () => NotificationPreferences;
  setPreference: (key: keyof NotificationPreferences, value: boolean) => Promise<void>;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  fcmToken: null,
  preferences: { ...DEFAULT_PREFS },
  loading: false,
  error: null,

  registerToken: async (uid: string, token: string) => {
    set({ loading: true, error: null });
    try {
      await setDoc(doc(db, `users/${uid}/devices`, token), {
        token,
        platform: 'expo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      set({ fcmToken: token, loading: false });
    } catch {
      set({ loading: false, error: 'registerError' });
    }
  },

  unregisterToken: async (uid: string, token: string) => {
    set({ loading: true, error: null });
    try {
      await deleteDoc(doc(db, `users/${uid}/devices`, token));
      set({ fcmToken: null, loading: false });
    } catch {
      set({ loading: false, error: 'unregisterError' });
    }
  },

  loadPreferences: async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;
        set({
          preferences: { ...DEFAULT_PREFS, ...parsed },
        });
      }
    } catch {
      // Default preferences are already set
    }
  },

  getPreferences: () => {
    return get().preferences;
  },

  setPreference: async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...get().preferences, [key]: value };
    set({ preferences: updated });
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    } catch {
      // Preference save failed — non-critical
    }
  },

  clear: () => set({ fcmToken: null, preferences: { ...DEFAULT_PREFS }, loading: false, error: null }),
}));
