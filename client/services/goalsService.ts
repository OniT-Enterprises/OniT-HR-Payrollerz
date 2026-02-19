/**
 * Goals & OKRs Service
 * Manages OKRs, Goals, and related entities with Firestore persistence
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTodayTL } from '@/lib/dateUtils';

// ============================================
// Types
// ============================================

export type OKRStatus = 'draft' | 'active' | 'completed' | 'at_risk';
export type KeyResultStatus = 'on_track' | 'at_risk' | 'behind' | 'completed';
export type GoalStatus = 'active' | 'completed' | 'paused';
export type GoalPriority = 'high' | 'medium' | 'low';
export type MilestoneStatus = 'pending' | 'completed' | 'overdue';

export interface KeyResult {
  id: string;
  title: string;
  description?: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progress: number;
  status: KeyResultStatus;
  dueDate: string;
}

export interface OKR {
  id?: string;
  tenantId: string;
  title: string;
  description: string;
  department: string;
  ownerId: string;
  ownerName: string;
  quarter: string;
  year: number;
  progress: number;
  status: OKRStatus;
  keyResults: KeyResult[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  status: MilestoneStatus;
  assigneeId?: string;
  assigneeName?: string;
}

export interface Goal {
  id?: string;
  tenantId: string;
  title: string;
  description: string;
  department: string;
  priority: GoalPriority;
  status: GoalStatus;
  progress: number;
  startDate: string;
  endDate: string;
  createdById: string;
  createdByName: string;
  assignedTeams: string[];
  linkedOKRs: string[];
  milestones: Milestone[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OKRFilters {
  status?: OKRStatus;
  department?: string;
  quarter?: string;
  year?: number;
  ownerId?: string;
}

export interface GoalFilters {
  status?: GoalStatus;
  department?: string;
  priority?: GoalPriority;
  year?: number;
}

export interface OKRStats {
  totalOKRs: number;
  active: number;
  completed: number;
  atRisk: number;
  draft: number;
  avgProgress: number;
}

export interface GoalStats {
  totalGoals: number;
  active: number;
  completed: number;
  paused: number;
  avgProgress: number;
  byPriority: Record<GoalPriority, number>;
}

// ============================================
// Constants
// ============================================

const OKRS_COLLECTION = 'okrs';
const GOALS_COLLECTION = 'goals';

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export const DEFAULT_DEPARTMENTS = [
  'Engineering',
  'Marketing',
  'Sales',
  'HR',
  'Finance',
  'Operations',
];

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate OKR progress from key results
 */
export function calculateOKRProgress(keyResults: KeyResult[]): number {
  if (keyResults.length === 0) return 0;
  const total = keyResults.reduce((sum, kr) => sum + kr.progress, 0);
  return Math.round(total / keyResults.length);
}

/**
 * Calculate key result progress
 */
export function calculateKRProgress(currentValue: number, targetValue: number): number {
  if (targetValue === 0) return 0;
  const progress = Math.round((currentValue / targetValue) * 100);
  return Math.min(100, Math.max(0, progress));
}

/**
 * Determine key result status based on progress and due date
 */
export function determineKRStatus(progress: number, dueDate: string): KeyResultStatus {
  if (progress >= 100) return 'completed';

  const today = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // If close to deadline with low progress
  if (daysUntilDue <= 14 && progress < 70) return 'behind';
  if (daysUntilDue <= 30 && progress < 50) return 'at_risk';

  return 'on_track';
}

/**
 * Calculate goal progress from milestones
 */
export function calculateGoalProgress(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  const completed = milestones.filter((m) => m.status === 'completed').length;
  return Math.round((completed / milestones.length) * 100);
}

/**
 * Update milestone statuses based on dates
 */
export function updateMilestoneStatuses(milestones: Milestone[]): Milestone[] {
  const today = getTodayTL();

  return milestones.map((m) => {
    if (m.status === 'completed') return m;
    if (m.dueDate < today) {
      return { ...m, status: 'overdue' as MilestoneStatus };
    }
    return m;
  });
}

