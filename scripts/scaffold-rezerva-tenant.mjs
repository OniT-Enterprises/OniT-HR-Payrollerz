/**
 * Scaffold a Rezerva-linked tenant into a login-ready Xefe tenant.
 *
 * Rezerva creates a bare tenant doc (name/slug/status + linkedRezervaSlugs) and
 * syncs employees, but leaves the tenant unusable for direct login: no plan /
 * features / app-settings on the tenant doc, empty company details, no
 * departments, and — critically — no members, so nobody can sign in.
 *
 * This script fills that gap idempotently. Structure is always written; the
 * owner login is only provisioned when --owner-email is passed.
 *
 * Usage:
 *   # structure only (safe, no credentials created)
 *   node scripts/scaffold-rezerva-tenant.mjs --tenant=hotel-esplanada
 *
 *   # structure + owner login (prints a one-time password to relay)
 *   node scripts/scaffold-rezerva-tenant.mjs \
 *     --tenant=hotel-esplanada \
 *     --owner-email=admin@hotelesplanada.com \
 *     --owner-name="Hotel Esplanada Admin" \
 *     --owner-employee-id=REZ-U6QNDP
 *
 * Optional company-detail flags (else left for the owner to fill in setup):
 *   --legal-name, --address, --city, --phone, --tin
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import crypto from 'crypto';

const args = process.argv.slice(2);
const arg = (flag) => {
  const e = args.find((a) => a.startsWith(`${flag}=`));
  return e ? e.slice(flag.length + 1).trim() || null : null;
};

const PROJECT_ID = arg('--project') || 'onit-hr-payroll';
const TID = arg('--tenant');
const OWNER_EMAIL = arg('--owner-email');
const OWNER_NAME = arg('--owner-name') || 'Owner';
const OWNER_EMPLOYEE_ID = arg('--owner-employee-id') || '';
const ALL_MODULES = ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'money', 'accounting', 'reports'];
const ALL_FEATURES = { hiring: true, staff: true, timeleave: true, performance: true, payroll: true, money: true, accounting: true, reports: true };
const APP_SETTINGS = { timezone: 'Asia/Dili', currency: 'USD', dateFormat: 'DD/MM/YYYY' };

if (!TID) {
  console.error('Usage: node scripts/scaffold-rezerva-tenant.mjs --tenant=<id> [--owner-email=<email> --owner-name=<name> --owner-employee-id=<id>]');
  process.exit(1);
}

function getCredentials() {
  const paths = [
    join(process.cwd(), 'service-account.json'),
    join(process.cwd(), 'serviceAccountKey.json'),
    join(process.cwd(), 'server', 'xefe-api', 'serviceAccountKey.json'),
    join(homedir(), '.config', 'firebase', `${PROJECT_ID}-firebase-adminsdk.json`),
  ];
  try {
    const k = readdirSync(process.cwd()).find((n) => n.startsWith(`${PROJECT_ID}-firebase-adminsdk-`) && n.endsWith('.json'));
    if (k) paths.unshift(join(process.cwd(), k));
  } catch { /* ignore */ }
  for (const p of paths) {
    if (existsSync(p)) return cert(JSON.parse(readFileSync(p, 'utf8')));
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')));
  }
  throw new Error('No service-account credentials found.');
}

