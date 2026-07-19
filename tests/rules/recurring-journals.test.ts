/**
 * Firestore Rules Tests: recurring journal templates
 * (tenants/{tid}/recurringJournals — managed by finance admins, read by
 * accounting-module members, posted by the Admin-SDK scheduler which
 * bypasses rules entirely).
 */

import { describe, it, beforeEach, afterAll, beforeAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-recurring-journals';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

const OWNER = 'owner-a';
const ACCOUNTANT = 'accountant-a';
const MANAGER = 'manager-a';
const OUTSIDER = 'owner-b';

const TEMPLATE = {
  name: 'Monthly rent accrual',
  lines: [
    { lineNumber: 1, accountId: 'a1', accountCode: '5200', accountName: 'Rent Expense', debit: 650, credit: 0 },
    { lineNumber: 2, accountId: 'a2', accountCode: '2110', accountName: 'Trade Payables', debit: 0, credit: 650 },
  ],
  totalDebit: 650,
  totalCredit: 650,
  frequency: 'monthly',
  dayOfMonth: 1,
  nextRunDate: '2026-08-01',
  active: true,
  createdBy: OWNER,
};

describe('Recurring journal template rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then(m => m.default),
        host: 'localhost',
        port: FIRESTORE_EMULATOR_PORT,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'tenants/tenant-a'), { id: 'tenant-a', name: 'Tenant A', createdBy: OWNER });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${OWNER}`), { uid: OWNER, role: 'owner' });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${ACCOUNTANT}`), {
        uid: ACCOUNTANT,
        role: 'accountant',
        modules: ['staff', 'timeleave', 'payroll', 'money', 'accounting', 'reports'],
      });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${MANAGER}`), {
        uid: MANAGER,
        role: 'manager',
        modules: ['staff', 'timeleave', 'performance'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/recurringJournals/existing'), TEMPLATE);
    });
  });

  const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore();

  it('owner can create a template', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(OWNER), 'tenants/tenant-a/recurringJournals/t1'), TEMPLATE),
    );
  });

  it('accountant can create, update and delete templates', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(ACCOUNTANT), 'tenants/tenant-a/recurringJournals/t2'), TEMPLATE),
    );
    await assertSucceeds(
      updateDoc(doc(asUser(ACCOUNTANT), 'tenants/tenant-a/recurringJournals/existing'), { active: false }),
    );
    await assertSucceeds(
      deleteDoc(doc(asUser(ACCOUNTANT), 'tenants/tenant-a/recurringJournals/existing')),
    );
  });

  it('accountant can read templates', async () => {
    await assertSucceeds(
      getDoc(doc(asUser(ACCOUNTANT), 'tenants/tenant-a/recurringJournals/existing')),
    );
  });

  it('manager without the accounting module cannot read or write', async () => {
    await assertFails(
      getDoc(doc(asUser(MANAGER), 'tenants/tenant-a/recurringJournals/existing')),
    );
    await assertFails(
      setDoc(doc(asUser(MANAGER), 'tenants/tenant-a/recurringJournals/t3'), TEMPLATE),
    );
    await assertFails(
      updateDoc(doc(asUser(MANAGER), 'tenants/tenant-a/recurringJournals/existing'), { active: false }),
    );
  });

  it('a user from another tenant cannot touch templates', async () => {
    await assertFails(
      getDoc(doc(asUser(OUTSIDER), 'tenants/tenant-a/recurringJournals/existing')),
    );
    await assertFails(
      deleteDoc(doc(asUser(OUTSIDER), 'tenants/tenant-a/recurringJournals/existing')),
    );
  });

  it('unauthenticated users are denied', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'tenants/tenant-a/recurringJournals/existing')));
  });
});
