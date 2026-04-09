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
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ============================================
// Types
// ============================================

export type OffboardingStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type DepartureReason =
  | 'resignation'
  | 'redundancy'
  | 'termination'
  | 'retirement'
  | 'contract_end'
  | 'mutual_agreement'
  | 'other';

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

  // Status
  status: OffboardingStatus;

  // Checklist
  checklist: OffboardingChecklist;

  // Exit interview
  exitInterview: ExitInterview;

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
