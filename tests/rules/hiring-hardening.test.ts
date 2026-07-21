import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

const PROJECT_ID = "test-hiring-hardening";
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const TENANT_ID = "tenant-hiring";
const OWNER_ID = "owner-hiring";

describe("Hiring privacy and public-write rules", () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import("../../firestore.rules?raw").then((module) => module.default),
        host: "localhost",
        port: PORT,
      },
    });
  });

  afterAll(async () => env.cleanup());

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `tenants/${TENANT_ID}`), {
        name: "Hiring Co",
        createdBy: OWNER_ID,
      });
      await setDoc(doc(db, `tenants/${TENANT_ID}/members/${OWNER_ID}`), {
        uid: OWNER_ID,
        role: "owner",
        modules: ["staff", "hiring"],
      });
      await setDoc(doc(db, "jobs/open-job"), {
        tenantId: TENANT_ID,
        title: "Office Assistant",
        status: "open",
      });
      await setDoc(doc(db, "jobs/closed-job"), {
        tenantId: TENANT_ID,
        title: "Closed Role",
        status: "closed",
      });
    });
  });

  const validApplication = {
    tenantId: TENANT_ID,
    jobId: "open-job",
    jobTitle: "Office Assistant",
    name: "Ana Soares",
    email: "ana@example.com",
    phone: "+670 7000 0000",
    resumePath: `public/jobApplications/${TENANT_ID}/open-job/valid/resume.pdf`,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  it("accepts a CV-only application for the referenced open job", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(db, "jobApplications/valid"), validApplication));
  });

  it("rejects applications without a CV or for a closed job", async () => {
    const db = env.unauthenticatedContext().firestore();
    const { resumePath: _resumePath, ...withoutResume } = validApplication;
    await assertFails(setDoc(doc(db, "jobApplications/no-cv"), withoutResume));
    await assertFails(
      setDoc(doc(db, "jobApplications/closed"), {
        ...validApplication,
        jobId: "closed-job",
        jobTitle: "Closed Role",
        resumePath: `public/jobApplications/${TENANT_ID}/closed-job/closed/resume.pdf`,
      }),
    );
  });

  it("rejects identity documents on the public application record", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, "jobApplications/id-document"), {
        ...validApplication,
        resumePath: `public/jobApplications/${TENANT_ID}/open-job/id-document/resume.pdf`,
        idDocumentPath: `public/jobApplications/${TENANT_ID}/open-job/upload-1/id_document.pdf`,
      }),
    );
  });

  it("blocks plaintext onboarding passwords while allowing a normal checklist", async () => {
    const db = env.authenticatedContext(OWNER_ID).firestore();
    await assertFails(
      setDoc(doc(db, "onboarding/unsafe"), {
        tenantId: TENANT_ID,
        employeeId: "employee-1",
        fullName: "Ana Soares",
        tempPassword: "do-not-store-this",
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "onboarding/safe"), {
        tenantId: TENANT_ID,
        employeeId: "employee-1",
        fullName: "Ana Soares",
        status: "in_progress",
        checklist: {
          employeeRecordConfirmed: true,
          contractReady: false,
          policiesExplained: false,
          firstDayReady: false,
        },
      }),
    );
  });
});
