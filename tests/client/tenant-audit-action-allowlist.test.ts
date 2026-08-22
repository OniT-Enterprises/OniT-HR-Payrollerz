/**
 * Every TENANT audit action the app emits must be accepted by the callable that
 * stores it — the sibling of admin-audit-action-allowlist.test.ts, and it exists
 * because the same silence bit twice.
 *
 * `recordTenantAuditEvent` validates the action against TENANT_AUDIT_ACTIONS and
 * throws `invalid-argument` for anything else. Tenant audit logging is
 * deliberately non-fatal — a failed audit write must never fail the payroll run
 * or tax filing it describes — so a missing action is dropped in SILENCE, with
 * only a console error to mark it.
 *
 * That is what happened to `tax.business_filed`. From the day Xefe could record
 * a services-tax or Sec. 64 instalment declaration as filed, the action was
 * absent from the allow-list, so not one of those filings was ever written to
 * the tenant audit log. It surfaced on 2026-08-22 only because a browser test
 * that exercised the path printed the rejection.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(repoRoot, p), "utf8");

/** The allow-list the callable enforces. */
function serverAllowList(): Set<string> {
  const source = read("functions/src/audit.ts");
  const block = /const TENANT_AUDIT_ACTIONS = new Set\(\[([\s\S]*?)\]\)/.exec(source);
  expect(
    block,
    "TENANT_AUDIT_ACTIONS must be a literal Set the test can read",
  ).toBeTruthy();
  return new Set(
    Array.from(block![1].matchAll(/"([a-z_.]+)"/g)).map((m) => m[1]),
  );
}

/**
 * Every dotted action literal in the app source. Deliberately a broad sweep
 * rather than parsing call sites: audit actions are passed through helpers,
 * ternaries and objects assembled far from the logging call, and the previous
 * version of this idea missed one exactly that way.
 */
function clientActions(): string[] {
  const prefixes = [
    "payroll",
    "tax",
    "accounting",
    "employee",
    "settings",
    "document",
    "user",
    "archive",
  ];
  const pattern = new RegExp(`"((?:${prefixes.join("|")})\\.[a-z_]+)"`, "g");
  const found = new Set<string>();

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(repoRoot, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(join(repoRoot, rel)).isDirectory()) {
        walk(rel);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      // i18n bundles carry unrelated dotted keys.
      if (rel.includes("/i18n/")) continue;
      for (const match of read(rel).matchAll(pattern)) found.add(match[1]);
    }
  };
  walk("client/services");
  walk("client/pages");
  walk("client/hooks");

  expect(found.size, "tenant audit action literals found").toBeGreaterThan(20);
  return [...found].sort();
}

describe("tenant audit allow-list", () => {
  it("accepts every action the app emits", () => {
    const allowed = serverAllowList();
    const missing = clientActions().filter((action) => !allowed.has(action));
    expect(
      missing,
      `Actions the callable would reject in silence: ${missing.join(", ")}. ` +
        "Add them to TENANT_AUDIT_ACTIONS in functions/src/audit.ts.",
    ).toEqual([]);
  });

  it("covers the business-tax filing that was missing", () => {
    // Named explicitly: the sweep above depends on a string literal staying in
    // the source, and this is the one the gap actually hid.
    expect(serverAllowList().has("tax.business_filed")).toBe(true);
    expect(serverAllowList().has("tax.payment_recorded")).toBe(true);
  });
});
