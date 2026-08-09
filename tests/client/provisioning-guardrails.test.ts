import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/services/provisionOrg.ts"),
  "utf8",
);

describe("organization provisioning guardrails", () => {
  it("keeps profile merging inside a retryable transaction", () => {
    expect(source).toContain("runTransaction(db");
    expect(source).toContain("transaction.get(tenantRef)");
    expect(source).toContain("transaction.get(memberRef)");
    expect(source).toContain("transaction.get(userRef)");
    expect(source).not.toContain("writeBatch");
    expect(source).not.toContain("getDoc(userRef)");
  });

  it("reconciles a late timeout commit as an idempotent same-owner retry", () => {
    expect(source).toContain("const isOwnRetry =");
    expect(source).toContain('memberSnap.data()?.role === "owner"');
    expect(source).toContain("if (!isOwnRetry)");
    expect(source).toContain("if (err instanceof SlugTakenError) throw err");
  });

  it("does not hold signup open for best-effort setup", () => {
    expect(source).toContain("await withTimeout(provisionOrgWrites(params))");
    expect(source).toContain("void completeProvisioningSideEffects(provisioned)");
  });

  it("adds the protected admin default only for a new profile", () => {
    expect(source).toContain("existingSnap.exists()");
    expect(source).toContain("{ isSuperAdmin: false, createdAt: serverTimestamp() }");
    expect(source).not.toContain("isSuperAdmin: existing.isSuperAdmin");
  });
});
