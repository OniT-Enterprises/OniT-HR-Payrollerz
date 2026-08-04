import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * True once Firebase has resolved the session this browser holds — **or** once a
 * grace window has passed, whichever comes first.
 *
 * The grace window is the whole point. `authResolved` only flips after
 * AuthContext's `loadUserState` settles, which for a signed-in user means a
 * Firestore profile read plus a forced token refresh; on a dead or very slow
 * connection those can hang for a long time. Anything that hides sign-in until
 * `authResolved` is therefore one flaky network away from locking the user out
 * completely — observed for real on app.xefe.tl on 2026-08-04, where the login
 * page sat on a spinner and could not be used at all. Blocking sign-in is a far
 * worse failure than the stranded-popup race the wait exists to prevent, so the
 * wait gives up and lets the user in.
 *
 * Signing in does not depend on the pending read finishing: email/password and
 * the Google popup both work regardless, and the "already signed in" redirect
 * still fires if a session turns up late.
 */
export function useAuthSettled(graceMs = 1500): boolean {
  const { authResolved } = useAuth();
  const [graceElapsed, setGraceElapsed] = useState(false);

  useEffect(() => {
    if (authResolved) return;
    const timer = window.setTimeout(() => setGraceElapsed(true), graceMs);
    return () => window.clearTimeout(timer);
  }, [authResolved, graceMs]);

  return authResolved || graceElapsed;
}
