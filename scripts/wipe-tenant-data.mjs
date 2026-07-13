/**
 * Wipe all operational data from a tenant while keeping the org shell + login.
 *
 * KEEPS: the tenant doc itself (name/slug/status/plan/features/appSettings),
 *        the `members` subcollection (so owner/users can still log in),
 *        users/{uid} docs and Auth accounts (untouched).
 * WIPES: every OTHER subcollection under tenants/{tid}/... (discovered
 *        dynamically so nothing is missed), PLUS legacy top-level collections
 *        keyed by a `tenantId` field.
 *
 * Dry-run by default (prints an inventory). Pass --confirm to actually delete.
 *
 * Usage:
 *   node scripts/wipe-tenant-data.mjs --tenant=onit-enterprises-mrdkbaja
 *   node scripts/wipe-tenant-data.mjs --tenant=onit-enterprises-mrdkbaja --confirm
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (flag) => {
  const e = args.find((a) => a.startsWith(`${flag}=`));
  return e ? e.slice(flag.length + 1).trim() || null : null;
};
const TID = arg('--tenant');
const CONFIRM = args.includes('--confirm');

if (!TID) {
  console.error('Usage: node scripts/wipe-tenant-data.mjs --tenant=<id> [--confirm]');
  process.exit(1);
}

// Subcollections to PRESERVE under the tenant doc.
//  members   -> owner/user login
//  settings  -> company profile, enabled modules/features, payroll policy
const KEEP_SUBCOLLECTIONS = new Set(['members', 'settings']);

// Legacy top-level collections keyed by a `tenantId` FIELD.
const ROOT_COLLECTIONS = [
  'departments', 'employees', 'positions', 'jobs', 'candidates', 'interviews',
  'offers', 'contracts', 'timesheets', 'leavePolicies', 'leaveRequests',
  'leaveBalances', 'leave_requests', 'leave_balances', 'goals', 'reviews',
  'trainings', 'discipline', 'customers', 'invoices', 'recurring_invoices',
  'payments_received', 'vendors', 'bills', 'bill_payments', 'expenses',
  'holidays', 'payrollRuns', 'payrollRecords', 'benefitEnrollments',
  'recurringDeductions', 'taxReports', 'taxFilings', 'bankTransfers',
  'attendance', 'attendanceImports',
];

function getCredentials() {
  const paths = [
    join(__dirname, '..', 'service-account.json'),
    join(__dirname, '..', 'server', 'xefe-api', 'serviceAccountKey.json'),
  ];
  const p = paths.find(existsSync);
  if (!p) throw new Error('No service account found: ' + paths.join(', '));
  console.log('🔑 Credentials:', p);
  return JSON.parse(readFileSync(p, 'utf8'));
}

if (!getApps().length) initializeApp({ credential: cert(getCredentials()) });
const db = getFirestore();

async function deleteQuery(ref, batchSize = 300) {
  let deleted = 0;
  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < batchSize) break;
  }
  return deleted;
}

async function main() {
  const tenantRef = db.doc(`tenants/${TID}`);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    console.error(`❌ Tenant '${TID}' does not exist. Aborting.`);
    process.exit(1);
  }
  const t = tenantSnap.data();
  console.log(`\n🏢 Tenant: ${t.name || '(no name)'}  [${TID}]`);
  console.log(`   status=${t.status} plan=${t.plan || t.subscriptionPlan || '-'}`);
  console.log(CONFIRM ? '\n🔴 LIVE RUN — deleting.\n' : '\n🟡 DRY RUN — no deletes. Pass --confirm to delete.\n');

  let grand = 0;

  // 1) Tenant subcollections (dynamic discovery)
  const subcols = await tenantRef.listCollections();
  console.log('— Tenant subcollections —');
  for (const c of subcols) {
    if (KEEP_SUBCOLLECTIONS.has(c.id)) {
      const kept = (await c.count().get()).data().count;
      console.log(`   ⏭  KEEP  ${c.id} (${kept} docs)`);
      continue;
    }
    const count = (await c.count().get()).data().count;
    if (count === 0) continue;
    if (CONFIRM) {
      const n = await deleteQuery(c);
      console.log(`   🗑  ${c.id}: deleted ${n}`);
      grand += n;
    } else {
      console.log(`   •  ${c.id}: ${count} docs`);
      grand += count;
    }
  }

  // 2) Legacy top-level collections by tenantId field
  console.log('\n— Legacy top-level collections (by tenantId) —');
  for (const name of ROOT_COLLECTIONS) {
    const q = db.collection(name).where('tenantId', '==', TID);
    const count = (await q.count().get()).data().count;
    if (count === 0) continue;
    if (CONFIRM) {
      const n = await deleteQuery(q);
      console.log(`   🗑  ${name}: deleted ${n}`);
      grand += n;
    } else {
      console.log(`   •  ${name}: ${count} docs`);
      grand += count;
    }
  }

  // 3) Reset stale denormalized counters on the tenant doc
  const staleCount = t.currentEmployeeCount || 0;
  if (staleCount !== 0) {
    if (CONFIRM) {
      await tenantRef.update({ currentEmployeeCount: 0 });
      console.log(`\n🔄 Reset currentEmployeeCount ${staleCount} -> 0`);
    } else {
      console.log(`\n🔄 Would reset currentEmployeeCount ${staleCount} -> 0`);
    }
  }

  console.log(`\n${CONFIRM ? '✅ Deleted' : '📊 Would delete'} ${grand} docs total.`);
  console.log('   Kept: tenant doc, members, settings, users/*, Auth accounts.');
  if (!CONFIRM) console.log('\nRe-run with --confirm to execute.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
