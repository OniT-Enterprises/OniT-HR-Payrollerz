/**
 * Firestore Rules Tests: public invoice links (hosted invoice pages)
 *
 * invoice_links/{token} — doc id is the unguessable share token. Covers:
 * - Public (unauthenticated) get of an active link; revoked links stay hidden
 * - No public list (links must not be enumerable)
 * - Public one-time viewedAt stamp (server time only, nothing else writable)
 * - Tenant-admin create/update/delete, cross-tenant denial, viewer denial
 */

import { describe, it, beforeEach, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'test-invoice-links';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

const ACTIVE_TOKEN = 'active-token-abc123';
const REVOKED_TOKEN = 'revoked-token-def456';
const VIEWED_TOKEN = 'viewed-token-ghi789';

function linkDoc(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-a',
    invoiceId: 'inv-1',
    invoice: { invoiceNumber: 'INV-2026-001', total: 100, status: 'sent' },
    settings: { companyName: 'Tenant A Lda' },
    revoked: false,
    viewedAt: null,
    ...overrides,
  };
}

describe('Public invoice link rules', () => {
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

      // Tenant A: owner + non-admin viewer member
      await setDoc(doc(adminDb, 'tenants/tenant-a'), { name: 'Tenant A' });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/owner-a'), {
        uid: 'owner-a',
        role: 'owner',
        modules: ['money'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/viewer-a'), {
        uid: 'viewer-a',
        role: 'viewer',
        modules: ['money'],
      });

      // Tenant B: owner (for cross-tenant denials)
      await setDoc(doc(adminDb, 'tenants/tenant-b'), { name: 'Tenant B' });
      await setDoc(doc(adminDb, 'tenants/tenant-b/members/owner-b'), {
        uid: 'owner-b',
        role: 'owner',
        modules: ['money'],
      });

      await setDoc(doc(adminDb, `invoice_links/${ACTIVE_TOKEN}`), linkDoc());
      await setDoc(doc(adminDb, `invoice_links/${REVOKED_TOKEN}`), linkDoc({ revoked: true }));
      await setDoc(doc(adminDb, `invoice_links/${VIEWED_TOKEN}`), linkDoc({ viewedAt: new Date() }));
    });
  });

  const publicDb = () => testEnv.unauthenticatedContext().firestore();
  const ownerADb = () => testEnv.authenticatedContext('owner-a').firestore();
  const viewerADb = () => testEnv.authenticatedContext('viewer-a').firestore();
  const ownerBDb = () => testEnv.authenticatedContext('owner-b').firestore();

  describe('public (unauthenticated) access', () => {
    it('can get an active link by token', async () => {
      await assertSucceeds(getDoc(doc(publicDb(), `invoice_links/${ACTIVE_TOKEN}`)));
    });

    it('cannot get a revoked link', async () => {
      await assertFails(getDoc(doc(publicDb(), `invoice_links/${REVOKED_TOKEN}`)));
    });

    it('get of a nonexistent token resolves (NOT_FOUND, not permission-denied)', async () => {
      // ensureShareLink() checks existence before create — a denied get here
      // would make it impossible for admins to ever create a link.
      await assertSucceeds(getDoc(doc(publicDb(), 'invoice_links/no-such-token')));
      await assertSucceeds(getDoc(doc(ownerADb(), 'invoice_links/no-such-token')));
    });

    it('cannot list the collection (no enumeration)', async () => {
      await assertFails(getDocs(collection(publicDb(), 'invoice_links')));
    });

    it('can stamp viewedAt once with server time', async () => {
      await assertSucceeds(
        updateDoc(doc(publicDb(), `invoice_links/${ACTIVE_TOKEN}`), {
          viewedAt: serverTimestamp(),
        })
      );
    });

    it('cannot re-stamp viewedAt once set', async () => {
      await assertFails(
        updateDoc(doc(publicDb(), `invoice_links/${VIEWED_TOKEN}`), {
          viewedAt: serverTimestamp(),
        })
      );
    });

    it('cannot stamp viewedAt with a client-chosen time', async () => {
      await assertFails(
        updateDoc(doc(publicDb(), `invoice_links/${ACTIVE_TOKEN}`), {
          viewedAt: new Date('2020-01-01'),
        })
      );
    });

    it('cannot touch any other field', async () => {
      await assertFails(
        updateDoc(doc(publicDb(), `invoice_links/${ACTIVE_TOKEN}`), {
          viewedAt: serverTimestamp(),
          invoice: { invoiceNumber: 'INV-HACKED', total: 0, status: 'paid' },
        })
      );
      await assertFails(
        updateDoc(doc(publicDb(), `invoice_links/${ACTIVE_TOKEN}`), {
          revoked: true,
        })
      );
    });

    it('cannot create or delete links', async () => {
      await assertFails(setDoc(doc(publicDb(), 'invoice_links/new-public-token'), linkDoc()));
      await assertFails(deleteDoc(doc(publicDb(), `invoice_links/${ACTIVE_TOKEN}`)));
    });
  });

  describe('tenant admin access', () => {
    it('owner can create a link for their tenant', async () => {
      await assertSucceeds(setDoc(doc(ownerADb(), 'invoice_links/new-token-1'), linkDoc()));
    });

    it('create requires the full snapshot shape', async () => {
      await assertFails(
        setDoc(doc(ownerADb(), 'invoice_links/new-token-2'), {
          tenantId: 'tenant-a',
          invoiceId: 'inv-1',
          revoked: false,
        })
      );
    });

    it('cannot create a link pre-revoked', async () => {
      await assertFails(
        setDoc(doc(ownerADb(), 'invoice_links/new-token-3'), linkDoc({ revoked: true }))
      );
    });

    it('owner of another tenant cannot create for tenant-a', async () => {
      await assertFails(setDoc(doc(ownerBDb(), 'invoice_links/new-token-4'), linkDoc()));
    });

    it('non-admin member cannot create', async () => {
      await assertFails(setDoc(doc(viewerADb(), 'invoice_links/new-token-5'), linkDoc()));
    });

    it('owner can refresh the snapshot (get + update), keeping tenantId', async () => {
      await assertSucceeds(getDoc(doc(ownerADb(), `invoice_links/${REVOKED_TOKEN}`)));
      await assertSucceeds(
        updateDoc(doc(ownerADb(), `invoice_links/${ACTIVE_TOKEN}`), {
          invoice: { invoiceNumber: 'INV-2026-001', total: 100, status: 'paid' },
        })
      );
    });

    it('owner cannot re-point a link at another tenant', async () => {
      await assertFails(
        updateDoc(doc(ownerADb(), `invoice_links/${ACTIVE_TOKEN}`), {
          tenantId: 'tenant-b',
        })
      );
    });

    it('cross-tenant owner cannot update or delete', async () => {
      await assertFails(
        updateDoc(doc(ownerBDb(), `invoice_links/${ACTIVE_TOKEN}`), {
          invoice: { invoiceNumber: 'X', total: 0, status: 'paid' },
        })
      );
      await assertFails(deleteDoc(doc(ownerBDb(), `invoice_links/${ACTIVE_TOKEN}`)));
    });

    it('owner can delete (revoke) their link', async () => {
      await assertSucceeds(deleteDoc(doc(ownerADb(), `invoice_links/${ACTIVE_TOKEN}`)));
    });

    it('non-admin member cannot delete', async () => {
      await assertFails(deleteDoc(doc(viewerADb(), `invoice_links/${ACTIVE_TOKEN}`)));
    });
  });
});
