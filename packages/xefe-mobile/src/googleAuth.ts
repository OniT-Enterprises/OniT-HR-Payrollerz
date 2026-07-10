/**
 * Shared native Google sign-in for the Xefe mobile family.
 *
 * The idToken is minted for the project's WEB OAuth client (a public
 * identifier — it ships in every client binary) and exchanged with Firebase
 * via signInWithCredential in the app's auth store.
 *
 * NOTE: each app's Android package + signing SHA-1 must be registered as a
 * Firebase Android app or Google returns DEVELOPER_ERROR (see the
 * mobile-auth-google notes: debug, Expo project, and EAS keystores all count).
 */
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, type Auth, type UserCredential } from 'firebase/auth';

export const GOOGLE_WEB_CLIENT_ID =
  '415646082318-97umvlac4hkl7kk321gcnu0hv9lb16u9.apps.googleusercontent.com';

let configured = false;

function ensureConfigured(): void {
  if (!configured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
}

export type GoogleSignInResult =
  | { type: 'success'; credential: UserCredential }
  | { type: 'cancelled' };

/**
 * Run the native account picker and sign the Firebase `auth` instance in.
 * Throws on real failures; returns {type:'cancelled'} when the user dismisses.
 */
export async function signInWithGoogleNative(auth: Auth): Promise<GoogleSignInResult> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') {
    return { type: 'cancelled' };
  }
  const idToken = result.data.idToken;
  if (!idToken) throw new Error('Google sign-in returned no idToken');
  const credential = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return { type: 'success', credential };
}

/**
 * Drop the Google session (so the account picker shows next time) — call it
 * alongside Firebase signOut. Never throws.
 */
export async function signOutGoogleNative(): Promise<void> {
  try {
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // best-effort
  }
}
