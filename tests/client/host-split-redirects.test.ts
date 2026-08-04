/**
 * The marketing (xefe.tl) / app (app.xefe.tl) split has exactly one failure
 * mode that matters: a path or a state that BOTH hosts think belongs to the
 * other one. That is a redirect loop, and on 2026-08-04 a real signed-in user
 * spent his session inside one (nginx logged xefe.tl/ and app.xefe.tl/
 * alternating every ~3s). These tests pin the two halves of the guarantee.
 */

import { describe, it, expect } from "vitest";
import { pathBelongsToApp, pathBelongsToMarketing } from "@/lib/hosts";
import { recordBounce, type BounceStore } from "@/lib/hostBounce";

/** Every shape of path either host can be asked for. */
const PATHS = [
  "/",
  "/tet",
  "/pt",
  "/landing",
  "/how-it-works",
  "/pricing",
  "/accountants",
  "/engine",
  "/security",
  "/docs",
  "/docs/payroll-money-chain",
  "/docs/some-unknown-slug",
  "/tet/pricing",
  "/pt/docs",
  "/tet/docs/payroll-money-chain",
  "/privacy",
  "/terms",
  "/pt/terms",
  "/auth/login",
  "/auth/signup",
  "/auth/onboarding",
  "/unauthorized",
  "/dashboard",
  "/people/employees",
  "/payroll/runs",
  "/money/invoices/new",
  "/accounting/journal-entries",
  "/reports",
  "/settings",
  "/admin",
  "/admin/tenants",
  "/i/some-token",
  "/apply/some-job",
  "/not-a-real-page",
];

describe("host split routing", () => {
  it("never lets both hosts disown the same path", () => {
    const contested = PATHS.filter(
      (path) => pathBelongsToApp(path) && pathBelongsToMarketing(path),
    );
    expect(contested).toEqual([]);
  });

  it("keeps the home pages on the marketing apex in all three languages", () => {
    for (const home of ["/", "/tet", "/pt"]) {
      expect(pathBelongsToApp(home)).toBe(false);
    }
  });

  it("keeps auth on the app origin, where the session is created", () => {
    expect(pathBelongsToApp("/auth/login")).toBe(true);
    expect(pathBelongsToMarketing("/auth/login")).toBe(false);
  });

  it("leaves the customer share surfaces on the apex", () => {
    for (const shared of ["/i/some-token", "/apply/some-job"]) {
      expect(pathBelongsToApp(shared)).toBe(false);
      expect(pathBelongsToMarketing(shared)).toBe(false);
    }
  });
});

function fakeStore(): BounceStore & { value: string | null } {
  const store = {
    value: null as string | null,
    read: () => store.value,
    write: (value: string) => {
      store.value = value;
    },
  };
  return store;
}

describe("cross-origin bounce guard", () => {
  it("allows a correction, then stops a ping-pong", () => {
    const store = fakeStore();
    expect(recordBounce(store, 1_000)).toBe(true);
    expect(recordBounce(store, 2_000)).toBe(true);
    expect(recordBounce(store, 3_000)).toBe(false);
    expect(recordBounce(store, 4_000)).toBe(false);
  });

  it("treats a later visit as a fresh journey, not a continuing loop", () => {
    const store = fakeStore();
    recordBounce(store, 1_000);
    recordBounce(store, 2_000);
    expect(recordBounce(store, 3_000)).toBe(false);

    // Well past the window: the user is navigating again, not spinning.
    expect(recordBounce(store, 60_000)).toBe(true);
  });

  it("counts from the most recent bounce, so a slow loop still trips", () => {
    const store = fakeStore();
    // 9s apart: inside the window each time, so the count keeps climbing even
    // though no two hops are close together.
    expect(recordBounce(store, 0)).toBe(true);
    expect(recordBounce(store, 9_000)).toBe(true);
    expect(recordBounce(store, 18_000)).toBe(false);
  });

  it("ignores junk left in storage instead of trusting it", () => {
    const store = fakeStore();
    store.value = "not json";
    expect(recordBounce(store, 1_000)).toBe(true);

    store.value = JSON.stringify({ at: "soon", count: "many" });
    expect(recordBounce(store, 2_000)).toBe(true);
  });
});
