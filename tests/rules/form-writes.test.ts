/**
 * Smoke-test that the WRITE each user-facing form performs is accepted by the
 * deployed security rules, for a normal tenant admin (owner). This catches the
 * "form submits but Firestore rejects it" class across every collection at once.
 *
 * Payloads mirror what the services actually write (tenant-scoped paths, and
 * the field shapes the rules require, e.g. tenantId on legacy collections).
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';

const PROJECT_ID = 'test-form-writes';
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const TID = 'tenant-a';
const UID = 'owner-a';

describe('Form writes accepted by rules (tenant owner)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then((m) => m.default),
        host: 'localhost',
        port: PORT,
      },
    });
  });
  afterAll(async () => env.cleanup());

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `tenants/${TID}`), { name: 'Tenant A', createdBy: UID });
      await setDoc(doc(db, `tenants/${TID}/members/${UID}`), {
        uid: UID, role: 'owner',
        modules: ['hiring','staff','timeleave','performance','payroll','money','accounting','reports'],
        employeeId: 'emp-1',
      });
    });
  });

  const db = () => env.authenticatedContext(UID).firestore();

  // Tenant-scoped create forms
  const tenantScoped: Array<[string, Record<string, unknown>]> = [
    ['employees',        { personalInfo: { firstName: 'A', lastName: 'B' }, status: 'active' }],
    ['departments',      { name: 'Ops' }],
    ['positions',        { title: 'Officer' }],
    ['jobs',             { title: 'Role', status: 'open' }],
    ['candidates',       { name: 'C' }],
    ['interviews',       { candidateName: 'C', status: 'scheduled' }],
    ['contracts',        { employeeId: 'emp-1' }],
    ['leaveRequests',    { employeeId: 'emp-1', status: 'pending' }],
    ['timesheets',       { employeeId: 'emp-1' }],
    ['goals',            { createdById: UID, title: 'G' }],
    ['reviews',          { employeeId: 'emp-1', status: 'draft' }],
    ['trainings',        { employeeId: 'emp-1' }],
    ['discipline',       { employeeId: 'emp-1' }],
    ['customers',        { name: 'Cust' }],
    ['invoices',         { customerName: 'Cust', total: 100 }],
    ['vendors',          { name: 'Vend' }],
    ['bills',            { vendorName: 'Vend', total: 50 }],
    ['expenses',         { employeeId: 'emp-1', status: 'submitted', amount: 10 }],
    ['accounts',         { accountCode: '1000', accountName: 'Cash' }],
    ['announcements',    { title: 'Hi', body: 'x' }],
    ['shifts',           { employeeId: 'emp-1', date: '2026-06-11' }],
    ['holidays',         { name: 'Holiday', date: '2026-06-11' }],
    ['recurring_invoices', { customerName: 'Cust' }],
  ];

  for (const [coll, payload] of tenantScoped) {
    it(`create ${coll}`, async () => {
      await assertSucceeds(
        addDoc(collection(db(), `tenants/${TID}/${coll}`), { ...payload, createdAt: new Date() }),
      );
    });
  }

  // journalEntries: create must be draft or posted
  it('create journalEntries (draft)', async () => {
    await assertSucceeds(
      addDoc(collection(db(), `tenants/${TID}/journalEntries`), {
        status: 'draft', totalDebit: 100, totalCredit: 100, lines: [], createdAt: new Date(),
      }),
    );
  });

  // Legacy top-level collections require tenantId on the doc
  const legacy: Array<[string, Record<string, unknown>]> = [
    ['attendance',  { tenantId: TID, employeeId: 'emp-1', date: '2026-06-11', source: 'manual' }],
    ['onboarding',  { tenantId: TID, employeeId: 'emp-1' }],
    ['offboarding', { tenantId: TID, employeeId: 'emp-1' }],
    ['payrollRuns', { tenantId: TID, createdBy: UID, status: 'draft' }],
  ];
  for (const [coll, payload] of legacy) {
    it(`create legacy ${coll}`, async () => {
      await assertSucceeds(addDoc(collection(db(), coll), { ...payload, createdAt: new Date() }));
    });
  }

  // Settings doc (CompanyDetails / payroll config save)
  it('write settings/config', async () => {
    await assertSucceeds(
      setDoc(doc(db(), `tenants/${TID}/settings/config`), { companyDetails: { legalName: 'X' } }),
    );
  });

  it('blocks direct tenant audit-log creation', async () => {
    await assertFails(
      addDoc(collection(db(), `tenants/${TID}/auditLogs`), {
        action: 'employee.update',
        userId: UID,
        timestamp: new Date(),
      }),
    );
  });
});
