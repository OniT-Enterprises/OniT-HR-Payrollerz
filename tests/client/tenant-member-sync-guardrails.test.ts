import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "functions/src/tenant.ts"),
  "utf8",
);

function callableBody(name: string, nextName: string): string {
  const start = source.indexOf(`export const ${name} = onCall`);
  const end = source.indexOf(`export const ${nextName} = onCall`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("tenant member synchronization guardrails", () => {
  it("commits member and profile changes together for add, update, and remove", () => {
    const add = callableBody("addTenantMember", "updateTenantMember");
    const update = callableBody("updateTenantMember", "removeTenantMember");
    const remove = callableBody(
      "removeTenantMember",
      "sendTenantMemberPasswordReset",
    );

    for (const body of [add, update, remove]) {
      expect(body).toContain("db.runTransaction");
      expect(body).toContain("transaction.get(callerMemberRef)");
      expect(body).toContain("transaction.get(memberRef)");
      expect(body).toContain("transaction.get(userRef)");
      expect(body).toContain('currentCallerRole !== "owner"');
      expect(body).toContain('currentCallerRole !== "hr-admin"');
    }
    expect(add).not.toContain("await memberRef.set");
    expect(update).not.toContain("await memberRef.update");
    expect(remove).not.toContain("await memberRef.delete");
  });

  it("treats exact add and remove retries as successful reconciliation", () => {
    const add = callableBody("addTenantMember", "updateTenantMember");
    const remove = callableBody(
      "removeTenantMember",
      "sendTenantMemberPasswordReset",
    );

    expect(add).toContain("exactRetry");
    expect(add).toContain("return !existingMemberDoc.exists");
    expect(remove).toContain('"Member access was already removed"');
  });

  it("keeps non-authoritative discovery claims best-effort", () => {
    expect(source).toContain("async function syncTenantRoleClaim");
    expect(source.match(/await syncTenantRoleClaim/g)?.length).toBe(3);
    expect(source).toContain("tenant discovery claims could not be synchronized");
  });

  it("keeps manager department scope on the callable-only write path", () => {
    const add = callableBody("addTenantMember", "updateTenantMember");
    const update = callableBody("updateTenantMember", "removeTenantMember");

    expect(add).toContain('Managers must be assigned to a department');
    expect(add).toContain('transaction.get(departmentRef)');
    expect(update).toContain('db.collection("departments").doc(nextDepartmentId)');
    expect(update).toContain('departmentId: nextDepartmentId ?? FieldValue.delete()');
    for (const body of [add, update]) {
      expect(body).toContain('departmentSnap.data()?.tenantId !== tenantId');
    }
  });
});
