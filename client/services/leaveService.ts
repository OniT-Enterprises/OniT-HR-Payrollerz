/**
 * Leave Service - Timor-Leste Version
 * Manages employee leave requests, approvals, and balance tracking
 * Based on TL Labor Law requirements
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTodayTL } from '@/lib/dateUtils';

// ============================================
// Types
// ============================================

export type LeaveType =
  | 'annual'
  | 'sick'
  | 'maternity'
  | 'paternity'
  | 'bereavement'
  | 'unpaid'
  | 'marriage'
  | 'study'
  | 'custom';

export type LeaveStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface LeaveRequest {
  id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId: string;

  // Leave details
  leaveType: LeaveType;
  leaveTypeLabel: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  duration: number; // Working days
  halfDay?: boolean;
  halfDayType?: 'morning' | 'afternoon';

  // Request info
  reason: string;
  attachmentUrl?: string;
  hasCertificate: boolean;
  certificateType?: string;

  // Status & workflow
  status: LeaveStatus;
  requestDate: string;

  // Approval info
  approverId?: string;
  approverName?: string;
  approvedDate?: string;
  rejectionReason?: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LeaveBalance {
  id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  year: number;

  // Balances by type
  annual: LeaveBalanceItem;
  sick: LeaveBalanceItem;
  maternity?: LeaveBalanceItem;
  paternity?: LeaveBalanceItem;
  unpaid: LeaveBalanceItem;

  // Carry over from previous year
  carryOver: number;

  // Last updated
  updatedAt?: Date;
}

export interface LeaveBalanceItem {
  entitled: number; // Days entitled per year
  used: number; // Days used
  pending: number; // Days in pending requests
  remaining: number; // entitled - used - pending
}

export interface LeaveStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  employeesOnLeaveToday: number;
}

// ============================================
// Constants
// ============================================

const LEAVE_REQUESTS_COLLECTION = 'leave_requests';
const LEAVE_BALANCES_COLLECTION = 'leave_balances';

// TL-specific leave type definitions
export const TL_LEAVE_TYPES = [
  {
    id: 'annual',
    name: 'Annual Leave (Férias)',
    daysPerYear: 12,
    isPaid: true,
    requiresCertificate: false,
  },
  {
    id: 'sick',
    name: 'Sick Leave (Licença Médica)',
    daysPerYear: 12,
    isPaid: true, // First 6 days 100%, next 6 days 50%
    requiresCertificate: true,
    certificateType: 'Medical Certificate',
  },
  {
    id: 'maternity',
    name: 'Maternity Leave (Licença de Maternidade)',
    daysPerYear: 84, // 12 weeks
    isPaid: true,
    requiresCertificate: true,
    certificateType: 'Medical Certificate',
  },
  {
    id: 'paternity',
    name: 'Paternity Leave (Licença de Paternidade)',
    daysPerYear: 5,
    isPaid: true,
    requiresCertificate: true,
    certificateType: 'Birth Certificate',
  },
  {
    id: 'bereavement',
    name: 'Bereavement Leave (Licença por Falecimento)',
    daysPerYear: 5,
    isPaid: true,
    requiresCertificate: true,
    certificateType: 'Death Certificate',
  },
  {
    id: 'marriage',
    name: 'Marriage Leave (Licença de Casamento)',
    daysPerYear: 5,
    isPaid: true,
    requiresCertificate: true,
    certificateType: 'Marriage Certificate',
  },
  {
    id: 'unpaid',
    name: 'Unpaid Leave (Licença sem Vencimento)',
    daysPerYear: 0, // No limit, but unpaid
    isPaid: false,
    requiresCertificate: false,
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate working days between two dates (excludes weekends)
 */
export function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

// ============================================
// Leave Service
// ============================================

class LeaveService {
  // ----------------------------------------
  // Leave Requests
  // ----------------------------------------

