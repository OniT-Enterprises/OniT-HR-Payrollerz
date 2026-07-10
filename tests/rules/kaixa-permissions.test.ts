import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-kaixa-permissions';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

function transactionData(tenantId: string, createdBy: string) {
  const now = new Date();
  return {
    type: 'in',
    amount: 12.5,
    netAmount: 12.5,
    vatRate: 0,
    vatAmount: 0,
    vatCategory: 'none',
    category: 'sales',
    note: 'Test sale',
    timestamp: now,
    syncedToMeza: false,
    tenantId,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

describe('Kaixa Firestore rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then((module) => module.default),
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
      const db = context.firestore();
      await setDoc(doc(db, 'tenants/shop-a'), { name: 'Shop A' });
      await setDoc(doc(db, 'tenants/shop-b'), { name: 'Shop B' });
      await setDoc(doc(db, 'tenants/shop-a/members/owner-a'), {
        uid: 'owner-a',
        role: 'owner',
        modules: ['money'],
      });
      await setDoc(doc(db, 'tenants/shop-a/members/viewer-a'), {
        uid: 'viewer-a',
        role: 'viewer',
        modules: ['money'],
      });
      await setDoc(doc(db, 'tenants/shop-b/members/owner-b'), {
        uid: 'owner-b',
        role: 'owner',
        modules: ['money'],
      });
      await setDoc(
        doc(db, 'tenants/shop-a/transactions/existing'),
        transactionData('shop-a', 'owner-a')
      );
      await setDoc(doc(db, 'tenants/shop-a/products/coffee'), {
        name: 'Coffee',
        price: 2,
        stock: 10,
        isActive: true,
      });
      await setDoc(doc(db, 'tenants/shop-a/customerTabs/customer-1'), {
        customerName: 'Ana',
        balance: 5,
        entries: [],
      });
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  it('allows a tenant owner to use every Kaixa collection', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore();

    await assertSucceeds(
      setDoc(
        doc(db, 'tenants/shop-a/transactions/new-sale'),
        transactionData('shop-a', 'owner-a')
      )
    );
    await assertSucceeds(
      updateDoc(doc(db, 'tenants/shop-a/products/coffee'), { stock: 9 })
    );
    await assertSucceeds(
      updateDoc(doc(db, 'tenants/shop-a/customerTabs/customer-1'), { balance: 7 })
    );
    await assertSucceeds(
      setDoc(doc(db, 'tenants/shop-a/receiptCounters/2026'), {
        year: '2026',
        seq: 1,
        updatedAt: new Date(),
      })
    );
  });

  it('allows money-module members to read but not mutate Kaixa data', async () => {
    const db = testEnv.authenticatedContext('viewer-a').firestore();

    await assertSucceeds(getDoc(doc(db, 'tenants/shop-a/transactions/existing')));
    await assertSucceeds(getDoc(doc(db, 'tenants/shop-a/products/coffee')));
    await assertSucceeds(getDoc(doc(db, 'tenants/shop-a/customerTabs/customer-1')));
    await assertFails(
      setDoc(
        doc(db, 'tenants/shop-a/transactions/viewer-sale'),
        transactionData('shop-a', 'viewer-a')
      )
    );
  });

  it('blocks cross-tenant reads and tenant-id spoofing', async () => {
    const ownerB = testEnv.authenticatedContext('owner-b').firestore();
    const ownerA = testEnv.authenticatedContext('owner-a').firestore();

    await assertFails(getDoc(doc(ownerB, 'tenants/shop-a/transactions/existing')));
    await assertFails(
      setDoc(
        doc(ownerA, 'tenants/shop-a/transactions/spoofed'),
        transactionData('shop-b', 'owner-a')
      )
    );
  });

  it('keeps financial values immutable while allowing receipt assignment', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore();
    const ref = doc(db, 'tenants/shop-a/transactions/existing');

    await assertSucceeds(
      updateDoc(ref, {
        receiptNumber: 'REC-2026-000001',
        updatedAt: new Date(),
      })
    );
    await assertFails(updateDoc(ref, { amount: 999, updatedAt: new Date() }));
    await assertFails(deleteDoc(ref));
  });

  it('only permits sequential receipt counter updates', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore();
    const ref = doc(db, 'tenants/shop-a/receiptCounters/2026');

    await assertSucceeds(
      setDoc(ref, { year: '2026', seq: 1, updatedAt: new Date() })
    );
    await assertSucceeds(updateDoc(ref, { seq: 2, updatedAt: new Date() }));
    await assertFails(updateDoc(ref, { seq: 4, updatedAt: new Date() }));
  });
});
