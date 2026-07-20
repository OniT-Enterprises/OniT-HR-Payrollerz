/**
 * Payroll Service - Firebase Operations
 * Handles CRUD operations for payroll data
 */

import {
  collection,
  doc,
  documentId,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { chunkArray } from '@/lib/utils';
import { normalizeLegacyRecord } from '@/lib/payroll/normalize-legacy';
import { isTenantSubscribed } from '@/lib/packagePricing';
import { addMoney } from '@/lib/currency';
import { auditLogService } from './auditLogService';
import type { AuditContext } from './employeeService';
import type {
  PayrollRun,
  PayrollRecord,
  BenefitEnrollment,
  RecurringDeduction,
  BankTransfer,
  ListPayrollRunsOptions,
} from '@/types/payroll';

export interface EmployeePayrollYTD {
  ytdGrossPay: number;
  ytdNetPay: number;
  ytdIncomeTax: number;
  ytdINSSEmployee: number;
  ytdSickDaysUsed: number;
  /** Subsídio anual (13th month) already paid this year — lets a leaver's
   * final-pay run net the Art. 44 entitlement instead of double-paying. */
  ytdSubsidioAnual: number;
}

// ============================================
// PAYROLL RUNS
// ============================================

/**
 * Thrown when a free (unsubscribed) tenant tries to finalize a payroll run.
 * The UI catches this to send the user to /billing.
 */
export class SubscriptionRequiredError extends Error {
  constructor() {
    super("A subscription is required to finalize payroll");
    this.name = "SubscriptionRequiredError";
  }
}

/**
 * payDate query window wide enough for any plausible pay date of a wage
 * period in `year`. YTD/MTD/final-pay aggregation is keyed on the wage
 * period's civil month/year, but pay dates slip past the period boundary
 * (a December run paid Jan 5), so the payDate-indexed query is widened —
 * one month left, two right — and the precise membership test runs in
 * memory on periodStart/periodEnd.
 */
function yearPayDateWindow(year: number): { start: string; end: string } {
  return { start: `${year - 1}-12-01`, end: `${year + 1}-03-01` };
}

class PayrollRunService {
  private get collectionRef() {
    return collection(db, 'payrollRuns');
  }

  async getAllPayrollRuns(options: ListPayrollRunsOptions = {}): Promise<PayrollRun[]> {
    let q = query(this.collectionRef, orderBy('createdAt', 'desc'));

    if (options.tenantId) {
      q = query(q, where('tenantId', '==', options.tenantId));
    }

    if (options.status) {
      q = query(q, where('status', '==', options.status));
    }

    if (options.limit) {
      q = query(q, limit(options.limit));
    }

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        approvedAt: data.approvedAt?.toDate() || null,
        paidAt: data.paidAt?.toDate() || null,
        rejectedAt: data.rejectedAt?.toDate() || null,
      } as PayrollRun;
    });
  }

  async getPaidPayrollRunsByPayDateRange(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<PayrollRun[]> {
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('status', '==', 'paid'),
      where('payDate', '>=', startDate),
      where('payDate', '<=', endDate),
      orderBy('payDate', 'asc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        approvedAt: data.approvedAt?.toDate() || null,
        paidAt: data.paidAt?.toDate() || null,
        rejectedAt: data.rejectedAt?.toDate() || null,
      } as PayrollRun;
    });
  }

  async getPayrollRunById(id: string): Promise<PayrollRun | null> {
    const docRef = doc(db, 'payrollRuns', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      approvedAt: data.approvedAt?.toDate() || null,
      paidAt: data.paidAt?.toDate() || null,
      rejectedAt: data.rejectedAt?.toDate() || null,
    } as PayrollRun;
  }

  async createPayrollRun(payrollRun: Omit<PayrollRun, 'id'>): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...payrollRun,
      status: payrollRun.status || 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Create a payroll run with its records using Firestore batches.
   * The first batch writes the run doc + up to 498 records (499 ops).
   * Subsequent batches write up to 499 records each.
   *
   * Note: Multi-batch writes are NOT atomic — if batch 2 fails, batch 1 is
   * already committed. This is acceptable because payrolls with 500+ employees
   * are rare in the TL market, and partial state is recoverable.
   */
  async createPayrollRunWithRecords(
    payrollRun: Omit<PayrollRun, 'id'>,
    records: Omit<PayrollRecord, 'id' | 'payrollRunId'>[],
    audit?: AuditContext
  ): Promise<{ runId: string; recordIds: string[] }> {
    const BATCH_LIMIT = 499; // Firestore max 500 ops per batch
    const targetStatus = payrollRun.status || 'draft';
    const runRef = doc(this.collectionRef);
    const runId = runRef.id;
    const recordsCollection = collection(db, 'payrollRecords');
    const recordIds: string[] = [];

    // Step 1: Write the run doc with intermediate status + expected count.
    // If the client disconnects during record batches, this doc is
    // detectable as "stuck" and repairable.
    const firstBatch = writeBatch(db);
    firstBatch.set(runRef, {
      ...payrollRun,
      status: 'writing_records',
      expectedRecordCount: records.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Pack up to 498 records into the first batch (run doc takes 1 slot)
    const firstChunkSize = BATCH_LIMIT - 1;
    const firstChunk = records.slice(0, firstChunkSize);
    const remaining = records.slice(firstChunkSize);

    for (const record of firstChunk) {
      const recordRef = doc(recordsCollection);
      recordIds.push(recordRef.id);
      firstBatch.set(recordRef, {
        ...record,
        payrollRunId: runId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await firstBatch.commit();

    // Step 2: Subsequent batches for remaining records
    // If a batch fails, the run stays in 'writing_records' status and is
    // detectable/repairable via repairStuckRun().
    try {
      const chunks = chunkArray(remaining, BATCH_LIMIT);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const record of chunk) {
          const recordRef = doc(recordsCollection);
          recordIds.push(recordRef.id);
          batch.set(recordRef, {
            ...record,
            payrollRunId: runId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch (batchError) {
      // Run stays in 'writing_records' with expectedRecordCount set,
      // so repairStuckRun() can detect and clean up the partial state.
      console.error(`Payroll batch write failed for run ${runId}. Run is in 'writing_records' state and can be repaired.`, batchError);
      throw batchError;
    }

    // Step 3: All records written — finalize the run with the intended status.
    // This is the "commit point": only runs that reach this update are complete.
    // committedAt marks when the run's records became visible to the MTD-WIT /
    // final-pay aggregations (they count processing+); a draft gets it later,
    // at approval, so staleness checks can compare against it.
    await updateDoc(runRef, {
      status: targetStatus,
      updatedAt: serverTimestamp(),
      ...(targetStatus !== 'draft' ? { committedAt: serverTimestamp() } : {}),
    });

    // Log to audit trail if context provided
    if (audit) {
      const tenantId = payrollRun.tenantId || audit.tenantId;
      if (tenantId) {
        await auditLogService.logPayrollAction({
          ...audit,
          tenantId,
          action: 'payroll.run',
          payrollRunId: runId,
          period: `${payrollRun.periodStart} to ${payrollRun.periodEnd}`,
          metadata: {
            employeeCount: records.length,
            totalGross: records.reduce(
              (sum, record) => addMoney(sum, record.totalGrossPay || 0),
              0,
            ),
            totalNet: records.reduce(
              (sum, record) => addMoney(sum, record.netPay || 0),
              0,
            ),
          },
        }).catch(err => console.error('Audit log failed for run ' + runId + ':', err));
      }
    }

    return { runId, recordIds };
  }

  /**
   * Detect and repair a payroll run stuck in 'writing_records' status.
   * Compares expectedRecordCount to actual records written.
   * - If all records present → finalize to 'processing'.
   * - If records missing → delete orphaned records and the run doc.
   */
  async repairStuckRun(runId: string): Promise<'repaired' | 'deleted'> {
    const run = await this.getPayrollRunById(runId);
    if (!run) throw new Error('Payroll run not found');
    if (run.status !== 'writing_records') {
      throw new Error(`Run is not stuck (status: ${run.status})`);
    }

    const records = await payrollRecordService.getPayrollRecordsByRunId(runId, run.tenantId);
    const expected = run.expectedRecordCount ?? 0;

    if (records.length >= expected && expected > 0) {
      // All records made it — finalize the run
      const runRef = doc(db, 'payrollRuns', runId);
      await updateDoc(runRef, {
        status: 'processing',
        updatedAt: serverTimestamp(),
      });
      return 'repaired';
    }

    // Incomplete — clean up orphaned records and the run
    await payrollRecordService.deletePayrollRecordsByRunId(runId);
    const runRef = doc(db, 'payrollRuns', runId);
    await deleteDoc(runRef);
    return 'deleted';
  }

  async updatePayrollRun(id: string, updates: Partial<PayrollRun>): Promise<boolean> {
    const docRef = doc(db, 'payrollRuns', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Throw if any run was committed after this draft was saved in a scope that
   * overlaps its figures: the same period month always (the runs share the
   * monthly $500 WIT threshold), widened to the same period year when the
   * draft carries once-only final-pay lines (Art. 56 severance / Art. 44
   * subsidio, deduped per year). Commit time is committedAt where stamped,
   * falling back to approvedAt/createdAt for runs predating the stamp —
   * approvedAt can over-block a legacy processing-then-approved run, which
   * only costs the approver a re-run, never a double payment.
   */
  private async assertDraftFiguresFresh(
    tenantId: string,
    draftRunId: string,
    draft: PayrollRun,
  ): Promise<void> {
    const draftSavedAt =
      draft.createdAt instanceof Date ? draft.createdAt.getTime() : 0;
    const periodMonth = (draft.periodStart || draft.payDate || '').slice(0, 7);
    if (!draftSavedAt || periodMonth.length !== 7) return;

    const records = await payrollRecordService.getPayrollRecordsByRunId(draftRunId, tenantId);
    const hasFinalPay = records.some((record) =>
      record.earnings?.some(
        (earning) =>
          earning.type === 'service_compensation' || earning.type === 'subsidio_anual',
      ),
    );

    const year = Number.parseInt(periodMonth.slice(0, 4), 10);
    const window = yearPayDateWindow(year);
    const runsSnapshot = await getDocs(query(
      collection(db, 'payrollRuns'),
      where('tenantId', '==', tenantId),
      where('status', 'in', ['processing', 'approved', 'paid']),
      where('payDate', '>=', window.start),
      where('payDate', '<=', window.end),
    ));
    const stale = runsSnapshot.docs.some((runDoc) => {
      if (runDoc.id === draftRunId) return false;
      const data = runDoc.data() as {
        periodStart?: string;
        payDate?: string;
        committedAt?: { toDate?: () => Date };
        approvedAt?: { toDate?: () => Date };
        createdAt?: { toDate?: () => Date };
      };
      const period = data.periodStart || data.payDate || '';
      const scopeMatch = hasFinalPay
        ? period.slice(0, 4) === String(year)
        : period.slice(0, 7) === periodMonth;
      if (!scopeMatch) return false;
      const committed =
        data.committedAt?.toDate?.() ??
        data.approvedAt?.toDate?.() ??
        data.createdAt?.toDate?.();
      return committed ? committed.getTime() > draftSavedAt : false;
    });
    if (stale) {
      throw new Error(
        'Another payroll run for this period was finalized after this draft was saved, ' +
        'so its tax-exemption and final-pay figures may be stale. Reject this draft and ' +
        'run payroll again to recalculate.',
      );
    }
  }

  async approvePayrollRun(
    id: string,
    approvedBy: string,
    audit?: AuditContext,
    options?: { allowSelfApproval?: boolean }
  ): Promise<boolean> {
    const payroll = await this.getPayrollRunById(id);
    if (!payroll) {
      throw new Error('Payroll run not found');
    }
    if (payroll.status === 'approved' || payroll.status === 'paid' || payroll.status === 'cancelled') {
      throw new Error(`Cannot approve payroll run in status "${payroll.status}"`);
    }
    if (payroll.status !== 'draft' && payroll.status !== 'processing') {
      throw new Error(`Payroll run must be draft/processing before approval (current: ${payroll.status})`);
    }

    // Paywall: finalizing a payroll run requires an active subscription. Every
    // other feature is free; this is the single monetization gate.
    const tenantId = payroll.tenantId || audit?.tenantId;
    if (tenantId) {
      const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
      if (!isTenantSubscribed((tenantSnap.data() ?? {}) as Parameters<typeof isTenantSubscribed>[0])) {
        throw new SubscriptionRequiredError();
      }
    }

    // Two-person rule: approver must differ from creator, unless the tenant
    // opted in to solo self-approval (also enforced in firestore.rules)
    const isSelfApproval = payroll.createdBy === approvedBy;
    if (isSelfApproval && !options?.allowSelfApproval) {
      throw new Error('Payroll cannot be approved by the same person who created it');
    }

    // A draft's records were computed against the runs committed at SAVE time.
    // The MTD-WIT ($500/employee-month) and once-only final-pay aggregations
    // ignore drafts, so any run committed since then invalidates this draft's
    // figures — approving it unchanged would double an exemption or a
    // severance/13th-month payment. Force a re-run instead of a silent recompute.
    if (payroll.status === 'draft' && tenantId) {
      await this.assertDraftFiguresFresh(tenantId, id, payroll);
    }

    // Atomic status transition: the pre-checks above read a snapshot, but two
    // approvers (or two tabs) could both pass them and both write 'approved',
    // double-posting the payroll journal downstream. The transaction re-reads
    // the doc and asserts it is still pre-approval, so exactly one approval
    // wins — Firestore retries the loser, which then sees 'approved' and
    // throws. Mirrored by a status precondition in firestore.rules.
    const docRef = doc(db, 'payrollRuns', id);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        throw new Error('Payroll run not found');
      }
      const current = snap.data().status;
      if (current === 'approved' || current === 'paid') {
        throw new Error('Payroll run has already been approved');
      }
      if (current !== 'draft' && current !== 'processing') {
        throw new Error(`Payroll run must be draft/processing before approval (current: ${current})`);
      }
      transaction.update(docRef, {
        status: 'approved',
        approvedBy,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // A draft's records join the MTD/final-pay aggregations at approval;
        // a processing run already carries its creation-time stamp.
        ...(snap.data().committedAt ? {} : { committedAt: serverTimestamp() }),
      });
    });

    // Log to audit trail if context provided
    if (audit) {
      const tenantId = payroll.tenantId || audit.tenantId;
      if (tenantId) {
        await auditLogService.logPayrollAction({
          ...audit,
          tenantId,
          action: 'payroll.approve',
          payrollRunId: id,
          period: `${payroll.periodStart} to ${payroll.periodEnd}`,
          metadata: {
            totalGross: payroll.totalGrossPay,
            totalNet: payroll.totalNetPay,
            employeeCount: payroll.employeeCount,
            selfApproved: isSelfApproval,
          },
        }).catch(err => console.error('Audit log failed:', err));
      }
    }

    return true;
  }

  async rejectPayrollRun(
    id: string,
    rejectedBy: string,
    reason: string,
    audit?: AuditContext
  ): Promise<boolean> {
    const payroll = await this.getPayrollRunById(id);
    if (!payroll) {
      throw new Error('Payroll run not found');
    }
    if (payroll.status !== 'processing') {
      throw new Error(`Only processing payroll runs can be rejected (current: ${payroll.status})`);
    }

    // Atomic status transition. The pre-check above reads a snapshot, but a
    // concurrent approval could move the run processing -> approved (and post
    // its GL journal) between that read and this write. A plain updateDoc would
    // then stamp 'rejected' over an already-approved, already-posted run — wages
    // on the books for a run the state machine now refuses to re-approve. The
    // transaction re-reads and rejects ONLY while still 'processing'.
    const docRef = doc(db, 'payrollRuns', id);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        throw new Error('Payroll run not found');
      }
      const current = snap.data().status;
      if (current !== 'processing') {
        throw new Error(`Only processing payroll runs can be rejected (current: ${current})`);
      }
      transaction.update(docRef, {
        status: 'rejected',
        rejectedBy,
        rejectedAt: serverTimestamp(),
        rejectionReason: reason,
        updatedAt: serverTimestamp(),
      });
    });

    if (audit) {
      const tenantId = payroll.tenantId || audit.tenantId;
      if (tenantId) {
        await auditLogService.logPayrollAction({
          ...audit,
          tenantId,
          action: 'payroll.reject',
          payrollRunId: id,
          period: `${payroll.periodStart} to ${payroll.periodEnd}`,
          metadata: {
            rejectedBy,
            reason,
          },
        }).catch(err => console.error('Audit log failed:', err));
      }
    }

    return true;
  }

  async markPayrollRunAsPaid(id: string): Promise<boolean> {
    // NOTE (accounting follow-up): this only flips status. It does NOT post a
    // settlement journal (Dr Salaries Payable 2210 / Cr bank), so book cash is
    // not reduced for the net wage disbursement and 2210 accrues across runs.
    // The correct fix is a dedicated payroll-disbursement posting that mirrors
    // createFromSupplierWithholdingRemittance — it must capture WHICH bank
    // account paid and a payment reference (a tenant may have several banks),
    // so it can't be auto-derived here without risking a wrong-account credit.
    // WIT/INSS payables (2220/2230/2240) intentionally persist until remitted.
    const payroll = await this.getPayrollRunById(id);
    if (!payroll) {
      throw new Error('Payroll run not found');
    }
    if (payroll.status !== 'approved') {
      throw new Error(`Only approved payroll runs can be marked paid (current: ${payroll.status})`);
    }

    const docRef = doc(db, 'payrollRuns', id);
    await updateDoc(docRef, {
      status: 'paid',
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async cancelPayrollRun(id: string): Promise<boolean> {
    const payroll = await this.getPayrollRunById(id);
    if (!payroll) {
      throw new Error('Payroll run not found');
    }
    if (payroll.status === 'paid') {
      throw new Error('Cannot cancel a paid payroll run');
    }
    if (payroll.status === 'cancelled') {
      return true;
    }

    const docRef = doc(db, 'payrollRuns', id);
    await updateDoc(docRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async deletePayrollRun(id: string): Promise<boolean> {
    // Only allow deleting draft payrolls
    const payroll = await this.getPayrollRunById(id);
    if (!payroll || payroll.status !== 'draft') {
      throw new Error('Can only delete draft payroll runs');
    }

    const docRef = doc(db, 'payrollRuns', id);
    await deleteDoc(docRef);
    return true;
  }

  async getRecentPayrollRuns(tenantId: string, count: number = 5): Promise<PayrollRun[]> {
    // tenantId is required — payrollRuns list rules are tenant-scoped, so a
    // query without it is denied once any run exists.
    return this.getAllPayrollRuns({ tenantId, limit: count });
  }

  async getPayrollRunsByDateRange(tenantId: string, startDate: string, endDate: string): Promise<PayrollRun[]> {
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('periodStart', '>=', startDate),
      where('periodEnd', '<=', endDate),
      orderBy('periodStart', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as PayrollRun;
    });
  }
}

// ============================================
// PAYROLL RECORDS
// ============================================

class PayrollRecordService {
  private get collectionRef() {
    return collection(db, 'payrollRecords');
  }

  async getPayrollRecordsByRunId(payrollRunId: string, tenantId?: string): Promise<PayrollRecord[]> {
    const q = query(
      this.collectionRef,
      where('payrollRunId', '==', payrollRunId),
      ...(tenantId ? [where('tenantId', '==', tenantId)] : []),
      orderBy('employeeName', 'asc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = normalizeLegacyRecord({ ...doc.data() });
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as PayrollRecord;
    });
  }

  async getPayrollRecordById(id: string): Promise<PayrollRecord | null> {
    const docRef = doc(db, 'payrollRecords', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = normalizeLegacyRecord({ ...docSnap.data() });
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as PayrollRecord;
  }

  async createPayrollRecord(record: Omit<PayrollRecord, 'id'>): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...record,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async createPayrollRecordsBatch(records: Omit<PayrollRecord, 'id'>[]): Promise<string[]> {
    const BATCH_LIMIT = 499;
    const ids: string[] = [];
    const chunks = chunkArray(records, BATCH_LIMIT);

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const record of chunk) {
        const docRef = doc(this.collectionRef);
        ids.push(docRef.id);
        batch.set(docRef, {
          ...record,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    return ids;
  }

  async updatePayrollRecord(id: string, updates: Partial<PayrollRecord>): Promise<boolean> {
    const docRef = doc(db, 'payrollRecords', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async deletePayrollRecordsByRunId(payrollRunId: string): Promise<boolean> {
    const records = await this.getPayrollRecordsByRunId(payrollRunId);
    const BATCH_LIMIT = 499;
    const chunks = chunkArray(records, BATCH_LIMIT);

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const record of chunk) {
        if (record.id) {
          batch.delete(doc(db, 'payrollRecords', record.id));
        }
      }
      await batch.commit();
    }
    return true;
  }

  async getEmployeePayrollHistory(tenantId: string, employeeId: string, limitCount: number = 12): Promise<PayrollRecord[]> {
    // tenantId is required — payrollRecords list rules are tenant-scoped.
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = normalizeLegacyRecord({ ...doc.data() });
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as PayrollRecord;
    });
  }

  async getEmployeeYTDTotals(tenantId: string, employeeId: string, year: number): Promise<{
    ytdGrossPay: number;
    ytdNetPay: number;
    ytdIncomeTax: number;
    ytdINSSEmployee: number;
  }> {
    const records = await this.getEmployeePayrollHistory(tenantId, employeeId, 500);
    const runIds = Array.from(new Set(records.map((r) => r.payrollRunId).filter(Boolean)));
    const runYears = new Map<string, number>();

    await Promise.all(
      chunkArray(runIds, 10).map(async (runIdChunk) => {
        const runsQuery = query(
          collection(db, 'payrollRuns'),
          where(documentId(), 'in', runIdChunk)
        );
        const runsSnapshot = await getDocs(runsQuery);

        runsSnapshot.forEach((doc) => {
          const payDate = doc.data().payDate as string | undefined;
          if (payDate) {
            runYears.set(doc.id, parseInt(payDate.substring(0, 4), 10));
          }
        });
      })
    );

    const ytdRecords = records.filter((record) => {
      const fromRun = record.payrollRunId ? runYears.get(record.payrollRunId) : undefined;
      if (typeof fromRun === 'number') {
        return fromRun === year;
      }
      const createdAt = record.createdAt instanceof Date ? record.createdAt : new Date(String(record.createdAt));
      return createdAt.getFullYear() === year;
    });

    const totals = ytdRecords.reduce(
      (acc, record) => ({
        ytdGrossPay: addMoney(acc.ytdGrossPay, record.totalGrossPay),
        ytdNetPay: addMoney(acc.ytdNetPay, record.netPay),
        ytdIncomeTax: addMoney(
          acc.ytdIncomeTax,
          record.deductions?.find((deduction) => deduction.type === 'income_tax')?.amount || 0,
        ),
        ytdINSSEmployee: addMoney(
          acc.ytdINSSEmployee,
          record.deductions?.find((deduction) => deduction.type === 'inss_employee')?.amount || 0,
        ),
      }),
      {
        ytdGrossPay: 0,
        ytdNetPay: 0,
        ytdIncomeTax: 0,
        ytdINSSEmployee: 0,
      }
    );

    return totals;
  }

  /**
   * Run ids whose pay PERIOD matches `belongs`, queried through the existing
   * (tenantId, status, payDate) composite. YTD/MTD/final-pay aggregation is
   * keyed on the wage period's civil month/year, but pay dates slip past the
   * period boundary (a December run paid Jan 5), so the payDate query window
   * is widened — one month left, two right — and the precise membership test
   * runs in memory on periodStart/periodEnd. Runs without periodStart
   * (legacy) fall back to payDate membership via `belongs`.
   */
  private async getRunIdsByPeriod(
    tenantId: string,
    statuses: PayrollRun['status'][],
    payDateWindow: { start: string; end: string },
    belongs: (run: { periodStart?: string; periodEnd?: string; payDate?: string }) => boolean,
  ): Promise<string[]> {
    const runsSnapshot = await getDocs(query(
      collection(db, 'payrollRuns'),
      where('tenantId', '==', tenantId),
      where('status', 'in', statuses),
      where('payDate', '>=', payDateWindow.start),
      where('payDate', '<=', payDateWindow.end),
    ));
    return runsSnapshot.docs
      .filter((runDoc) => belongs(runDoc.data() as {
        periodStart?: string; periodEnd?: string; payDate?: string;
      }))
      .map((runDoc) => runDoc.id);
  }

  /** Aggregate current-period values from paid records; never re-sum YTD snapshots. */
  async getTenantYTDTotals(
    tenantId: string,
    year: number,
  ): Promise<Record<string, EmployeePayrollYTD>> {
    const yearStr = String(year);
    const runIds = await this.getRunIdsByPeriod(
      tenantId,
      ['paid'],
      yearPayDateWindow(year),
      // YTD follows the wage period's civil year (matches the hook's
      // period-year keying), not the year the money happened to move.
      (run) => (run.periodStart || run.payDate || '').slice(0, 4) === yearStr,
    );
    const totals: Record<string, EmployeePayrollYTD> = {};

    for (const runIdChunk of chunkArray(runIds, 10)) {
      if (runIdChunk.length === 0) continue;
      // The tenantId filter is required, not just a nicety: payrollRecords `list`
      // rules are tenant-scoped, so a query without it is denied the moment any
      // record exists (it silently succeeds only while the collection is empty,
      // i.e. before a tenant's first paid run). Keep it in sync with the
      // required tenantId field on every top-level tenant-keyed collection.
      const recordsSnapshot = await getDocs(query(
        this.collectionRef,
        where('tenantId', '==', tenantId),
        where('payrollRunId', 'in', runIdChunk),
      ));

      for (const recordDoc of recordsSnapshot.docs) {
        const record = normalizeLegacyRecord({ ...recordDoc.data() }) as PayrollRecord;
        if (!record.employeeId) continue;
        const current = totals[record.employeeId] || {
          ytdGrossPay: 0,
          ytdNetPay: 0,
          ytdIncomeTax: 0,
          ytdINSSEmployee: 0,
          ytdSickDaysUsed: 0,
          ytdSubsidioAnual: 0,
        };
        totals[record.employeeId] = {
          ytdGrossPay: addMoney(current.ytdGrossPay, record.totalGrossPay || 0),
          ytdNetPay: addMoney(current.ytdNetPay, record.netPay || 0),
          ytdIncomeTax: addMoney(
            current.ytdIncomeTax,
            record.deductions?.find((deduction) => deduction.type === 'income_tax')?.amount || 0,
          ),
          ytdINSSEmployee: addMoney(
            current.ytdINSSEmployee,
            record.deductions?.find((deduction) => deduction.type === 'inss_employee')?.amount || 0,
          ),
          ytdSickDaysUsed: current.ytdSickDaysUsed + ((record.sickHoursUsed || 0) / 8),
          ytdSubsidioAnual: addMoney(
            current.ytdSubsidioAnual,
            record.earnings?.find((earning) => earning.type === 'subsidio_anual')?.amount || 0,
          ),
        };
      }
    }

    return totals;
  }

  /**
   * Final-pay amounts already COMMITTED for each employee this year, used to
   * make a leaver's Art. 56 severance and Art. 44 subsidio pay exactly once.
   * Unlike getTenantYTDTotals (paid-only, for reporting), this includes every
   * run that has real persisted records and will be paid — 'processing',
   * 'approved', 'paid' — but NOT 'draft'/'writing_records' (may be discarded
   * or partial) nor 'cancelled'/'rejected'. The run currently being built is
   * an unsaved draft, so it is never counted. Covered by the existing
   * (tenantId, status, payDate) composite index.
   */
  async getCommittedFinalPayByEmployee(
    tenantId: string,
    year: number,
  ): Promise<Record<string, { serviceCompensation: number; subsidioAnual: number }>> {
    const yearStr = String(year);
    const runIds = await this.getRunIdsByPeriod(
      tenantId,
      ['processing', 'approved', 'paid'],
      yearPayDateWindow(year),
      // Dedup is conservative: a period touching the year at EITHER end counts,
      // so a New-Year-spanning weekly final run is found from both years.
      (run) =>
        (run.periodStart || run.payDate || '').slice(0, 4) === yearStr ||
        (run.periodEnd || '').slice(0, 4) === yearStr,
    );
    const totals: Record<string, { serviceCompensation: number; subsidioAnual: number }> = {};

    for (const runIdChunk of chunkArray(runIds, 10)) {
      if (runIdChunk.length === 0) continue;
      // tenantId filter is load-bearing — see getTenantYTDTotals.
      const recordsSnapshot = await getDocs(query(
        this.collectionRef,
        where('tenantId', '==', tenantId),
        where('payrollRunId', 'in', runIdChunk),
      ));
      for (const recordDoc of recordsSnapshot.docs) {
        const record = normalizeLegacyRecord({ ...recordDoc.data() }) as PayrollRecord;
        if (!record.employeeId) continue;
        const current = totals[record.employeeId] || { serviceCompensation: 0, subsidioAnual: 0 };
        totals[record.employeeId] = {
          serviceCompensation: addMoney(
            current.serviceCompensation,
            record.earnings?.find((e) => e.type === 'service_compensation')?.amount || 0,
          ),
          subsidioAnual: addMoney(
            current.subsidioAnual,
            record.earnings?.find((e) => e.type === 'subsidio_anual')?.amount || 0,
          ),
        };
      }
    }

    return totals;
  }

  /**
   * Per-employee WIT already assessed this CALENDAR MONTH (by pay-period month),
   * so a new monthly run applies the resident $500/month exemption against the
   * remaining threshold instead of granting a fresh one. Counts committed runs
   * only (processing/approved/paid) — the draft being built is excluded. Keyed
   * on `periodStart`'s YYYY-MM so a regular run and a same-month top-up run
   * (e.g. a standalone 13th-month run) share one monthly threshold.
   *
   * `mtdWitTaxableIncome` is pre-threshold taxable income; `mtdIncomeTax` is WIT
   * withheld — both are what calculateIncomeTaxWithBase's monthToDate expects.
   */
  async getMonthToDateWITByEmployee(
    tenantId: string,
    periodMonth: string, // 'YYYY-MM'
  ): Promise<Record<string, { mtdWitTaxableIncome: number; mtdIncomeTax: number }>> {
    // Bucket by the pay-PERIOD month, not the pay date: a December salary run and
    // a December 13th-month run belong to the same WIT month even if paid in
    // January — which is exactly why the payDate window must straddle the
    // period month rather than stop at its calendar year.
    const year = Number.parseInt(periodMonth.slice(0, 4), 10);
    const month = Number.parseInt(periodMonth.slice(5, 7), 10);
    const isoDay = (d: Date) => d.toISOString().slice(0, 10);
    const runIds = await this.getRunIdsByPeriod(
      tenantId,
      ['processing', 'approved', 'paid'],
      {
        start: isoDay(new Date(Date.UTC(year, month - 2, 1))),
        end: isoDay(new Date(Date.UTC(year, month + 2, 0))),
      },
      (run) => (run.periodStart || run.payDate || '').slice(0, 7) === periodMonth,
    );
    const totals: Record<string, { mtdWitTaxableIncome: number; mtdIncomeTax: number }> = {};

    for (const runIdChunk of chunkArray(runIds, 10)) {
      if (runIdChunk.length === 0) continue;
      // tenantId filter is load-bearing — see getTenantYTDTotals.
      const recordsSnapshot = await getDocs(query(
        this.collectionRef,
        where('tenantId', '==', tenantId),
        where('payrollRunId', 'in', runIdChunk),
      ));
      for (const recordDoc of recordsSnapshot.docs) {
        const record = normalizeLegacyRecord({ ...recordDoc.data() }) as PayrollRecord;
        if (!record.employeeId) continue;
        const current = totals[record.employeeId] || {
          mtdWitTaxableIncome: 0,
          mtdIncomeTax: 0,
        };
        // Records written before taxableIncome existed would contribute 0
        // income while their WIT still lands in mtdIncomeTax, which makes the
        // engine's monthToDate gate treat the month as untouched and re-grant
        // the full $500. Gross pay is the closest available proxy for their
        // pre-threshold taxable income (it can only overstate, i.e. lean
        // toward slight over-withholding, never a duplicate exemption).
        const taxableIncome =
          typeof record.taxableIncome === 'number'
            ? record.taxableIncome
            : record.totalGrossPay || 0;
        totals[record.employeeId] = {
          mtdWitTaxableIncome: addMoney(
            current.mtdWitTaxableIncome,
            taxableIncome,
          ),
          mtdIncomeTax: addMoney(
            current.mtdIncomeTax,
            record.deductions?.find((d) => d.type === 'income_tax')?.amount || 0,
          ),
        };
      }
    }

    return totals;
  }
}

// ============================================
// BENEFIT ENROLLMENTS
// ============================================

class BenefitEnrollmentService {
  private get collectionRef() {
    return collection(db, 'benefitEnrollments');
  }

  async getEnrollmentsByEmployeeId(tenantId: string, employeeId: string): Promise<BenefitEnrollment[]> {
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('employeeId', '==', employeeId),
      where('status', '==', 'active')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as BenefitEnrollment;
    });
  }

  async getAllEnrollments(tenantId: string): Promise<BenefitEnrollment[]> {
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as BenefitEnrollment;
    });
  }

  async createEnrollment(
    tenantId: string,
    enrollment: Omit<BenefitEnrollment, 'id' | 'tenantId'>
  ): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...enrollment,
      tenantId,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateEnrollment(id: string, updates: Partial<BenefitEnrollment>): Promise<boolean> {
    const docRef = doc(db, 'benefitEnrollments', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async terminateEnrollment(id: string, terminationDate: string): Promise<boolean> {
    const docRef = doc(db, 'benefitEnrollments', id);
    await updateDoc(docRef, {
      status: 'terminated',
      terminationDate,
      updatedAt: serverTimestamp(),
    });
    return true;
  }
}

// ============================================
// RECURRING DEDUCTIONS
// ============================================

class RecurringDeductionService {
  private get collectionRef() {
    return collection(db, 'recurringDeductions');
  }

  async getDeductionsByEmployeeId(tenantId: string, employeeId: string): Promise<RecurringDeduction[]> {
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('employeeId', '==', employeeId),
      where('status', '==', 'active')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as RecurringDeduction;
    });
  }

  async getAllDeductions(tenantId: string): Promise<RecurringDeduction[]> {
    const q = query(this.collectionRef, where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as RecurringDeduction;
    });
  }

  async createDeduction(
    tenantId: string,
    deduction: Omit<RecurringDeduction, 'id' | 'tenantId'>
  ): Promise<string> {
    // Remove undefined values - Firestore doesn't accept them
    const cleanedDeduction = Object.fromEntries(
      Object.entries(deduction).filter(([_, v]) => v !== undefined)
    );

    const docRef = await addDoc(this.collectionRef, {
      ...cleanedDeduction,
      tenantId,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateDeduction(id: string, updates: Partial<RecurringDeduction>): Promise<boolean> {
    // Remove undefined values - Firestore doesn't accept them
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    const docRef = doc(db, 'recurringDeductions', id);
    await updateDoc(docRef, {
      ...cleanedUpdates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async pauseDeduction(id: string): Promise<boolean> {
    return this.updateDeduction(id, { status: 'paused' });
  }

  async completeDeduction(id: string): Promise<boolean> {
    return this.updateDeduction(id, { status: 'completed' });
  }

  async deleteDeduction(id: string): Promise<boolean> {
    const docRef = doc(db, 'recurringDeductions', id);
    await deleteDoc(docRef);
    return true;
  }
}

// ============================================
// BANK TRANSFERS (extends existing functionality)
// ============================================

class BankTransferService {
  private get collectionRef() {
    return collection(db, 'bankTransfers');
  }

  async getAllTransfers(tenantId: string): Promise<BankTransfer[]> {
    const q = query(this.collectionRef, where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        completedAt: data.completedAt?.toDate() || null,
      } as BankTransfer;
    });
  }

  async createTransfer(
    tenantId: string,
    transfer: Omit<BankTransfer, 'id' | 'tenantId'>
  ): Promise<string> {
    // Older releases used random document IDs, so check those records before
    // claiming the canonical tenant/run ID used by current clients.
    const tenantTransfers = await getDocs(
      query(this.collectionRef, where('tenantId', '==', tenantId)),
    );
    if (
      tenantTransfers.docs.some(
        (snapshot) => snapshot.data().payrollRunId === transfer.payrollRunId,
      )
    ) {
      throw new Error('A bank transfer already exists for this payroll run');
    }

    const transferRef = doc(
      this.collectionRef,
      `${tenantId}__${transfer.payrollRunId}`,
    );
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(transferRef);
      if (existing.exists()) {
        throw new Error('A bank transfer already exists for this payroll run');
      }
      transaction.set(transferRef, {
        ...transfer,
        tenantId,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return transferRef.id;
  }

  async updateTransferStatus(
    id: string,
    status: BankTransfer['status'],
    errorMessage?: string
  ): Promise<boolean> {
    const updates: Partial<BankTransfer> = {
      status,
      updatedAt: serverTimestamp(),
    };

    if (status === 'completed') {
      updates.completedAt = serverTimestamp();
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    const docRef = doc(db, 'bankTransfers', id);
    await updateDoc(docRef, updates);
    return true;
  }
}

// ============================================
// EXPORT SERVICE INSTANCES
// ============================================

const payrollRunService = new PayrollRunService();
const payrollRecordService = new PayrollRecordService();
const benefitEnrollmentService = new BenefitEnrollmentService();
const recurringDeductionService = new RecurringDeductionService();
const bankTransferService = new BankTransferService();

// Combined export for convenience
export const payrollService = {
  runs: payrollRunService,
  records: payrollRecordService,
  benefits: benefitEnrollmentService,
  deductions: recurringDeductionService,
  transfers: bankTransferService,
};
