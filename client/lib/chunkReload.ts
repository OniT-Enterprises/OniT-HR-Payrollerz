/**
 * Recovery for stale lazy-loaded chunks after a deploy.
 *
 * Every route is `lazyWithRetry(() => import(...))` (see routes.tsx). A new
 * build renames every hashed chunk, so a tab that was already open fails the
 * moment it navigates to a not-yet-loaded route — Chrome says "Failed to fetch
 * dynamically imported module", Safari "Importing a module script failed".
 * Reloading fetches fresh HTML with the new hashes, which fixes it.
 *
 * The subtle part: once main.tsx's `vite:preloadError` listener calls
 * `preventDefault()` to claim the recovery, Vite's preload helper **resolves
 * `undefined`** instead of rejecting. A `React.lazy` factory that just returns
 * that then trips React's useless "Element type is invalid. Received a promise
 * that resolves to: undefined" — racing the reload it's already doing. Both
 * shapes have to be handled; see `lazyWithRetry`.
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
