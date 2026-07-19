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
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db, getFunctionsLazy } from "@/lib/firebase";
import { getTodayTL } from "@/lib/dateUtils";
import { notificationService } from "@/services/notificationService";

// ============================================
// Types
// ============================================

export type LeaveType =
  | "annual"
  | "sick"
  | "maternity"
  | "paternity"
  | "bereavement"
  | "unpaid"
  | "marriage"
  | "study"
  | "custom";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

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
  halfDayType?: "morning" | "afternoon";

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

export type NewLeaveRequest = Omit<
  LeaveRequest,
  "id" | "tenantId" | "status" | "requestDate" | "createdAt" | "updatedAt"
> & {
  /**
   * Owner/HR-admin only (server-enforced): knowingly grant leave beyond the
   * employee's remaining entitlement instead of being blocked by the balance
   * check. Never persisted on the request document.
   */
  overrideBalance?: boolean;
};

export interface LeaveBalance {
  id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  departmentId?: string;
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

interface LeaveStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  employeesOnLeaveToday: number;
}

// ============================================
// Constants
// ============================================

const LEAVE_REQUESTS_COLLECTION = "leave_requests";
const LEAVE_BALANCES_COLLECTION = "leave_balances";

async function callTimeLeaveFunction<TRequest, TResponse>(
  name: string,
  payload: TRequest,
): Promise<TResponse> {
  const [{ httpsCallable }, functions] = await Promise.all([
    import("firebase/functions"),
    getFunctionsLazy(),
  ]);
  return (await httpsCallable<TRequest, TResponse>(functions, name)(payload))
    .data;
}

