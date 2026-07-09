import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "test-contract-templates";
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

const SUPERADMIN = "platform-superadmin";
const TENANT_OWNER = "acme-owner";

/**
 * Contract templates are platform-wide documents: superadmins manage them,
 * and any signed-in user (tenant staff) can read them to generate work
 * contracts from the Add Employee flow.
 */
describe("Contract templates rules", () => {
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
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, `users/${SUPERADMIN}`), {
        email: "admin@xefe.tl",
        isSuperAdmin: true,
      });
      await setDoc(doc(adminDb, `users/${TENANT_OWNER}`), {
        email: "owner@acme.tl",
        isSuperAdmin: false,
      });
      await setDoc(doc(adminDb, "tenants/acme"), { id: "acme", name: "Acme Ltd" });
      await setDoc(doc(adminDb, `tenants/acme/members/${TENANT_OWNER}`), {
        uid: TENANT_OWNER,
        role: "owner",
      });
      await setDoc(doc(adminDb, "contractTemplates/tpl1"), {
        name: "SEFOPE Work Contract (PT)",
        language: "pt",
        bodyText: "CONTRATO DE TRABALHO ...",
        active: true,
      });
    });
  });

  it("allows superadmins to create, update, and delete templates", async () => {
    const db = testEnv.authenticatedContext(SUPERADMIN).firestore();
    await assertSucceeds(
      setDoc(doc(db, "contractTemplates/tpl2"), {
        name: "SEFOPE Work Contract (EN)",
        language: "en",
        bodyText: "LABOUR CONTRACT ...",
        active: true,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db, "contractTemplates/tpl1"), { active: false }),
    );
    await assertSucceeds(deleteDoc(doc(db, "contractTemplates/tpl1")));
  });

  it("allows signed-in tenant users to read templates", async () => {
    const db = testEnv.authenticatedContext(TENANT_OWNER).firestore();
    await assertSucceeds(getDoc(doc(db, "contractTemplates/tpl1")));
  });

  it("rejects template writes from non-superadmins", async () => {
    const db = testEnv.authenticatedContext(TENANT_OWNER).firestore();
    await assertFails(
      setDoc(doc(db, "contractTemplates/tpl2"), {
        name: "Rogue template",
        language: "en",
        bodyText: "...",
        active: true,
      }),
    );
    await assertFails(
      updateDoc(doc(db, "contractTemplates/tpl1"), { active: false }),
    );
    await assertFails(deleteDoc(doc(db, "contractTemplates/tpl1")));
  });

  it("rejects unauthenticated reads and writes", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "contractTemplates/tpl1")));
    await assertFails(
      setDoc(doc(db, "contractTemplates/tpl3"), { name: "Anon", active: true }),
    );
  });
});
