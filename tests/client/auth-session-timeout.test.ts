import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_AUTHORITY_TIMEOUT_MS,
  AuthAuthorityTimeoutError,
  isFreshTokenSuperAdmin,
  settleAuthAuthorityRequests,
} from "@/lib/auth-session-timeout";

const never = <T>() => new Promise<T>(() => {});

describe("auth authority request timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves both successful authority results", async () => {
    const results = await settleAuthAuthorityRequests(
      Promise.resolve({ uid: "user-1" }),
      Promise.resolve({ claims: { superadmin: false } }),
      25,
    );

    expect(results).toEqual([
      { status: "fulfilled", value: { uid: "user-1" } },
      { status: "fulfilled", value: { claims: { superadmin: false } } },
    ]);
  });

  it("times out a hanging profile without discarding a fresh token", async () => {
    vi.useFakeTimers();
    const pending = settleAuthAuthorityRequests(
      never(),
      Promise.resolve({ claims: { superadmin: true } }),
    );

    await vi.advanceTimersByTimeAsync(AUTH_AUTHORITY_TIMEOUT_MS);
    const [profileResult, tokenResult] = await pending;

    expect(profileResult.status).toBe("rejected");
    if (profileResult.status === "rejected") {
      expect(profileResult.reason).toBeInstanceOf(AuthAuthorityTimeoutError);
      expect(profileResult.reason).toMatchObject({
        authority: "profile",
        timeoutMs: AUTH_AUTHORITY_TIMEOUT_MS,
      });
    }
    expect(tokenResult).toEqual({
      status: "fulfilled",
      value: { claims: { superadmin: true } },
    });
  });

  it("does not restore cached superadmin when both current authority checks hang", async () => {
    vi.useFakeTimers();
    const cached = { isSuperAdmin: true };
    const pending = settleAuthAuthorityRequests(never(), never());

    await vi.advanceTimersByTimeAsync(AUTH_AUTHORITY_TIMEOUT_MS);
    const [profileResult, tokenResult] = await pending;
    const tokenAdminState = tokenResult.status === "fulfilled"
      ? tokenResult.value === true
      : null;

    expect(profileResult.status).toBe("rejected");
    expect(cached.isSuperAdmin).toBe(true);
    expect(tokenResult.status).toBe("rejected");
    expect(isFreshTokenSuperAdmin(tokenAdminState)).toBe(false);
  });

  it("times out a hanging token without discarding a current profile", async () => {
    vi.useFakeTimers();
    const pending = settleAuthAuthorityRequests(
      Promise.resolve({ uid: "user-1" }),
      never(),
      500,
    );

    await vi.advanceTimersByTimeAsync(500);
    const [profileResult, tokenResult] = await pending;

    expect(profileResult).toEqual({
      status: "fulfilled",
      value: { uid: "user-1" },
    });
    expect(tokenResult.status).toBe("rejected");
    if (tokenResult.status === "rejected") {
      expect(tokenResult.reason).toMatchObject({
        name: "AuthAuthorityTimeoutError",
        authority: "token",
        timeoutMs: 500,
      });
    }
  });

  it("preserves an immediate request failure instead of relabeling it as a timeout", async () => {
    const original = new Error("permission denied");
    const [profileResult] = await settleAuthAuthorityRequests(
      Promise.reject(original),
      Promise.resolve("token"),
      25,
    );

    expect(profileResult).toEqual({ status: "rejected", reason: original });
  });
});
