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
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
    daysPerYear: 30,
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

/**
 * Calculate sick leave pay based on TL law
 * First 6 days: 100% pay
 * Days 7-12: 50% pay
 * Beyond 12: Unpaid (but job protected up to 30 days)
 */
export function calculateSickLeavePayment(
  days: number,
  dailyRate: number
): { paidDays: number; totalPay: number; breakdown: { fullPay: number; halfPay: number; unpaid: number } } {
  const fullPayDays = Math.min(days, 6);
  const halfPayDays = Math.min(Math.max(days - 6, 0), 6);
  const unpaidDays = Math.max(days - 12, 0);

  const fullPay = fullPayDays * dailyRate;
  const halfPay = halfPayDays * (dailyRate * 0.5);

  return {
    paidDays: fullPayDays + halfPayDays,
    totalPay: fullPay + halfPay,
    breakdown: {
      fullPay: fullPayDays,
      halfPay: halfPayDays,
      unpaid: unpaidDays,
    },
  };
}

/**
 * Check if employee has passed probation (3 months in TL)
 */
export function hasPassedProbation(startDate: string): boolean {
  const start = new Date(startDate);
  const now = new Date();
  const monthsWorked = (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  return monthsWorked >= 3;
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
    request: Omit<LeaveRequest, 'id' | 'status' | 'requestDate' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      // Calculate duration if not provided
      const duration = request.duration || calculateWorkingDays(request.startDate, request.endDate);

      const docRef = await addDoc(collection(db, LEAVE_REQUESTS_COLLECTION), {
        ...request,
        duration,
        status: 'pending' as LeaveStatus,
        requestDate: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update pending balance
      await this.updatePendingBalance(request.employeeId, request.leaveType, duration);

      return docRef.id;
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  }

  /**
   * Get leave request by ID
   */
  async getLeaveRequest(requestId: string): Promise<LeaveRequest | null> {
    try {
      const docRef = doc(db, LEAVE_REQUESTS_COLLECTION, requestId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
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
  async getLeaveRequests(filters?: {
    status?: LeaveStatus;
    employeeId?: string;
    departmentId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<LeaveRequest[]> {
    try {
      let q = query(
        collection(db, LEAVE_REQUESTS_COLLECTION),
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
    requestId: string,
    approverId: string,
    approverName: string
  ): Promise<void> {
    try {
      const request = await this.getLeaveRequest(requestId);
      if (!request) throw new Error('Leave request not found');
      if (request.status !== 'pending') throw new Error('Request is not pending');

      const docRef = doc(db, LEAVE_REQUESTS_COLLECTION, requestId);
      await updateDoc(docRef, {
        status: 'approved',
        approverId,
        approverName,
        approvedDate: new Date().toISOString().split('T')[0],
        updatedAt: serverTimestamp(),
      });

      // Move from pending to used in balance
      await this.updateBalanceOnApproval(
        request.employeeId,
        request.leaveType,
        request.duration
      );
    } catch (error) {
      console.error('Error approving leave request:', error);
      throw error;
    }
  }

  /**
   * Reject a leave request
   */
  async rejectLeaveRequest(
    requestId: string,
    approverId: string,
    approverName: string,
    rejectionReason: string
  ): Promise<void> {
    try {
      const request = await this.getLeaveRequest(requestId);
      if (!request) throw new Error('Leave request not found');
      if (request.status !== 'pending') throw new Error('Request is not pending');

      const docRef = doc(db, LEAVE_REQUESTS_COLLECTION, requestId);
      await updateDoc(docRef, {
        status: 'rejected',
        approverId,
        approverName,
        rejectionReason,
        updatedAt: serverTimestamp(),
      });

      // Remove from pending balance
      await this.updatePendingBalance(
        request.employeeId,
        request.leaveType,
        -request.duration
      );
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      throw error;
    }
  }

  /**
   * Cancel a leave request (by employee before approval)
   */
  async cancelLeaveRequest(requestId: string): Promise<void> {
    try {
      const request = await this.getLeaveRequest(requestId);
      if (!request) throw new Error('Leave request not found');
      if (request.status !== 'pending') throw new Error('Only pending requests can be cancelled');

      const docRef = doc(db, LEAVE_REQUESTS_COLLECTION, requestId);
      await updateDoc(docRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      // Remove from pending balance
      await this.updatePendingBalance(
        request.employeeId,
        request.leaveType,
        -request.duration
      );
    } catch (error) {
      console.error('Error cancelling leave request:', error);
      throw error;
    }
  }

  /**
   * Get pending requests for approval (for managers)
   */
  async getPendingRequests(departmentId?: string): Promise<LeaveRequest[]> {
    return this.getLeaveRequests({
      status: 'pending',
      departmentId
    });
  }

  /**
   * Get requests by employee
   */
  async getEmployeeRequests(employeeId: string): Promise<LeaveRequest[]> {
    return this.getLeaveRequests({ employeeId });
  }

  // ----------------------------------------
  // Leave Balances
  // ----------------------------------------

  /**
   * Get or initialize leave balance for an employee
   */
  async getLeaveBalance(employeeId: string, year?: number): Promise<LeaveBalance | null> {
    const targetYear = year || new Date().getFullYear();

    try {
      const q = query(
        collection(db, LEAVE_BALANCES_COLLECTION),
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
    employeeId: string,
    employeeName: string,
    year?: number,
    carryOver?: number
  ): Promise<LeaveBalance> {
    const targetYear = year || new Date().getFullYear();

    // Default TL entitlements
    const defaultBalance: Omit<LeaveBalance, 'id'> = {
      employeeId,
      employeeName,
      year: targetYear,
      annual: { entitled: 12, used: 0, pending: 0, remaining: 12 },
      sick: { entitled: 30, used: 0, pending: 0, remaining: 30 },
      maternity: { entitled: 84, used: 0, pending: 0, remaining: 84 },
      paternity: { entitled: 5, used: 0, pending: 0, remaining: 5 },
      unpaid: { entitled: 0, used: 0, pending: 0, remaining: 0 }, // Unlimited
      carryOver: carryOver || 0,
    };

    // Add carry over to annual leave
    if (carryOver && carryOver > 0) {
      defaultBalance.annual.entitled += Math.min(carryOver, 6); // Max 6 days carry over
      defaultBalance.annual.remaining = defaultBalance.annual.entitled;
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
    employeeId: string,
    leaveType: LeaveType,
    days: number
  ): Promise<void> {
    const balance = await this.getLeaveBalance(employeeId);
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
    employeeId: string,
    leaveType: LeaveType,
    days: number
  ): Promise<void> {
    const balance = await this.getLeaveBalance(employeeId);
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
  async getAllBalances(year?: number): Promise<LeaveBalance[]> {
    const targetYear = year || new Date().getFullYear();

    try {
      const q = query(
        collection(db, LEAVE_BALANCES_COLLECTION),
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
  async getLeaveStats(): Promise<LeaveStats> {
    try {
      const allRequests = await this.getLeaveRequests();
      const today = new Date().toISOString().split('T')[0];

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
  async getEmployeesOnLeave(startDate: string, endDate: string): Promise<LeaveRequest[]> {
    try {
      const approvedRequests = await this.getLeaveRequests({ status: 'approved' });

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
      const requests = await this.getLeaveRequests({
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
export default leaveService;
