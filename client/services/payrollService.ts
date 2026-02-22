/**
 * Payroll Service - Firebase Operations
 * Handles CRUD operations for payroll data
 */

import {
  collection,
  doc,
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTodayTL } from '@/lib/dateUtils';
import { chunkArray } from '@/lib/utils';
import { auditLogService } from './auditLogService';
import type { AuditContext } from './employeeService';
import type {
  PayrollRun,
  PayrollRecord,
  BenefitEnrollment,
  RecurringDeduction,
  TaxReport,
  BankTransfer,
  ListPayrollRunsOptions,
} from '@/types/payroll';

// ============================================
// PAYROLL RUNS
// ============================================

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

    // Step 3: All records written — finalize the run with the intended status.
    // This is the "commit point": only runs that reach this update are complete.
    await updateDoc(runRef, {
      status: targetStatus,
      updatedAt: serverTimestamp(),
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
            totalGross: records.reduce((sum, r) => sum + (r.totalGrossPay || 0), 0),
            totalNet: records.reduce((sum, r) => sum + (r.netPay || 0), 0),
          },
        }).catch(err => console.error('Audit log failed:', err));
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

  async approvePayrollRun(
    id: string,
    approvedBy: string,
    audit?: AuditContext
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

    // Two-person rule: approver must differ from creator
    if (payroll.createdBy === approvedBy) {
      throw new Error('Payroll cannot be approved by the same person who created it');
    }

    const docRef = doc(db, 'payrollRuns', id);
    await updateDoc(docRef, {
      status: 'approved',
      approvedBy,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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

    const docRef = doc(db, 'payrollRuns', id);
    await updateDoc(docRef, {
      status: 'rejected',
      rejectedBy,
      rejectedAt: serverTimestamp(),
      rejectionReason: reason,
      updatedAt: serverTimestamp(),
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

  async getRecentPayrollRuns(count: number = 5): Promise<PayrollRun[]> {
    return this.getAllPayrollRuns({ limit: count });
  }

  async getPayrollRunsByDateRange(startDate: string, endDate: string): Promise<PayrollRun[]> {
    const q = query(
      this.collectionRef,
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
      const data = doc.data();
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

    const data = docSnap.data();
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

  async getEmployeePayrollHistory(employeeId: string, limitCount: number = 12): Promise<PayrollRecord[]> {
    const q = query(
      this.collectionRef,
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as PayrollRecord;
    });
  }

  async getEmployeeYTDTotals(employeeId: string, year: number): Promise<{
    ytdGrossPay: number;
    ytdNetPay: number;
    ytdFederalTax: number;
    ytdStateTax: number;
    ytdSocialSecurity: number;
    ytdMedicare: number;
  }> {
    const records = await this.getEmployeePayrollHistory(employeeId, 500);
    const runIds = Array.from(new Set(records.map((r) => r.payrollRunId).filter(Boolean)));
    const runYears = new Map<string, number>();

    await Promise.all(
      runIds.map(async (runId) => {
        const run = await payrollRunService.getPayrollRunById(runId);
        if (run?.payDate) {
          runYears.set(runId, parseInt(run.payDate.substring(0, 4), 10));
        }
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
        ytdGrossPay: acc.ytdGrossPay + record.totalGrossPay,
        ytdNetPay: acc.ytdNetPay + record.netPay,
        ytdFederalTax: acc.ytdFederalTax + (record.ytdFederalTax || 0),
        ytdStateTax: acc.ytdStateTax + (record.ytdStateTax || 0),
        ytdSocialSecurity: acc.ytdSocialSecurity + (record.ytdSocialSecurity || 0),
        ytdMedicare: acc.ytdMedicare + (record.ytdMedicare || 0),
      }),
      {
        ytdGrossPay: 0,
        ytdNetPay: 0,
        ytdFederalTax: 0,
        ytdStateTax: 0,
        ytdSocialSecurity: 0,
        ytdMedicare: 0,
      }
    );

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
// TAX REPORTS
// ============================================

class TaxReportService {
  private get collectionRef() {
    return collection(db, 'taxReports');
  }

  async getAllTaxReports(tenantId: string, maxResults: number = 500): Promise<TaxReport[]> {
    const q = query(this.collectionRef, where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'), limit(maxResults));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as TaxReport;
    });
  }

  async getTaxReportsByYear(tenantId: string, year: number): Promise<TaxReport[]> {
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('year', '==', year),
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
      } as TaxReport;
    });
  }

  async createTaxReport(tenantId: string, report: Omit<TaxReport, 'id' | 'tenantId'>): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...report,
      tenantId,
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateTaxReport(id: string, updates: Partial<TaxReport>): Promise<boolean> {
    const docRef = doc(db, 'taxReports', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async markAsGenerated(id: string): Promise<boolean> {
    return this.updateTaxReport(id, { status: 'generated' });
  }

  async markAsFiled(id: string, confirmationNumber: string): Promise<boolean> {
    return this.updateTaxReport(id, {
      status: 'filed',
      filedDate: getTodayTL(),
      confirmationNumber,
    });
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
    const docRef = await addDoc(this.collectionRef, {
      ...transfer,
      tenantId,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
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
const taxReportService = new TaxReportService();
const bankTransferService = new BankTransferService();

// Combined export for convenience
export const payrollService = {
  runs: payrollRunService,
  records: payrollRecordService,
  benefits: benefitEnrollmentService,
  deductions: recurringDeductionService,
  taxReports: taxReportService,
  transfers: bankTransferService,
};
