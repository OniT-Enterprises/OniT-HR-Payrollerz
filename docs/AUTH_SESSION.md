# Auth & session lifecycle — invariants

_Last updated: 2026-08-09. Audience: anyone touching sign-in, sign-out, route
guards, the host split, or lazy-chunk loading. Written after a day in which four
separate defects in prod all came from the same two blind spots: assuming one
origin can see another's session, and assuming a session always resolves._

## The two facts everything here follows from

**1. Firebase auth state is scoped to an ORIGIN.** `xefe.tl` and `app.xefe.tl`
have separate localStorage and IndexedDB, so a session on one is invisible to the
other. Neither host can answer "is this visitor signed in over there?".

**2. Session resolution can hang, indefinitely.** `authResolved` (AuthContext)
flips only after `loadUserState` settles — a Firestore profile read plus a forced
`getIdTokenResult(user, true)`. Both are network calls. On a dead or very slow
connection they can stall, and Timor-Leste connections stall.

Most of what follows is a consequence of one of those two.

## Invariants

### Never make a cross-host redirect decision from auth state

Covered in `docs/PUBLIC_SITE.md` (host split) and enforced by
`tests/client/host-split-redirects.test.ts`. Cross-host redirects are decided
from the **path** alone. Two hosts each redirecting on "am *I* signed in?" is an
infinite loop, and it cost a real user his session on 2026-08-04. The apex is the
marketing site for everyone, signed in or not; `client/lib/hostBounce.ts` is the
per-tab backstop for whatever slips through.

### Never gate sign-in on `authResolved` without a ceiling

Use `client/hooks/useAuthSettled.ts` — `authResolved` **or** 1.5s elapsed,
whichever first. An unbounded wait shipped on 2026-08-04 and made
`/auth/login` render zero inputs on prod for a browser whose profile read never
returned: no form, no Google button, no way in. Signing in never depends on that
read finishing, so the wait must always yield.

The rule generalises: **a screen whose whole purpose is to recover from a bad
auth state must not be gated on auth state resolving.** Login and signup are
those screens.

There is a real reason to want the gate — a Google popup opened while the session
is still restoring gets **stranded**: the popup opens, the restore completes, the
"already signed in" effect navigates to the dashboard, and the chooser is left
asking which account to use for a session that already exists. Bound the wait,
don't remove it.

### `prompt: "select_account"` stays

`authService.signInWithGoogle()` forces Google's account chooser. Dropping it
would let a shared office computer sign in as whoever used it last with one
click — the wrong trade for payroll. It also would not help anyone with several
active Google sessions, because Google shows its own picker regardless.

### Never let a failed dynamic import resolve `undefined`

`client/main.tsx` listens for `vite:preloadError` and reloads once
(`client/lib/chunkReload.ts` holds the loop guard). It deliberately does **not**
call `preventDefault()`: that suppresses Vite's throw, which makes its preload
helper *resolve `undefined`* instead of rejecting. Every `await import(...)` in
the app then hands `undefined` to code expecting a module, and the failure
resurfaces far from its cause — as React's "Element type is invalid. Received a
promise that resolves to: undefined", or as "Cannot read properties of undefined
(reading 'default')" from a service (Sentry, 2026-08-04).

A rejection is the honest signal: call sites that catch degrade properly (a
failed Firestore import shows the account-recovery card), the reload still fires,
and the wording is already in Sentry's `ignoreErrors` so recovery stays quiet.
`lazyWithRetry` still handles the resolves-`undefined` shape, because one stray
listener brings it back.

## Where the state lives

| Concern | Owner | Notes |
|---|---|---|
| `user`, `authResolved`, `profileStatus` | `client/contexts/AuthContext.tsx` | `profileStatus: "missing"` means a successful read found no doc; read failures are `"error"` |
| Tenant session, `tenantResolved` | `client/contexts/TenantContext.tsx` | Claims and profile `tenantIds` are discovery **hints**; every candidate is verified against the tenant + member docs |
| Route gating | `client/components/auth/FeatureRoute.tsx`, `SuperadminRoute.tsx` | Both wait for `authLoading`/`authResolved` before deciding — see the open item below |
| Home routing | `HomeRoute` in `client/App.tsx` | Guest → marketing, superadmin → `/admin`, impersonation wins over both |
| Cross-origin correction | `client/lib/hosts.ts`, `HostGuard` in `App.tsx` | Path-based only |

A read failure is never evidence of a missing account: both contexts route that
to `SessionRecovery` (retry / use another account), never to onboarding.

## Authority-request timeout

`loadUserState` time-boxes the Firestore profile read and forced token refresh
**independently at 12 seconds** through `client/lib/auth-session-timeout.ts`.
Twelve seconds is deliberately much more generous than the 1.5-second sign-in
recovery grace, so a slow Timor-Leste connection gets a real chance to restore,
while still putting a human-scale ceiling on the otherwise permanent route
skeleton.

A timeout is represented as a rejected settled result; it does not cancel or
reinterpret the other authority source. A current profile may therefore restore
an ordinary user when token refresh times out. A current token may establish the
superadmin claim when the profile times out, while the profile outcome remains
`profileStatus: "error"` so ordinary users see `SessionRecovery`, never
onboarding. The existing AuthContext request id rejects any late result from an
obsolete auth transition.
