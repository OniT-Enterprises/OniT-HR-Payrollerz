/**
 * Loop breaker for the marketing (xefe.tl) / app (app.xefe.tl) host split.
 *
 * Firebase auth state is scoped to an ORIGIN, so neither host can see whether
 * the other holds a session — a redirect decided from "am I signed in here?"
 * is a guess about the other origin. On 2026-08-04 that guess cost a real
 * signed-in user every visit: a session left on the apex made xefe.tl send him
 * to app.xefe.tl, where he was a guest, so the app sent him straight back
 * (nginx logs show the two "/" documents alternating every ~3s until he gave
 * up). HomeRoute no longer redirects signed-in users off the apex, which
 * removes that cycle; this counter is the backstop, so a future cross-origin
 * redirect (an nginx rule, a Cloudflare rule, another stale origin) can bounce
 * a couple of times and then stop instead of spinning forever.
 *
 * Per-origin and per-tab, which is exactly the scope we want: each hop of a
 * ping-pong re-enters the same tab, so the count climbs until it trips.
 */

const BOUNCE_KEY = "xefe-host-bounce";
/** Bounces this far apart are separate journeys, not a loop. */
const BOUNCE_WINDOW_MS = 10_000;
/** One legitimate correction per journey; the second is already suspicious. */
const MAX_BOUNCES = 2;

export interface BounceRecord {
  /** When the most recent bounce was recorded. */
  at: number;
  /** How many bounces have happened inside the window. */
  count: number;
}

/** Storage the counter lives in — `sessionStorage`, or a fake in tests. */
export interface BounceStore {
  read: () => string | null;
  write: (value: string) => void;
}

function parse(raw: string | null): BounceRecord | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<BounceRecord>;
    if (typeof data?.at !== "number" || typeof data?.count !== "number") {
      return null;
    }
    return { at: data.at, count: data.count };
  } catch {
    return null;
  }
}

/**
 * Records a cross-origin bounce and answers whether it is safe to make it.
 * `false` means we have already bounced too often too recently — the caller
 * must resolve the situation on this origin instead of handing it to the other.
 */
export function recordBounce(store: BounceStore, now: number): boolean {
  const previous = parse(store.read());
  const withinWindow = previous !== null && now - previous.at < BOUNCE_WINDOW_MS;
  const count = withinWindow ? previous.count + 1 : 1;

  store.write(JSON.stringify({ at: now, count } satisfies BounceRecord));
  return count <= MAX_BOUNCES;
}

/**
 * `recordBounce` against this tab's sessionStorage. A browser that refuses
 * storage (private mode, quota) gets the benefit of the doubt — one blind
 * redirect is better than stranding every guest on the wrong host — and the
 * browser's own redirect-loop protection remains the last line of defence.
 */
export function noteHostBounce(): boolean {
  try {
    return recordBounce(
      {
        read: () => sessionStorage.getItem(BOUNCE_KEY),
        write: (value) => sessionStorage.setItem(BOUNCE_KEY, value),
      },
      Date.now(),
    );
  } catch {
    return true;
  }
}
