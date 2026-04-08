import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

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
