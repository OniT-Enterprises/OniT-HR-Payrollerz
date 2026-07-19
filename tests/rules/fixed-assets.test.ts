/**
 * Firestore Rules Tests: fixed-asset register + depreciation posting guards
 * (tenants/{tid}/fixedAssets, tenants/{tid}/fixedAssetPostings).
 * Postings are append-only from clients — a period can never be silently
 * unposted or edited; reversal is a deliberate manual journal.
 */

import { describe, it, beforeEach, afterAll, beforeAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-fixed-assets';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

const OWNER = 'owner-a';
const ACCOUNTANT = 'accountant-a';
const MANAGER = 'manager-a';
const OUTSIDER = 'owner-b';

const ASSET = {
  name: 'Espresso machine',
  assetClass: 'equipment',
  acquisitionDate: '2026-07-01',
  acquisitionCost: 3200,
  residualValue: 200,
  usefulLifeMonths: 60,
  method: 'straight_line',
  assetAccountCode: '1530',
  accumulatedAccountCode: '1590',
  expenseAccountCode: '5800',
  depreciationStartPeriod: '2026-07',
  accumulatedDepreciation: 0,
  status: 'active',
  createdBy: OWNER,
};

const POSTING = {
  period: '2026-07',
  journalEntryId: 'je-1',
  entryNumber: 'JE-2026-0001',
  totalAmount: 50,
  assetCount: 1,
  postedBy: OWNER,
};

describe('Fixed asset rules', () => {
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
      await setDoc(doc(adminDb, 'tenants/tenant-a/fixedAssets/existing'), ASSET);
      await setDoc(doc(adminDb, 'tenants/tenant-a/fixedAssetPostings/2026-06'), {
        ...POSTING,
        period: '2026-06',
      });
    });
  });

  const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore();

  it('finance admins (owner + accountant) manage the register', async () => {
    await assertSucceeds(setDoc(doc(asUser(OWNER), 'tenants/tenant-a/fixedAssets/a1'), ASSET));
    await assertSucceeds(setDoc(doc(asUser(ACCOUNTANT), 'tenants/tenant-a/fixedAssets/a2'), ASSET));
    await assertSucceeds(
      updateDoc(doc(asUser(ACCOUNTANT), 'tenants/tenant-a/fixedAssets/existing'), {
        accumulatedDepreciation: 50,
        depreciatedThroughPeriod: '2026-07',
      }),
    );
    await assertSucceeds(deleteDoc(doc(asUser(OWNER), 'tenants/tenant-a/fixedAssets/existing')));
  });

  it('accounting members can read; non-accounting managers cannot', async () => {
    await assertSucceeds(getDoc(doc(asUser(ACCOUNTANT), 'tenants/tenant-a/fixedAssets/existing')));
    await assertFails(getDoc(doc(asUser(MANAGER), 'tenants/tenant-a/fixedAssets/existing')));
    await assertFails(setDoc(doc(asUser(MANAGER), 'tenants/tenant-a/fixedAssets/a3'), ASSET));
  });

  it('outsiders and anonymous are denied', async () => {
    await assertFails(getDoc(doc(asUser(OUTSIDER), 'tenants/tenant-a/fixedAssets/existing')));
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'tenants/tenant-a/fixedAssets/existing')));
  });

  it('depreciation postings are create-only for finance admins', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(ACCOUNTANT), 'tenants/tenant-a/fixedAssetPostings/2026-07'), POSTING),
    );
    // A posted period can never be edited or removed from the client.
    await assertFails(
      updateDoc(doc(asUser(OWNER), 'tenants/tenant-a/fixedAssetPostings/2026-06'), { totalAmount: 1 }),
    );
    await assertFails(
      deleteDoc(doc(asUser(OWNER), 'tenants/tenant-a/fixedAssetPostings/2026-06')),
    );
    await assertFails(
      setDoc(doc(asUser(MANAGER), 'tenants/tenant-a/fixedAssetPostings/2026-08'), POSTING),
    );
  });
});
