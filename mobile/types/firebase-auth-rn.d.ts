/**
 * Type augmentation for Firebase Auth React Native persistence.
 *
 * At runtime, Metro resolves the "react-native" condition in @firebase/auth
 * which exports getReactNativePersistence. TypeScript uses the browser types
 * which don't include it. This augmentation adds the missing export.
 */
import 'firebase/auth';

declare module 'firebase/auth' {
  interface ReactNativeAsyncStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }

  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage
  ): Persistence;
}