async function run() {
  if (!getApps().length) initializeApp({ credential: getCredentials(), projectId: PROJECT_ID });
  const db = getFirestore();
  const auth = getAuth();

  const tSnap = await db.doc(`tenants/${TID}`).get();
  if (!tSnap.exists) {
    throw new Error(`Tenant ${TID} does not exist. This script scaffolds an existing (Rezerva-created) tenant, it does not create one.`);
  }
  const company = tSnap.data().name || TID;
  console.log(`\nScaffolding "${company}" (${TID})...\n`);

  // 1. Tenant doc: fields the app reads for plan/features/settings.
  await db.doc(`tenants/${TID}`).set({
    id: TID,
    plan: 'professional',
    features: ALL_FEATURES,
    settings: APP_SETTINGS,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('  ✓ tenant doc: id, plan, features, settings');

  // 2. settings/config: company details (from flags) + features + settings.
  const cfgRef = db.doc(`tenants/${TID}/settings/config`);
  const cfg = (await cfgRef.get()).data() || {};
  const details = { ...(cfg.companyDetails || {}) };
  if (arg('--legal-name')) { details.legalName = arg('--legal-name'); details.tradingName ||= arg('--legal-name'); }
  if (arg('--address')) details.registeredAddress = arg('--address');
  if (arg('--city')) details.city = arg('--city');
  if (arg('--phone')) details.phone = arg('--phone');
  if (arg('--tin')) details.tinNumber = arg('--tin');
  if (OWNER_EMAIL) details.email ||= OWNER_EMAIL;
  await cfgRef.set({
    companyDetails: details,
    features: ALL_FEATURES,
    settings: APP_SETTINGS,
    setupProgress: { ...(cfg.setupProgress || {}), companyDetails: !!details.legalName },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('  ✓ settings/config: company details, features, settings');

  // 3. Ensure at least one department, link any unassigned employees to it.
  const deptSnap = await db.collection(`tenants/${TID}/departments`).get();
  let deptId, deptName;
  if (deptSnap.empty) {
    deptId = 'dept-operations';
    deptName = 'Operations';
    await db.doc(`tenants/${TID}/departments/${deptId}`).set({
      name: deptName, tenantId: TID, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  ✓ department "${deptName}" (${deptId})`);
  } else {
    deptId = deptSnap.docs[0].id;
    deptName = deptSnap.docs[0].data().name || 'Operations';
    console.log(`  · ${deptSnap.size} department(s) already exist; using ${deptId} for unassigned staff`);
  }
  const emps = await db.collection(`tenants/${TID}/employees`).get();
  const batch = db.batch();
  let linked = 0;
  emps.docs.forEach((doc) => {
    if (!doc.data().departmentId) {
      batch.update(doc.ref, { departmentId: deptId, 'jobDetails.department': deptName, updatedAt: FieldValue.serverTimestamp() });
      linked++;
    }
  });
  if (linked) await batch.commit();
  console.log(`  ✓ linked ${linked} unassigned employee(s) to ${deptId}`);

  // 4. Owner login (only if requested).
  if (OWNER_EMAIL) {
    const tempPassword = 'Xefe-' + crypto.randomBytes(9).toString('base64url') + '9!';
    let uid;
    try {
      const u = await auth.getUserByEmail(OWNER_EMAIL);
      uid = u.uid;
      await auth.updateUser(uid, { password: tempPassword, displayName: OWNER_NAME, emailVerified: true });
      console.log(`  ✓ owner auth user existed, password reset (${uid})`);
    } catch {
      const c = await auth.createUser({ email: OWNER_EMAIL, password: tempPassword, displayName: OWNER_NAME, emailVerified: true });
      uid = c.uid;
      console.log(`  ✓ created owner auth user (${uid})`);
    }

    await db.doc(`tenants/${TID}/members/${uid}`).set({
      uid, email: OWNER_EMAIL, displayName: OWNER_NAME,
      role: 'owner', modules: ALL_MODULES, employeeId: OWNER_EMPLOYEE_ID,
      joinedAt: FieldValue.serverTimestamp(), lastActiveAt: FieldValue.serverTimestamp(),
      permissions: { admin: true, write: true, read: true },
    }, { merge: true });

    const userRef = db.doc(`users/${uid}`);
    const existing = (await userRef.get()).data() || {};
    const ids = Array.isArray(existing.tenantIds) ? existing.tenantIds : [];
    await userRef.set({
      uid, email: OWNER_EMAIL, displayName: OWNER_NAME,
      isSuperAdmin: existing.isSuperAdmin === true,
      tenantIds: ids.includes(TID) ? ids : [...ids, TID],
      tenantAccess: { ...(existing.tenantAccess || {}), [TID]: { name: company, role: 'owner' } },
      ...(existing.createdAt ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await cfgRef.set({ hrAdminIds: FieldValue.arrayUnion(uid), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.log('  ✓ owner member + user profile + hrAdminIds');

    console.log('\n=== OWNER LOGIN ===');
    console.log(`  URL:      https://xefe.tl/auth/login`);
    console.log(`  Email:    ${OWNER_EMAIL}`);
    console.log(`  Password: ${tempPassword}   (change on first sign-in)`);
    console.log(`  UID:      ${uid}`);
  } else {
    console.log('\n  (no --owner-email — structure only; run again with owner flags to create a login)');
  }

  console.log('\n✅ Done.\n');
  process.exit(0);
}

run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
