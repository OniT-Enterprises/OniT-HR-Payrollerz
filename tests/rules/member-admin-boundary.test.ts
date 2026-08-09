import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const PROJECT_ID = "test-member-admin-boundary";
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

describe("Member administration boundary", () => {
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
      await setDoc(doc(adminDb, "tenants/tenant-a"), {
        id: "tenant-a",
        name: "Tenant A",
        createdBy: "owner-a",
      });
      await setDoc(doc(adminDb, "tenants/tenant-a/members/owner-a"), {
        uid: "owner-a",
        role: "owner",
        modules: ["staff"],
      });
      await setDoc(doc(adminDb, "tenants/tenant-a/members/owner-b"), {
        uid: "owner-b",
        role: "owner",
        modules: ["staff"],
      });
      await setDoc(doc(adminDb, "tenants/tenant-a/members/hr-admin-a"), {
        uid: "hr-admin-a",
        role: "hr-admin",
        modules: ["staff"],
      });
      await setDoc(doc(adminDb, "tenants/tenant-a/members/viewer-a"), {
        uid: "viewer-a",
        role: "viewer",
        displayName: "Viewer A",
        modules: ["staff"],
      });
      await setDoc(doc(adminDb, "users/platform-admin"), {
        uid: "platform-admin",
        isSuperAdmin: true,
      });
    });
  });

  const hrAdminDb = () => testEnv.authenticatedContext("hr-admin-a").firestore();

  it("blocks an HR admin from creating another owner", async () => {
    await assertFails(
      setDoc(doc(hrAdminDb(), "tenants/tenant-a/members/attacker-owner"), {
        uid: "attacker-owner",
        role: "owner",
        modules: ["staff", "payroll"],
      }),
    );
  });

  it("blocks an HR admin from promoting an existing member to owner", async () => {
    await assertFails(
      updateDoc(doc(hrAdminDb(), "tenants/tenant-a/members/viewer-a"), {
        role: "owner",
      }),
    );
  });

  it("blocks an HR admin from demoting an owner", async () => {
    await assertFails(
      updateDoc(doc(hrAdminDb(), "tenants/tenant-a/members/owner-b"), {
        role: "viewer",
      }),
    );
  });

  it("blocks an HR admin from deleting an owner", async () => {
    await assertFails(
      deleteDoc(doc(hrAdminDb(), "tenants/tenant-a/members/owner-b")),
    );
  });

  it("requires owners to use the synchronized callables for ordinary member management", async () => {
    const ownerDb = testEnv.authenticatedContext("owner-a").firestore();
    await assertFails(
      setDoc(doc(ownerDb, "tenants/tenant-a/members/new-viewer"), {
        uid: "new-viewer",
        role: "viewer",
      }),
    );
    await assertFails(
      updateDoc(doc(ownerDb, "tenants/tenant-a/members/viewer-a"), {
        modules: ["payroll"],
      }),
    );
    await assertFails(deleteDoc(doc(ownerDb, "tenants/tenant-a/members/viewer-a")));
  });

  it("preserves member reads and harmless self-profile updates", async () => {
    const viewerDb = testEnv.authenticatedContext("viewer-a").firestore();
    await assertSucceeds(getDoc(doc(viewerDb, "tenants/tenant-a/members/owner-a")));
    await assertSucceeds(
      updateDoc(doc(viewerDb, "tenants/tenant-a/members/viewer-a"), {
        displayName: "Viewer Renamed",
        lastActiveAt: new Date(),
      }),
    );
  });

  it("keeps announcement mail outboxes server-only", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          "tenants/tenant-a/announcementMailOutboxes/announcement-1",
        ),
        { tenantId: "tenant-a", subject: "Notice", text: "Body" },
      );
    });
    const ownerDb = testEnv.authenticatedContext("owner-a").firestore();
    const superadminDb = testEnv.authenticatedContext("platform-admin").firestore();
    const path = "tenants/tenant-a/announcementMailOutboxes/announcement-1";
    await assertFails(getDoc(doc(ownerDb, path)));
    await assertFails(setDoc(doc(ownerDb, `${path}-owner`), { text: "Forged" }));
    await assertFails(getDoc(doc(superadminDb, path)));
    await assertFails(
      setDoc(doc(superadminDb, `${path}-admin`), { text: "Forged" }),
    );
  });

  it("preserves initial owner bootstrap and superadmin recovery writes", async () => {
    const bootstrapDb = testEnv.authenticatedContext("bootstrap-owner").firestore();
    const bootstrap = writeBatch(bootstrapDb);
    bootstrap.set(doc(bootstrapDb, "tenants/bootstrap"), {
      id: "bootstrap",
      name: "Bootstrap Tenant",
      createdBy: "bootstrap-owner",
      status: "active",
      plan: "free",
    });
    bootstrap.set(
      doc(bootstrapDb, "tenants/bootstrap/members/bootstrap-owner"),
      {
        uid: "bootstrap-owner",
        role: "owner",
        modules: ["staff"],
      },
    );
    bootstrap.set(doc(bootstrapDb, "users/bootstrap-owner"), {
      uid: "bootstrap-owner",
      isSuperAdmin: false,
      tenantIds: ["bootstrap"],
      tenantAccess: {
        bootstrap: { name: "Bootstrap Tenant", role: "owner" },
      },
    });
    await assertSucceeds(bootstrap.commit());

    const superadminDb = testEnv.authenticatedContext("platform-admin").firestore();
    await assertSucceeds(
      setDoc(doc(superadminDb, "tenants/tenant-a/members/recovery-user"), {
        uid: "recovery-user",
        role: "viewer",
      }),
    );
    await assertSucceeds(
      updateDoc(doc(superadminDb, "tenants/tenant-a/members/recovery-user"), {
        role: "owner",
      }),
    );
    await assertSucceeds(
      deleteDoc(doc(superadminDb, "tenants/tenant-a/members/recovery-user")),
    );
  });
});
