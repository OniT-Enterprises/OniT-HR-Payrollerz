/**
 * Idempotently create the canonical Primos Bo'ot partner workspace.
 *
 * Dry-run (default):
 *   node scripts/bootstrap-primos-partner.mjs
 *
 * Apply without contacting the firm (safe for superadmin impersonation):
 *   node scripts/bootstrap-primos-partner.mjs --apply
 *
 * Apply and send the partner owner a password-setup email after commercial
 * onboarding is confirmed:
 *   node scripts/bootstrap-primos-partner.mjs --apply --send-invite
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const sendInvite = args.includes("--send-invite");
const partnerCommunicationsEnabled = false;
const projectArg = args.find((value) => value.startsWith("--project="));
const projectId = projectArg?.slice("--project=".length) || "onit-hr-payroll";

const partner = {
  id: "primos-boot",
  tenantId: "primos-boot",
  name: "Primos Bo'ot",
  email: "info@primosboot.com",
  phone: "+670 7831 8131",
  address: "Torreto Building, 6th Floor, Dili",
};

const modules = [
  "hiring",
  "staff",
  "timeleave",
  "performance",
  "payroll",
  "money",
  "accounting",
  "reports",
];
const features = {
  hiring: true,
  staff: true,
  timeleave: true,
  performance: true,
  payroll: true,
  money: true,
  accounting: true,
  reports: true,
};
const appSettings = {
  timezone: "Asia/Dili",
  currency: "USD",
  dateFormat: "DD/MM/YYYY",
};

function credentials() {
  const candidates = [
    join(process.cwd(), "service-account.json"),
    join(process.cwd(), "serviceAccountKey.json"),
    join(process.cwd(), "server", "xefe-api", "serviceAccountKey.json"),
    join(homedir(), ".config", "firebase", `${projectId}-firebase-adminsdk.json`),
  ];
  try {
    const localKey = readdirSync(process.cwd()).find(
      (name) =>
        name.startsWith(`${projectId}-firebase-adminsdk-`) &&
        name.endsWith(".json"),
    );
    if (localKey) candidates.unshift(join(process.cwd(), localKey));
  } catch {
    // The current directory is readable in normal use; continue to other paths.
  }
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  ) {
    candidates.unshift(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error("No Firebase service-account credentials found.");
  return cert(JSON.parse(readFileSync(path, "utf8")));
}

async function run() {
  if (sendInvite && !apply) {
    throw new Error("--send-invite requires --apply");
  }
  if (sendInvite && !partnerCommunicationsEnabled) {
    throw new Error(
      "Primos Bo'ot communications are pre-launch. Enable them only after the partnership is confirmed.",
    );
  }
  if (!getApps().length) {
    initializeApp({ credential: credentials(), projectId });
  }

  const db = getFirestore();
  const auth = getAuth();
  const tenantRef = db.doc(`tenants/${partner.tenantId}`);
  const tenantSnapshot = await tenantRef.get();
  let owner = null;
  try {
    owner = await auth.getUserByEmail(partner.email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }

  console.log(`Project: ${projectId}`);
  console.log(`Partner tenant: ${partner.tenantId} (${tenantSnapshot.exists ? "exists" : "missing"})`);
  console.log(`Partner owner: ${partner.email} (${owner ? "exists" : "missing"})`);
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to create or repair the workspace.");
    return;
  }

  if (tenantSnapshot.exists) {
    const current = tenantSnapshot.data() || {};
    const currentPartnerId = current.partnerWorkspace?.partnerId;
    if (currentPartnerId && currentPartnerId !== partner.id) {
      throw new Error(
        `Tenant ${partner.tenantId} belongs to a different partner (${currentPartnerId}).`,
      );
    }
  }

  if (!owner) {
    owner = await auth.createUser({
      email: partner.email,
      displayName: partner.name,
      emailVerified: false,
    });
  }

  const now = FieldValue.serverTimestamp();
  const tenantCreateFields = tenantSnapshot.exists
    ? {}
    : { createdAt: now, createdBy: "partner-bootstrap" };
  await tenantRef.set({
    id: partner.tenantId,
    name: partner.name,
    legalName: partner.name,
    tradingName: partner.name,
    slug: partner.tenantId,
    status: "active",
    plan: "professional",
    limits: { maxEmployees: 100, maxUsers: 20, storageGB: 25 },
    ownerEmail: partner.email,
    billingEmail: partner.email,
    phone: partner.phone,
    address: partner.address,
    features,
    settings: appSettings,
    partnerWorkspace: {
      partnerId: partner.id,
      status: "active",
    },
    updatedAt: now,
    ...tenantCreateFields,
  }, { merge: true });

  await db.doc(`tenants/${partner.tenantId}/settings/config`).set({
    companyDetails: {
      legalName: partner.name,
      tradingName: partner.name,
      registeredAddress: partner.address,
      city: "Dili",
      country: "Timor-Leste",
      phone: partner.phone,
      email: partner.email,
    },
    features,
    settings: appSettings,
    hrAdminIds: FieldValue.arrayUnion(owner.uid),
    updatedAt: now,
  }, { merge: true });

  await db.doc(`tenants/${partner.tenantId}/members/${owner.uid}`).set({
    uid: owner.uid,
    email: partner.email,
    displayName: partner.name,
    role: "owner",
    modules,
    joinedAt: now,
    lastActiveAt: now,
    permissions: { admin: true, write: true, read: true },
  }, { merge: true });

  const userRef = db.doc(`users/${owner.uid}`);
  const userSnapshot = await userRef.get();
  const userData = userSnapshot.data() || {};
  const tenantIds = Array.isArray(userData.tenantIds) ? userData.tenantIds : [];
  await userRef.set({
    uid: owner.uid,
    email: partner.email,
    displayName: partner.name,
    isSuperAdmin: userData.isSuperAdmin === true,
    tenantIds: tenantIds.includes(partner.tenantId)
      ? tenantIds
      : [...tenantIds, partner.tenantId],
    tenantAccess: {
      ...(userData.tenantAccess || {}),
      [partner.tenantId]: { name: partner.name, role: "owner" },
    },
    ...(userSnapshot.exists ? {} : { createdAt: now }),
    updatedAt: now,
  }, { merge: true });

  const existingTenantClaims = owner.customClaims?.tenants;
  const tenantClaims = Array.isArray(existingTenantClaims)
    ? Object.fromEntries(existingTenantClaims.map((id) => [id, "member"]))
    : existingTenantClaims && typeof existingTenantClaims === "object"
      ? { ...existingTenantClaims }
      : {};
  await auth.setCustomUserClaims(owner.uid, {
    ...(owner.customClaims || {}),
    tenants: {
      ...tenantClaims,
      [partner.tenantId]: "owner",
    },
  });

  await db.collection("adminAuditLog").add({
    action: tenantSnapshot.exists
      ? "accountant_partner_workspace_repaired"
      : "accountant_partner_workspace_created",
    actorUid: "partner-bootstrap",
    actorEmail: "",
    targetType: "tenant",
    targetId: partner.tenantId,
    targetName: partner.name,
    details: { partnerId: partner.id, ownerUid: owner.uid },
    timestamp: now,
    triggeredBy: "script",
  });

  if (sendInvite) {
    const resetLink = await auth.generatePasswordResetLink(partner.email);
    await db.collection("mail").add({
      tenantId: partner.tenantId,
      to: [partner.email],
      subject: "Your Primos Bo'ot Xefe workspace is ready",
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6"><h2>Your Xefe partner workspace is ready</h2><p>Use the secure link below to set your password and open the Primos Bo'ot client-review workspace.</p><p><a href="${resetLink.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">Set your Xefe password</a></p><p>Client records are available only after each business explicitly grants accountant access.</p><hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><p style="font-size:12px;color:#666">Sent by Xefe · Haruka husi Xefe</p></div>`,
      status: "pending",
      purpose: "accountant-partner-onboarding",
      createdBy: "partner-bootstrap",
      createdAt: now,
    });
    console.log("Queued the partner onboarding email.");
  }

  console.log(`Partner workspace ready: ${partner.tenantId} (owner uid ${owner.uid})`);
}

run().catch((error) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
