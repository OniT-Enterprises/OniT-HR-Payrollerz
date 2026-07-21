/**
 * Emulator seeding helpers for the E2E journey.
 *
 * Talks to the Auth + Firestore emulators with the Admin SDK (no credentials
 * needed — the emulator env vars route everything locally). Used for the bits
 * a browser can't do through the product: creating the second approver
 * account (there is no tenant-facing invite UI yet) and recording the offline
 * subscription a superadmin would normally enter (payroll approval is
 * paywalled in firestore.rules).
 */
import { App, deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore, Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "onit-hr-payroll";

process.env.FIRESTORE_EMULATOR_HOST ||= "localhost:8081";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "localhost:9100";

let app: App | null = null;

/**
 * The emulator hub answers before every emulator finishes binding, so a
 * hub-based readiness probe can hand the browser a half-started stack
 * (auth/network-request-failed on the first signup call). Poll every
 * emulator the journey touches before any test begins.
 */
export async function waitForEmulators(timeoutMs = 90_000): Promise<void> {
  const targets = [
    ["auth", "http://localhost:9100"],
    ["firestore", "http://localhost:8081"],
    ["storage", "http://localhost:9199"],
    ["functions", "http://localhost:5001"],
  ] as const;
  const deadline = Date.now() + timeoutMs;
  for (const [name, url] of targets) {
    for (;;) {
      try {
        await fetch(url);
        break;
      } catch {
        if (Date.now() > deadline) {
          throw new Error(`Emulator "${name}" (${url}) never became reachable`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }
}

function adminApp(): App {
  if (!app) {
    app = initializeApp({ projectId: PROJECT_ID }, `e2e-${Date.now()}`);
  }
  return app;
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export async function closeAdmin(): Promise<void> {
  if (app) {
    await deleteApp(app);
    app = null;
  }
}

/**
 * The invite UI creates the Auth user and queues a password-setup email. The
 * emulator has no inbox, so give that invited account the password the test
 * would have set by following the email link. Membership still comes entirely
 * from the product's owner-facing invite flow.
 */
export async function setInvitedUserPassword(options: {
  email: string;
  password: string;
  displayName: string;
}): Promise<string> {
  const auth = getAuth(adminApp());
  const user = await auth.getUserByEmail(options.email);
  await auth.updateUser(user.uid, {
    password: options.password,
    displayName: options.displayName,
    emailVerified: true,
  });
  return user.uid;
}

/** Find the tenant provisioned by the signup step via its unique name. */
export async function findTenantIdByName(name: string): Promise<string> {
  const snapshot = await adminDb()
    .collection("tenants")
    .where("name", "==", name)
    .limit(1)
    .get();
  if (snapshot.empty) {
    throw new Error(`No tenant found with name ${name}`);
  }
  return snapshot.docs[0].id;
}

/**
 * Record an active offline subscription (what a superadmin does for bank
 * transfer / cash customers) so the rules' payroll-approval paywall opens.
 */
export async function activateSubscription(tenantId: string): Promise<void> {
  await adminDb()
    .doc(`tenants/${tenantId}`)
    .update({
      manualSubscription: true,
      subscriptionPaidUntil: Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ),
    });
}

/**
 * Seed active employees directly (Admin SDK). The main E2E already proves
 * employee creation through the UI; the month replay uses this to load a
 * whole schedule quickly and drive only the payroll wizard. Shapes match
 * what the directory hook and the TL payroll calculator read.
 */
export async function markSetupComplete(tenantId: string): Promise<void> {
  // The payroll wizard redirects to /setup when settings/config is absent.
  // Seed a minimal completed-setup doc so the replay can drive the wizard
  // (setup itself is exercised by the main E2E).
  await adminDb()
    .doc(`tenants/${tenantId}/settings/config`)
    .set(
      {
        tenantId,
        setupComplete: true,
        setupProgress: {
          companyDetails: true,
          paymentStructure: true,
          payrollConfig: true,
          completed: true,
        },
        companyDetails: {
          legalName: "Replay Co Lda",
          tinNumber: "1234567890",
          registeredAddress: "Rua de Dili 1, Dili",
          businessType: "Lda",
        },
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
}

/** Seed reference data that is not the subject of the accounting browser test. */
export async function seedDomesticWithholdingVendor(
  tenantId: string,
): Promise<{ id: string; name: string }> {
  const db = adminDb();
  const name = "E2E Construction Supplier";
  const vendorRef = db.collection(`tenants/${tenantId}/vendors`).doc();
  await Promise.all([
    db.doc(`tenants/${tenantId}`).set({ advancedTaxMode: true }, { merge: true }),
    db.doc(`tenants/${tenantId}/settings/config`).set(
      {
        companyDetails: {
          legalName: "E2E Books Co Lda",
          tinNumber: "1234567890",
          registeredAddress: "Rua de Dili 1, Dili",
          businessType: "Lda",
        },
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    ),
    vendorRef.set({
      name,
      type: "business",
      tin: "VENDOR-TIN-100",
      taxProfile: {
        recipientResidence: "resident",
        taxRegime: "domestic",
      },
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }),
  ]);
  return { id: vendorRef.id, name };
}

export async function seedEmployees(
  tenantId: string,
  employees: Array<{ ref: string; monthlySalary: number }>,
): Promise<void> {
  const db = adminDb();
  await Promise.all(
    employees.map((e, index) =>
      db.doc(`tenants/${tenantId}/employees/${e.ref}`).set({
        status: "active",
        personalInfo: { firstName: "Worker", lastName: e.ref.toUpperCase() },
        jobDetails: {
          employeeId: `E${String(index + 1).padStart(3, "0")}`,
          department: "Operations",
          position: "Staff",
          hireDate: "2020-01-01",
          employmentType: "full_time",
        },
        compensation: {
          monthlySalary: e.monthlySalary,
          payFrequency: "monthly",
          isResident: true,
        },
        documents: {
          residencyStatus: "citizen",
          socialSecurityNumber: { number: `NISS${index + 1}`, required: true },
          bilheteIdentidade: { number: `BI${index + 1}`, required: true },
        },
        contract: { fileUrl: "seeded://contract", signed: true },
        createdAt: Timestamp.now(),
      }),
    ),
  );
}

/** Read the created payroll run's aggregate totals from Firestore. */
export async function getLatestRunTotals(tenantId: string): Promise<{
  totalGrossPay: number;
  totalNetPay: number;
  totalDeductions: number;
  employeeCount: number;
} | null> {
  const snapshot = await adminDb()
    .collection("payrollRuns")
    .where("tenantId", "==", tenantId)
    .limit(5)
    .get();
  if (snapshot.empty) return null;
  const run = snapshot.docs[0].data();
  return {
    totalGrossPay: Number(run.totalGrossPay ?? 0),
    totalNetPay: Number(run.totalNetPay ?? 0),
    totalDeductions: Number(run.totalDeductions ?? 0),
    employeeCount: Number(run.employeeCount ?? 0),
  };
}

/**
 * Read back the payroll journal a run posted, so a test can verify the books —
 * not just that the run reached "paid". Returns the posted entry's balance and
 * per-account-code debit/credit totals (tenant-scoped journalEntries).
 */
export interface JournalSummary {
  id: string;
  totalDebit: number;
  totalCredit: number;
  byCode: Record<string, { debit: number; credit: number }>;
}

/** Read a posted journal by source and summarize its account lines. */
export async function getJournalBySource(
  tenantId: string,
  source: string,
  requiredAccountCode?: string,
): Promise<JournalSummary | null> {
  const snapshot = await adminDb()
    .collection(`tenants/${tenantId}/journalEntries`)
    .where("source", "==", source)
    .limit(5)
    .get();
  if (snapshot.empty) return null;
  const document = requiredAccountCode
    ? snapshot.docs.find((candidate) =>
        ((candidate.data().lines ?? []) as Array<{ accountCode?: string }>)
          .some((line) => line.accountCode === requiredAccountCode))
    : snapshot.docs[0];
  if (!document) return null;
  const entry = document.data();
  const byCode: Record<string, { debit: number; credit: number }> = {};
  for (const line of (entry.lines ?? []) as Array<{ accountCode: string; debit: number; credit: number }>) {
    const c = (byCode[line.accountCode] ??= { debit: 0, credit: 0 });
    c.debit += Number(line.debit ?? 0);
    c.credit += Number(line.credit ?? 0);
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  for (const code of Object.keys(byCode)) {
    byCode[code].debit = round2(byCode[code].debit);
    byCode[code].credit = round2(byCode[code].credit);
  }
  return {
    id: document.id,
    totalDebit: Number(entry.totalDebit ?? 0),
    totalCredit: Number(entry.totalCredit ?? 0),
    byCode,
  };
}

/** Poll for a journal created asynchronously after a browser action. */
export async function waitForJournalBySource(
  tenantId: string,
  source: string,
  requiredAccountCode?: string,
  timeoutMs = 45_000,
): Promise<JournalSummary> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const journal = await getJournalBySource(tenantId, source, requiredAccountCode);
    if (journal) return journal;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `No ${source} journal${requiredAccountCode ? ` containing ${requiredAccountCode}` : ""} found for ${tenantId}`,
  );
}

export async function getPayrollJournal(tenantId: string): Promise<JournalSummary | null> {
  return getJournalBySource(tenantId, "payroll");
}

/** Poll server-written tenant audit logs until every expected action exists. */
export async function waitForAuditActions(
  tenantId: string,
  expectedActions: string[],
  timeoutMs = 45_000,
): Promise<string[]> {
  const expected = new Set(expectedActions);
  const deadline = Date.now() + timeoutMs;
  let last: string[] = [];
  while (Date.now() < deadline) {
    const snapshot = await adminDb()
      .collection(`tenants/${tenantId}/auditLogs`)
      .limit(200)
      .get();
    last = snapshot.docs.map((document) => String(document.data().action));
    if ([...expected].every((action) => last.includes(action))) return last;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `Missing audit actions for ${tenantId}: ${[...expected].filter((action) => !last.includes(action)).join(", ")}`,
  );
}

/** Sum the employee income tax + INSS across the run's saved records. */
export async function getLatestRunRecordTotals(tenantId: string): Promise<{
  incomeTax: number;
  inssEmployee: number;
  count: number;
}> {
  const snapshot = await adminDb()
    .collection("payrollRecords")
    .where("tenantId", "==", tenantId)
    .get();
  let incomeTax = 0;
  let inssEmployee = 0;
  for (const doc of snapshot.docs) {
    const rec = doc.data();
    for (const d of (rec.deductions ?? []) as Array<{ type: string; amount: number }>) {
      if (d.type === "income_tax") incomeTax += Number(d.amount ?? 0);
      if (d.type === "inss_employee") inssEmployee += Number(d.amount ?? 0);
    }
  }
  return {
    incomeTax: Math.round(incomeTax * 100) / 100,
    inssEmployee: Math.round(inssEmployee * 100) / 100,
    count: snapshot.size,
  };
}

/**
 * Ground-truth check: poll the tenant's payroll run until it reaches the
 * expected status. Returns the final
 * status; throws with the actual status on timeout so failures name the
 * stuck state instead of a missing UI element.
 */
export async function waitForRunStatus(
  tenantId: string,
  expected: string,
  timeoutMs = 45_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = "<no run found>";
  while (Date.now() < deadline) {
    const snapshot = await adminDb()
      .collection("payrollRuns")
      .where("tenantId", "==", tenantId)
      .limit(5)
      .get();
    const statuses = snapshot.docs.map((d) => String(d.data().status));
    if (statuses.includes(expected)) return expected;
    last = statuses.join(",") || last;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `Payroll run for ${tenantId} never reached "${expected}" — last status: ${last}`,
  );
}

/**
 * Create the independent approver: an auth account plus tenant membership and
 * the user profile the tenant-discovery path reads. Mirrors provisionOrg.ts
 * shapes (member doc + users doc with tenantIds/tenantAccess).
 */
export async function createApprover(options: {
  tenantId: string;
  email: string;
  password: string;
  displayName: string;
}): Promise<string> {
  const { tenantId, email, password, displayName } = options;
  const auth = getAuth(adminApp());
  const user = await auth.createUser({
    email,
    password,
    displayName,
    emailVerified: true,
  });

  const db = adminDb();
  await db.doc(`tenants/${tenantId}/members/${user.uid}`).set({
    uid: user.uid,
    role: "hr-admin",
    email,
    displayName,
    joinedAt: Timestamp.now(),
  });
  await db.doc(`users/${user.uid}`).set({
    email,
    displayName,
    isSuperAdmin: false,
    tenantIds: [tenantId],
    tenantAccess: { [tenantId]: "hr-admin" },
    createdAt: Timestamp.now(),
  });

  return user.uid;
}
