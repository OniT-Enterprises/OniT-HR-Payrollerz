import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, setDoc } from "firebase/firestore";

const PROJECT_ID = "test-legacy-deletes";
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

const OWNER = "acme-owner";
const OUTSIDER = "rival-owner";

/**
 * Some legacy top-level collections used a combined `allow update, delete` rule that referenced
 * request.resource.data — which does not exist on deletes — so every
 * non-superadmin delete was rejected. These tests pin the fixed behaviour:
 * tenant admins can delete ordinary tenant-owned docs, while computed Time &
 * Leave projections remain Cloud Functions-owned.
 */
describe("Legacy top-level collection deletes", () => {
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
      await setDoc(doc(adminDb, "tenants/acme"), {
        id: "acme",
        name: "Acme Ltd",
        createdBy: OWNER,
      });
      await setDoc(doc(adminDb, `tenants/acme/members/${OWNER}`), {
        uid: OWNER,
        role: "owner",
        modules: ["staff", "timeleave", "performance", "payroll"],
      });
      await setDoc(doc(adminDb, "tenants/rival"), {
        id: "rival",
        name: "Rival Ltd",
        createdBy: OUTSIDER,
      });
      await setDoc(doc(adminDb, `tenants/rival/members/${OUTSIDER}`), {
        uid: OUTSIDER,
        role: "owner",
        modules: ["staff", "timeleave", "performance", "payroll"],
      });
      await setDoc(doc(adminDb, "departments/dep1"), {
        tenantId: "acme",
        name: "Operations",
      });
      await setDoc(doc(adminDb, "leave_balances/bal1"), {
        tenantId: "acme",
        employeeId: "emp1",
        annual: 12,
      });
      await setDoc(doc(adminDb, "timesheets/ts1"), {
        tenantId: "acme",
        employeeId: "emp1",
        hours: 8,
      });
      await setDoc(doc(adminDb, "reviews/rev1"), {
        tenantId: "acme",
        employeeId: "emp1",
        rating: 4,
      });
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  const DELETABLE_CASES: Array<[collection: string, id: string]> = [
    ["departments", "dep1"],
    ["reviews", "rev1"],
  ];

  for (const [collection, id] of DELETABLE_CASES) {
    it(`lets the tenant owner delete their own ${collection} doc`, async () => {
      const db = testEnv.authenticatedContext(OWNER).firestore();
      await assertSucceeds(deleteDoc(doc(db, `${collection}/${id}`)));
    });

    it(`blocks an outsider from deleting another tenant's ${collection} doc`, async () => {
      const db = testEnv.authenticatedContext(OUTSIDER).firestore();
      await assertFails(deleteDoc(doc(db, `${collection}/${id}`)));
    });
  }

  for (const [collection, id] of [["leave_balances", "bal1"], ["timesheets", "ts1"]]) {
    it(`blocks direct owner deletion of computed ${collection}`, async () => {
      const db = testEnv.authenticatedContext(OWNER).firestore();
      await assertFails(deleteDoc(doc(db, `${collection}/${id}`)));
    });
  }
});
