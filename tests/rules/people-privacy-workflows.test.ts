import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const PROJECT_ID = "test-people-privacy-workflows";
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const TENANT_ID = "people-tenant";
const OWNER = "people-owner";
const HR = "people-hr";
const MANAGER = "people-manager";
const EMPLOYEE = "people-employee";
const OTHER = "people-other";

describe("People privacy and self-service workflows", () => {
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
      await setDoc(doc(db, `tenants/${TENANT_ID}`), { name: "People Co", createdBy: OWNER });
      await Promise.all([
        setDoc(doc(db, `tenants/${TENANT_ID}/members/${OWNER}`), {
          uid: OWNER,
          role: "owner",
          modules: ["staff", "performance"],
        }),
        setDoc(doc(db, `tenants/${TENANT_ID}/members/${HR}`), {
          uid: HR,
          role: "hr-admin",
          modules: ["staff", "performance"],
        }),
        setDoc(doc(db, `tenants/${TENANT_ID}/members/${MANAGER}`), {
          uid: MANAGER,
          role: "manager",
          employeeId: "manager-emp",
          modules: ["staff", "performance"],
        }),
        setDoc(doc(db, `tenants/${TENANT_ID}/members/${EMPLOYEE}`), {
          uid: EMPLOYEE,
          role: "employee",
          employeeId: "emp-1",
          modules: [],
        }),
        setDoc(doc(db, `tenants/${TENANT_ID}/members/${OTHER}`), {
          uid: OTHER,
          role: "employee",
          employeeId: "emp-2",
          modules: [],
        }),
      ]);

      await setDoc(doc(db, "goals/goal-1"), {
        tenantId: TENANT_ID,
        title: "Improve induction",
        status: "active",
      });
      await setDoc(doc(db, "reviews/review-draft"), {
        tenantId: TENANT_ID,
        employeeId: "emp-1",
        status: "draft",
        overallRating: 3,
      });
      await setDoc(doc(db, "reviews/review-submitted"), {
        tenantId: TENANT_ID,
        employeeId: "emp-1",
        status: "submitted",
        overallRating: 4,
      });
      await setDoc(doc(db, "trainings/training-1"), {
        tenantId: TENANT_ID,
        employeeId: "emp-1",
        trainingName: "Safety",
      });
      await setDoc(doc(db, "disciplinary/case-1"), {
        tenantId: TENANT_ID,
        employeeId: "emp-1",
        status: "open",
      });
      await setDoc(doc(db, "disciplinary/termination-1"), {
        tenantId: TENANT_ID,
        employeeId: "emp-1",
        type: "termination",
        status: "in_review",
      });
      await setDoc(doc(db, `tenants/${TENANT_ID}/employees/emp-1`), {
        personalInfo: { firstName: "Ana", lastName: "Soares" },
        jobDetails: { employeeId: "EMP-1" },
        status: "active",
      });
      await setDoc(doc(db, "offboarding/offboarding-1"), {
        tenantId: TENANT_ID,
        employeeId: "emp-1",
        status: "pending",
        lastWorkingDay: "2026-07-31",
        includeArt56Severance: false,
        checklist: {
          accessRevoked: false,
          equipmentReturned: false,
          documentsSigned: false,
          knowledgeTransfer: false,
          finalPayCalculated: false,
          benefitsCancelled: false,
          exitInterviewCompleted: false,
          referenceLetter: false,
          inssCessationDeclared: false,
        },
        exitInterview: { completed: false },
      });
    });
  });

  const dbAs = (uid: string) => env.authenticatedContext(uid).firestore();

  it("keeps tenant-wide performance records HR-only, even for managers with the old module flag", async () => {
    const managerDb = dbAs(MANAGER);
    for (const path of [
      "goals/goal-1",
      "reviews/review-submitted",
      "trainings/training-1",
      "disciplinary/case-1",
    ]) {
      await assertFails(getDoc(doc(managerDb, path)));
    }

    const hrDb = dbAs(HR);
    await assertSucceeds(getDoc(doc(hrDb, "goals/goal-1")));
    await assertSucceeds(getDoc(doc(hrDb, "disciplinary/case-1")));
  });

  it("shows an employee only their submitted review/training and never an HR draft", async () => {
    const employeeDb = dbAs(EMPLOYEE);
    await assertFails(getDoc(doc(employeeDb, "reviews/review-draft")));
    await assertSucceeds(getDoc(doc(employeeDb, "reviews/review-submitted")));
    await assertSucceeds(getDoc(doc(employeeDb, "trainings/training-1")));
    await assertFails(getDoc(doc(dbAs(OTHER), "trainings/training-1")));

    const ownVisibleReviews = query(
      collection(employeeDb, "reviews"),
      where("tenantId", "==", TENANT_ID),
      where("employeeId", "==", "emp-1"),
      where("status", "in", ["submitted", "acknowledged", "completed"]),
    );
    await assertSucceeds(getDocs(ownVisibleReviews));
    const anotherEmployeeReviews = query(
      collection(dbAs(OTHER), "reviews"),
      where("tenantId", "==", TENANT_ID),
      where("employeeId", "==", "emp-1"),
      where("status", "in", ["submitted", "acknowledged", "completed"]),
    );
    await assertFails(getDocs(anotherEmployeeReviews));
  });

  it("lets the employee acknowledge a submitted review without editing the rating", async () => {
    const reviewRef = doc(dbAs(EMPLOYEE), "reviews/review-submitted");
    await assertSucceeds(updateDoc(reviewRef, {
      status: "acknowledged",
      employeeComments: "I received and read this review.",
      acknowledgedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    expect((await getDoc(reviewRef)).data()?.status).toBe("acknowledged");
    await assertFails(updateDoc(reviewRef, { overallRating: 5 }));

    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "reviews/review-submitted"), {
        status: "submitted",
      });
    });
    await assertFails(updateDoc(reviewRef, {
      status: "acknowledged",
      employeeComments: "x".repeat(2001),
      acknowledgedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });

  it("enforces the disciplinary review and termination written-process workflow", async () => {
    const hrDb = dbAs(HR);
    const normalCase = doc(hrDb, "disciplinary/case-1");
    await assertFails(updateDoc(normalCase, {
      status: "closed",
      closedBy: HR,
      closedDate: "2026-07-21",
    }));
    await assertSucceeds(updateDoc(normalCase, { status: "in_review" }));

    const termination = doc(hrDb, "disciplinary/termination-1");
    await assertFails(updateDoc(termination, {
      status: "closed",
      closedBy: HR,
      closedDate: "2026-07-21",
    }));
    await assertSucceeds(updateDoc(termination, {
      status: "closed",
      closedBy: HR,
      closedDate: "2026-07-21",
      writtenAccusation: "Written allegation delivered to the employee.",
      employeeDefence: "The employee response was recorded.",
      reasonedDecision: "Evidence and response were considered.",
      decisionDeliveredDate: "2026-07-21",
    }));
    await assertFails(updateDoc(termination, { reasonedDecision: "Changed later" }));
  });

  it("completes offboarding only with the full checklist and employee termination in one write", async () => {
    const hrDb = dbAs(HR);
    const offboarding = doc(hrDb, "offboarding/offboarding-1");
    await assertFails(updateDoc(offboarding, { status: "completed" }));

    const complete = writeBatch(hrDb);
    complete.update(offboarding, {
      status: "completed",
      checklist: {
        accessRevoked: true,
        equipmentReturned: true,
        documentsSigned: true,
        knowledgeTransfer: true,
        finalPayCalculated: true,
        benefitsCancelled: true,
        exitInterviewCompleted: true,
        referenceLetter: true,
        inssCessationDeclared: true,
      },
      exitInterview: { completed: true },
      includeArt56Severance: false,
      article56FinalPay: {
        reviewAcknowledged: true,
        reviewNote: "Reviewed against the final payroll calculation.",
      },
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    complete.update(doc(hrDb, `tenants/${TENANT_ID}/employees/emp-1`), {
      status: "terminated",
      terminationDate: "2026-07-31",
      severanceOnTermination: false,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(complete.commit());
    await assertFails(updateDoc(offboarding, { status: "in_progress" }));
    await assertFails(deleteDoc(offboarding));
  });

  it("creates an anonymous grievance and bearer-status record together", async () => {
    const employeeDb = dbAs(EMPLOYEE);
    const ticket = "ABCDEFGH23456789";
    const grievanceRef = doc(employeeDb, `tenants/${TENANT_ID}/grievances/${ticket}`);
    const statusRef = doc(employeeDb, `tenants/${TENANT_ID}/grievanceStatuses/${ticket}`);
    const batch = writeBatch(employeeDb);
    batch.set(grievanceRef, {
      tenantId: TENANT_ID,
      ticketId: ticket,
      category: "wage_issue",
      description: "My recorded wages do not match the hours I worked.",
      attachmentUrls: [],
      status: "submitted",
      createdAt: serverTimestamp(),
    });
    batch.set(statusRef, {
      tenantId: TENANT_ID,
      ticketId: ticket,
      category: "wage_issue",
      status: "submitted",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());

    await assertFails(getDoc(grievanceRef));
    await assertSucceeds(getDoc(statusRef));
    await assertFails(getDocs(collection(employeeDb, `tenants/${TENANT_ID}/grievanceStatuses`)));
    await assertSucceeds(getDoc(doc(dbAs(HR), `tenants/${TENANT_ID}/grievances/${ticket}`)));

    const hrDb = dbAs(HR);
    const hrGrievance = doc(hrDb, `tenants/${TENANT_ID}/grievances/${ticket}`);
    const hrStatus = doc(hrDb, `tenants/${TENANT_ID}/grievanceStatuses/${ticket}`);
    const tamper = writeBatch(hrDb);
    tamper.update(hrGrievance, {
      status: "reviewing",
      description: "The original report body was changed.",
      updatedAt: serverTimestamp(),
    });
    tamper.update(hrStatus, { status: "reviewing", updatedAt: serverTimestamp() });
    await assertFails(tamper.commit());

    await assertFails(updateDoc(hrGrievance, {
      status: "reviewing",
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(hrStatus, {
      status: "reviewing",
      updatedAt: serverTimestamp(),
    }));

    const review = writeBatch(hrDb);
    review.update(hrGrievance, { status: "reviewing", updatedAt: serverTimestamp() });
    review.update(hrStatus, { status: "reviewing", updatedAt: serverTimestamp() });
    await assertSucceeds(review.commit());

    const resolve = writeBatch(hrDb);
    resolve.update(hrGrievance, {
      status: "resolved",
      resolution: "Payroll records were corrected and the employee was paid.",
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    resolve.update(hrStatus, {
      status: "resolved",
      resolution: "Payroll records were corrected and the employee was paid.",
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(resolve.commit());
    expect((await getDoc(statusRef)).data()?.resolution).toContain("corrected");

    const reopen = writeBatch(hrDb);
    reopen.update(hrGrievance, { status: "reviewing", updatedAt: serverTimestamp() });
    reopen.update(hrStatus, { status: "reviewing", updatedAt: serverTimestamp() });
    await assertFails(reopen.commit());
  });

  it("rejects identity fields and unpaired grievance status records", async () => {
    const employeeDb = dbAs(EMPLOYEE);
    const ticket = "ZXCVBNMA23456789";
    await assertFails(setDoc(doc(employeeDb, `tenants/${TENANT_ID}/grievances/${ticket}`), {
      tenantId: TENANT_ID,
      ticketId: ticket,
      category: "other",
      description: "This concern has enough detail to submit safely.",
      attachmentUrls: [],
      status: "submitted",
      userId: EMPLOYEE,
      createdAt: serverTimestamp(),
    }));
    const bodyOnlyTicket = "QWERTYUI23456789";
    await assertFails(setDoc(
      doc(employeeDb, `tenants/${TENANT_ID}/grievances/${bodyOnlyTicket}`),
      {
        tenantId: TENANT_ID,
        ticketId: bodyOnlyTicket,
        category: "other",
        description: "This otherwise valid report is missing its private status pair.",
        attachmentUrls: [],
        status: "submitted",
        createdAt: serverTimestamp(),
      },
    ));
    await assertFails(setDoc(doc(employeeDb, `tenants/${TENANT_ID}/grievanceStatuses/${ticket}`), {
      tenantId: TENANT_ID,
      ticketId: ticket,
      category: "other",
      status: "submitted",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });
});
