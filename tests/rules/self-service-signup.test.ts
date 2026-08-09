import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

const PROJECT_ID = "test-self-service-signup";
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

function commitBootstrap(
  db: Firestore,
  tenantId: string,
  uid: string,
  options: {
    tenant?: Record<string, unknown>;
    member?: Record<string, unknown>;
    profile?: Record<string, unknown>;
    omitSuperAdmin?: boolean;
  } = {},
) {
  const batch = writeBatch(db);
  batch.set(doc(db, `tenants/${tenantId}`), {
    id: tenantId,
    name: "Acme Ltd",
    createdBy: uid,
    plan: "free",
    status: "active",
    ...options.tenant,
  });
  batch.set(doc(db, `tenants/${tenantId}/members/${uid}`), {
    uid,
    role: "owner",
    modules: ["staff", "payroll"],
    ...options.member,
  });
  batch.set(
    doc(db, `users/${uid}`),
    {
      uid,
      email: `${uid}@example.com`,
      ...(options.omitSuperAdmin ? {} : { isSuperAdmin: false }),
      tenantIds: [tenantId],
      tenantAccess: { [tenantId]: { name: "Acme Ltd", role: "owner" } },
      ...options.profile,
    },
    { merge: true },
  );
  return batch.commit();
}

describe("Self-Service Signup Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import("../../firestore.rules?raw").then((m) => m.default),
        host: "localhost",
        port: FIRESTORE_EMULATOR_PORT,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  it("allows an authenticated user to create their own tenant and initial owner membership", async () => {
    const uid = "self-serve-owner";
    const db = testEnv.authenticatedContext(uid).firestore();

    await assertSucceeds(commitBootstrap(db, "acme", uid));

    const profile = await getDoc(doc(db, `users/${uid}`));
    expect(profile.data()?.tenantAccess.acme.role).toBe("owner");
  });

  it("allows transactional slug preflight and an idempotent same-owner retry", async () => {
    const uid = "transaction-owner";
    const tenantId = "transaction-org";
    const db = testEnv.authenticatedContext(uid).firestore();
    const tenantRef = doc(db, `tenants/${tenantId}`);
    const memberRef = doc(db, `tenants/${tenantId}/members/${uid}`);
    const userRef = doc(db, `users/${uid}`);

    const provision = () => runTransaction(db, async (transaction) => {
      const [tenantSnap, memberSnap, profileSnap] = await Promise.all([
        transaction.get(tenantRef),
        transaction.get(memberRef),
        transaction.get(userRef),
      ]);
      const ownRetry =
        tenantSnap.data()?.createdBy === uid &&
        memberSnap.data()?.role === "owner";
      if (!ownRetry) {
        transaction.set(tenantRef, {
          id: tenantId,
          name: "Transaction Org",
          createdBy: uid,
        });
        transaction.set(memberRef, { uid, role: "owner", modules: ["staff"] });
      }
      transaction.set(userRef, {
        uid,
        email: `${uid}@example.com`,
        tenantIds: [tenantId],
        tenantAccess: { [tenantId]: { name: "Transaction Org", role: "owner" } },
        ...(profileSnap.exists() ? {} : { isSuperAdmin: false }),
      }, { merge: true });
    });

    await assertSucceeds(provision());
    await assertSucceeds(provision());
    expect((await getDoc(tenantRef)).data()?.createdBy).toBe(uid);
  });

  it("lets an invited user provision without adding a protected admin field", async () => {
    const uid = "invited-owner";
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${uid}`), {
        uid,
        email: `${uid}@example.com`,
        tenantIds: ["inviting-tenant"],
        tenantAccess: {
          "inviting-tenant": { name: "Inviting Tenant", role: "viewer" },
        },
      });
    });

    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(
      commitBootstrap(db, "invited-owner-org", uid, {
        omitSuperAdmin: true,
        profile: {
          tenantIds: ["inviting-tenant", "invited-owner-org"],
          tenantAccess: {
            "inviting-tenant": { name: "Inviting Tenant", role: "viewer" },
            "invited-owner-org": { name: "Acme Ltd", role: "owner" },
          },
        },
      }),
    );

    const profile = await getDoc(doc(db, `users/${uid}`));
    expect(profile.data()?.isSuperAdmin).toBeUndefined();
    expect(profile.data()?.tenantIds).toEqual([
      "inviting-tenant",
      "invited-owner-org",
    ]);
  });

  it("rejects sequential bootstrap writes so a failed signup cannot leave a ghost tenant", async () => {
    const uid = "sequential-owner";
    const db = testEnv.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(doc(db, "tenants/sequential"), {
        id: "sequential",
        name: "Sequential Ltd",
        createdBy: uid,
        plan: "free",
        status: "active",
      }),
    );
    await assertFails(
      setDoc(doc(db, `tenants/sequential/members/${uid}`), {
        uid,
        role: "owner",
      }),
    );
  });

  it("blocks creating a tenant pre-subscribed (paywall bypass via create)", async () => {
    const uid = "would-be-freeloader";
    const db = testEnv.authenticatedContext(uid).firestore();
    const farFuture = new Date("2035-01-01");

    // The exact bypass: mint the tenant already carrying an active manual
    // subscription so the payroll finalize paywall passes forever.
    await assertFails(
      commitBootstrap(db, "freeloader", uid, {
        tenant: {
          manualSubscription: true,
          subscriptionPaidUntil: farFuture,
        },
      }),
    );

    // Forged Stripe linkage on create is equally blocked.
    await assertFails(
      commitBootstrap(db, "freeloader", uid, {
        tenant: { stripeSubscriptionId: "sub_forged" },
      }),
    );

    // So is any other billing metadata field.
    await assertFails(
      commitBootstrap(db, "freeloader", uid, {
        tenant: { subscriptionPaidUntil: farFuture },
      }),
    );

    // The full legitimate provisionOrganization payload still works.
    await assertSucceeds(
      commitBootstrap(db, "freeloader", uid, {
        tenant: {
          slug: "freeloader",
          limits: { maxEmployees: 10 },
          branding: {},
          features: { payroll: true },
          settings: { timezone: "Asia/Dili", currency: "USD" },
        },
      }),
    );
  });

  it("rejects creating a tenant on behalf of another user", async () => {
    const db = testEnv.authenticatedContext("self-serve-owner").firestore();

    await assertFails(
      commitBootstrap(db, "acme", "self-serve-owner", {
        tenant: { createdBy: "someone-else" },
      }),
    );
  });

  it("rejects overwriting an existing tenant (slug collision)", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "tenants/acme"), {
        id: "acme",
        name: "Original Owner Org",
        createdBy: "original-owner",
        plan: "free",
        status: "active",
      });
      await setDoc(doc(adminDb, "tenants/acme/members/original-owner"), {
        uid: "original-owner",
        role: "owner",
        modules: ["staff"],
      });
    });

    const db = testEnv.authenticatedContext("second-signup").firestore();

    // The exact atomic write provisionOrganization attempts when a slug collides.
    await assertFails(
      commitBootstrap(db, "acme", "second-signup", {
        tenant: { name: "Impostor Org" },
      }),
    );

    // Even preserving the original creator, a non-owner may not overwrite.
    await assertFails(
      commitBootstrap(db, "acme", "second-signup", {
        tenant: {
          name: "Impostor Org",
          createdBy: "original-owner",
        },
      }),
    );

    // The rejected batch must not leave the second user pointing at the tenant.
    const secondProfile = await getDoc(doc(db, "users/second-signup"));
    expect(secondProfile.exists()).toBe(false);
  });

  it("rolls back a malformed bootstrap completely so a corrected retry succeeds", async () => {
    const uid = "retry-owner";
    const db = testEnv.authenticatedContext(uid).firestore();

    await assertFails(
      commitBootstrap(db, "retry-tenant", uid, {
        member: { role: "viewer" },
      }),
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      expect((await getDoc(doc(adminDb, "tenants/retry-tenant"))).exists()).toBe(false);
      expect(
        (await getDoc(doc(adminDb, `tenants/retry-tenant/members/${uid}`))).exists(),
      ).toBe(false);
      expect((await getDoc(doc(adminDb, `users/${uid}`))).exists()).toBe(false);
    });

    await assertSucceeds(commitBootstrap(db, "retry-tenant", uid));
  });

  it("lets the owner update tenant config but never status/plan/limits", async () => {
    const uid = "config-owner";
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "tenants/acme"), {
        id: "acme",
        name: "Acme Ltd",
        createdBy: uid,
        plan: "free",
        status: "active",
      });
      await setDoc(doc(adminDb, `tenants/acme/members/${uid}`), {
        uid,
        role: "owner",
        modules: ["staff"],
      });
    });

    const db = testEnv.authenticatedContext(uid).firestore();

    await assertSucceeds(updateDoc(doc(db, "tenants/acme"), { name: "Acme Renamed" }));
    await assertFails(updateDoc(doc(db, "tenants/acme"), { plan: "enterprise" }));
    await assertFails(updateDoc(doc(db, "tenants/acme"), { status: "suspended" }));
    await assertFails(updateDoc(doc(db, "tenants/acme"), { limits: { maxEmployees: 9999 } }));
  });

  it("blocks self-granting isSuperAdmin on profile create and update", async () => {
    const uid = "would-be-admin";
    const db = testEnv.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(doc(db, `users/${uid}`), { uid, email: "x@example.com", isSuperAdmin: true }),
    );
    await assertSucceeds(
      setDoc(doc(db, `users/${uid}`), { uid, email: "x@example.com", isSuperAdmin: false }),
    );
    await assertFails(updateDoc(doc(db, `users/${uid}`), { isSuperAdmin: true }));
    await assertSucceeds(updateDoc(doc(db, `users/${uid}`), { displayName: "Fine" }));
  });

  it("rejects creating the initial owner membership for a tenant created by someone else", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "tenants/acme"), {
        id: "acme",
        name: "Acme Ltd",
        createdBy: "different-owner",
      });
    });

    const uid = "self-serve-owner";
    const db = testEnv.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(doc(db, `tenants/acme/members/${uid}`), {
        uid,
        role: "owner",
        modules: ["staff"],
      }),
    );
  });

  it("prevents a removed historical creator from reclaiming owner access", async () => {
    const uid = "former-creator";
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "tenants/acme"), {
        id: "acme",
        name: "Acme Ltd",
        createdBy: uid,
      });
      await setDoc(doc(adminDb, "tenants/acme/members/current-owner"), {
        uid: "current-owner",
        role: "owner",
      });
    });

    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(
      setDoc(doc(db, `tenants/acme/members/${uid}`), {
        uid,
        role: "owner",
        modules: ["staff", "payroll"],
      }),
    );
  });
});
