import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-payroll-approval';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

describe('Payroll run approval rules (two-person rule + solo self-approval)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then((m) => m.default),
        host: 'localhost',
        port: FIRESTORE_EMULATOR_PORT,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  // Tenant is subscribed by default — the finalize paywall is tested
  // separately below; these suites focus on the two-person rule.
  const seed = async (
    payrollConfig?: Record<string, unknown>,
    tenantDoc: Record<string, unknown> = { name: 'Tenant A', stripeSubscriptionId: 'sub_active' },
  ) => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      await setDoc(doc(adminDb, 'tenants/tenant-a'), tenantDoc);
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/owner-a'), {
        uid: 'owner-a',
        role: 'owner',
        modules: ['payroll'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/admin-b'), {
        uid: 'admin-b',
        role: 'hr-admin',
        modules: ['payroll'],
      });
      if (payrollConfig) {
        await setDoc(doc(adminDb, 'tenants/tenant-a/settings/config'), {
          payrollConfig,
        });
      }

      await setDoc(doc(adminDb, 'payrollRuns/run-1'), {
        tenantId: 'tenant-a',
        status: 'pending_approval',
        createdBy: 'owner-a',
        totalNetPay: 1000,
      });
    });
  };

  describe('default (no settings doc)', () => {
    beforeEach(() => seed());

    it('blocks the creator from approving their own run', async () => {
      const db = testEnv.authenticatedContext('owner-a').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'owner-a',
        }),
      );
    });

    it('allows a different admin to approve', async () => {
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'admin-b',
        }),
      );
    });
  });

  describe('allowSelfApproval = false (explicit)', () => {
    beforeEach(() => seed({ allowSelfApproval: false }));

    it('still blocks self-approval', async () => {
      const db = testEnv.authenticatedContext('owner-a').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'owner-a',
        }),
      );
    });
  });

  describe('allowSelfApproval = true (solo-operator mode)', () => {
    beforeEach(() => seed({ allowSelfApproval: true }));

    it('lets the creator approve their own run', async () => {
      const db = testEnv.authenticatedContext('owner-a').firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'owner-a',
        }),
      );
    });

    it('still allows a different admin to approve', async () => {
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'admin-b',
        }),
      );
    });

    it('still blocks createdBy tampering', async () => {
      const db = testEnv.authenticatedContext('owner-a').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'owner-a',
          createdBy: 'someone-else',
        }),
      );
    });

    it('still blocks non-members entirely', async () => {
      const db = testEnv.authenticatedContext('stranger').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'stranger',
        }),
      );
    });
  });

  describe('allowSelfApproval toggle protection (owner-only change)', () => {
    // The waiver for the two-person rule must not be flippable by the very
    // finance roles it constrains (hr-admin / accountant) — otherwise a single
    // finance person toggles it and self-approves their own run.
    const seedWithAccountant = async (config?: Record<string, unknown>) => {
      await testEnv.clearFirestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'tenants/tenant-a'), { name: 'Tenant A' });
        await setDoc(doc(adminDb, 'tenants/tenant-a/members/owner-a'), {
          uid: 'owner-a',
          role: 'owner',
          modules: ['payroll'],
        });
        await setDoc(doc(adminDb, 'tenants/tenant-a/members/admin-b'), {
          uid: 'admin-b',
          role: 'hr-admin',
          modules: ['payroll'],
        });
        await setDoc(doc(adminDb, 'tenants/tenant-a/members/acct-c'), {
          uid: 'acct-c',
          role: 'accountant',
          modules: ['payroll'],
        });
        if (config) {
          await setDoc(doc(adminDb, 'tenants/tenant-a/settings/config'), config);
        }
      });
    };

    it('blocks an accountant from enabling self-approval', async () => {
      await seedWithAccountant({ payrollConfig: { allowSelfApproval: false } });
      const db = testEnv.authenticatedContext('acct-c').firestore();
      await assertFails(
        setDoc(
          doc(db, 'tenants/tenant-a/settings/config'),
          { payrollConfig: { allowSelfApproval: true } },
          { merge: true },
        ),
      );
    });

    it('blocks an hr-admin from enabling self-approval', async () => {
      await seedWithAccountant({ payrollConfig: { allowSelfApproval: false } });
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertFails(
        setDoc(
          doc(db, 'tenants/tenant-a/settings/config'),
          { payrollConfig: { allowSelfApproval: true } },
          { merge: true },
        ),
      );
    });

    it('lets the owner enable and disable self-approval', async () => {
      await seedWithAccountant({ payrollConfig: { allowSelfApproval: false } });
      const db = testEnv.authenticatedContext('owner-a').firestore();
      await assertSucceeds(
        setDoc(
          doc(db, 'tenants/tenant-a/settings/config'),
          { payrollConfig: { allowSelfApproval: true } },
          { merge: true },
        ),
      );
      await assertSucceeds(
        setDoc(
          doc(db, 'tenants/tenant-a/settings/config'),
          { payrollConfig: { allowSelfApproval: false } },
          { merge: true },
        ),
      );
    });

    it('still lets an accountant save unrelated payroll config (flag carried through)', async () => {
      await seedWithAccountant({
        payrollConfig: { allowSelfApproval: true, standardWeeklyHours: 44 },
      });
      const db = testEnv.authenticatedContext('acct-c').firestore();
      // Mirrors settingsService.updatePayrollConfig: setDoc(merge) that does
      // not touch allowSelfApproval — the post-merge value is unchanged.
      await assertSucceeds(
        setDoc(
          doc(db, 'tenants/tenant-a/settings/config'),
          { payrollConfig: { standardWeeklyHours: 40 } },
          { merge: true },
        ),
      );
    });

    it('blocks an accountant from creating the config doc pre-waived', async () => {
      await seedWithAccountant(); // no settings doc yet
      const db = testEnv.authenticatedContext('acct-c').firestore();
      await assertFails(
        setDoc(doc(db, 'tenants/tenant-a/settings/config'), {
          payrollConfig: { allowSelfApproval: true },
        }),
      );
      // A fresh config without the waiver is fine.
      await assertSucceeds(
        setDoc(doc(db, 'tenants/tenant-a/settings/config'), {
          payrollConfig: { standardWeeklyHours: 44 },
        }),
      );
    });
  });

  describe('subscription paywall (finalize gate)', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it('blocks approval when the tenant has no subscription', async () => {
      await seed(undefined, { name: 'Tenant A' });
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'admin-b',
        }),
      );
    });

    it('blocks approval when the subscription has lapsed', async () => {
      await seed(undefined, {
        name: 'Tenant A',
        stripeSubscriptionId: 'sub_lapsed',
        subscriptionPaidUntil: new Date(Date.now() - DAY_MS),
      });
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'admin-b',
        }),
      );
    });

    it('allows approval with an active subscription and future paid-until', async () => {
      await seed(undefined, {
        name: 'Tenant A',
        stripeSubscriptionId: 'sub_active',
        subscriptionPaidUntil: new Date(Date.now() + DAY_MS),
      });
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'admin-b',
        }),
      );
    });

    it('still allows non-finalize updates without a subscription (free features)', async () => {
      await seed(undefined, { name: 'Tenant A' });
      const db = testEnv.authenticatedContext('owner-a').firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          totalNetPay: 1200,
        }),
      );
    });

    it('allows approval with an active MANUAL subscription (bank transfer/cash)', async () => {
      await seed(undefined, {
        name: 'Tenant A',
        manualSubscription: true,
        subscriptionPaidUntil: new Date(Date.now() + DAY_MS),
      });
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'admin-b',
        }),
      );
    });

    it('blocks approval when a manual subscription has lapsed', async () => {
      await seed(undefined, {
        name: 'Tenant A',
        manualSubscription: true,
        subscriptionPaidUntil: new Date(Date.now() - DAY_MS),
      });
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'admin-b',
        }),
      );
    });

    it('blocks approval when a manual subscription has no paid-until (never open-ended)', async () => {
      await seed(undefined, { name: 'Tenant A', manualSubscription: true });
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'admin-b',
        }),
      );
    });

    it('blocks a tenant owner from self-activating via billing fields on the tenant doc', async () => {
      await seed(undefined, { name: 'Tenant A' });
      const db = testEnv.authenticatedContext('owner-a').firestore();
      await assertFails(
        updateDoc(doc(db, 'tenants/tenant-a'), { stripeSubscriptionId: 'sub_forged' }),
      );
      await assertFails(
        updateDoc(doc(db, 'tenants/tenant-a'), {
          manualSubscription: true,
          subscriptionPaidUntil: new Date(Date.now() + 30 * DAY_MS),
        }),
      );
      await assertFails(
        updateDoc(doc(db, 'tenants/tenant-a'), {
          subscriptionPaidUntil: new Date(Date.now() + 30 * DAY_MS),
        }),
      );
      await assertFails(
        updateDoc(doc(db, 'tenants/tenant-a'), {
          subscriptionBillingAmount: 20,
          subscriptionBillingInterval: 'year',
          subscriptionBillingMonths: 12,
          subscriptionBilledSeats: 5,
          subscriptionAnnualMonthsCharged: 10,
        }),
      );
      // Benign config updates by the owner must still work
      await assertSucceeds(
        updateDoc(doc(db, 'tenants/tenant-a'), { name: 'Tenant A (renamed)' }),
      );
    });

    it('does not freeze already-approved runs when the subscription lapses', async () => {
      await testEnv.clearFirestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'tenants/tenant-a'), { name: 'Tenant A' });
        await setDoc(doc(adminDb, 'tenants/tenant-a/members/owner-a'), {
          uid: 'owner-a',
          role: 'owner',
          modules: ['payroll'],
        });
        await setDoc(doc(adminDb, 'tenants/tenant-a/members/admin-b'), {
          uid: 'admin-b',
          role: 'hr-admin',
          modules: ['payroll'],
        });
        await setDoc(doc(adminDb, 'payrollRuns/run-1'), {
          tenantId: 'tenant-a',
          status: 'approved',
          createdBy: 'owner-a',
          approvedBy: 'admin-b',
          totalNetPay: 1000,
        });
      });
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'payrollRuns/run-1'), {
          status: 'approved',
          approvedBy: 'admin-b',
          notes: 'paid via bank transfer',
        }),
      );
    });
  });

  describe('approval state machine (only pre-approval -> approved)', () => {
    const seedRunWithStatus = async (status: string) => {
      await testEnv.clearFirestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'tenants/tenant-a'), {
          name: 'Tenant A',
          stripeSubscriptionId: 'sub_active',
        });
        await setDoc(doc(adminDb, 'tenants/tenant-a/members/owner-a'), {
          uid: 'owner-a', role: 'owner', modules: ['payroll'],
        });
        await setDoc(doc(adminDb, 'tenants/tenant-a/members/admin-b'), {
          uid: 'admin-b', role: 'hr-admin', modules: ['payroll'],
        });
        await setDoc(doc(adminDb, 'payrollRuns/run-1'), {
          tenantId: 'tenant-a',
          status,
          createdBy: 'owner-a',
          totalNetPay: 1000,
        });
      });
    };

    it('allows processing -> approved', async () => {
      await seedRunWithStatus('processing');
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'payrollRuns/run-1'), { status: 'approved', approvedBy: 'admin-b' }),
      );
    });

    it('blocks paid -> approved', async () => {
      await seedRunWithStatus('paid');
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), { status: 'approved', approvedBy: 'admin-b' }),
      );
    });

    it('blocks rejected -> approved', async () => {
      await seedRunWithStatus('rejected');
      const db = testEnv.authenticatedContext('admin-b').firestore();
      await assertFails(
        updateDoc(doc(db, 'payrollRuns/run-1'), { status: 'approved', approvedBy: 'admin-b' }),
      );
    });
  });
});