  /**
   * Create a new leave request
   */
  async createLeaveRequest(
    tenantId: string,
    request: Omit<LeaveRequest, 'id' | 'tenantId' | 'status' | 'requestDate' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      // Calculate duration if not provided
      const duration = request.duration || calculateWorkingDays(request.startDate, request.endDate);

      // Pre-read: get current balance for the batch write
      const balance = await this.getLeaveBalance(tenantId, request.employeeId);

      const batch = writeBatch(db);

      // Write 1: Create leave request
      const docRef = doc(collection(db, LEAVE_REQUESTS_COLLECTION));
      batch.set(docRef, {
        ...request,
        tenantId,
        duration,
        status: 'pending' as LeaveStatus,
        requestDate: getTodayTL(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Write 2: Update pending balance (if balance exists)
      if (balance?.id) {
        const typeKey = request.leaveType as keyof LeaveBalance;
        if (typeof balance[typeKey] === 'object') {
          const currentBalance = balance[typeKey] as LeaveBalanceItem;
          const newPending = Math.max(0, currentBalance.pending + duration);
          const newRemaining = currentBalance.entitled - currentBalance.used - newPending;
          const balanceRef = doc(db, LEAVE_BALANCES_COLLECTION, balance.id);
          batch.update(balanceRef, {
            [`${request.leaveType}.pending`]: newPending,
            [`${request.leaveType}.remaining`]: newRemaining,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      return docRef.id;
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  }

  /**
   * Get leave request by ID
   */
  async getLeaveRequest(tenantId: string, requestId: string): Promise<LeaveRequest | null> {
    try {
      const docRef = doc(db, LEAVE_REQUESTS_COLLECTION, requestId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Verify tenant ownership
        if (data.tenantId !== tenantId) {
          return null;
        }
        return {
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as LeaveRequest;
      }

      return null;
    } catch (error) {
      console.error('Error getting leave request:', error);
      throw error;
    }
  }

  /**
   * Get all leave requests with optional filters
   */
  async getLeaveRequests(tenantId: string, filters?: {
    status?: LeaveStatus;
    employeeId?: string;
    departmentId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<LeaveRequest[]> {
    try {
      let q = query(
        collection(db, LEAVE_REQUESTS_COLLECTION),
        where('tenantId', '==', tenantId),
        orderBy('requestDate', 'desc')
      );

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.employeeId) {
        q = query(q, where('employeeId', '==', filters.employeeId));
      }

      if (filters?.departmentId) {
        q = query(q, where('departmentId', '==', filters.departmentId));
      }

      const querySnapshot = await getDocs(q);
      const requests: LeaveRequest[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as LeaveRequest);
      });

      // Filter by date range if provided (client-side for flexibility)
      if (filters?.startDate || filters?.endDate) {
        return requests.filter((req) => {
          if (filters.startDate && req.startDate < filters.startDate) return false;
          if (filters.endDate && req.endDate > filters.endDate) return false;
          return true;
        });
      }

      return requests;
    } catch (error) {
      console.error('Error getting leave requests:', error);
      throw error;
    }
  }

  /**
   * Approve a leave request
   */
  async approveLeaveRequest(
    tenantId: string,
    requestId: string,
    approverId: string,
    approverName: string
  ): Promise<void> {
    try {
      const request = await this.getLeaveRequest(tenantId, requestId);
      if (!request) throw new Error('Leave request not found');
      if (request.status !== 'pending') throw new Error('Request is not pending');

      // Pre-read balance for batch
      const balance = await this.getLeaveBalance(tenantId, request.employeeId);

      const batch = writeBatch(db);

      // Write 1: Update request status
      const requestRef = doc(db, LEAVE_REQUESTS_COLLECTION, requestId);
      batch.update(requestRef, {
        status: 'approved',
        approverId,
        approverName,
        approvedDate: getTodayTL(),
        updatedAt: serverTimestamp(),
      });

      // Write 2: Move from pending to used in balance
      if (balance?.id) {
        const typeKey = request.leaveType as keyof LeaveBalance;
        if (typeof balance[typeKey] === 'object') {
          const currentBalance = balance[typeKey] as LeaveBalanceItem;
          const newUsed = currentBalance.used + request.duration;
          const newPending = Math.max(0, currentBalance.pending - request.duration);
          const newRemaining = currentBalance.entitled - newUsed - newPending;
          const balanceRef = doc(db, LEAVE_BALANCES_COLLECTION, balance.id);
          batch.update(balanceRef, {
            [`${request.leaveType}.used`]: newUsed,
            [`${request.leaveType}.pending`]: newPending,
            [`${request.leaveType}.remaining`]: newRemaining,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Error approving leave request:', error);
      throw error;
    }
  }

  /**
   * Reject a leave request
   */
  async rejectLeaveRequest(
    tenantId: string,
    requestId: string,
    approverId: string,
    approverName: string,
    rejectionReason: string
  ): Promise<void> {
    try {
      const request = await this.getLeaveRequest(tenantId, requestId);
      if (!request) throw new Error('Leave request not found');
      if (request.status !== 'pending') throw new Error('Request is not pending');

      // Pre-read balance for batch
      const balance = await this.getLeaveBalance(tenantId, request.employeeId);

      const batch = writeBatch(db);

      // Write 1: Update request status
      const requestRef = doc(db, LEAVE_REQUESTS_COLLECTION, requestId);
      batch.update(requestRef, {
        status: 'rejected',
        approverId,
        approverName,
        rejectionReason,
        updatedAt: serverTimestamp(),
      });

      // Write 2: Remove from pending balance
      if (balance?.id) {
        const typeKey = request.leaveType as keyof LeaveBalance;
        if (typeof balance[typeKey] === 'object') {
          const currentBalance = balance[typeKey] as LeaveBalanceItem;
          const newPending = Math.max(0, currentBalance.pending - request.duration);
          const newRemaining = currentBalance.entitled - currentBalance.used - newPending;
          const balanceRef = doc(db, LEAVE_BALANCES_COLLECTION, balance.id);
          batch.update(balanceRef, {
            [`${request.leaveType}.pending`]: newPending,
            [`${request.leaveType}.remaining`]: newRemaining,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      throw error;
    }
  }

  /**
   * Cancel a leave request (by employee before approval)
   */
  async cancelLeaveRequest(tenantId: string, requestId: string): Promise<void> {
    try {
      const request = await this.getLeaveRequest(tenantId, requestId);
      if (!request) throw new Error('Leave request not found');
      if (request.status !== 'pending') throw new Error('Only pending requests can be cancelled');

      // Pre-read balance for batch
      const balance = await this.getLeaveBalance(tenantId, request.employeeId);

      const batch = writeBatch(db);

      // Write 1: Update request status
      const requestRef = doc(db, LEAVE_REQUESTS_COLLECTION, requestId);
      batch.update(requestRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      // Write 2: Remove from pending balance
      if (balance?.id) {
        const typeKey = request.leaveType as keyof LeaveBalance;
        if (typeof balance[typeKey] === 'object') {
          const currentBalance = balance[typeKey] as LeaveBalanceItem;
          const newPending = Math.max(0, currentBalance.pending - request.duration);
          const newRemaining = currentBalance.entitled - currentBalance.used - newPending;
          const balanceRef = doc(db, LEAVE_BALANCES_COLLECTION, balance.id);
          batch.update(balanceRef, {
            [`${request.leaveType}.pending`]: newPending,
            [`${request.leaveType}.remaining`]: newRemaining,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Error cancelling leave request:', error);
      throw error;
    }
  }

  /**
   * Get pending requests for approval (for managers)
   */
  async getPendingRequests(tenantId: string, departmentId?: string): Promise<LeaveRequest[]> {
    return this.getLeaveRequests(tenantId, {
      status: 'pending',
      departmentId
    });
  }

  /**
   * Get requests by employee
   */
  async getEmployeeRequests(tenantId: string, employeeId: string): Promise<LeaveRequest[]> {
    return this.getLeaveRequests(tenantId, { employeeId });
  }

  // ----------------------------------------
  // Leave Balances
  // ----------------------------------------

  /**
   * Get or initialize leave balance for an employee
   */
  async getLeaveBalance(tenantId: string, employeeId: string, year?: number): Promise<LeaveBalance | null> {
    const targetYear = year || new Date().getFullYear();

    try {
      const q = query(
        collection(db, LEAVE_BALANCES_COLLECTION),
        where('tenantId', '==', tenantId),
        where('employeeId', '==', employeeId),
        where('year', '==', targetYear)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          updatedAt: data.updatedAt?.toDate(),
        } as LeaveBalance;
      }

      return null;
    } catch (error) {
      console.error('Error getting leave balance:', error);
      throw error;
    }
  }

  /**
   * Initialize leave balance for a new employee or new year
   */
  async initializeLeaveBalance(
    tenantId: string,
    employeeId: string,
    employeeName: string,
    year?: number,
    carryOver?: number
  ): Promise<LeaveBalance> {
    const targetYear = year || new Date().getFullYear();

    // Default TL entitlements
    const defaultBalance: Omit<LeaveBalance, 'id'> = {
      tenantId,
      employeeId,
      employeeName,
      year: targetYear,
      annual: { entitled: 12, used: 0, pending: 0, remaining: 12 },
      sick: { entitled: 12, used: 0, pending: 0, remaining: 12 },
      maternity: { entitled: 84, used: 0, pending: 0, remaining: 84 },
      paternity: { entitled: 5, used: 0, pending: 0, remaining: 5 },
      unpaid: { entitled: 0, used: 0, pending: 0, remaining: 0 }, // Unlimited
      carryOver: carryOver || 0,
    };

    // Add carry over to remaining (not entitled — entitled stays at statutory 12)
    if (carryOver && carryOver > 0) {
      const cappedCarryOver = Math.min(carryOver, 6); // Max 6 days carry over per TL law
      defaultBalance.annual.remaining += cappedCarryOver;
      defaultBalance.carryOver = cappedCarryOver;
    }

    try {
      const docRef = await addDoc(collection(db, LEAVE_BALANCES_COLLECTION), {
        ...defaultBalance,
        updatedAt: serverTimestamp(),
      });

      return {
        ...defaultBalance,
        id: docRef.id,
      };
    } catch (error) {
      console.error('Error initializing leave balance:', error);
      throw error;
    }
  }

  /**
   * Update pending balance when request is created/cancelled
   */
  private async updatePendingBalance(
    tenantId: string,
    employeeId: string,
    leaveType: LeaveType,
    days: number
  ): Promise<void> {
    const balance = await this.getLeaveBalance(tenantId, employeeId);
    if (!balance) return;

    const typeKey = leaveType as keyof LeaveBalance;
    if (typeof balance[typeKey] !== 'object') return;

    const currentBalance = balance[typeKey] as LeaveBalanceItem;
    const newPending = Math.max(0, currentBalance.pending + days);
    const newRemaining = currentBalance.entitled - currentBalance.used - newPending;

    try {
      const docRef = doc(db, LEAVE_BALANCES_COLLECTION, balance.id!);
      await updateDoc(docRef, {
        [`${leaveType}.pending`]: newPending,
        [`${leaveType}.remaining`]: newRemaining,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating pending balance:', error);
      throw error;
    }
  }

  /**
   * Update balance when request is approved
   */
  private async updateBalanceOnApproval(
    tenantId: string,
    employeeId: string,
    leaveType: LeaveType,
    days: number
  ): Promise<void> {
    const balance = await this.getLeaveBalance(tenantId, employeeId);
    if (!balance) return;

    const typeKey = leaveType as keyof LeaveBalance;
    if (typeof balance[typeKey] !== 'object') return;

    const currentBalance = balance[typeKey] as LeaveBalanceItem;
    const newUsed = currentBalance.used + days;
    const newPending = Math.max(0, currentBalance.pending - days);
    const newRemaining = currentBalance.entitled - newUsed - newPending;

    try {
      const docRef = doc(db, LEAVE_BALANCES_COLLECTION, balance.id!);
      await updateDoc(docRef, {
        [`${leaveType}.used`]: newUsed,
        [`${leaveType}.pending`]: newPending,
        [`${leaveType}.remaining`]: newRemaining,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating balance on approval:', error);
      throw error;
    }
  }

  /**
   * Get all employee balances (for admin view)
   */
  async getAllBalances(tenantId: string, year?: number): Promise<LeaveBalance[]> {
    const targetYear = year || new Date().getFullYear();

    try {
      const q = query(
        collection(db, LEAVE_BALANCES_COLLECTION),
        where('tenantId', '==', tenantId),
        where('year', '==', targetYear)
      );

      const querySnapshot = await getDocs(q);
      const balances: LeaveBalance[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        balances.push({
          ...data,
          id: doc.id,
          updatedAt: data.updatedAt?.toDate(),
        } as LeaveBalance);
      });

      return balances;
    } catch (error) {
      console.error('Error getting all balances:', error);
      throw error;
    }
  }

  // ----------------------------------------
  // Statistics & Reports
  // ----------------------------------------

  /**
   * Get leave statistics
   */
  async getLeaveStats(tenantId: string): Promise<LeaveStats> {
    try {
      const allRequests = await this.getLeaveRequests(tenantId);
      const today = getTodayTL();

      const pendingRequests = allRequests.filter(r => r.status === 'pending').length;
      const approvedRequests = allRequests.filter(r => r.status === 'approved').length;
      const rejectedRequests = allRequests.filter(r => r.status === 'rejected').length;

      // Employees on leave today
      const employeesOnLeaveToday = allRequests.filter(
        r => r.status === 'approved' && r.startDate <= today && r.endDate >= today
      ).length;

      return {
        totalRequests: allRequests.length,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        employeesOnLeaveToday,
      };
    } catch (error) {
      console.error('Error getting leave stats:', error);
      throw error;
    }
  }

  /**
   * Get employees on leave for a date range
   */
  async getEmployeesOnLeave(tenantId: string, startDate: string, endDate: string): Promise<LeaveRequest[]> {
    try {
      const approvedRequests = await this.getLeaveRequests(tenantId, { status: 'approved' });

      return approvedRequests.filter(req => {
        // Check if leave period overlaps with query period
        return req.endDate >= startDate && req.startDate <= endDate;
      });
    } catch (error) {
      console.error('Error getting employees on leave:', error);
      throw error;
    }
  }

  /**
   * Get leave summary by department
   */
  async getLeaveSummaryByDepartment(
    tenantId: string,
    departmentId: string,
    year?: number
  ): Promise<{
    totalDaysTaken: number;
    byType: Record<string, number>;
    employees: Array<{ name: string; daysTaken: number }>;
  }> {
    const targetYear = year || new Date().getFullYear();
    const yearStart = `${targetYear}-01-01`;
    const yearEnd = `${targetYear}-12-31`;

    try {
      const requests = await this.getLeaveRequests(tenantId, {
        departmentId,
        status: 'approved',
        startDate: yearStart,
        endDate: yearEnd,
      });

      const byType: Record<string, number> = {};
      const byEmployee: Record<string, number> = {};
      let totalDaysTaken = 0;

      requests.forEach(req => {
        totalDaysTaken += req.duration;
        byType[req.leaveType] = (byType[req.leaveType] || 0) + req.duration;
        byEmployee[req.employeeName] = (byEmployee[req.employeeName] || 0) + req.duration;
      });

      const employees = Object.entries(byEmployee)
        .map(([name, daysTaken]) => ({ name, daysTaken }))
        .sort((a, b) => b.daysTaken - a.daysTaken);

      return { totalDaysTaken, byType, employees };
    } catch (error) {
      console.error('Error getting department leave summary:', error);
      throw error;
    }
  }
}

export const leaveService = new LeaveService();
