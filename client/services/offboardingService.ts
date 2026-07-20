/**
 * Offboarding Service
 * Manages employee offboarding cases with Firestore persistence
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  runTransaction,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import {
  calculateServiceCompensationDetails,
  calculateSubsidioAnual,
} from '@/lib/payroll/calculations-tl';

// ============================================
// Types
// ============================================

export type OffboardingStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// Defined in the pure leaver-final-pay module (Firebase-free, unit-testable);
// re-exported here so offboarding UI/service callers keep one import site.
import {
  severanceDefaultForReason,
  type DepartureReason,
} from '@/lib/payroll/leaver-final-pay';
export { severanceDefaultForReason, type DepartureReason };

export interface OffboardingChecklist {
  accessRevoked: boolean;
  equipmentReturned: boolean;
  documentsSigned: boolean;
  knowledgeTransfer: boolean;
  finalPayCalculated: boolean;
  benefitsCancelled: boolean;
  exitInterviewCompleted: boolean;
  referenceLetter: boolean;
}

export interface ExitInterview {
  overallSatisfaction: string;
  managerRelationship: string;
  primaryReason: string;
  suggestions: string;
  wouldRecommend: string;
  additionalComments: string;
  completed: boolean;
}

export interface Article56FinalPaySnapshot {
  version: 1 | 2 | 3;
  monthlySalary: number;
  hireDate: string;
  terminationDate: string;
  completedYears: number;
  completedFiveYearPeriods: number;
  salaryMonths: number;
  serviceCompensation: number;
  witTaxable: true;
  inssContributable: false;
  legalBasis: 'Labour Law 4/2012 Art. 56';
  taxBasis: 'Tax Law 8/2008 Art. 1';
  // v2: the Art. 44 prorated 13th month owed to a mid-year leaver (months
  // worked in the termination year, whole-month convention). GROSS
  // entitlement — if the tenant already paid this year's subsidio through a
  // payroll run, the paid amount must be deducted by the person settling
  // final pay (see subsidioAnualNote). Unlike the Art. 56 payment, the
  // subsidio is INSS-contributable as well as WIT-taxable.
  subsidioAnualMonths?: number;
  subsidioAnual?: number;
  subsidioAnualLegalBasis?: 'Labour Law 4/2012 Art. 44';
  subsidioAnualNote?: string;
  // v3: the cause-aware decision. serviceCompensation above stays the
  // computed statutory figure either way (the reference the accountant needs);
  // severanceIncluded records whether the final payroll run will pay it.
  severanceIncluded?: boolean;
  departureReason?: DepartureReason;
  calculatedBy: string;
  calculatedAt: Date;
}

export interface OffboardingCase {
  id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;

  // Departure info
  departureReason: DepartureReason;
  lastWorkingDay: string;
  noticeDate: string;
  notes?: string;
  /**
   * Editable Art. 56 decision for this case; absent = the cause-aware default
   * (severanceDefaultForReason). Frozen into the snapshot and stamped on the
   * employee (`severanceOnTermination`) at completion.
   */
  includeArt56Severance?: boolean;

  // Status
  status: OffboardingStatus;

  // Checklist
  checklist: OffboardingChecklist;

  // Exit interview
  exitInterview: ExitInterview;

  // Frozen source values and result for the universal Art. 56 service payment.
  article56FinalPay?: Article56FinalPaySnapshot;

  // Audit
  createdBy: string;
  completedBy?: string;
  completedAt?: Date;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

interface OffboardingFilters {
  employeeId?: string;
  status?: OffboardingStatus;
  departureReason?: DepartureReason;
  year?: number;
}

interface OffboardingStats {
  totalCases: number;
  pending: number;
  inProgress: number;
  completed: number;
  byReason: Record<DepartureReason, number>;
}

// ============================================
// Constants
// ============================================

const OFFBOARDING_COLLECTION = 'offboarding';

export const DEPARTURE_REASONS: { id: DepartureReason; name: string }[] = [
  { id: 'resignation', name: 'Resignation' },
  { id: 'redundancy', name: 'Redundancy' },
  { id: 'termination', name: 'Termination' },
  { id: 'retirement', name: 'Retirement' },
  { id: 'contract_end', name: 'Contract End' },
  { id: 'mutual_agreement', name: 'Mutual Agreement' },
  { id: 'other', name: 'Other' },
];

const DEFAULT_CHECKLIST: OffboardingChecklist = {
  accessRevoked: false,
  equipmentReturned: false,
  documentsSigned: false,
  knowledgeTransfer: false,
  finalPayCalculated: false,
  benefitsCancelled: false,
  exitInterviewCompleted: false,
  referenceLetter: false,
};

