import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "test-self-service-signup";
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

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

    await assertSucceeds(
      setDoc(doc(db, "tenants/acme"), {
        id: "acme",
        name: "Acme Ltd",
        createdBy: uid,
        plan: "free",
        status: "active",
      }),
    );

    await assertSucceeds(
      setDoc(doc(db, `tenants/acme/members/${uid}`), {
        uid,
        role: "owner",
        modules: ["staff", "payroll"],
      }),
    );
  });

  it("rejects creating a tenant on behalf of another user", async () => {
    const db = testEnv.authenticatedContext("self-serve-owner").firestore();

    await assertFails(
      setDoc(doc(db, "tenants/acme"), {
        id: "acme",
        name: "Acme Ltd",
        createdBy: "someone-else",
        plan: "free",
        status: "active",
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

    // The exact write provisionOrganization attempts when a slug collides.
    await assertFails(
      setDoc(doc(db, "tenants/acme"), {
        id: "acme",
        name: "Impostor Org",
        createdBy: "second-signup",
        plan: "free",
        status: "active",
      }),
    );

    // Even preserving the original creator, a non-owner may not overwrite.
    await assertFails(
      setDoc(doc(db, "tenants/acme"), {
        id: "acme",
        name: "Impostor Org",
        createdBy: "original-owner",
        plan: "free",
        status: "active",
      }),
    );
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
});
