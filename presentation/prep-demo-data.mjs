/**
 * Presentation prep — enrich the DEMO tenant so every scene has real data.
 * Admin SDK (bypasses rules; demo tenant only). Idempotent.
 *
 *   node prep-demo-data.mjs
 *
 * Does:
 *  1. Marks the demo tenant as manually subscribed (+1y) so finalizing payroll
 *     works exactly like a paying customer's tenant.
 *  2. Enables payroll self-approval (solo-operator mode) + advancedTaxMode so
 *     the WIT filing screens are on camera.
 *  3. Seeds July 2026 attendance for all 8 staff (Mon–Sat), including a night
 *     -shift barista (21:00+ hours) and one late arrival — so Time & Leave and
 *     the payroll wizard's attendance sync have something true to show.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync(new URL('../service-account.json', import.meta.url), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const TENANT_ID = 'demo-kafe-aroma';

// name, deptName, deptId, [clockIn, clockOut] default day shift
const STAFF = [
  ['EMP001', 'Aderito Soares',    'Administration', 'dept-admin',   ['08:00', '16:30']],
  ['EMP002', 'Filomena da Costa', 'Front of House', 'dept-front',   ['07:30', '16:00']],
  ['EMP003', 'Joaquim Ximenes',   'Front of House', 'dept-front',   ['14:00', '22:30']], // evening barista → night hours
  ['EMP004', 'Lucia Pereira',     'Front of House', 'dept-front',   ['08:00', '16:30']],
  ['EMP005', 'Mateus Guterres',   'Front of House', 'dept-front',   ['08:00', '16:30']],
  ['EMP006', 'Esperança Belo',    'Kitchen',        'dept-kitchen', ['06:30', '15:00']],
  ['EMP007', 'Domingos Amaral',   'Kitchen',        'dept-kitchen', ['06:30', '15:00']],
  ['EMP008', 'Rosa Sarmento',     'Administration', 'dept-admin',   ['06:00', '14:30']],
];

// July 2026 working days (Mon–Sat), 1st → 18th.
const DAYS = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04',
  '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11',
  '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18'];
// Sundays: the café runs a reduced crew, so "today" is never empty on camera.
const SUNDAYS = ['2026-07-05', '2026-07-12', '2026-07-19'];
const SUNDAY_CREW = new Set(['EMP002', 'EMP003', 'EMP005', 'EMP006']);

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
function nightHoursOf(clockIn, clockOut) {
  // day-shift café hours only cross the 21:00 line for the evening barista;
  // none of the seeded shifts cross midnight.
  const start = Math.max(toMin(clockIn), 21 * 60);
  const end = toMin(clockOut);
  return Math.max(0, (end - start) / 60);
}

async function run() {
  console.log(`\nPrepping demo tenant ${TENANT_ID}…\n`);

  // 1. Subscription (manual path — mirrors a bank-transfer customer)
  const paidUntil = new Date();
  paidUntil.setFullYear(paidUntil.getFullYear() + 1);
  await db.doc(`tenants/${TENANT_ID}`).set({
    manualSubscription: true,
    subscriptionPaidUntil: Timestamp.fromDate(paidUntil),
    subscriptionBilledSeats: 8,
    monthlySubscriptionAmount: 32,
    advancedTaxMode: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ✓ manual subscription until ${paidUntil.toISOString().slice(0, 10)} + advancedTaxMode`);

  // 2. Solo approval for the demo owner
  await db.doc(`tenants/${TENANT_ID}/settings/config`).set({
    payrollConfig: { allowSelfApproval: true },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('  ✓ payrollConfig.allowSelfApproval = true');

  // 3. Attendance — wipe this month's seeded rows, then write fresh ones
  const existing = await db.collection('attendance')
    .where('tenantId', '==', TENANT_ID)
    .get();
  const julyDocs = existing.docs.filter((d) => (d.get('date') || '') >= DAYS[0]);
  if (julyDocs.length) {
    const b = db.batch();
    julyDocs.forEach((d) => b.delete(d.ref));
    await b.commit();
    console.log(`  ✓ cleared ${julyDocs.length} existing July attendance rows`);
  }

  let batch = db.batch();
  let n = 0;
  for (const date of [...DAYS, ...SUNDAYS].sort()) {
    for (const [employeeId, employeeName, department, departmentId, [inT, outT]] of STAFF) {
      if (SUNDAYS.includes(date) && !SUNDAY_CREW.has(employeeId)) continue;
      // one believable late arrival
      const late = employeeId === 'EMP004' && date === '2026-07-09';
      const clockIn = late ? '08:19' : inT;
      const clockOut = outT;
      const totalRaw = (toMin(clockOut) - toMin(clockIn)) / 60 - 0.5; // 30 min break
      const totalHours = Math.round(totalRaw * 100) / 100;
      const regularHours = Math.min(8, totalHours);
      const overtimeHours = Math.round(Math.max(0, totalHours - 8) * 100) / 100;
      const nightHours = Math.round(nightHoursOf(clockIn, clockOut) * 100) / 100;
      const ref = db.collection('attendance').doc(`${TENANT_ID}_${employeeId}_${date}`);
      batch.set(ref, {
        tenantId: TENANT_ID,
        employeeId, employeeName, department, departmentId,
        date, clockIn, clockOut,
        breakStart: '12:00', breakEnd: '12:30',
        regularHours, overtimeHours, nightHours,
        lateMinutes: late ? 19 : 0,
        earlyDepartureMinutes: 0,
        breakMinutes: 30,
        totalHours,
        status: late ? 'late' : 'present',
        source: 'manual',
        isAdjusted: false,
        notes: '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      n++;
      if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
  }
  await batch.commit();
  console.log(`  ✓ ${n} attendance records for ${DAYS.length} days × ${STAFF.length} staff`);

  console.log('\n✅ Demo data ready for capture.\n');
  process.exit(0);
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
