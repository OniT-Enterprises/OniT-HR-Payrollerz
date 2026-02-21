/**
 * Push notification setup — FCM via expo-notifications
 * Handles: permission request, token retrieval, incoming notifications, deep linking
 *
 * NOTE: expo-notifications must be installed:
 *   npx expo install expo-notifications expo-device expo-constants
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';

/**
 * Configure how notifications appear when app is in foreground
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and get the Expo push token.
 * Returns the token string, or null if permissions denied / not a physical device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permissions not granted');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22C55E', // primary green from colors.ts
    });
  }

  try {
    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenData.data;
  } catch (err) {
    console.error('Failed to get push token:', err);
    return null;
  }
}

/**
 * Deep link routing map — notification data.type -> Expo Router path
 */
const DEEP_LINK_MAP: Record<string, string> = {
  payslip: '/(tabs)/payslips',
  leave_approved: '/(tabs)/leave',
  leave_rejected: '/(tabs)/leave',
  leave_update: '/(tabs)/leave',
  announcement: '/(tabs)', // home — announcements show on home
  shift: '/(tabs)', // home — shifts show on home
  expense_approved: '/(tabs)', // home
  expense_rejected: '/(tabs)', // home
};

/**
 * Handle notification tap — navigate to the relevant screen
 */
function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data;
  if (!data) return;

  const type = data.type as string | undefined;
  if (type && DEEP_LINK_MAP[type]) {
    // Small delay to ensure app is ready for navigation
    setTimeout(() => {
      router.push(DEEP_LINK_MAP[type] as any);
    }, 100);
  }
}

/**
 * Set up notification listeners for the app lifecycle.
 * Call this once in the root layout (_layout.tsx).
 *
 * Returns a cleanup function to remove listeners.
 */
export function setupNotificationHandler(): () => void {
  // Handle notification received while app is in foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    // Notification already shown by the handler above
    // Can be used for analytics or badge count updates
    const data = notification.request.content.data;
    if (data?.type) {
      console.log(`Notification received: ${data.type}`);
    }
  });

  // Handle notification tap (app in background or killed)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse
  );

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
