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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auditLogService } from './auditLogService';
import type { AuditContext } from './employeeService';
import type {
  PayrollRun,
  PayrollRecord,
  PayrollStatus,
  BenefitEnrollment,
  RecurringDeduction,
  TaxReport,
  BankTransfer,
  ListPayrollRunsOptions,
  ListPayrollRecordsOptions,
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
   * Create a payroll run with its records atomically using a Firestore batch.
   * This prevents corrupt state if the browser crashes mid-operation.
   * Either all writes succeed or none do.
   */
  async createPayrollRunWithRecords(
    payrollRun: Omit<PayrollRun, 'id'>,
    records: Omit<PayrollRecord, 'id' | 'payrollRunId'>[],
    audit?: AuditContext
  ): Promise<{ runId: string; recordIds: string[] }> {
    const batch = writeBatch(db);

    // Create the payroll run document
    const runRef = doc(this.collectionRef);
    const runId = runRef.id;

    batch.set(runRef, {
      ...payrollRun,
      status: payrollRun.status || 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create all payroll records with reference to the run
    const recordIds: string[] = [];
    const recordsCollection = collection(db, 'payrollRecords');

    for (const record of records) {
      const recordRef = doc(recordsCollection);
      recordIds.push(recordRef.id);
      batch.set(recordRef, {
        ...record,
        payrollRunId: runId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Atomic commit - all or nothing
    await batch.commit();

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
    // Get payroll info for audit
    const payroll = audit ? await this.getPayrollRunById(id) : null;

    const docRef = doc(db, 'payrollRuns', id);
    await updateDoc(docRef, {
      status: 'approved',
      approvedBy,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log to audit trail if context provided
    if (audit && payroll) {
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

  async markPayrollRunAsPaid(id: string): Promise<boolean> {
    const docRef = doc(db, 'payrollRuns', id);
    await updateDoc(docRef, {
      status: 'paid',
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async cancelPayrollRun(id: string): Promise<boolean> {
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
    const batch = writeBatch(db);
    const ids: string[] = [];

    for (const record of records) {
      const docRef = doc(this.collectionRef);
      ids.push(docRef.id);
      batch.set(docRef, {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
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
    const batch = writeBatch(db);

    for (const record of records) {
      if (record.id) {
        batch.delete(doc(db, 'payrollRecords', record.id));
      }
    }

    await batch.commit();
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
    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    const records = await this.getEmployeePayrollHistory(employeeId, 100);

    // Filter to current year and sum up totals
    const ytdRecords = records.filter((r) => {
      // Assuming we have the payroll run period info
      return true; // Simplified - would check against period dates
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
    const docRef = await addDoc(this.collectionRef, {
      ...deduction,
      tenantId,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateDeduction(id: string, updates: Partial<RecurringDeduction>): Promise<boolean> {
    const docRef = doc(db, 'recurringDeductions', id);
    await updateDoc(docRef, {
      ...updates,
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

  async getAllTaxReports(tenantId: string): Promise<TaxReport[]> {
    const q = query(this.collectionRef, where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
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
      filedDate: new Date().toISOString().split('T')[0],
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
      updatedAt: serverTimestamp() as any,
    };

    if (status === 'completed') {
      updates.completedAt = serverTimestamp() as any;
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

export const payrollRunService = new PayrollRunService();
export const payrollRecordService = new PayrollRecordService();
export const benefitEnrollmentService = new BenefitEnrollmentService();
export const recurringDeductionService = new RecurringDeductionService();
export const taxReportService = new TaxReportService();
export const bankTransferService = new BankTransferService();

// Combined export for convenience
export const payrollService = {
  runs: payrollRunService,
  records: payrollRecordService,
  benefits: benefitEnrollmentService,
  deductions: recurringDeductionService,
  taxReports: taxReportService,
  transfers: bankTransferService,
};
