/**
 * Fully delete one or more tenants: the tenant doc + ALL subcollections
 * (recursiveDelete), PLUS legacy top-level collections keyed by `tenantId`.
 *
 * User/Auth handling is SAFE: for each member uid we look at the user's
 * tenantAccess/tenantIds. We only delete users/{uid} + the Auth account when
 * the user has NO remaining tenants after these deletions. Otherwise we strip
 * just the deleted tenant(s) from their access maps (no orphan / ghost refs).
 *
 * Dry-run by default. Pass --confirm to execute.
 *
 * Usage:
 *   node scripts/delete-tenant.mjs --tenants=a,b,c
 *   node scripts/delete-tenant.mjs --tenants=a,b,c --confirm
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (flag) => {
  const e = args.find((a) => a.startsWith(`${flag}=`));
  return e ? e.slice(flag.length + 1).trim() || null : null;
};
const TIDS = (arg('--tenants') || arg('--tenant') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const CONFIRM = args.includes('--confirm');
// Preserve all Auth/login accounts by default; pass --delete-orphan-logins to
// remove user docs + Auth accounts for users left with no tenant (never supers).
const KEEP_LOGINS = !args.includes('--delete-orphan-logins');
const DELETE_SET = new Set(TIDS);

if (!TIDS.length) {
  console.error('Usage: node scripts/delete-tenant.mjs --tenants=<id,id,...> [--confirm]');
  process.exit(1);
}

const ROOT_COLLECTIONS = [
  'departments', 'employees', 'positions', 'jobs', 'candidates', 'interviews',
  'offers', 'contracts', 'timesheets', 'leavePolicies', 'leaveRequests',
  'leaveBalances', 'leave_requests', 'leave_balances', 'goals', 'reviews',
  'trainings', 'discipline', 'customers', 'invoices', 'recurring_invoices',
  'payments_received', 'vendors', 'bills', 'bill_payments', 'expenses',
  'holidays', 'payrollRuns', 'payrollRecords', 'benefitEnrollments',
  'recurringDeductions', 'taxReports', 'taxFilings', 'bankTransfers',
  'attendance', 'attendanceImports', 'analytics', 'invoice_links',
];

function getCredentials() {
  const paths = [
    join(__dirname, '..', 'service-account.json'),
    join(__dirname, '..', 'server', 'xefe-api', 'serviceAccountKey.json'),
  ];
  const p = paths.find(existsSync);
  if (!p) throw new Error('No service account found');
  console.log('🔑 Credentials:', p);
  return JSON.parse(readFileSync(p, 'utf8'));
}

if (!getApps().length) initializeApp({ credential: cert(getCredentials()) });
const db = getFirestore();
const auth = getAuth();

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
  console.log(CONFIRM ? '\n🔴 LIVE RUN — deleting.\n' : '\n🟡 DRY RUN — no deletes. Pass --confirm to execute.\n');

  // Gather member uids across all target tenants first.
  const memberUids = new Set();
  for (const tid of TIDS) {
    const t = await db.doc(`tenants/${tid}`).get();
    if (!t.exists) { console.log(`⚠️  Tenant '${tid}' not found — skipping.`); continue; }
    const members = await db.collection(`tenants/${tid}/members`).get();
    members.forEach((m) => memberUids.add(m.id));
    console.log(`🏢 ${t.data().name || '(no name)'} [${tid}] — status=${t.data().status} plan=${t.data().plan || '-'}, ${members.size} member(s)`);
  }

  // 1) Tenant docs + subcollections (recursiveDelete) + legacy sweep
  let grand = 0;
  for (const tid of TIDS) {
    const tenantRef = db.doc(`tenants/${tid}`);
    if (!(await tenantRef.get()).exists) continue;
    if (CONFIRM) {
      await db.recursiveDelete(tenantRef);
      console.log(`   🗑  recursiveDelete tenants/${tid}`);
    } else {
      const subs = await tenantRef.listCollections();
      for (const c of subs) {
        const n = (await c.count().get()).data().count;
        console.log(`   • tenants/${tid}/${c.id}: ${n}`);
      }
    }
    for (const name of ROOT_COLLECTIONS) {
      const q = db.collection(name).where('tenantId', '==', tid);
      const n = (await q.count().get()).data().count;
      if (n === 0) continue;
      if (CONFIRM) { const d = await deleteQuery(q); console.log(`   🗑  ${name} (${tid}): ${d}`); grand += d; }
      else { console.log(`   • legacy ${name} (${tid}): ${n}`); grand += n; }
    }
  }

  // 2) User / Auth handling — decide from GROUND-TRUTH membership (scan every
  //    tenant's members subcollection), NOT the possibly-stale user doc. Never
  //    delete a superadmin's Auth account.
  console.log('\n— Affected users —');
  // Ground-truth: which tenants each affected uid actually belongs to.
  const groundTruth = {};
  memberUids.forEach((uid) => { groundTruth[uid] = new Set(); });
  const allTenants = await db.collection('tenants').get();
  for (const t of allTenants.docs) {
    const mem = await db.collection(`tenants/${t.id}/members`).get();
    mem.forEach((m) => { if (groundTruth[m.id]) groundTruth[m.id].add(t.id); });
  }
  // Superadmins: custom claim OR superadmins collection.
  const superColl = new Set();
  try { (await db.collection('superadmins').get()).forEach((d) => superColl.add(d.id)); } catch {}

  for (const uid of memberUids) {
    const uref = db.doc(`users/${uid}`);
    const usnap = await uref.get();
    const u = usnap.exists ? usnap.data() : {};
    let email = u.email, isSuper = superColl.has(uid);
    try { const au = await auth.getUser(uid); email = email || au.email; isSuper = isSuper || au.customClaims?.superadmin === true || au.customClaims?.role === 'superadmin'; } catch {}
    const remaining = [...groundTruth[uid]].filter((x) => !DELETE_SET.has(x));

    if (remaining.length > 0 || isSuper || KEEP_LOGINS) {
      const why = [remaining.length > 0 ? `member of [${remaining.join(', ')}]` : 'orphaned', isSuper ? 'SUPERADMIN' : '', (remaining.length === 0 && !isSuper && KEEP_LOGINS) ? 'login preserved' : ''].filter(Boolean).join(', ');
      console.log(`   ✋ KEEP ${email || uid} — ${why}; strip deleted tenant(s) from user doc.`);
      if (CONFIRM && usnap.exists) {
        const patch = {};
        if (Array.isArray(u.tenantIds)) patch.tenantIds = u.tenantIds.filter((x) => !DELETE_SET.has(x));
        if (u.tenantAccess && typeof u.tenantAccess === 'object') { const ta = { ...u.tenantAccess }; DELETE_SET.forEach((d) => delete ta[d]); patch.tenantAccess = ta; }
        if (u.tenantId && DELETE_SET.has(u.tenantId)) patch.tenantId = remaining[0] || FieldValue.delete();
        if (Object.keys(patch).length) await uref.update(patch);
      }
    } else {
      console.log(`   🗑 DELETE ${email || uid} — orphaned, not superadmin; remove user doc + Auth account.`);
      if (CONFIRM) {
        if (usnap.exists) await uref.delete();
        try { await auth.deleteUser(uid); } catch (e) { console.log(`      (auth delete skipped: ${e.code || e.message})`); }
      }
    }
  }

  console.log(`\n${CONFIRM ? '✅ Done.' : `📊 Would delete ${grand} legacy docs + ${TIDS.length} tenant tree(s).`}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
