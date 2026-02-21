/**
 * Location utilities — request permission and get current GPS
 */
import * as Location from 'expo-location';
import type { LocationData } from '../types/crew';

/**
 * Request foreground location permission
 * Returns true if granted
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Get current location with balanced accuracy (~100m, fast, low battery)
 * Returns null if permission denied or location unavailable
 */
export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 0,
    };
  } catch {
    return null;
  }
}