const DEFAULT_EXIT_INTERVIEW: ExitInterview = {
  overallSatisfaction: '',
  managerRelationship: '',
  primaryReason: '',
  suggestions: '',
  wouldRecommend: '',
  additionalComments: '',
  completed: false,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate progress percentage from checklist
 */
export function getChecklistProgress(checklist: OffboardingChecklist): number {
  const items = Object.values(checklist);
  const completed = items.filter(Boolean).length;
  return Math.round((completed / items.length) * 100);
}

/**
 * Calculate status based on checklist
 */
function calculateStatus(checklist: OffboardingChecklist): OffboardingStatus {
  const progress = getChecklistProgress(checklist);
  if (progress === 100) return 'completed';
  if (progress > 0) return 'in_progress';
  return 'pending';
}

// ============================================
// Offboarding Service
// ============================================

class OffboardingService {
  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Create a new offboarding case
   */
  async createCase(
    tenantId: string,
    caseData: Omit<OffboardingCase, 'id' | 'tenantId' | 'status' | 'checklist' | 'exitInterview' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, OFFBOARDING_COLLECTION), {
        ...caseData,
        tenantId,
        status: 'pending' as OffboardingStatus,
        checklist: DEFAULT_CHECKLIST,
        exitInterview: DEFAULT_EXIT_INTERVIEW,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating offboarding case:', error);
      throw error;
    }
  }

  /**
   * Get an offboarding case by ID
   */
  async getCase(tenantId: string, caseId: string): Promise<OffboardingCase | null> {
    try {
      const docRef = doc(db, OFFBOARDING_COLLECTION, caseId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tenantId !== tenantId) {
          return null;
        }
        return this.mapDocToCase(docSnap.id, data);
      }

      return null;
    } catch (error) {
      console.error('Error getting offboarding case:', error);
      throw error;
    }
  }

  /**
   * Get all offboarding cases with optional filters
   */
  async getCases(
    tenantId: string,
    filters?: OffboardingFilters
  ): Promise<OffboardingCase[]> {
    try {
      const canApplyYearServerSide = Boolean(
        filters?.year &&
        !filters.employeeId &&
        !filters.status &&
        !filters.departureReason
      );

      const yearStart = filters?.year ? new Date(Date.UTC(filters.year, 0, 1)) : null;
      const nextYearStart = filters?.year ? new Date(Date.UTC(filters.year + 1, 0, 1)) : null;

      let q = canApplyYearServerSide
        ? query(
            collection(db, OFFBOARDING_COLLECTION),
            where('tenantId', '==', tenantId),
            where('createdAt', '>=', Timestamp.fromDate(yearStart!)),
            where('createdAt', '<', Timestamp.fromDate(nextYearStart!)),
            orderBy('createdAt', 'desc')
          )
        : query(
            collection(db, OFFBOARDING_COLLECTION),
            where('tenantId', '==', tenantId),
            orderBy('createdAt', 'desc')
          );

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.employeeId) {
        q = query(q, where('employeeId', '==', filters.employeeId));
      }

      if (filters?.departureReason) {
        q = query(q, where('departureReason', '==', filters.departureReason));
      }

      const querySnapshot = await getDocs(q);
      let cases: OffboardingCase[] = [];

      querySnapshot.forEach((doc) => {
        cases.push(this.mapDocToCase(doc.id, doc.data()));
      });

      // Client-side year filter when additional equality filters are applied.
      if (filters?.year && !canApplyYearServerSide) {
        cases = cases.filter((c) => {
          if (!c.createdAt) return false;
          return new Date(c.createdAt).getFullYear() === filters.year;
        });
      }

      return cases;
    } catch (error) {
      console.error('Error getting offboarding cases:', error);
      throw error;
    }
  }

  /**
   * Get active (non-completed) cases
   */
  async getActiveCases(tenantId: string): Promise<OffboardingCase[]> {
    const q = query(
      collection(db, OFFBOARDING_COLLECTION),
      where('tenantId', '==', tenantId),
      where('status', 'in', ['pending', 'in_progress']),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapDocToCase(doc.id, doc.data()));
  }

  /**
   * Get completed cases (history)
   */
  async getCompletedCases(tenantId: string): Promise<OffboardingCase[]> {
    return this.getCases(tenantId, { status: 'completed' });
  }

  /**
   * Update an offboarding case
   */
  async updateCase(
    tenantId: string,
    caseId: string,
    updates: Partial<Omit<OffboardingCase, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<void> {
    try {
      // Verify ownership first
      const existing = await this.getCase(tenantId, caseId);
      if (!existing) {
        throw new Error('Offboarding case not found');
      }

      const docRef = doc(db, OFFBOARDING_COLLECTION, caseId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      // When offboarding finishes, terminate the employee record so they stop
      // appearing in active lists and the next payroll run. Best-effort: a
      // permissions failure here must not roll back the case completion.
      if (updates.status === 'completed' && existing.status !== 'completed' && existing.employeeId) {
        const { employeeService } = await import('./employeeService');
        const severanceIncluded =
          updates.includeArt56Severance ??
          existing.includeArt56Severance ??
          severanceDefaultForReason(existing.departureReason);
        await employeeService
          .updateEmployee(tenantId, existing.employeeId, {
            status: 'terminated',
            terminationDate: updates.lastWorkingDay ?? existing.lastWorkingDay,
            severanceOnTermination: severanceIncluded,
          })
          .catch((err) => {
            console.error('Offboarding completed but employee could not be marked terminated:', err);
          });
      }
    } catch (error) {
      console.error('Error updating offboarding case:', error);
      throw error;
    }
  }

  /**
   * Delete an offboarding case
   */
  async deleteCase(tenantId: string, caseId: string): Promise<void> {
    try {
      const existing = await this.getCase(tenantId, caseId);
      if (!existing) {
        throw new Error('Offboarding case not found');
      }

      const docRef = doc(db, OFFBOARDING_COLLECTION, caseId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting offboarding case:', error);
      throw error;
    }
  }

  // ----------------------------------------
  // Checklist Operations
  // ----------------------------------------

  /**
   * Update a single checklist item
   */
  async updateChecklistItem(
    tenantId: string,
    caseId: string,
    item: keyof OffboardingChecklist,
    value: boolean
  ): Promise<void> {
    if (item === 'finalPayCalculated') {
      throw new Error(
        'Article 56 final pay must be calculated and saved from employee source data; it cannot be ticked manually.',
      );
    }
    const existing = await this.getCase(tenantId, caseId);
    if (!existing) {
      throw new Error('Offboarding case not found');
    }

    const updatedChecklist = {
      ...existing.checklist,
      [item]: value,
    };

    const newStatus = calculateStatus(updatedChecklist);

    await this.updateCase(tenantId, caseId, {
      checklist: updatedChecklist,
      status: newStatus,
      ...(newStatus === 'completed' && {
        completedAt: new Date(),
      }),
    });
  }

  /**
   * Calculate and freeze the Article 56 service compensation from employee
   * master data and the case's last working day. No salary/date fallback is
   * permitted and saving the snapshot is what completes the checklist item.
   */
  async saveArticle56FinalPay(
    tenantId: string,
    caseId: string,
    calculatedBy: string,
  ): Promise<Article56FinalPaySnapshot> {
    if (!calculatedBy.trim()) throw new Error('A signed-in user is required to save final pay.');
    const caseRef = doc(db, OFFBOARDING_COLLECTION, caseId);

    return runTransaction(db, async (transaction) => {
      const caseDoc = await transaction.get(caseRef);
      if (!caseDoc.exists() || caseDoc.data().tenantId !== tenantId) {
        throw new Error('Offboarding case not found');
      }
      const caseData = caseDoc.data();
      if (caseData.status === 'cancelled') {
        throw new Error('Cannot calculate final pay for a cancelled offboarding case.');
      }
      const employeeId = String(caseData.employeeId || '');
      if (!employeeId) throw new Error('Offboarding case is missing its employee.');
      const employeeRef = doc(db, paths.employee(tenantId, employeeId));
      const employeeDoc = await transaction.get(employeeRef);
      if (!employeeDoc.exists()) throw new Error('Employee master record not found.');
      const employee = employeeDoc.data();
      const monthlySalary = employee.compensation?.monthlySalary;
      const hireDate = employee.jobDetails?.hireDate;
      const terminationDate = caseData.lastWorkingDay;
      if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
        throw new Error('Employee monthly salary must be completed before calculating Article 56 final pay.');
      }
      if (typeof hireDate !== 'string' || !hireDate.trim()) {
        throw new Error('Employee hire date must be completed before calculating Article 56 final pay.');
      }
      if (typeof terminationDate !== 'string' || !terminationDate.trim()) {
        throw new Error('Last working day is required before calculating Article 56 final pay.');
      }

      const details = calculateServiceCompensationDetails(
        monthlySalary,
        hireDate,
        terminationDate,
      );

      // Art. 44 prorated 13th month owed for the termination year (months
      // worked Jan-or-hire through the termination month, whole-month
      // convention — the legal default; the tenant new-hire opt-out is a
      // payroll-run convenience and does not reduce a leaver's entitlement).
      const termDateObj = new Date(`${terminationDate}T00:00:00`);
      const hireDateObj = new Date(`${hireDate}T00:00:00`);
      const termYear = termDateObj.getFullYear();
      const subsidioStartMonth =
        hireDateObj.getFullYear() === termYear ? hireDateObj.getMonth() : 0;
      const subsidioAnualMonths =
        hireDateObj.getFullYear() > termYear
          ? 0
          : Math.min(12, Math.max(0, termDateObj.getMonth() - subsidioStartMonth + 1));
      const subsidioAnual = calculateSubsidioAnual(
        monthlySalary,
        hireDate,
        termDateObj,
        { terminationDate },
      );

      const departureReason = (caseData.departureReason ||
        'other') as DepartureReason;
      const severanceIncluded =
        typeof caseData.includeArt56Severance === 'boolean'
          ? caseData.includeArt56Severance
          : severanceDefaultForReason(departureReason);

      const snapshot: Article56FinalPaySnapshot = {
        version: 3,
        monthlySalary: details.monthlySalary,
        hireDate: details.hireDate,
        terminationDate: details.terminationDate,
        completedYears: details.completedYears,
        completedFiveYearPeriods: details.completedFiveYearPeriods,
        salaryMonths: details.salaryMonths,
        serviceCompensation: details.amount,
        witTaxable: true,
        inssContributable: false,
        legalBasis: 'Labour Law 4/2012 Art. 56',
        taxBasis: 'Tax Law 8/2008 Art. 1',
        subsidioAnualMonths,
        subsidioAnual,
        subsidioAnualLegalBasis: 'Labour Law 4/2012 Art. 44',
        subsidioAnualNote: severanceIncluded
          ? 'Reference figures only. Once this employee is terminated, the next payroll run automatically pays their Art. 56 severance and the prorated Art. 44 subsídio (each net of anything already paid this year) — do NOT also settle these amounts manually.'
          : 'Reference figures only. Art. 56 severance is EXCLUDED for this case, so the next payroll run pays only the prorated Art. 44 subsídio (net of anything already paid this year) — do NOT also settle it manually.',
        severanceIncluded,
        departureReason,
        calculatedBy: calculatedBy.trim(),
        calculatedAt: new Date(),
      };
      const currentChecklist = caseData.checklist || DEFAULT_CHECKLIST;
      const checklist = { ...currentChecklist, finalPayCalculated: true };
      const status = calculateStatus(checklist);

      transaction.update(caseRef, {
        article56FinalPay: {
          ...snapshot,
          calculatedAt: serverTimestamp(),
        },
        checklist,
        status,
        ...(status === 'completed' ? { completedAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });
      if (status === 'completed') {
        transaction.update(employeeRef, {
          status: 'terminated',
          terminationDate,
          // The payroll run reads this to decide whether the final pay
          // auto-includes Art. 56 (see resolveLeaverFinalPay).
          severanceOnTermination: severanceIncluded,
          updatedAt: serverTimestamp(),
        });
      }
      return snapshot;
    });
  }

  /**
   * Update entire checklist
   */
  async updateChecklist(
    tenantId: string,
    caseId: string,
    checklist: OffboardingChecklist
  ): Promise<void> {
    const newStatus = calculateStatus(checklist);

    await this.updateCase(tenantId, caseId, {
      checklist,
      status: newStatus,
      ...(newStatus === 'completed' && {
        completedAt: new Date(),
      }),
    });
  }

  // ----------------------------------------
  // Exit Interview Operations
  // ----------------------------------------

  /**
   * Update exit interview field
   */
  async updateExitInterviewField(
    tenantId: string,
    caseId: string,
    field: keyof ExitInterview,
    value: string | boolean
  ): Promise<void> {
    const existing = await this.getCase(tenantId, caseId);
    if (!existing) {
      throw new Error('Offboarding case not found');
    }

    const updatedInterview = {
      ...existing.exitInterview,
      [field]: value,
    };

    await this.updateCase(tenantId, caseId, {
      exitInterview: updatedInterview,
    });
  }

  /**
   * Update entire exit interview
   */
  async updateExitInterview(
    tenantId: string,
    caseId: string,
    exitInterview: ExitInterview
  ): Promise<void> {
    await this.updateCase(tenantId, caseId, { exitInterview });
  }

  /**
   * Mark exit interview as complete
   */
  async completeExitInterview(tenantId: string, caseId: string): Promise<void> {
    const existing = await this.getCase(tenantId, caseId);
    if (!existing) {
      throw new Error('Offboarding case not found');
    }

    const updatedInterview = {
      ...existing.exitInterview,
      completed: true,
    };

    const updatedChecklist = {
      ...existing.checklist,
      exitInterviewCompleted: true,
    };

    await this.updateCase(tenantId, caseId, {
      exitInterview: updatedInterview,
      checklist: updatedChecklist,
      status: calculateStatus(updatedChecklist),
    });
  }

  // ----------------------------------------
  // Status Operations
  // ----------------------------------------

  /**
   * Mark case as completed
   */
  async completeCase(
    tenantId: string,
    caseId: string,
    completedBy: string
  ): Promise<void> {
    await this.updateCase(tenantId, caseId, {
      status: 'completed',
      completedBy,
      completedAt: new Date(),
    });
  }

  /**
   * Cancel a case
   */
  async cancelCase(tenantId: string, caseId: string): Promise<void> {
    await this.updateCase(tenantId, caseId, {
      status: 'cancelled',
    });
  }

  // ----------------------------------------
  // Statistics
  // ----------------------------------------

  /**
   * Get offboarding statistics
   */
  async getStats(tenantId: string, year?: number): Promise<OffboardingStats> {
    try {
      const collectionRef = collection(db, OFFBOARDING_COLLECTION);
      const baseQuery = year
        ? query(
            collectionRef,
            where('tenantId', '==', tenantId),
            where('createdAt', '>=', Timestamp.fromDate(new Date(Date.UTC(year, 0, 1)))),
            where('createdAt', '<', Timestamp.fromDate(new Date(Date.UTC(year + 1, 0, 1))))
          )
        : query(collectionRef, where('tenantId', '==', tenantId));

      const [
        totalSnapshot,
        pendingSnapshot,
        inProgressSnapshot,
        completedSnapshot,
        reasonSnapshots,
      ] = await Promise.all([
        getCountFromServer(baseQuery),
        getCountFromServer(query(baseQuery, where('status', '==', 'pending'))),
        getCountFromServer(query(baseQuery, where('status', '==', 'in_progress'))),
        getCountFromServer(query(baseQuery, where('status', '==', 'completed'))),
        Promise.all(
          DEPARTURE_REASONS.map(({ id }) =>
            getCountFromServer(query(baseQuery, where('departureReason', '==', id)))
          )
        ),
      ]);

      const byReason = DEPARTURE_REASONS.reduce<Record<DepartureReason, number>>((acc, { id }, index) => {
        acc[id] = reasonSnapshots[index].data().count;
        return acc;
      }, {
        resignation: 0,
        redundancy: 0,
        termination: 0,
        retirement: 0,
        contract_end: 0,
        mutual_agreement: 0,
        other: 0,
      });

      return {
        totalCases: totalSnapshot.data().count,
        pending: pendingSnapshot.data().count,
        inProgress: inProgressSnapshot.data().count,
        completed: completedSnapshot.data().count,
        byReason,
      };
    } catch (error) {
      console.error('Error getting offboarding stats:', error);
      throw error;
    }
  }

  /**
   * Get cases for an employee
   */
  async getEmployeeCases(tenantId: string, employeeId: string): Promise<OffboardingCase[]> {
    return this.getCases(tenantId, { employeeId });
  }

  // ----------------------------------------
  // Helper Methods
  // ----------------------------------------

  /**
   * Map Firestore document to OffboardingCase
   */
  private mapDocToCase(id: string, data: DocumentData): OffboardingCase {
    return {
      id,
      tenantId: data.tenantId,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      department: data.department,
      position: data.position,
      departureReason: data.departureReason,
      lastWorkingDay: data.lastWorkingDay,
      noticeDate: data.noticeDate,
      notes: data.notes,
      status: data.status,
      checklist: data.checklist || DEFAULT_CHECKLIST,
      exitInterview: data.exitInterview || DEFAULT_EXIT_INTERVIEW,
      article56FinalPay: data.article56FinalPay
        ? {
            ...data.article56FinalPay,
            calculatedAt: data.article56FinalPay.calculatedAt instanceof Timestamp
              ? data.article56FinalPay.calculatedAt.toDate()
              : data.article56FinalPay.calculatedAt,
          }
        : undefined,
      createdBy: data.createdBy,
      completedBy: data.completedBy,
      completedAt: data.completedAt instanceof Timestamp
        ? data.completedAt.toDate()
        : data.completedAt,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : data.updatedAt,
    };
  }
}

export const offboardingService = new OffboardingService();
