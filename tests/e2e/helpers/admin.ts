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