// TL-specific leave type definitions
export const TL_LEAVE_TYPES = [
  {
    id: "annual",
    name: "Annual Leave (Férias)",
    daysPerYear: 12,
    isPaid: true,
    requiresCertificate: false,
  },
  {
    id: "sick",
    name: "Sick Leave (Licença Médica)",
    daysPerYear: 12,
    isPaid: true, // First 6 days 100%, next 6 days 50%
    requiresCertificate: true,
    certificateType: "Medical Certificate",
  },
  {
    id: "maternity",
    name: "Maternity Leave (Licença de Maternidade)",
    daysPerYear: 84, // 12 weeks
    isPaid: true,
    requiresCertificate: true,
    certificateType: "Medical Certificate",
  },
  {
    id: "paternity",
    name: "Paternity Leave (Licença de Paternidade)",
    daysPerYear: 5,
    isPaid: true,
    requiresCertificate: true,
    certificateType: "Birth Certificate",
  },
  {
    id: "bereavement",
    name: "Bereavement Leave (Licença por Falecimento)",
    daysPerYear: 5,
    isPaid: true,
    requiresCertificate: true,
    certificateType: "Death Certificate",
  },
  {
    id: "marriage",
    name: "Marriage Leave (Licença de Casamento)",
    daysPerYear: 5,
    isPaid: true,
    requiresCertificate: true,
    certificateType: "Marriage Certificate",
  },
  {
    id: "unpaid",
    name: "Unpaid Leave (Licença sem Vencimento)",
    daysPerYear: 30,
    isPaid: false,
    requiresCertificate: false,
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate working days between two inclusive ISO dates. Weekends and any
 * tenant holiday dates supplied by the caller are excluded. UTC parsing keeps
 * the answer stable in Timor-Leste and for managers working abroad.
 */
export function calculateWorkingDays(
  startDate: string,
  endDate: string,
  holidayDates: readonly string[] = [],
): number {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0;
  }

  let workingDays = 0;
  const current = new Date(start);
  const holidays = new Set(holidayDates);

  while (current <= end) {
    const dayOfWeek = current.getUTCDay();
    const date = current.toISOString().slice(0, 10);
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(date)) {
      workingDays++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
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
    request: NewLeaveRequest,
  ): Promise<string> {
    try {
      const result = await callTimeLeaveFunction<
        NewLeaveRequest & { tenantId: string },
        { success: true; requestId: string; duration: number }
      >("createLeaveRequest", { ...request, tenantId });
      return result.requestId;
    } catch (error) {
      console.error("Error creating leave request:", error);
      throw error;
    }
  }

  /**
   * Get leave request by ID
   */
  async getLeaveRequest(
    tenantId: string,
    requestId: string,
  ): Promise<LeaveRequest | null> {
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
      console.error("Error getting leave request:", error);
      throw error;
    }
  }

  /**
   * Get all leave requests with optional filters
   */
  async getLeaveRequests(
    tenantId: string,
    filters?: {
      status?: LeaveStatus;
      employeeId?: string;
      departmentId?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<LeaveRequest[]> {
    try {
      let q = query(
        collection(db, LEAVE_REQUESTS_COLLECTION),
        where("tenantId", "==", tenantId),
        orderBy("requestDate", "desc"),
        limit(200),
      );

      if (filters?.status) {
        q = query(q, where("status", "==", filters.status));
      }

      if (filters?.employeeId) {
        q = query(q, where("employeeId", "==", filters.employeeId));
      }

      if (filters?.departmentId) {
        q = query(q, where("departmentId", "==", filters.departmentId));
      }

      const querySnapshot = await getDocs(q);
      const requests: LeaveRequest[] = [];

      const seen = new Set<string>();
      querySnapshot.forEach((doc) => {
        if (seen.has(doc.id)) return;
        seen.add(doc.id);
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
          if (filters.startDate && req.startDate < filters.startDate)
            return false;
          if (filters.endDate && req.endDate > filters.endDate) return false;
          return true;
        });
      }

      return requests;
    } catch (error) {
      console.error("Error getting leave requests:", error);
      throw error;
    }
  }

  /**
   * Email the staff member about an approve/reject decision (queued through
   * the mail collection → Resend). Bilingual EN + Tetun — Ekipa staff are
   * Tetun-first. Returns false when the employee has no email on file.
   * Non-critical: callers should not fail the approval if this throws.
   */
  async notifyLeaveDecision(
    tenantId: string,
    request: LeaveRequest,
    decision: "approved" | "rejected",
    opts: { approverName: string; reason?: string },
  ): Promise<boolean> {
    const email = await notificationService.getEmployeeEmail(
      tenantId,
      request.employeeId,
    );
    if (!email) return false;

    const period =
      request.startDate === request.endDate
        ? request.startDate
        : `${request.startDate} – ${request.endDate}`;
    const label = request.leaveTypeLabel || request.leaveType;
    const approved = decision === "approved";

    const subject = approved
      ? `Leave approved / Lisensa aprova ona — ${label}, ${period}`
      : `Leave request declined / Pedidu lisensa la aprova — ${label}, ${period}`;
    const text = [
      `Hi ${request.employeeName},`,
      "",
      approved
        ? `Your ${label} request for ${period} (${request.duration} day(s)) was APPROVED by ${opts.approverName}.`
        : `Your ${label} request for ${period} (${request.duration} day(s)) was DECLINED by ${opts.approverName}.`,
      ...(!approved && opts.reason ? [`Reason: ${opts.reason}`] : []),
      "",
      approved
        ? `Ita-nia pedidu lisensa (${label}) ba ${period} (loron ${request.duration}) APROVA ona husi ${opts.approverName}.`
        : `Ita-nia pedidu lisensa (${label}) ba ${period} (loron ${request.duration}) LA APROVA husi ${opts.approverName}.`,
      ...(!approved && opts.reason ? [`Razaun: ${opts.reason}`] : []),
      "",
      notificationService.bilingualFooter(),
    ].join("\n");

    await notificationService.queueEmail({
      tenantId,
      to: email,
      subject,
      text,
      purpose: "leave-decision",
      relatedId: request.id,
    });
    return true;
  }

  /**
   * Approve a leave request
   */
  async approveLeaveRequest(
    tenantId: string,
    requestId: string,
    _approverId: string,
    approverName: string,
    overrideBalance = false,
  ): Promise<void> {
    try {
      await callTimeLeaveFunction("approveLeaveRequest", {
        tenantId,
        requestId,
        approved: true,
        approverName,
        // Owner/HR-admin only (server-enforced): approve beyond entitlement.
        ...(overrideBalance ? { overrideBalance: true } : {}),
      });
    } catch (error) {
      console.error("Error approving leave request:", error);
      throw error;
    }
  }

  /**
   * Reject a leave request
   */
  async rejectLeaveRequest(
    tenantId: string,
    requestId: string,
    _approverId: string,
    approverName: string,
    rejectionReason: string,
  ): Promise<void> {
    try {
      await callTimeLeaveFunction("approveLeaveRequest", {
        tenantId,
        requestId,
        approved: false,
        approverName,
        note: rejectionReason,
      });
    } catch (error) {
      console.error("Error rejecting leave request:", error);
      throw error;
    }
  }

  /**
   * Cancel a leave request (by employee before approval)
   */
  async cancelLeaveRequest(tenantId: string, requestId: string): Promise<void> {
    try {
      const requestRef = doc(db, LEAVE_REQUESTS_COLLECTION, requestId);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(requestRef);
        if (!snapshot.exists() || snapshot.data().tenantId !== tenantId) {
          throw new Error("Leave request not found");
        }
        if (snapshot.data().status !== "pending") {
          throw new Error("Only pending requests can be cancelled");
        }
        transaction.update(requestRef, {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error("Error cancelling leave request:", error);
      throw error;
    }
  }

  /**
   * Get pending requests for approval (for managers)
   */
  async getPendingRequests(
    tenantId: string,
    departmentId?: string,
  ): Promise<LeaveRequest[]> {
    return this.getLeaveRequests(tenantId, {
      status: "pending",
      departmentId,
    });
  }

  /**
   * Get requests by employee
   */
  async getEmployeeRequests(
    tenantId: string,
    employeeId: string,
  ): Promise<LeaveRequest[]> {
    return this.getLeaveRequests(tenantId, { employeeId });
  }

  // ----------------------------------------
  // Leave Balances
  // ----------------------------------------

  /**
   * Get or initialize leave balance for an employee
   */
  async getLeaveBalance(
    tenantId: string,
    employeeId: string,
    year?: number,
    departmentId?: string,
  ): Promise<LeaveBalance | null> {
    const targetYear = year || Number(getTodayTL().slice(0, 4));

    try {
      const q = departmentId
        ? query(
            collection(db, LEAVE_BALANCES_COLLECTION),
            where("tenantId", "==", tenantId),
            where("employeeId", "==", employeeId),
            where("departmentId", "==", departmentId),
            where("year", "==", targetYear),
          )
        : query(
            collection(db, LEAVE_BALANCES_COLLECTION),
            where("tenantId", "==", tenantId),
            where("employeeId", "==", employeeId),
            where("year", "==", targetYear),
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
      console.error("Error getting leave balance:", error);
      throw error;
    }
  }

  /**
   * Get all employee balances (for admin view)
   */
  async getAllBalances(
    tenantId: string,
    year?: number,
    departmentId?: string,
  ): Promise<LeaveBalance[]> {
    const targetYear = year || Number(getTodayTL().slice(0, 4));

    try {
      const q = departmentId
        ? query(
            collection(db, LEAVE_BALANCES_COLLECTION),
            where("tenantId", "==", tenantId),
            where("departmentId", "==", departmentId),
            where("year", "==", targetYear),
          )
        : query(
            collection(db, LEAVE_BALANCES_COLLECTION),
            where("tenantId", "==", tenantId),
            where("year", "==", targetYear),
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
      console.error("Error getting all balances:", error);
      throw error;
    }
  }

  // ----------------------------------------
  // Statistics & Reports
  // ----------------------------------------

  /**
   * Get leave statistics
   */
  async getLeaveStats(
    tenantId: string,
    filters?: { employeeId?: string; departmentId?: string },
  ): Promise<LeaveStats> {
    try {
      const today = getTodayTL();
      const leaveRequestsRef = collection(db, LEAVE_REQUESTS_COLLECTION);
      let statsQuery = query(
        leaveRequestsRef,
        where("tenantId", "==", tenantId),
      );
      if (filters?.employeeId) {
        statsQuery = query(
          statsQuery,
          where("employeeId", "==", filters.employeeId),
        );
      }
      if (filters?.departmentId) {
        statsQuery = query(
          statsQuery,
          where("departmentId", "==", filters.departmentId),
        );
      }
      const snapshot = await getDocs(statsQuery);

      let totalRequests = 0;
      let pendingRequests = 0;
      let approvedRequests = 0;
      let rejectedRequests = 0;
      let employeesOnLeaveToday = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        totalRequests++;
        if (data.status === "pending") pendingRequests++;
        else if (data.status === "approved") {
          approvedRequests++;
          if (data.startDate <= today && data.endDate >= today) {
            employeesOnLeaveToday++;
          }
        } else if (data.status === "rejected") rejectedRequests++;
      }

      return {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        employeesOnLeaveToday,
      };
    } catch (error) {
      console.error("Error getting leave stats:", error);
      throw error;
    }
  }

  /**
   * Get employees on leave for a date range
   */
  async getEmployeesOnLeave(
    tenantId: string,
    startDate: string,
    endDate: string,
  ): Promise<LeaveRequest[]> {
    try {
      const q = query(
        collection(db, LEAVE_REQUESTS_COLLECTION),
        where("tenantId", "==", tenantId),
        where("status", "==", "approved"),
        where("startDate", "<=", endDate),
        where("endDate", ">=", startDate),
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as LeaveRequest;
      });
    } catch (error) {
      console.error("Error getting employees on leave:", error);
      throw error;
    }
  }

  /**
   * Get leave summary by department
   */
  async getLeaveSummaryByDepartment(
    tenantId: string,
    departmentId: string,
    year?: number,
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
        status: "approved",
        startDate: yearStart,
        endDate: yearEnd,
      });

      const byType: Record<string, number> = {};
      const byEmployee: Record<string, number> = {};
      let totalDaysTaken = 0;

      requests.forEach((req) => {
        totalDaysTaken += req.duration;
        byType[req.leaveType] = (byType[req.leaveType] || 0) + req.duration;
        byEmployee[req.employeeName] =
          (byEmployee[req.employeeName] || 0) + req.duration;
      });

      const employees = Object.entries(byEmployee)
        .map(([name, daysTaken]) => ({ name, daysTaken }))
        .sort((a, b) => b.daysTaken - a.daysTaken);

      return { totalDaysTaken, byType, employees };
    } catch (error) {
      console.error("Error getting department leave summary:", error);
      throw error;
    }
  }
}

export const leaveService = new LeaveService();
