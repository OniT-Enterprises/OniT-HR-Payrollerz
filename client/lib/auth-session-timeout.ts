/**
 * A signed-in Firebase session needs two independent authority checks before the
 * app can route it: the Firestore user profile and a forced ID-token refresh.
 * Either network request can remain pending indefinitely, so convert each one
 * into a settled result with a ceiling instead of letting AuthContext hang.
 */

export const AUTH_AUTHORITY_TIMEOUT_MS = 12_000;

export type AuthAuthority = "profile" | "token";

export class AuthAuthorityTimeoutError extends Error {
  constructor(
    public readonly authority: AuthAuthority,
    public readonly timeoutMs: number,
  ) {
    super(
      `${authority === "profile" ? "User profile" : "Session token"} check timed out`,
    );
    this.name = "AuthAuthorityTimeoutError";
  }
}

/**
 * A cached superadmin flag is navigation state, not current authority. When the
 * profile read fails, privileged UI is available only when this session's
 * forced token refresh explicitly confirms the claim.
 */
export function isFreshTokenSuperAdmin(
  tokenAdminState: boolean | null,
): boolean {
  return tokenAdminState === true;
}

function settleWithTimeout<T>(
  request: Promise<T>,
  authority: AuthAuthority,
  timeoutMs: number,
): Promise<PromiseSettledResult<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({
        status: "rejected",
        reason: new AuthAuthorityTimeoutError(authority, timeoutMs),
      });
    }, timeoutMs);

    request.then(
      (value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        resolve({ status: "fulfilled", value });
      },
      (reason) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        resolve({ status: "rejected", reason });
      },
    );
  });
}

/**
 * Settle the profile and token checks independently. A fast success remains
 * usable when the other authority source times out; callers can therefore show
 * profile recovery without discarding a freshly verified token (and vice
 * versa).
 */
export function settleAuthAuthorityRequests<TProfile, TToken>(
  profileRequest: Promise<TProfile>,
  tokenRequest: Promise<TToken>,
  timeoutMs = AUTH_AUTHORITY_TIMEOUT_MS,
): Promise<
  readonly [PromiseSettledResult<TProfile>, PromiseSettledResult<TToken>]
> {
  return Promise.all([
    settleWithTimeout(profileRequest, "profile", timeoutMs),
    settleWithTimeout(tokenRequest, "token", timeoutMs),
  ] as const);
}