/**
 * Generate unique ID for nested items
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// OKR Service
// ============================================

class GoalsService {
  // ----------------------------------------
  // OKR Operations
  // ----------------------------------------

  /**
   * Create a new OKR
   */
  async createOKR(
    tenantId: string,
    okrData: Omit<OKR, 'id' | 'tenantId' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      // Ensure key results have IDs and calculated progress
      const keyResults = okrData.keyResults.map((kr) => ({
        ...kr,
        id: kr.id || generateId(),
        progress: calculateKRProgress(kr.currentValue, kr.targetValue),
        status: determineKRStatus(
          calculateKRProgress(kr.currentValue, kr.targetValue),
          kr.dueDate
        ),
      }));

      const progress = calculateOKRProgress(keyResults);

      const docRef = await addDoc(collection(db, OKRS_COLLECTION), {
        ...okrData,
        tenantId,
        keyResults,
        progress,
        status: 'active' as OKRStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating OKR:', error);
      throw error;
    }
  }

  /**
   * Get an OKR by ID
   */
  async getOKR(tenantId: string, okrId: string): Promise<OKR | null> {
    try {
      const docRef = doc(db, OKRS_COLLECTION, okrId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tenantId !== tenantId) {
          return null;
        }
        return this.mapDocToOKR(docSnap.id, data);
      }

      return null;
    } catch (error) {
      console.error('Error getting OKR:', error);
      throw error;
    }
  }

  /**
   * Get all OKRs with optional filters
   */
  async getOKRs(tenantId: string, filters?: OKRFilters): Promise<OKR[]> {
    try {
      let q = query(
        collection(db, OKRS_COLLECTION),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc')
      );

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.department) {
        q = query(q, where('department', '==', filters.department));
      }

      if (filters?.quarter) {
        q = query(q, where('quarter', '==', filters.quarter));
      }

      if (filters?.year) {
        q = query(q, where('year', '==', filters.year));
      }

      if (filters?.ownerId) {
        q = query(q, where('ownerId', '==', filters.ownerId));
      }

      const querySnapshot = await getDocs(q);
      const okrs: OKR[] = [];

      querySnapshot.forEach((doc) => {
        okrs.push(this.mapDocToOKR(doc.id, doc.data()));
      });

      return okrs;
    } catch (error) {
      console.error('Error getting OKRs:', error);
      throw error;
    }
  }

  /**
   * Update an OKR
   */
  async updateOKR(
    tenantId: string,
    okrId: string,
    updates: Partial<Omit<OKR, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<void> {
    try {
      const existing = await this.getOKR(tenantId, okrId);
      if (!existing) {
        throw new Error('OKR not found');
      }

      // Recalculate progress if key results updated
      let finalUpdates = { ...updates };
      if (updates.keyResults) {
        const keyResults = updates.keyResults.map((kr) => ({
          ...kr,
          id: kr.id || generateId(),
          progress: calculateKRProgress(kr.currentValue, kr.targetValue),
          status: determineKRStatus(
            calculateKRProgress(kr.currentValue, kr.targetValue),
            kr.dueDate
          ),
        }));
        finalUpdates.keyResults = keyResults;
        finalUpdates.progress = calculateOKRProgress(keyResults);
      }

      const docRef = doc(db, OKRS_COLLECTION, okrId);
      await updateDoc(docRef, {
        ...finalUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating OKR:', error);
      throw error;
    }
  }

  /**
   * Update a key result value
   */
  async updateKeyResult(
    tenantId: string,
    okrId: string,
    keyResultId: string,
    currentValue: number
  ): Promise<void> {
    const okr = await this.getOKR(tenantId, okrId);
    if (!okr) {
      throw new Error('OKR not found');
    }

    const updatedKeyResults = okr.keyResults.map((kr) => {
      if (kr.id === keyResultId) {
        const progress = calculateKRProgress(currentValue, kr.targetValue);
        return {
          ...kr,
          currentValue,
          progress,
          status: determineKRStatus(progress, kr.dueDate),
        };
      }
      return kr;
    });

    await this.updateOKR(tenantId, okrId, { keyResults: updatedKeyResults });
  }

  /**
   * Delete an OKR
   */
  async deleteOKR(tenantId: string, okrId: string): Promise<void> {
    try {
      const existing = await this.getOKR(tenantId, okrId);
      if (!existing) {
        throw new Error('OKR not found');
      }

      const docRef = doc(db, OKRS_COLLECTION, okrId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting OKR:', error);
      throw error;
    }
  }

  /**
   * Get OKR statistics
   */
  async getOKRStats(tenantId: string, quarter?: string, year?: number): Promise<OKRStats> {
    const filters: OKRFilters = {};
    if (quarter) filters.quarter = quarter;
    if (year) filters.year = year;

    const allOKRs = await this.getOKRs(tenantId, filters);

    return {
      totalOKRs: allOKRs.length,
      active: allOKRs.filter((o) => o.status === 'active').length,
      completed: allOKRs.filter((o) => o.status === 'completed').length,
      atRisk: allOKRs.filter((o) => o.status === 'at_risk').length,
      draft: allOKRs.filter((o) => o.status === 'draft').length,
      avgProgress: allOKRs.length > 0
        ? Math.round(allOKRs.reduce((sum, o) => sum + o.progress, 0) / allOKRs.length)
        : 0,
    };
  }

  // ----------------------------------------
  // Goal Operations
  // ----------------------------------------

  /**
   * Create a new Goal
   */
  async createGoal(
    tenantId: string,
    goalData: Omit<Goal, 'id' | 'tenantId' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      // Ensure milestones have IDs and check statuses
      const milestones = updateMilestoneStatuses(
        goalData.milestones.map((m) => ({
          ...m,
          id: m.id || generateId(),
        }))
      );

      const progress = calculateGoalProgress(milestones);

      const docRef = await addDoc(collection(db, GOALS_COLLECTION), {
        ...goalData,
        tenantId,
        milestones,
        progress,
        status: 'active' as GoalStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  }

  /**
   * Get a Goal by ID
   */
  async getGoal(tenantId: string, goalId: string): Promise<Goal | null> {
    try {
      const docRef = doc(db, GOALS_COLLECTION, goalId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tenantId !== tenantId) {
          return null;
        }
        return this.mapDocToGoal(docSnap.id, data);
      }

      return null;
    } catch (error) {
      console.error('Error getting goal:', error);
      throw error;
    }
  }

  /**
   * Get all Goals with optional filters
   */
  async getGoals(tenantId: string, filters?: GoalFilters): Promise<Goal[]> {
    try {
      let q = query(
        collection(db, GOALS_COLLECTION),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc')
      );

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.department) {
        q = query(q, where('department', '==', filters.department));
      }

      if (filters?.priority) {
        q = query(q, where('priority', '==', filters.priority));
      }

      const querySnapshot = await getDocs(q);
      let goals: Goal[] = [];

      querySnapshot.forEach((doc) => {
        goals.push(this.mapDocToGoal(doc.id, doc.data()));
      });

      // Client-side year filter
      if (filters?.year) {
        goals = goals.filter((g) => {
          const startYear = new Date(g.startDate).getFullYear();
          const endYear = new Date(g.endDate).getFullYear();
          return startYear === filters.year || endYear === filters.year;
        });
      }

      return goals;
    } catch (error) {
      console.error('Error getting goals:', error);
      throw error;
    }
  }

  /**
   * Update a Goal
   */
  async updateGoal(
    tenantId: string,
    goalId: string,
    updates: Partial<Omit<Goal, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<void> {
    try {
      const existing = await this.getGoal(tenantId, goalId);
      if (!existing) {
        throw new Error('Goal not found');
      }

      let finalUpdates = { ...updates };

      // Recalculate progress if milestones updated
      if (updates.milestones) {
        const milestones = updateMilestoneStatuses(
          updates.milestones.map((m) => ({
            ...m,
            id: m.id || generateId(),
          }))
        );
        finalUpdates.milestones = milestones;
        finalUpdates.progress = calculateGoalProgress(milestones);
      }

      const docRef = doc(db, GOALS_COLLECTION, goalId);
      await updateDoc(docRef, {
        ...finalUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating goal:', error);
      throw error;
    }
  }

  /**
   * Update a milestone status
   */
  async updateMilestone(
    tenantId: string,
    goalId: string,
    milestoneId: string,
    status: MilestoneStatus
  ): Promise<void> {
    const goal = await this.getGoal(tenantId, goalId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const updatedMilestones = goal.milestones.map((m) => {
      if (m.id === milestoneId) {
        return { ...m, status };
      }
      return m;
    });

    await this.updateGoal(tenantId, goalId, { milestones: updatedMilestones });
  }

  /**
   * Delete a Goal
   */
  async deleteGoal(tenantId: string, goalId: string): Promise<void> {
    try {
      const existing = await this.getGoal(tenantId, goalId);
      if (!existing) {
        throw new Error('Goal not found');
      }

      const docRef = doc(db, GOALS_COLLECTION, goalId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  }

  /**
   * Get Goal statistics
   */
  async getGoalStats(tenantId: string, year?: number): Promise<GoalStats> {
    const allGoals = await this.getGoals(tenantId, year ? { year } : undefined);

    const byPriority: Record<GoalPriority, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };
    allGoals.forEach((g) => {
      byPriority[g.priority]++;
    });

    return {
      totalGoals: allGoals.length,
      active: allGoals.filter((g) => g.status === 'active').length,
      completed: allGoals.filter((g) => g.status === 'completed').length,
      paused: allGoals.filter((g) => g.status === 'paused').length,
      avgProgress: allGoals.length > 0
        ? Math.round(allGoals.reduce((sum, g) => sum + g.progress, 0) / allGoals.length)
        : 0,
      byPriority,
    };
  }

  // ----------------------------------------
  // Helper Methods
  // ----------------------------------------

  private mapDocToOKR(id: string, data: Record<string, any>): OKR {
    return {
      id,
      tenantId: data.tenantId,
      title: data.title,
      description: data.description || '',
      department: data.department,
      ownerId: data.ownerId,
      ownerName: data.ownerName,
      quarter: data.quarter,
      year: data.year,
      progress: data.progress || 0,
      status: data.status,
      keyResults: data.keyResults || [],
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : data.updatedAt,
    };
  }

  private mapDocToGoal(id: string, data: Record<string, any>): Goal {
    return {
      id,
      tenantId: data.tenantId,
      title: data.title,
      description: data.description || '',
      department: data.department,
      priority: data.priority,
      status: data.status,
      progress: data.progress || 0,
      startDate: data.startDate,
      endDate: data.endDate,
      createdById: data.createdById,
      createdByName: data.createdByName,
      assignedTeams: data.assignedTeams || [],
      linkedOKRs: data.linkedOKRs || [],
      milestones: data.milestones || [],
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : data.updatedAt,
    };
  }
}

export const goalsService = new GoalsService();
export default goalsService;
