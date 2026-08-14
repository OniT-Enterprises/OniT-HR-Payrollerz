/**
 * Every admin audit action the console emits must be accepted by the callable
 * that stores it.
 *
 * `recordAdminAuditEvent` validates the action against an allow-list and throws
 * `invalid-argument` for anything else. `adminService.logAdminAction` catches
 * that and only console.errors — deliberately, because a failed audit write
 * must not fail the admin action it describes. The cost of that design is this
 * failure mode: an action missing from the allow-list is dropped in SILENCE.
 *
 * That is what happened to billing. From the day the console gained "Grant free
 * access", offline-payment recording and subscription cancellation, none of the
 * four actions were on the allow-list, so not one of those money events was
 * ever written to `adminAuditLog`. It surfaced on 2026-08-14 only because a
 * customer's free-access grant could not be traced.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(repoRoot, p), "utf8");

/** The allow-list the callable enforces. */
function serverAllowList(): Set<string> {
  const source = read("functions/src/audit.ts");
  const block = /const ADMIN_AUDIT_ACTIONS = new Set\(\[([\s\S]*?)\]\)/.exec(source);
  expect(block, "ADMIN_AUDIT_ACTIONS must be a literal Set the test can read").toBeTruthy();
  return new Set(
    Array.from(block![1].matchAll(/"([a-z_]+)"/g)).map((m) => m[1]),
  );
}

/**
 * Every action string handed to logAdminAction, ternaries included. A call site
 * this cannot parse FAILS rather than being skipped — a silently unparsed call
 * is the same blind spot the test exists to close (the first draft of this file
 * missed `manual_subscription_recorded` exactly that way, because its details
 * object pushed the closing brace past a fixed window).
 */
function clientActions(): string[] {
  const source = read("client/services/adminService.ts");
  const calls = source.split("logAdminAction({").slice(1);
  expect(calls.length, "logAdminAction call sites").toBeGreaterThanOrEqual(10);
  const actions: string[] = [];
  for (const call of calls) {
    const field = /action:\s*([\s\S]*?),\s*\n\s*(?:actorUid|actorEmail|targetType)/.exec(
      call.slice(0, 1200),
    );
    expect(
      field,
      `unreadable action in: ${call.slice(0, 90).replace(/\s+/g, " ")}`,
    ).toBeTruthy();
    for (const literal of field![1].matchAll(/"([a-z_]+)"/g)) actions.push(literal[1]);
  }
  return Array.from(new Set(actions));
}

describe("admin audit allow-list", () => {
  it("reads both sides", () => {
    // A regex that quietly matches nothing would make this file vacuous.
    expect(serverAllowList().size).toBeGreaterThanOrEqual(11);
    expect(clientActions().length).toBeGreaterThanOrEqual(12);
  });

  it("accepts every action the console emits", () => {
    const allowed = serverAllowList();
    const missing = clientActions().filter((action) => !allowed.has(action));
    expect(
      missing,
      `these actions would be dropped in silence by recordAdminAuditEvent: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("still covers the billing actions specifically", () => {
    // Named rather than left to the sweep above: these are the money events,
    // and they are the ones that were missing.
    const allowed = serverAllowList();
    for (const action of [
      "manual_subscription_recorded",
      "manual_subscription_cancelled",
      "complimentary_subscription_granted",
      "complimentary_subscription_ended",
    ]) {
      expect(allowed.has(action), `${action} must be auditable`).toBe(true);
    }
  });
});
