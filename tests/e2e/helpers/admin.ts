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
        companyDetails: {
          legalName: "Replay Co Lda",
          tinNumber: "1234567890",
          registeredAddress: "Rua de Dili 1, Dili",
        },
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
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
 * expected status (the approve flow ends at 'paid'). Returns the final
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
