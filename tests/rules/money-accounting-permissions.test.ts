/**
 * Firestore Rules Tests: Money + Accounting permission alignment
 *
 * Covers:
 * - Global platform VAT config readability
 * - Tenant VAT returns permissions
 * - Tenant bank transactions (bank reconciliation) permissions
 * - Voiding posted journal entries (posted -> void) for tenant admins
 */

import { describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-money-accounting-perms';

describe('Money + Accounting Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then(m => m.default),
        host: 'localhost',
        port: 8081,
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

      // Tenant + membership
      await setDoc(doc(adminDb, 'tenants/tenant-a'), { name: 'Tenant A' });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/owner-a'), {
        uid: 'owner-a',
        role: 'owner',
        modules: ['money', 'accounting', 'reports'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/viewer-a'), {
        uid: 'viewer-a',
        role: 'viewer',
        modules: [],
      });

      // Seed global platform vatConfig
      await setDoc(doc(adminDb, 'platform/vatConfig'), { isActive: true, updatedAt: new Date() });

      // Seed a posted journal entry we can attempt to void
      await setDoc(doc(adminDb, 'tenants/tenant-a/journalEntries/je-posted-1'), {
        entryNumber: 'JE-2026-0001',
        date: '2026-03-01',
        description: 'Posted entry',
        source: 'manual',
        lines: [
          { lineNumber: 1, accountId: 'acct-ar', accountCode: '1210', accountName: 'AR', debit: 100, credit: 0 },
          { lineNumber: 2, accountId: 'acct-rev', accountCode: '4100', accountName: 'Revenue', debit: 0, credit: 100 },
        ],
        totalDebit: 100,
        totalCredit: 100,
        status: 'posted',
        fiscalYear: 2026,
        fiscalPeriod: 3,
        postedBy: 'owner-a',
        postedAt: new Date(),
        createdAt: new Date(),
      });

      // Seed a VAT return doc for read tests
      await setDoc(doc(adminDb, 'tenants/tenant-a/vatReturns/2026-03'), {
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
        outputVAT: 10,
        inputVAT: 2,
        netDue: 8,
        status: 'draft',
        createdAt: new Date(),
      });

      // Seed a bank transaction for read tests
      await setDoc(doc(adminDb, 'tenants/tenant-a/bankTransactions/tx-1'), {
        date: '2026-03-01',
        description: 'Deposit',
        amount: 100,
        type: 'deposit',
        status: 'unmatched',
        createdAt: new Date(),
      });
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  it('allows authenticated users to read platform VAT config', async () => {
    const authedDb = testEnv.authenticatedContext('owner-a').firestore();
    await assertSucceeds(getDoc(doc(authedDb, 'platform/vatConfig')));
  });

  it('blocks unauthenticated users from reading platform VAT config', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthedDb, 'platform/vatConfig')));
  });

  it('allows tenant admins to create VAT returns; blocks non-admin writes; allows member reads', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-a').firestore();
    const viewerDb = testEnv.authenticatedContext('viewer-a').firestore();

    await assertSucceeds(setDoc(doc(ownerDb, 'tenants/tenant-a/vatReturns/2026-04'), {
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      outputVAT: 0,
      inputVAT: 0,
      netDue: 0,
      status: 'draft',
      createdAt: new Date(),
    }));

    await assertFails(setDoc(doc(viewerDb, 'tenants/tenant-a/vatReturns/2026-05'), {
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      outputVAT: 0,
      inputVAT: 0,
      netDue: 0,
      status: 'draft',
      createdAt: new Date(),
    }));

    await assertSucceeds(getDoc(doc(viewerDb, 'tenants/tenant-a/vatReturns/2026-03')));
  });

  it('allows tenant admins to write bank transactions; blocks non-admin writes; allows member reads', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-a').firestore();
    const viewerDb = testEnv.authenticatedContext('viewer-a').firestore();

    await assertSucceeds(setDoc(doc(ownerDb, 'tenants/tenant-a/bankTransactions/tx-2'), {
      date: '2026-03-02',
      description: 'Withdrawal',
      amount: -25,
      type: 'withdrawal',
      status: 'unmatched',
      createdAt: new Date(),
    }));

    await assertFails(setDoc(doc(viewerDb, 'tenants/tenant-a/bankTransactions/tx-3'), {
      date: '2026-03-03',
      description: 'Deposit',
      amount: 10,
      type: 'deposit',
      status: 'unmatched',
      createdAt: new Date(),
    }));

    await assertSucceeds(getDoc(doc(viewerDb, 'tenants/tenant-a/bankTransactions/tx-1')));
  });

  it('allows tenant admins to void posted journal entries; blocks edits to other fields', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-a').firestore();

    // Void is allowed (posted -> void) with only void metadata changes
    await assertSucceeds(updateDoc(doc(ownerDb, 'tenants/tenant-a/journalEntries/je-posted-1'), {
      status: 'void',
      voidedAt: new Date(),
      voidedBy: 'owner-a',
      voidReason: 'Testing void',
    }));

    // Changing other fields on posted entries should fail
    await assertFails(updateDoc(doc(ownerDb, 'tenants/tenant-a/journalEntries/je-posted-1'), {
      description: 'Tampered',
    }));
  });

  it('blocks non-admin users from voiding posted journal entries', async () => {
    const viewerDb = testEnv.authenticatedContext('viewer-a').firestore();

    await assertFails(updateDoc(doc(viewerDb, 'tenants/tenant-a/journalEntries/je-posted-1'), {
      status: 'void',
      voidedAt: new Date(),
      voidedBy: 'viewer-a',
      voidReason: 'Nope',
    }));
  });
});

