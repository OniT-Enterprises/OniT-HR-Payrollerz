/**
 * Ekipa push-notification registration and navigation helpers.
 *
 * Tokens are stored below the signed-in user so a shared phone can stop
 * receiving private payroll/leave alerts as soon as that user signs out.
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Language } from './i18n';

const TOKEN_KEY_PREFIX = '@ekipa/push_token/';
const DEFAULT_CHANNEL_ID = 'ekipa-updates';

const NOTIFICATION_ROUTES = new Set([
  '/screens/Announcements',
  '/(tabs)/leave',
  '/(tabs)/payslips',
  '/screens/Expenses',
  '/screens/ShiftSchedule',
  '/screens/EmploymentLetterRequest',
]);

// expo-notifications' push native module was removed from Expo Go (SDK 53+),
// so touching it there throws and red-screens the app. Only wire notifications
// up in real builds (dev client / standalone); the app still runs in Expo Go
// for UI work — push just no-ops. Full push works in a dev/production build.
export const isExpoGo = Constants.executionEnvironment === "storeClient";

if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

interface RegisterPushParams {
  userId: string;
  tenantId: string;
  employeeId: string;
  language: Language;
}

function tokenDocumentId(token: string): string {
  return encodeURIComponent(token);
}

function tokenStorageKey(userId: string): string {
  return `${TOKEN_KEY_PREFIX}${userId}`;
}

export async function registerForPushNotifications({
  userId,
  tenantId,
  employeeId,
  language,
}: RegisterPushParams): Promise<string | null> {
  // Push isn't available in Expo Go (SDK 53+); skip cleanly so the app runs.
  if (isExpoGo) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
        name: 'Ekipa updates',
        description: 'Payslips, leave, expenses, shifts, and company announcements',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#6A9C29',
        // no `sound`: a string here means a custom sound FILE; omitting it uses
        // the system default (a 'default' string spams "sound not found").
      });
    }

    // Remote push delivery requires a physical device. Local development and
    // simulators continue without surfacing a user-facing error.
    if (!Device.isDevice) return null;

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted' && current.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const storageKey = tokenStorageKey(userId);
    const previousToken = await AsyncStorage.getItem(storageKey);

    if (previousToken && previousToken !== token) {
      await deleteDoc(doc(db, 'users', userId, 'devices', tokenDocumentId(previousToken)));
    }

    await setDoc(
      doc(db, 'users', userId, 'devices', tokenDocumentId(token)),
      {
        token,
        provider: 'expo',
        enabled: true,
        platform: Platform.OS,
        deviceName: Device.deviceName || Device.modelName || null,
        tenantId,
        employeeId,
        language,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    await AsyncStorage.setItem(storageKey, token);
    return token;
  } catch {
    // Notifications enhance the app but must never block sign-in or core ESS.
    return null;
  }
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  const storageKey = tokenStorageKey(userId);
  try {
    const token = await AsyncStorage.getItem(storageKey);
    if (token) {
      await deleteDoc(doc(db, 'users', userId, 'devices', tokenDocumentId(token)));
    }
  } catch {
    // Best effort: Firebase sign-out must still proceed if the device is offline.
  } finally {
    await AsyncStorage.removeItem(storageKey).catch(() => undefined);
  }
}

export function getNotificationRoute(data: Record<string, unknown> | undefined): string | null {
  const route = data?.route;
  return typeof route === 'string' && NOTIFICATION_ROUTES.has(route) ? route : null;
}
