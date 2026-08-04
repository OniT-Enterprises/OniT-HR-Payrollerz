/**
 * Recovery for stale lazy-loaded chunks after a deploy.
 *
 * Every route is `lazyWithRetry(() => import(...))` (see routes.tsx). A new
 * build renames every hashed chunk, so a tab that was already open fails the
 * moment it navigates to a not-yet-loaded route — Chrome says "Failed to fetch
 * dynamically imported module", Safari "Importing a module script failed".
 * Reloading fetches fresh HTML with the new hashes, which fixes it.
 *
 * The subtle part, and why main.tsx no longer calls `preventDefault()` on
 * `vite:preloadError` (changed 2026-08-04): preventing the default suppresses
 * Vite's throw, which makes its preload helper **resolve `undefined`** instead
 * of rejecting. Every `await import(...)` in the app then receives `undefined`,
 * and the failure resurfaces far from its cause — as React's "Element type is
 * invalid. Received a promise that resolves to: undefined" from a lazy route,
 * or as "Cannot read properties of undefined (reading 'default')" from a
 * service. A rejection is the honest signal; `lazyWithRetry` still handles both
 * shapes, because a swallowed rejection is easy to reintroduce.
 */

const RELOAD_KEY = "xefe-chunk-reload-at";
// If we already reloaded this recently, the chunk is probably *genuinely* broken
// (not just stale) — stop reloading and let the error surface so we don't spin.
const RELOAD_COOLDOWN_MS = 10_000;

/** True when an error looks like a failed dynamic import / missing chunk. */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    typeof error === "string" ? error : String((error as { message?: unknown })?.message ?? "");
  return /dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk/i.test(
    message,
  );
}

/**
 * True while a chunk-recovery reload is (probably) in flight. Lets callers park
 * quietly on a Suspense fallback instead of surfacing an error the incoming
 * fresh document is about to make moot.
 */
export function isReloadInFlight(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) || 0) < RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Reload once to pick up fresh hashed chunks. Loop-guarded via sessionStorage:
 * returns `true` if a reload was triggered, `false` if we reloaded too recently
 * (caller should then let the original error surface normally).
 */
export function reloadForFreshChunks(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage can throw (private mode / quota) — fall through and still
    // attempt the reload; worst case is the browser's own loop protection.
  }
  window.location.reload();
  return true;
}
