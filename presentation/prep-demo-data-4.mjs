/**
 * Presentation prep, phase 5 — the FULL seed. Grows the fictional Kafé Knua into a
 * 30-person café + bakery/roastery + catering operation with everything
 * filled in: complete employee profiles (contracts, INSS numbers, banks),
 * July attendance for everyone, next week's shifts, hiring pipeline, leave,
 * 8 customers, 12 invoices and 14 expenses — WITH matching posted journals
 * and general-ledger lines so the books (journal, trial balance, P&L) are
 * genuinely consistent.
 *
 * Wipes and reseeds: employees ARE PRESERVED for EMP001–008 (same ids/names)
 * and extended to EMP030. Payroll artifacts (runs/records/bank
 * transfers/tax filings) and ALL journals/GL are wiped — run
 * `node prep-demo-ui-2.mjs` afterwards to re-run June payroll for 30 staff
 * through the real client (its journal takes the next number after the
 * seeded ones).
 *
 *   node prep-demo-data-4.mjs && node prep-demo-ui-2.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync(new URL('../service-account.json', import.meta.url), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const T = 'demo-kafe-aroma';
const CONTRACT = { fileUrl: 'https://xefe.tl/demo/kontratu-servisu.pdf', uploadDate: '2026-01-15' };

// ── staff ────────────────────────────────────────────────────────────────
// [id, first, last, deptName, deptId, position, salary, hireDate, bank, shift, sunday]
const BNU = 'BNU (Banco Nacional Ultramarino)';
const BNCTL = 'BNCTL (Banco Nacional de Comércio de Timor-Leste)';
const MANDIRI = 'Bank Mandiri (Timor-Leste)';
const STAFF = [
  ['EMP001', 'Aderito', 'Soares', 'Administration', 'dept-admin', 'Manajer Jerál', 700, '2021-02-01', BNU, 'day', false],
  ['EMP002', 'Filomena', 'da Costa', 'Front of House', 'dept-front', 'Supervisora Sala', 320, '2021-06-15', BNU, 'front', true],
  ['EMP003', 'Joaquim', 'Ximenes', 'Front of House', 'dept-front', 'Barista', 190, '2022-03-10', BNU, 'evening', true],
  ['EMP004', 'Lucia', 'Pereira', 'Front of House', 'dept-front', 'Barista', 180, '2023-01-20', BNU, 'front', false],
  ['EMP005', 'Mateus', 'Guterres', 'Front of House', 'dept-front', 'Kaixa', 165, '2023-08-05', BNCTL, 'front', true],
  ['EMP006', 'Esperança', 'Belo', 'Kitchen', 'dept-kitchen', 'Kuziñeiru Xefe', 280, '2021-09-01', BNU, 'kitchen', true],
  ['EMP007', 'Domingos', 'Amaral', 'Kitchen', 'dept-kitchen', 'Asistente Kuziña', 150, '2023-05-12', BNU, 'kitchen', false],
  ['EMP008', 'Rosa', 'Sarmento', 'Administration', 'dept-admin', 'Limpeza', 130, '2022-11-01', BNU, 'cleaner', false],
  ['EMP009', 'Julio', 'Barros', 'Front of House', 'dept-front', 'Barista', 175, '2024-02-12', BNU, 'evening', true],
  ['EMP010', 'Angelina', 'Freitas', 'Front of House', 'dept-front', 'Barista', 170, '2024-06-03', BNU, 'front', true],
  ['EMP011', 'Tomas', 'Soares', 'Front of House', 'dept-front', 'Empregadu Meza', 155, '2024-09-16', BNCTL, 'evening', true],
  ['EMP012', 'Marcelina', 'Gusmão', 'Front of House', 'dept-front', 'Empregada Meza', 155, '2025-01-06', BNU, 'front', false],
  ['EMP013', 'Agostinho', 'Ramos', 'Front of House', 'dept-front', 'Kaixa', 165, '2025-03-24', BNU, 'front', false],
  ['EMP014', 'Veronica', 'Ximenes', 'Front of House', 'dept-front', 'Resepsaun', 150, '2025-05-19', MANDIRI, 'front', false],
  ['EMP015', 'Cesaltina', 'Lopes', 'Kitchen', 'dept-kitchen', 'Kuziñeira', 195, '2022-08-22', BNU, 'kitchen', true],
  ['EMP016', 'Bendito', 'Araújo', 'Kitchen', 'dept-kitchen', 'Asistente Kuziña', 145, '2024-04-08', BNU, 'kitchen', false],
  ['EMP017', 'Olandina', 'Martins', 'Kitchen', 'dept-kitchen', 'Asistente Kuziña', 145, '2024-10-14', BNCTL, 'kitchen', false],
  ['EMP018', 'Francisco', 'Tilman', 'Kitchen', 'dept-kitchen', 'Limpeza Kuziña', 132, '2025-02-17', BNU, 'kitchen', false],
  ['EMP019', 'Juliana', 'Cardoso', 'Bakery & Roastery', 'dept-bakery', 'Padeiru Xefe', 260, '2021-11-08', BNU, 'early', false],
  ['EMP020', 'Anito', 'Belo', 'Bakery & Roastery', 'dept-bakery', 'Padeiru', 175, '2023-03-13', BNU, 'early', false],
  ['EMP021', 'Fernanda', 'Costa', 'Bakery & Roastery', 'dept-bakery', 'Tosta-Na\'in Kafé', 210, '2022-06-20', BNU, 'early', false],
  ['EMP022', 'Gaspar', 'Amaral', 'Bakery & Roastery', 'dept-bakery', 'Asistente Padaria', 140, '2025-07-07', MANDIRI, 'early', false],
  ['EMP023', 'Idalia', 'Pinto', 'Catering & Delivery', 'dept-catering', 'Koordenadora Catering', 240, '2022-04-04', BNU, 'day', false],
  ['EMP024', 'Nelson', 'Xavier', 'Catering & Delivery', 'dept-catering', 'Kondutor Entrega', 160, '2023-10-09', BNU, 'day', true],
  ['EMP025', 'Zeferino', 'Alves', 'Catering & Delivery', 'dept-catering', 'Kondutor Entrega', 160, '2024-08-26', BNCTL, 'day', false],
  ['EMP026', 'Prisca', 'Nunes', 'Catering & Delivery', 'dept-catering', 'Asistente Eventu', 140, '2025-04-21', BNU, 'day', false],
  ['EMP027', 'Elvis', 'Monteiro', 'Administration', 'dept-admin', 'Kontabilista Junior', 320, '2023-02-06', BNU, 'day', false],
  ['EMP028', 'Delfina', 'Sarmento', 'Administration', 'dept-admin', 'Ofisiál RH', 300, '2022-09-12', BNU, 'day', false],
  ['EMP029', 'Armindo', 'Guterres', 'Administration', 'dept-admin', 'Guarda Seguransa', 135, '2023-06-19', BNCTL, 'day', true],
  ['EMP030', 'Sofia', 'Magalhães', 'Front of House', 'dept-front', 'Barista', 170, '2026-07-06', BNU, 'front', false],
];

const SHIFT_TIMES = {
  early: ['05:30', '14:00'],
  kitchen: ['06:30', '15:00'],
  cleaner: ['06:00', '14:30'],
  front: ['07:30', '16:00'],
  day: ['08:00', '16:30'],
  evening: ['14:00', '22:30'],
};

const DEPARTMENTS = [
  { id: 'dept-front', name: 'Front of House' },
  { id: 'dept-kitchen', name: 'Kitchen' },
  { id: 'dept-admin', name: 'Administration' },
  { id: 'dept-bakery', name: 'Bakery & Roastery' },
  { id: 'dept-catering', name: 'Catering & Delivery' },
];

const DAYS = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04',
  '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11',
  '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18'];
const SUNDAYS = ['2026-07-05', '2026-07-12', '2026-07-19'];

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const nightHoursOf = (ci, co) => Math.max(0, (toMin(co) - Math.max(toMin(ci), 21 * 60)) / 60);

async function wipe(colRef, filterFn = null) {
  const snap = await colRef.get();
  const docs = filterFn ? snap.docs.filter(filterFn) : snap.docs;
  let batch = db.batch(); let n = 0;
  for (const d of docs) { batch.delete(d.ref); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
  await batch.commit();
  return docs.length;
}
const wipeTop = async (name) => wipe(db.collection(name).where('tenantId', '==', T));

async function run() {
  console.log(`\nPhase-5 FULL seed for ${T}…\n`);

  // ── 0. wipe stale artifacts ──────────────────────────────────────────
  for (const c of ['payrollRuns', 'payrollRecords', 'bankTransfers', 'taxFilings', 'invoice_links']) {
    const n = await wipeTop(c);
    if (n) console.log(`  ✓ wiped ${n} × ${c}`);
  }
  for (const c of ['journalEntries', 'generalLedger', 'balanceSnapshots', 'invoices', 'customers', 'expenses']) {
    const n = await wipe(db.collection(`tenants/${T}/${c}`));
    if (n) console.log(`  ✓ wiped ${n} × tenants/${T}/${c}`);
  }

  // ── 1. departments ───────────────────────────────────────────────────
  for (const d of DEPARTMENTS) {
    await db.doc(`tenants/${T}/departments/${d.id}`).set({
      name: d.name, tenantId: T, updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  console.log(`  ✓ ${DEPARTMENTS.length} departments`);

  // ── 2. employees (full profiles) ─────────────────────────────────────
  let i = 0;
  for (const [id, first, last, dept, deptId, position, salary, hire, bank, shift, sunday] of STAFF) {
    i++;
    const acct = `28${String(6400 + i * 7)}.10.0${String(i).padStart(2, '0')}`;
    await db.doc(`tenants/${T}/employees/${id}`).set({
      personalInfo: {
        firstName: first, lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@kafeknua.tl`,
        phone: `+670 77${String(10 + i)} ${String(1000 + i * 7)}`,
        address: i % 3 === 0 ? 'Colmera, Dili' : 'Lecidere, Dili',
        nationality: 'Timorese',
      },
      jobDetails: {
        employeeId: id, department: dept, position, hireDate: hire,
        employmentType: 'Full-time',
        workLocation: i % 4 === 0 ? 'Kafé Knua, Colmera' : 'Kafé Knua, Lecidere',
        manager: id === 'EMP001' ? '' : 'EMP001',
      },
      compensation: { monthlySalary: salary, annualLeaveDays: 12, benefitsPackage: 'standard' },
      documents: {
        socialSecurityNumber: { number: `90001${String(2340 + i)}`, expiryDate: '', required: true },
        workContract: CONTRACT,
      },
      bankName: bank,
      bankAccountNumber: acct,
      bankDetails: { accountNumber: acct, bankName: bank, branch: 'Dili' },
      status: 'active',
      departmentId: deptId,
      isForeignWorker: false,
      _shift: shift, _sunday: sunday, // internal seeding hints (harmless extra fields)
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  console.log(`  ✓ ${STAFF.length} employees with full profiles`);

  // ── 3. attendance (July, everyone) ───────────────────────────────────
  const oldAtt = await wipe(db.collection('attendance').where('tenantId', '==', T));
  console.log(`  ✓ wiped ${oldAtt} old attendance rows`);
  let batch = db.batch(); let n = 0;
  const skip = new Set(['EMP012_2026-07-16', 'EMP012_2026-07-17']); // approved sick leave
  for (const date of [...DAYS, ...SUNDAYS].sort()) {
    const isSunday = SUNDAYS.includes(date);
    for (const [id, first, last, dept, deptId, , , hire, , shift, sunday] of STAFF) {
      if (date < hire) continue;
      if (isSunday && !sunday) continue;
      if (skip.has(`${id}_${date}`)) continue;
      const absent = id === 'EMP007' && date === '2026-07-14';
      const late = (id === 'EMP004' && date === '2026-07-09') || (id === 'EMP009' && date === '2026-07-15');
      const [inT, outT] = SHIFT_TIMES[shift];
      const clockIn = absent ? '' : late ? `${inT.slice(0, 2)}:${Number(inT.slice(3)) + 21}` : inT;
      const clockOut = absent ? '' : outT;
      const total = absent ? 0 : Math.round(((toMin(clockOut) - toMin(clockIn)) / 60 - 0.5) * 100) / 100;
      const ref = db.collection('attendance').doc(`${T}_${id}_${date}`);
      batch.set(ref, {
        tenantId: T, employeeId: id, employeeName: `${first} ${last}`,
        department: dept, departmentId: deptId,
        date, clockIn, clockOut,
        breakStart: absent ? '' : '12:00', breakEnd: absent ? '' : '12:30',
        regularHours: absent ? 0 : Math.min(8, total),
        overtimeHours: absent ? 0 : Math.round(Math.max(0, total - 8) * 100) / 100,
        nightHours: absent ? 0 : Math.round(nightHoursOf(clockIn, clockOut) * 100) / 100,
        lateMinutes: late ? 21 : 0,
        earlyDepartureMinutes: 0,
        breakMinutes: absent ? 0 : 30,
        totalHours: total,
        status: absent ? 'absent' : late ? 'late' : 'present',
        source: 'manual', isAdjusted: false, notes: absent ? 'La mai servisu' : '',
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
  }
  await batch.commit();
  console.log(`  ✓ ${n} attendance records (July, incl. Sundays crew, 1 absence, 2 lates)`);

  // ── 4. next week's shifts (Jul 20–25) ────────────────────────────────
  await wipe(db.collection(`tenants/${T}/shifts`));
  const week = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25'];
  batch = db.batch(); n = 0;
  for (const date of week) {
    for (const [id, first, last, dept, deptId, position, , hire, , shift] of STAFF) {
      if (['EMP001', 'EMP027', 'EMP028'].includes(id)) continue; // admin desk staff — no rota
      if (date < hire) continue;
      const [startTime, endTime] = SHIFT_TIMES[shift];
      batch.set(db.doc(`tenants/${T}/shifts/${id}_${date}`), {
        tenantId: T, employeeId: id, employeeName: `${first} ${last}`,
        department: dept, departmentId: deptId, position,
        date, startTime, endTime, hours: 8,
        status: 'published',
        location: 'Kafé Knua, Lecidere',
        slotId: shift === 'evening' ? 'evening' : 'morning',
        notes: '', createdBy: 'demo-prep',
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
  }
  await batch.commit();
  console.log(`  ✓ ${n} published shifts for next week`);

  // ── 5. leave requests ────────────────────────────────────────────────
  const leaves = [
    ['leave-lucia', 'EMP004', 'Lucia Pereira', 'Front of House', 'dept-front', 'annual', 'Annual Leave', '2026-08-03', '2026-08-05', 3, 'Family visit to Baucau', false, 'pending', '2026-07-17', null],
    ['leave-esperanca', 'EMP006', 'Esperança Belo', 'Kitchen', 'dept-kitchen', 'annual', 'Annual Leave', '2026-07-27', '2026-07-29', 3, 'Rest days after the festival weekend', false, 'approved', '2026-07-12', '2026-07-13'],
    ['leave-marcelina', 'EMP012', 'Marcelina Gusmão', 'Front of House', 'dept-front', 'sick', 'Sick Leave', '2026-07-16', '2026-07-17', 2, 'Flu — medical certificate attached', true, 'approved', '2026-07-16', '2026-07-16'],
    ['leave-cesaltina', 'EMP015', 'Cesaltina Lopes', 'Kitchen', 'dept-kitchen', 'maternity', 'Maternity Leave', '2026-08-10', '2026-11-01', 60, 'Maternity leave', true, 'approved', '2026-07-02', '2026-07-03'],
    ['leave-anito', 'EMP020', 'Anito Belo', 'Bakery & Roastery', 'dept-bakery', 'annual', 'Annual Leave', '2026-08-12', '2026-08-14', 3, 'Wedding in Maubisse', false, 'pending', '2026-07-18', null],
  ];
  for (const [id, employeeId, employeeName, department, departmentId, leaveType, leaveTypeLabel, startDate, endDate, duration, reason, hasCertificate, status, requestDate, approvedDate] of leaves) {
    await db.doc(`leave_requests/${T}_${id}`).set({
      tenantId: T, employeeId, employeeName, department, departmentId,
      leaveType, leaveTypeLabel, startDate, endDate, duration, reason, hasCertificate,
      status, requestDate,
      ...(approvedDate ? { approverId: 'demo-owner', approverName: 'Aderito Soares', approvedDate } : {}),
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  console.log(`  ✓ ${leaves.length} leave requests (2 pending, 3 approved)`);

  // ── 6. hiring: second job + candidates ───────────────────────────────
  await db.doc(`jobs/${T}_job-cook`).set({
    tenantId: T, title: 'Kuziñeiru / Cook',
    description: 'Experienced cook for our growing kitchen. Weekend availability required.',
    department: 'Kitchen', location: 'Kafé Knua, Lecidere',
    salaryMin: 180, salaryMax: 240, employmentType: 'Full-time',
    contractType: 'permanent', permanentProbation: '90_days', probationDays: 90,
    status: 'open', postedDate: '2026-07-13T09:00:00.000Z', closingDate: '2026-08-10',
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const cands = [
    ['cand-4', 'Aurelio Ribeiro', 'aurelio.ribeiro@gmail.com', '+670 7761 4522', 'Kuziñeiru / Cook', '4 years — Hotel Timor kitchen', 82, 'Under Review', '2026-07-15', 74],
    ['cand-5', 'Domingas Viana', 'domingas.viana@gmail.com', '+670 7733 9018', 'Kuziñeiru / Cook', '3 years — catering', 77, 'New', '2026-07-17', 70],
  ];
  for (const [id, name, email, phone, position, experience, score, status, appliedDate, cvQuality] of cands) {
    await db.doc(`candidates/${T}_${id}`).set({
      tenantId: T, name, email, phone, position, experience, score, status, appliedDate,
      resume: '', avatar: '', cvQuality,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  console.log('  ✓ 2nd open job + 2 more candidates');

  // ── 7. customers ─────────────────────────────────────────────────────
  // All customers are FICTIONAL businesses (real Dili organisations must never
  // appear as demo customers).
  const customers = [
    ['cust-hotelknua', 'Hotel Fatu Metan', 'eventos@hotelfatumetan.tl', '+670 7731 2360', 'Lecidere, Dili', '1002345-6'],
    ['cust-ong', 'ONG Hadomi Futuru', 'admin@hadomifuturu.org', '+670 7731 2481', 'Caicoli, Dili', '1003456-7'],
    ['cust-eskritoriu', 'Eskritóriu Dili Konsultoria', 'geral@dilikonsultoria.tl', '+670 7731 0344', 'Colmera, Dili', '1004567-8'],
    ['cust-lojakafe', 'Kafé Ualu (Wholesale)', 'orders@kafeualu.tl', '+670 7734 5511', 'Audian, Dili', '1005678-9'],
    ['cust-fundasaun', 'Fundasaun Bee Moos', 'info@beemoos.org', '+670 7731 0691', 'Bairro Pite, Dili', '1006789-0'],
    ['cust-klinika', 'Klínika Naroman Foun', 'resepsaun@naromanfoun.tl', '+670 7732 3855', 'Mascarenhas, Dili', '1007890-1'],
    ['cust-institutu', 'Institutu Formasaun Loriku', 'kursu@loriku.tl', '+670 7732 4800', 'Comoro, Dili', '1008901-2'],
    ['cust-agencia', 'Ajénsia Viajen Ronda Timor', 'tour@rondatimor.tl', '+670 7732 4111', 'Av. de Portugal, Dili', '1009012-3'],
  ];
  for (const [id, name, email, phone, address, tin] of customers) {
    await db.doc(`tenants/${T}/customers/${id}`).set({
      name, email, phone, address, city: 'Dili', tin, notes: '',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  }
  console.log(`  ✓ ${customers.length} customers`);

  // ── 8. invoices + expenses WITH journals & GL ────────────────────────
  const accountsSnap = await db.collection(`tenants/${T}/accounts`).get();
  const byCode = {};
  accountsSnap.docs.forEach((d) => { const a = d.data(); byCode[a.code] = { id: d.id, code: a.code, name: a.name }; });
  const acct = (code, fallback = '5900') => byCode[code] || byCode[fallback];
  if (!acct('1120') || !acct('1210') || !acct('4100')) {
    throw new Error('Chart of accounts missing 1120/1210/4100 — is the default chart seeded?');
  }

  const journals = []; // { date, description, source, sourceRef, lines: [{code, name?, debit, credit, description?}] }

  // invoices: [id, number, custId, custName, issueDate, dueDate, status, items, paidDate]
  const INV = (desc, qty, unitPrice) => ({ id: `li-${Math.abs(desc.length * qty * 100 + unitPrice)}`, description: desc, quantity: qty, unitPrice, amount: Math.round(qty * unitPrice * 100) / 100 });
  const invoices = [
    ['inv-004', 'INV-2026-004', 'cust-hotelknua', 'Hotel Fatu Metan', '2026-06-03', '2026-06-17', 'paid', [INV('Catering — conference lunch (60 pax)', 60, 14.5)], '2026-06-15'],
    ['inv-005', 'INV-2026-005', 'cust-lojakafe', 'Kafé Ualu (Wholesale)', '2026-06-06', '2026-06-20', 'paid', [INV('Roasted beans — Ramelau blend (kg)', 25, 12.5)], '2026-06-18'],
    ['inv-006', 'INV-2026-006', 'cust-ong', 'ONG Hadomi Futuru', '2026-06-12', '2026-06-26', 'paid', [INV('Coffee cart service — staff week (days)', 5, 180)], '2026-06-30'],
    ['inv-007', 'INV-2026-007', 'cust-eskritoriu', 'Eskritóriu Dili Konsultoria', '2026-06-18', '2026-07-02', 'paid', [INV('Event catering — office anniversary (pax)', 120, 9.75)], '2026-07-06'],
    ['inv-008', 'INV-2026-008', 'cust-fundasaun', 'Fundasaun Bee Moos', '2026-06-24', '2026-07-08', 'overdue', [INV('Workshop catering (35 pax)', 35, 11)], null],
    ['inv-009', 'INV-2026-009', 'cust-lojakafe', 'Kafé Ualu (Wholesale)', '2026-07-01', '2026-07-15', 'paid', [INV('Roasted beans — Ramelau blend (kg)', 30, 12.5)], '2026-07-14'],
    ['inv-010', 'INV-2026-010', 'cust-klinika', 'Klínika Naroman Foun', '2026-07-03', '2026-07-17', 'overdue', [INV('Training-day catering (48 pax)', 48, 12.25)], null],
    ['inv-011', 'INV-2026-011', 'cust-institutu', 'Institutu Formasaun Loriku', '2026-07-08', '2026-07-22', 'paid', [INV('Training-room pastries — weekly (weeks)', 2, 210)], '2026-07-17'],
    ['inv-012', 'INV-2026-012', 'cust-hotelknua', 'Hotel Fatu Metan', '2026-07-10', '2026-07-24', 'sent', [INV('Breakfast pastry supply (mornings)', 12, 38.5)], null],
    ['inv-013', 'INV-2026-013', 'cust-ong', 'ONG Hadomi Futuru', '2026-07-14', '2026-07-28', 'viewed', [INV('Coffee cart service — retreat (days)', 3, 180)], null],
    ['inv-014', 'INV-2026-014', 'cust-agencia', 'Ajénsia Viajen Ronda Timor', '2026-07-16', '2026-07-30', 'sent', [INV('Meeting catering (25 pax)', 25, 13.2)], null],
    ['inv-015', 'INV-2026-015', 'cust-eskritoriu', 'Eskritóriu Dili Konsultoria', '2026-07-18', '2026-08-01', 'draft', [INV('Tour-group breakfast service (days)', 2, 240)], null],
  ];
  let invTotalIncome = 0;
  for (const [id, invoiceNumber, customerId, customerName, issueDate, dueDate, status, items, paidDate] of invoices) {
    const subtotal = Math.round(items.reduce((s, it) => s + it.amount, 0) * 100) / 100;
    const paid = status === 'paid';
    await db.doc(`tenants/${T}/invoices/${id}`).set({
      invoiceNumber, customerId, customerName,
      customerEmail: (customers.find((c) => c[0] === customerId) || [])[2] || '',
      issueDate, dueDate, items,
      subtotal, taxRate: 0, taxAmount: 0, total: subtotal,
      status, amountPaid: paid ? subtotal : 0, balanceDue: paid ? 0 : subtotal,
      notes: 'Obrigadu ba ita-nia konfiansa!', terms: 'Payment due within 14 days',
      templateId: 'classic',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    if (status !== 'draft') {
      journals.push({
        date: issueDate, source: 'invoice', sourceId: id, sourceRef: invoiceNumber,
        description: `Invoice ${invoiceNumber} — ${customerName}`,
        lines: [
          { a: acct('1210'), debit: subtotal, credit: 0 },
          { a: acct('4100'), debit: 0, credit: subtotal },
        ],
      });
      invTotalIncome += subtotal;
    }
    if (paid) {
      journals.push({
        date: paidDate, source: 'payment', sourceId: id, sourceRef: invoiceNumber,
        description: `Payment received — ${invoiceNumber} ${customerName}`,
        lines: [
          { a: acct('1120'), debit: subtotal, credit: 0 },
          { a: acct('1210'), debit: 0, credit: subtotal },
        ],
      });
    }
  }
  console.log(`  ✓ ${invoices.length} invoices ($${invTotalIncome.toFixed(2)} invoiced income)`);

  // expenses: [id, date, description, amount, category, vendorName, method]
  const expenses = [
    ['exp-rent-jun', '2026-06-01', 'Rent — Lecidere premises (June)', 650, 'rent', 'Sr. Almeida Properties', 'bank_transfer'],
    ['exp-beans-jun', '2026-06-05', 'Green beans — 40 kg, Ramelau cooperative', 287.5, 'supplies', 'Kooperativa Kafé Ramelau', 'bank_transfer'],
    ['exp-power-jun', '2026-06-10', 'EDTL electricity (May)', 141.7, 'utilities', 'EDTL', 'cash'],
    ['exp-gas-jun', '2026-06-12', 'Kitchen gas bottles ×4', 96, 'supplies', 'Loja Central', 'cash'],
    ['exp-net-jun', '2026-06-15', 'Internet — fibre (June)', 65, 'communication', 'Telemor', 'bank_transfer'],
    ['exp-pack-jun', '2026-06-18', 'Cups, lids and packaging', 84.3, 'supplies', 'Dili Trading', 'cash'],
    ['exp-rent-jul', '2026-07-01', 'Rent — Lecidere premises (July)', 650, 'rent', 'Sr. Almeida Properties', 'bank_transfer'],
    ['exp-beans-jul', '2026-07-03', 'Green beans — 45 kg, Ramelau cooperative', 312.5, 'supplies', 'Kooperativa Kafé Ramelau', 'bank_transfer'],
    ['exp-flyers-jul', '2026-07-07', 'Menu reprint + festival flyers', 45, 'marketing', 'Grafika Dili', 'cash'],
    ['exp-water-jul', '2026-07-08', 'Bee Timor water (July)', 38.4, 'utilities', 'Bee Timor-Leste', 'cash'],
    ['exp-power-jul', '2026-07-10', 'EDTL electricity (June)', 148.2, 'utilities', 'EDTL', 'cash'],
    ['exp-fix-jul', '2026-07-11', 'Espresso machine service', 120, 'maintenance', 'Dili Coffee Tech', 'bank_transfer'],
    ['exp-gas-jul', '2026-07-15', 'Kitchen gas bottles ×4', 96, 'supplies', 'Loja Central', 'cash'],
    ['exp-insur-jul', '2026-07-16', 'Premises insurance (Q3 instalment)', 88, 'insurance', 'Seguru Dili, Lda', 'bank_transfer'],
  ];
  const CAT_ACCT = {
    rent: '5200', utilities: '5300', supplies: '5400', communication: '5330',
    marketing: '5900', maintenance: '5520', insurance: '5700',
  };
  let expTotal = 0;
  for (const [id, date, description, amount, category, vendorName, paymentMethod] of expenses) {
    await db.doc(`tenants/${T}/expenses/${id}`).set({
      date, description, amount, category, vendorName, paymentMethod, notes: '',
      createdAt: FieldValue.serverTimestamp(),
    });
    journals.push({
      date, source: 'receipt', sourceId: id, sourceRef: description.slice(0, 40),
      description: `Expense — ${description}`,
      lines: [
        { a: acct(CAT_ACCT[category] || '5900'), debit: amount, credit: 0 },
        { a: acct('1120'), debit: 0, credit: amount },
      ],
    });
    expTotal += amount;
  }
  console.log(`  ✓ ${expenses.length} expenses ($${expTotal.toFixed(2)})`);

  // ── 9. post journals + GL, chronologically numbered ──────────────────
  journals.sort((x, y) => x.date.localeCompare(y.date));
  let seq = 0;
  for (const j of journals) {
    seq++;
    const entryNumber = `JE-2026-${String(seq).padStart(4, '0')}`;
    const fiscalPeriod = Number(j.date.slice(5, 7));
    const totalDebit = Math.round(j.lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
    const totalCredit = Math.round(j.lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
    if (totalDebit !== totalCredit) throw new Error(`Unbalanced seed journal ${entryNumber}`);
    const jRef = db.collection(`tenants/${T}/journalEntries`).doc();
    const lines = j.lines.map((l, idx) => ({
      lineNumber: idx + 1,
      accountId: l.a.id, accountCode: l.a.code, accountName: l.a.name,
      description: j.description,
      debit: l.debit, credit: l.credit,
    }));
    const b = db.batch();
    b.set(jRef, {
      entryNumber, date: j.date, description: j.description,
      source: j.source, sourceId: j.sourceId, sourceRef: j.sourceRef,
      lines, totalDebit, totalCredit,
      status: 'posted',
      fiscalYear: 2026, fiscalPeriod,
      createdBy: 'demo-seed', postedBy: 'demo-seed',
      postedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
    });
    for (const l of lines) {
      b.set(db.collection(`tenants/${T}/generalLedger`).doc(), {
        accountId: l.accountId, accountCode: l.accountCode, accountName: l.accountName,
        journalEntryId: jRef.id, entryNumber, entryDate: j.date,
        description: l.description,
        debit: l.debit, credit: l.credit, balance: 0,
        fiscalYear: 2026, fiscalPeriod,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await b.commit();
  }
  // reserve the numbers we used so the app's next entry doesn't collide
  await db.doc(`tenants/${T}/settings/accounting`).set({
    nextJournalNumberByYear: { 2026: seq + 1 },
  }, { merge: true });
  console.log(`  ✓ ${seq} posted journals + GL lines (counter set to ${seq + 1})`);

  // ── 10. tenant billing seats ─────────────────────────────────────────
  await db.doc(`tenants/${T}`).set({
    name: 'Kafé Knua Dili',
    subscriptionBilledSeats: 30,
    monthlySubscriptionAmount: 120,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.doc(`tenants/${T}/settings/config`).set({
    companyDetails: {
      legalName: 'Kafé Knua Dili, Lda', tradingName: 'Kafé Knua',
      registeredAddress: 'Rua de Lecidere, Dili',
    },
    paymentStructure: {
      bankAccounts: [{
        id: 'acct-payroll-bnu', purpose: 'payroll',
        bankName: 'BNU (Banco Nacional Ultramarino)',
        accountName: 'Kafé Knua Dili, Lda',
        accountNumber: '286123.10.001', branchCode: 'Dili', isActive: true,
      }],
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('  ✓ tenant renamed to Kafé Knua Dili + billed seats → 30');

  console.log('\n✅ FULL seed complete. Now run: node prep-demo-ui-2.mjs\n');
  process.exit(0);
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
