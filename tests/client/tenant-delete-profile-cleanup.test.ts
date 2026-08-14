/**
 * Deleting a tenant from the superadmin console must not leave its members
 * holding a pointer to it.
 *
 * Found on a real account on 2026-08-14: a prospect's two orgs were deleted
 * from the console on 2026-08-12, and six days later `users/{uid}` still listed
 * both in `tenantIds` and `tenantAccess` — one of which had never been
 * recreated. Firestore deletes do not cascade, and the console's deleteTenant
 * swept the tenant's own data only. `scripts/delete-tenant.mjs` had always done
 * this correctly; the console path was the one that drifted.
 *
 * TenantContext verifies both the tenant and member doc before offering a
 * candidate, so the stale entry is inert rather than dangerous — which is
 * exactly why it went unnoticed and why it is pinned here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextActiveTenantId } from "@/services/adminService";

const source = readFileSync(
  join(__dirname, "../..", "client/services/adminService.ts"),
  "utf8",
);

describe("nextActiveTenantId", () => {
  it("picks the first surviving tenant", () => {
    expect(
      nextActiveTenantId({ tenantId: "rba", tenantIds: ["rba", "rba1"] }, "rba"),
    ).toBe("rba1");
  });

  it("returns null when the deleted tenant was the only one", () => {
    // The caller must delete the field instead of writing a dead id back.
    expect(nextActiveTenantId({ tenantId: "rba", tenantIds: ["rba"] }, "rba")).toBeNull();
  });

  it("survives a missing or junk tenantIds list", () => {
    expect(nextActiveTenantId({}, "rba")).toBeNull();
    expect(
      nextActiveTenantId(
        { tenantIds: [undefined as unknown as string, "rba", "keep"] },
        "rba",
      ),
    ).toBe("keep");
  });

  it("never returns the tenant being removed", () => {
    expect(
      nextActiveTenantId({ tenantIds: ["rba", "rba", "rba"] }, "rba"),
    ).toBeNull();
  });
});

describe("adminService.deleteTenant", () => {
  it("cleans the members' user profiles", () => {
    expect(source, "must sweep member profiles").toContain(
      "await this.sweepMemberProfiles(tenantId, memberUids)",
    );
    expect(source, "must remove the tenantAccess key").toContain(
      "[`tenantAccess.${tenantId}`]: deleteField()",
    );
    expect(source, "must remove the tenantIds entry").toContain(
      "tenantIds: arrayRemove(tenantId)",
    );
  });

  it("reads the member uids before the members subcollection is swept", () => {
    // Ordering is the whole trick: once members are gone a client can no longer
    // learn who belonged to the tenant, so the pointers become unreachable.
    const readAt = source.indexOf("const memberUids = await this.getMemberUids(tenantId)");
    const sweepAt = source.indexOf('await this.sweepTenantSubcollection(tenantId, "members", true)');
    expect(readAt, "uid read must exist").toBeGreaterThan(-1);
    expect(sweepAt, "members sweep must exist").toBeGreaterThan(-1);
    expect(readAt).toBeLessThan(sweepAt);
  });

  it("keeps the profile cleanup non-fatal", () => {
    // The tenant is already gone by then; a failed profile write must not make
    // a completed deletion report as failed. The members sweep stays critical.
    expect(source).toMatch(
      /could not clean users\/\$\{uid\} tenant pointers/,
    );
  });
});
