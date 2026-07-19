/**
 * Presentation prep, phase 3 — hiring pipeline, next week's shifts, leave
 * requests and expenses, so every module scene has believable content.
 * Admin SDK, demo tenant only, idempotent (fixed doc ids).
 *
 *   node prep-demo-data-2.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync(new URL('../service-account.json', import.meta.url), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const T = 'demo-kafe-aroma';

async function run() {
  console.log(`\nPhase-3 prep for ${T}…\n`);

  // ── Hiring: one open job + three candidates ────────────────────────────
  await db.doc(`jobs/${T}_job-barista`).set({
    tenantId: T,
    title: 'Barista',
    description: 'Full-time barista for our Lecidere café. Espresso experience preferred; we train the rest. Tetun essential, English a plus.',
    department: 'Front of House',
    location: 'Kafé Aroma, Lecidere',
    salaryMin: 165,
    salaryMax: 200,
    employmentType: 'Full-time',
    contractType: 'permanent',
    permanentProbation: '30_days',
    probationDays: 30,
    status: 'open',
    postedDate: '2026-07-06T09:00:00.000Z',
    closingDate: '2026-08-01',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const candidates = [
    ['cand-1', 'Zelia Fernandes', 'zelia.fernandes@gmail.com', '+670 7789 2211', 'Barista', '2 years — Gloria Jean\'s Dili', 86, 'Shortlisted', '2026-07-08', 78],
    ['cand-2', 'Abel Tilman', 'abel.tilman@gmail.com', '+670 7745 8890', 'Barista', '1 year — Café Brisa', 74, 'Under Review', '2026-07-10', 65],
    ['cand-3', 'Natalia Gusmão', 'natalia.gusmao@gmail.com', '+670 7712 3345', 'Barista', 'Hospitality graduate, DIT', 61, 'New', '2026-07-15', 70],
  ];
  for (const [id, name, email, phone, position, experience, score, status, appliedDate, cvQuality] of candidates) {
    await db.doc(`candidates/${T}_${id}`).set({
      tenantId: T,
      name, email, phone, position, experience, score, status, appliedDate,
      resume: '', avatar: '', cvQuality,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  console.log('  ✓ 1 open job + 3 candidates');

  // ── Shifts: next week (Mon 20 – Sat 25 July), morning + evening ───────
  const SHIFT_STAFF = [
    ['EMP002', 'Filomena da Costa', 'Front of House', 'dept-front', 'Supervisora Sala', '07:00', '15:30', 'morning'],
    ['EMP004', 'Lucia Pereira',     'Front of House', 'dept-front', 'Barista',          '07:00', '15:30', 'morning'],
    ['EMP005', 'Mateus Guterres',   'Front of House', 'dept-front', 'Kaixa',            '07:00', '15:30', 'morning'],
    ['EMP003', 'Joaquim Ximenes',   'Front of House', 'dept-front', 'Barista',          '14:00', '22:30', 'evening'],
    ['EMP006', 'Esperança Belo',    'Kitchen',        'dept-kitchen', 'Kuziñeiru Xefe', '06:00', '14:30', 'morning'],
    ['EMP007', 'Domingos Amaral',   'Kitchen',        'dept-kitchen', 'Asistente Kuziña','06:00', '14:30', 'morning'],
  ];
  const week = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25'];
  let batch = db.batch();
  let n = 0;
  for (const date of week) {
    for (const [employeeId, employeeName, department, departmentId, position, startTime, endTime, slotId] of SHIFT_STAFF) {
      const ref = db.doc(`tenants/${T}/shifts/${employeeId}_${date}`);
      batch.set(ref, {
        tenantId: T,
        employeeId, employeeName, department, departmentId, position,
        date, startTime, endTime,
        hours: 8,
        status: 'published',
        location: 'Kafé Aroma, Lecidere',
        slotId,
        notes: '',
        createdBy: 'demo-prep',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      n++;
    }
  }
  await batch.commit();
  console.log(`  ✓ ${n} published shifts for next week`);

  // ── Leave: one pending (decision moment) + one approved (future) ──────
  await db.doc(`leave_requests/${T}_leave-lucia`).set({
    tenantId: T,
    employeeId: 'EMP004', employeeName: 'Lucia Pereira',
    department: 'Front of House', departmentId: 'dept-front',
    leaveType: 'annual', leaveTypeLabel: 'Annual Leave',
    startDate: '2026-08-03', endDate: '2026-08-05', duration: 3,
    reason: 'Family visit to Baucau',
    hasCertificate: false,
    status: 'pending',
    requestDate: '2026-07-17',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.doc(`leave_requests/${T}_leave-esperanca`).set({
    tenantId: T,
    employeeId: 'EMP006', employeeName: 'Esperança Belo',
    department: 'Kitchen', departmentId: 'dept-kitchen',
    leaveType: 'annual', leaveTypeLabel: 'Annual Leave',
    startDate: '2026-07-27', endDate: '2026-07-29', duration: 3,
    reason: 'Rest days after the festival weekend',
    hasCertificate: false,
    status: 'approved',
    requestDate: '2026-07-12',
    approverId: 'demo-owner', approverName: 'Aderito Soares',
    approvedDate: '2026-07-13',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log('  ✓ 2 leave requests (1 pending, 1 approved)');

  // ── Expenses: a believable month ───────────────────────────────────────
  const expenses = [
    ['exp-beans', '2026-07-03', 'Coffee beans — 25 kg, Maubisse cooperative', 312.5, 'supplies', 'Cooperativa Café Maubisse', 'bank_transfer'],
    ['exp-power', '2026-07-10', 'EDTL electricity — June', 148.2, 'utilities', 'EDTL', 'cash'],
    ['exp-gas', '2026-07-15', 'Kitchen gas bottles ×4', 96.0, 'supplies', 'Loja Central', 'cash'],
  ];
  for (const [id, date, description, amount, category, vendorName, paymentMethod] of expenses) {
    await db.doc(`tenants/${T}/expenses/${id}`).set({
      date, description, amount, category, vendorName, paymentMethod,
      notes: '',
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  console.log('  ✓ 3 expenses');

  console.log('\n✅ Phase-3 demo data ready.\n');
  process.exit(0);
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
