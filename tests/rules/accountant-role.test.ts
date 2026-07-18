/**
 * Firestore Rules Tests: the 'accountant' finance-power role
 *
 * Pins the isTenantFinanceAdmin boundary introduced for the audience split:
 * - Accountants write money / accounting / payroll records like an admin
 *   (bills, vendors, journal entries, payruns, settings/config, mail queue,
 *   invoice links).
 * - Accountants do NOT get administration: no member management, no employee
 *   create/delete, no settings/integrations, no tenant-doc updates.
 * - Managers did not gain finance writes from the new helper.
 * - Only owners flip the advancedTaxMode tenant flag (and never billing keys).
 */

import { describe, it, beforeEach, afterAll, beforeAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-accountant-role';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

const OWNER = 'owner-a';
const ACCOUNTANT = 'accountant-a';
const MANAGER = 'manager-a';

describe('Accountant role rules', () => {
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
      await setDoc(doc(adminDb, 'tenants/tenant-a'), {
        id: 'tenant-a',
        name: 'Tenant A',
        createdBy: OWNER,
      });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${OWNER}`), {
        uid: OWNER,
        role: 'owner',
      });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${ACCOUNTANT}`), {
        uid: ACCOUNTANT,
        role: 'accountant',
        // Mirrors DEFAULT_ROLE_PERMISSIONS.accountant
        modules: ['staff', 'timeleave', 'payroll', 'money', 'accounting', 'reports'],
      });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${MANAGER}`), {
        uid: MANAGER,
        role: 'manager',
        modules: ['staff', 'timeleave', 'performance'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/employees/emp-1'), {
        personalInfo: { firstName: 'Maria', lastName: 'Silva' },
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/settings/config'), {
        companyDetails: { legalName: 'Tenant A Lda' },
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/settings/integrations'), {
        quickbooks: { connected: false },
      });
    });
  });

  const asAccountant = () => testEnv.authenticatedContext(ACCOUNTANT).firestore();
  const asManager = () => testEnv.authenticatedContext(MANAGER).firestore();
  const asOwner = () => testEnv.authenticatedContext(OWNER).firestore();

  describe('finance writes allowed', () => {
    it('accountant can create a bill', async () => {
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'tenants/tenant-a/bills/bill-1'), {
          vendorId: 'v-1',
          amount: 100,
          status: 'pending',
        }),
      );
    });

    it('accountant can create a vendor', async () => {
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'tenants/tenant-a/vendors/v-1'), {
          name: 'Supplier Lda',
          isActive: true,
        }),
      );
    });

    it('accountant can create a draft journal entry', async () => {
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'tenants/tenant-a/journalEntries/je-1'), {
          entryNumber: 'JE-1',
          status: 'draft',
          totalDebit: 10,
          totalCredit: 10,
        }),
      );
    });

    it('accountant can create a draft payroll run', async () => {
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'tenants/tenant-a/payruns/run-1'), {
          status: 'draft',
          createdBy: ACCOUNTANT,
        }),
      );
    });

    it('accountant can read employees via the staff module', async () => {
      await assertSucceeds(
        getDoc(doc(asAccountant(), 'tenants/tenant-a/employees/emp-1')),
      );
    });

    // The REAL payroll flow writes to the top-level payrollRuns/payrollRecords
    // collections (not the tenants/*/payruns subcollection). Before the
    // finance-admin swap the accountant could build a run in the UI but every
    // save/approve 403'd here — this pins that it now works end to end.
    it('accountant can create a top-level payroll run', async () => {
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'payrollRuns/run-top-1'), {
          tenantId: 'tenant-a',
          status: 'draft',
          createdBy: ACCOUNTANT,
        }),
      );
    });

    it('accountant can approve a payroll run created by someone else (two-person rule)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'payrollRuns/run-approve-1'), {
          tenantId: 'tenant-a',
          status: 'processing',
          createdBy: OWNER,
        });
        // Active subscription — approval is paywalled
        await setDoc(doc(context.firestore(), 'tenants/tenant-a'), {
          id: 'tenant-a',
          name: 'Tenant A',
          createdBy: OWNER,
          stripeSubscriptionId: 'sub_live',
        });
      });
      await assertSucceeds(
        updateDoc(doc(asAccountant(), 'payrollRuns/run-approve-1'), {
          status: 'approved',
          approvedBy: ACCOUNTANT,
        }),
      );
    });

    it('accountant can write payroll records and tax filings', async () => {
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'payrollRecords/rec-1'), {
          tenantId: 'tenant-a',
          employeeId: 'emp-1',
          netPay: 288,
        }),
      );
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'taxFilings/fil-1'), {
          tenantId: 'tenant-a',
          type: 'inss_monthly',
          period: '2026-07',
        }),
      );
    });

    it('accountant can update settings/config (tax + payroll config)', async () => {
      await assertSucceeds(
        updateDoc(doc(asAccountant(), 'tenants/tenant-a/settings/config'), {
          payrollConfig: { allowSelfApproval: false },
        }),
      );
    });

    it('accountant can queue mail for the tenant', async () => {
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'mail/mail-1'), {
          tenantId: 'tenant-a',
          to: ['customer@example.com'],
          message: { subject: 'Invoice', html: '<p>Invoice attached</p>' },
        }),
      );
    });

    it('accountant can create an invoice link', async () => {
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'invoice_links/token-abc'), {
          tenantId: 'tenant-a',
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'INV-1', total: 100, status: 'sent' },
          settings: { companyName: 'Tenant A Lda' },
          revoked: false,
          viewedAt: null,
        }),
      );
    });
  });

  describe('administration still denied', () => {
    it('accountant cannot create members', async () => {
      await assertFails(
        setDoc(doc(asAccountant(), 'tenants/tenant-a/members/new-user'), {
          uid: 'new-user',
          role: 'viewer',
        }),
      );
    });

    it('accountant cannot change another member role', async () => {
      await assertFails(
        updateDoc(doc(asAccountant(), `tenants/tenant-a/members/${MANAGER}`), {
          role: 'owner',
        }),
      );
    });

    it('accountant cannot escalate own role or modules', async () => {
      await assertFails(
        updateDoc(doc(asAccountant(), `tenants/tenant-a/members/${ACCOUNTANT}`), {
          role: 'owner',
        }),
      );
    });

    it('accountant cannot create or delete employees', async () => {
      await assertFails(
        setDoc(doc(asAccountant(), 'tenants/tenant-a/employees/emp-2'), {
          personalInfo: { firstName: 'New', lastName: 'Hire' },
        }),
      );
      await assertFails(
        deleteDoc(doc(asAccountant(), 'tenants/tenant-a/employees/emp-1')),
      );
    });

    it('accountant cannot touch settings/integrations', async () => {
      await assertFails(
        updateDoc(doc(asAccountant(), 'tenants/tenant-a/settings/integrations'), {
          quickbooks: { connected: true },
        }),
      );
    });

    it('accountant cannot update the tenant doc', async () => {
      await assertFails(
        updateDoc(doc(asAccountant(), 'tenants/tenant-a'), {
          advancedTaxMode: true,
        }),
      );
    });
  });

  describe('audit log entries (journal-post transaction writes these client-side)', () => {
    it('finance admin can create a self-attributed audit entry', async () => {
      await assertSucceeds(
        setDoc(doc(asAccountant(), 'tenants/tenant-a/auditLogs/acct_je1_post'), {
          userId: ACCOUNTANT,
          tenantId: 'tenant-a',
          action: 'accounting.journal_post',
          module: 'accounting',
        }),
      );
    });

    it('cannot attribute an audit entry to someone else', async () => {
      await assertFails(
        setDoc(doc(asAccountant(), 'tenants/tenant-a/auditLogs/acct_je2_post'), {
          userId: OWNER,
          tenantId: 'tenant-a',
          action: 'accounting.journal_post',
        }),
      );
    });

    it('manager cannot create audit entries', async () => {
      await assertFails(
        setDoc(doc(asManager(), 'tenants/tenant-a/auditLogs/acct_je3_post'), {
          userId: MANAGER,
          tenantId: 'tenant-a',
          action: 'accounting.journal_post',
        }),
      );
    });

    it('audit entries stay immutable', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'tenants/tenant-a/auditLogs/existing'), {
          userId: OWNER,
          tenantId: 'tenant-a',
          action: 'accounting.journal_post',
        });
      });
      await assertFails(
        updateDoc(doc(asOwner(), 'tenants/tenant-a/auditLogs/existing'), {
          action: 'tampered',
        }),
      );
      await assertFails(
        deleteDoc(doc(asOwner(), 'tenants/tenant-a/auditLogs/existing')),
      );
    });
  });

  describe('other roles unchanged', () => {
    it('manager still cannot create bills', async () => {
      await assertFails(
        setDoc(doc(asManager(), 'tenants/tenant-a/bills/bill-x'), {
          vendorId: 'v-1',
          amount: 50,
          status: 'pending',
        }),
      );
    });

    it('owner can flip advancedTaxMode but never billing keys', async () => {
      await assertSucceeds(
        updateDoc(doc(asOwner(), 'tenants/tenant-a'), {
          advancedTaxMode: true,
        }),
      );
      await assertFails(
        updateDoc(doc(asOwner(), 'tenants/tenant-a'), {
          advancedTaxMode: true,
          manualSubscription: true,
        }),
      );
    });
  });
});
