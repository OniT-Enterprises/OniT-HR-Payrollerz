/**
 * Firestore rules: invoices are editable while draft, but every issued-invoice
 * balance change must be joined atomically to its immutable source event.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { subtractMoney } from '../../client/lib/currency';

const PROJECT_ID = 'test-invoice-integrity';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const TENANT = 'tenant-invoices';
const OWNER = 'invoice-owner';
const VIEWER = 'invoice-viewer';

const baseInvoice = (status: 'draft' | 'sent' | 'paid', amountPaid = 0) => ({
  invoiceNumber: status === 'paid' ? 'INV-PAID' : status === 'draft' ? 'INV-DRAFT' : 'INV-SENT',
  customerId: 'customer-1',
  customerName: 'Customer One',
  issueDate: '2026-07-01',
  dueDate: '2026-07-31',
  items: [{ id: 'line-1', description: 'Service', quantity: 1, unitPrice: 100, amount: 100 }],
  subtotal: 90,
  taxRate: 10,
  taxAmount: 10,
  total: 100,
  status,
  amountPaid,
  creditedAmount: 0,
  balanceDue: subtractMoney(100, amountPaid),
  currency: 'USD',
  createdBy: OWNER,
  updatedBy: OWNER,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T00:00:00Z'),
  ...(status !== 'draft' ? { sentAt: new Date('2026-07-01T00:00:00Z') } : {}),
  ...(status === 'paid' ? { paidAt: new Date('2026-07-02T00:00:00Z'), lastPaymentId: 'payment-original' } : {}),
});

describe('invoice financial integrity rules', () => {
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

  afterAll(async () => testEnv.cleanup());

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `tenants/${TENANT}`), { id: TENANT, name: 'Invoice Tenant' });
      await setDoc(doc(db, `tenants/${TENANT}/members/${OWNER}`), {
        uid: OWNER,
        role: 'owner',
        modules: ['money', 'accounting'],
      });
      await setDoc(doc(db, `tenants/${TENANT}/members/${VIEWER}`), {
        uid: VIEWER,
        role: 'viewer',
        modules: ['money'],
      });
      await setDoc(doc(db, `tenants/${TENANT}/invoices/draft-1`), baseInvoice('draft'));
      await setDoc(doc(db, `tenants/${TENANT}/invoices/sent-1`), baseInvoice('sent'));
      await setDoc(doc(db, `tenants/${TENANT}/invoices/paid-1`), baseInvoice('paid', 100));
      await setDoc(doc(db, `tenants/${TENANT}/payments_received/payment-original`), {
        kind: 'payment',
        date: '2026-07-02',
        customerId: 'customer-1',
        customerName: 'Customer One',
        invoiceId: 'paid-1',
        invoiceNumber: 'INV-PAID',
        amount: 100,
        method: 'bank_transfer',
        refundedAmount: 0,
        refundStatus: 'none',
        createdBy: OWNER,
        createdAt: new Date('2026-07-02T00:00:00Z'),
      });
    });
  });

  const ownerDb = () => testEnv.authenticatedContext(OWNER).firestore();
  const viewerDb = () => testEnv.authenticatedContext(VIEWER).firestore();

  it('allows a valid draft but rejects an invoice created as already paid', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `tenants/${TENANT}/invoices/draft-new`), {
      ...baseInvoice('draft'),
      invoiceNumber: 'INV-NEW',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    await assertFails(setDoc(doc(ownerDb(), `tenants/${TENANT}/invoices/forged-paid`), {
      ...baseInvoice('paid', 100),
      invoiceNumber: 'INV-FORGED',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });

  it('allows draft edits/deletes but keeps issued invoice amounts and records protected', async () => {
    await assertSucceeds(updateDoc(doc(ownerDb(), `tenants/${TENANT}/invoices/draft-1`), {
      notes: 'Updated before issue',
      updatedBy: OWNER,
      updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(deleteDoc(doc(ownerDb(), `tenants/${TENANT}/invoices/draft-1`)));

    await assertFails(updateDoc(doc(ownerDb(), `tenants/${TENANT}/invoices/sent-1`), {
      total: 1,
      balanceDue: 1,
      updatedBy: OWNER,
      updatedAt: serverTimestamp(),
    }));
    await assertFails(deleteDoc(doc(ownerDb(), `tenants/${TENANT}/invoices/sent-1`)));
  });

  it('accepts an atomic receipt and invoice update, but rejects either side alone', async () => {
    const db = ownerDb();
    const paymentRef = doc(db, `tenants/${TENANT}/payments_received/payment-new`);
    const invoiceRef = doc(db, `tenants/${TENANT}/invoices/sent-1`);
    const batch = writeBatch(db);
    batch.set(paymentRef, {
      kind: 'payment',
      date: '2026-07-03',
      customerId: 'customer-1',
      customerName: 'Customer One',
      invoiceId: 'sent-1',
      invoiceNumber: 'INV-SENT',
      amount: 40,
      method: 'bank_transfer',
      refundedAmount: 0,
      refundStatus: 'none',
      createdBy: OWNER,
      createdAt: serverTimestamp(),
    });
    batch.update(invoiceRef, {
      amountPaid: 40,
      balanceDue: 60,
      status: 'partial',
      paidAt: null,
      lastPaymentId: 'payment-new',
      updatedBy: OWNER,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());

    await assertFails(setDoc(doc(db, `tenants/${TENANT}/payments_received/payment-orphan`), {
      kind: 'payment', invoiceId: 'sent-1', invoiceNumber: 'INV-SENT',
      customerId: 'customer-1', amount: 10, date: '2026-07-03', method: 'cash',
      refundedAmount: 0, refundStatus: 'none', createdBy: OWNER,
      createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(invoiceRef, {
      amountPaid: 80,
      balanceDue: 20,
      status: 'partial',
      lastPaymentId: 'does-not-exist',
      updatedBy: OWNER,
      updatedAt: serverTimestamp(),
    }));
  });

  it('accepts an atomic refund and prevents receipt deletion or arbitrary refund metadata', async () => {
    const db = ownerDb();
    const invoiceRef = doc(db, `tenants/${TENANT}/invoices/paid-1`);
    const paymentRef = doc(db, `tenants/${TENANT}/payments_received/payment-original`);
    const refundRef = doc(db, `tenants/${TENANT}/payments_received/refund-1`);
    const batch = writeBatch(db);
    batch.set(refundRef, {
      kind: 'refund',
      date: '2026-07-04',
      customerId: 'customer-1',
      customerName: 'Customer One',
      invoiceId: 'paid-1',
      invoiceNumber: 'INV-PAID',
      amount: -30,
      method: 'bank_transfer',
      notes: 'Customer overpaid',
      relatedPaymentId: 'payment-original',
      createdBy: OWNER,
      createdAt: serverTimestamp(),
    });
    batch.update(paymentRef, {
      refundedAmount: 30,
      refundStatus: 'partial',
      lastRefundId: 'refund-1',
      updatedAt: serverTimestamp(),
    });
    batch.update(invoiceRef, {
      amountPaid: 70,
      balanceDue: 30,
      status: 'partial',
      paidAt: null,
      lastRefundId: 'refund-1',
      updatedBy: OWNER,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());

    await assertFails(deleteDoc(refundRef));
    await assertFails(updateDoc(paymentRef, {
      refundedAmount: 100,
      refundStatus: 'refunded',
      updatedAt: serverTimestamp(),
    }));
  });

  it('accepts an atomic credit note and keeps the issued note immutable', async () => {
    const db = ownerDb();
    const invoiceRef = doc(db, `tenants/${TENANT}/invoices/sent-1`);
    const malformedCreditRef = doc(db, `tenants/${TENANT}/credit_notes/credit-malformed`);
    const malformedBatch = writeBatch(db);
    malformedBatch.set(malformedCreditRef, {
      creditNoteNumber: 'INV-SENT-CN-BAD',
      invoiceId: 'sent-1',
      invoiceNumber: 'INV-SENT',
      customerId: 'customer-1',
      customerName: 'Customer One',
      date: '2026-07-04',
      amount: 40,
      netAmount: -10,
      taxAmount: 50,
      reason: 'Malformed split',
      status: 'issued',
      createdBy: OWNER,
      createdAt: serverTimestamp(),
    });
    malformedBatch.update(invoiceRef, {
      creditedAmount: 40,
      creditedTaxAmount: 50,
      balanceDue: 60,
      status: 'partial',
      paidAt: null,
      creditNoteCount: 1,
      lastCreditNoteId: 'credit-malformed',
      updatedBy: OWNER,
      updatedAt: serverTimestamp(),
    });
    await assertFails(malformedBatch.commit());

    const creditRef = doc(db, `tenants/${TENANT}/credit_notes/credit-1`);
    const batch = writeBatch(db);
    batch.set(creditRef, {
      creditNoteNumber: 'INV-SENT-CN-01',
      invoiceId: 'sent-1',
      invoiceNumber: 'INV-SENT',
      customerId: 'customer-1',
      customerName: 'Customer One',
      date: '2026-07-04',
      amount: 40,
      netAmount: 36.36,
      taxAmount: 3.64,
      reason: 'Scope reduced',
      status: 'issued',
      createdBy: OWNER,
      createdAt: serverTimestamp(),
    });
    batch.update(invoiceRef, {
      creditedAmount: 40,
      creditedTaxAmount: 3.64,
      balanceDue: 60,
      status: 'partial',
      paidAt: null,
      creditNoteCount: 1,
      lastCreditNoteId: 'credit-1',
      updatedBy: OWNER,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());

    await assertSucceeds(getDoc(doc(viewerDb(), creditRef.path)));
    await assertFails(updateDoc(creditRef, { amount: 1 }));
    await assertFails(deleteDoc(creditRef));
  });

  it('lets money viewers read but never alter invoice records', async () => {
    await assertSucceeds(getDoc(doc(viewerDb(), `tenants/${TENANT}/invoices/sent-1`)));
    await assertFails(updateDoc(doc(viewerDb(), `tenants/${TENANT}/invoices/sent-1`), {
      status: 'paid',
    }));
  });
});
