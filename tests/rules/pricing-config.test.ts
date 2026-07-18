import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "test-public-pricing-config";
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const PRICING_PATH = "platform/packagesConfig";

describe("published pricing configuration rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import("../../firestore.rules?raw").then((module) => module.default),
        host: "localhost",
        port: FIRESTORE_EMULATOR_PORT,
      },
    });
  });

  afterAll(async () => testEnv.cleanup());

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), PRICING_PATH), {
        pricePerEmployee: 4,
        minimumEmployees: 5,
        annualMonthsCharged: 10,
      });
      await setDoc(doc(context.firestore(), "platform/internalConfig"), {
        privateValue: true,
      });
    });
  });

  it("does not expose other platform configuration documents", async () => {
    await assertFails(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), "platform/internalConfig")),
    );
  });

  it("allows guests and authenticated users to read the published price", async () => {
    await assertSucceeds(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), PRICING_PATH)),
    );
    await assertSucceeds(
      getDoc(doc(testEnv.authenticatedContext("tenant-user").firestore(), PRICING_PATH)),
    );
  });

  it("allows only a platform superadmin to change pricing", async () => {
    await assertFails(
      updateDoc(doc(testEnv.unauthenticatedContext().firestore(), PRICING_PATH), {
        pricePerEmployee: 0.01,
      }),
    );
    await assertFails(
      updateDoc(doc(testEnv.authenticatedContext("tenant-user").firestore(), PRICING_PATH), {
        minimumEmployees: 1,
      }),
    );
    await assertSucceeds(
      updateDoc(
        doc(
          testEnv.authenticatedContext("platform-admin", { superadmin: true }).firestore(),
          PRICING_PATH,
        ),
        { annualMonthsCharged: 9 },
      ),
    );
  });
});
