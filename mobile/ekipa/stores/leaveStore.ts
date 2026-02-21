/**
 * Leave store — balance + requests from global collections
 * Leave requests: `leave_requests` (filtered by tenantId + employeeId)
 * Leave balances: `leave_balances` (filtered by tenantId + employeeId)
 */
import { create } from 'zustand';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { LeaveRequest, LeaveBalance, LeaveType } from '../types/leave';

interface LeaveState {
  balance: LeaveBalance | null;
  requests: LeaveRequest[];
  loading: boolean;
  submitting: boolean;
  error: string | null;

  fetchBalance: (tenantId: string, employeeId: string) => Promise<void>;
  fetchRequests: (tenantId: string, employeeId: string) => Promise<void>;
  createRequest: (params: CreateLeaveParams) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  clear: () => void;
}

interface CreateLeaveParams {
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId: string;
  leaveType: LeaveType;
  leaveTypeLabel: string;
  startDate: string;
  endDate: string;
  duration: number;
  reason: string;
}

export const useLeaveStore = create<LeaveState>((set, get) => ({
  balance: null,
  requests: [],
  loading: false,
  submitting: false,
  error: null,

  fetchBalance: async (tenantId: string, employeeId: string) => {
    try {
      const year = new Date().getFullYear();
      const q = query(
        collection(db, 'leave_balances'),
        where('tenantId', '==', tenantId),
        where('employeeId', '==', employeeId),
        where('year', '==', year)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        set({
          balance: {
            id: snap.docs[0].id,
            tenantId: data.tenantId,
            employeeId: data.employeeId,
            employeeName: data.employeeName || '',
            year: data.year,
            annual: data.annual || { entitled: 12, used: 0, pending: 0, remaining: 12 },
            sick: data.sick || { entitled: 30, used: 0, pending: 0, remaining: 30 },
            maternity: data.maternity,
            paternity: data.paternity,
            unpaid: data.unpaid || { entitled: 0, used: 0, pending: 0, remaining: 0 },
            carryOver: data.carryOver || 0,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
          },
        });
      }
    } catch {
      // Balance may not exist yet — that's ok
    }
  },

  fetchRequests: async (tenantId: string, employeeId: string) => {
    set({ loading: true, error: null });
    try {
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const q = query(
        collection(db, 'leave_requests'),
        where('tenantId', '==', tenantId),
        where('employeeId', '==', employeeId),
        where('requestDate', '>=', yearStart),
        orderBy('requestDate', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const requests: LeaveRequest[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          tenantId: data.tenantId,
          employeeId: data.employeeId,
          employeeName: data.employeeName || '',
          department: data.department || '',
          departmentId: data.departmentId || '',
          leaveType: data.leaveType,
          leaveTypeLabel: data.leaveTypeLabel || data.leaveType,
          startDate: data.startDate,
          endDate: data.endDate,
          duration: data.duration || 0,
          reason: data.reason || '',
          status: data.status,
          requestDate: data.requestDate,
          approverId: data.approverId,
          approverName: data.approverName,
          approvedDate: data.approvedDate,
          rejectionReason: data.rejectionReason,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
        };
      });
      set({ requests, loading: false });
    } catch {
      set({ requests: [], loading: false, error: 'fetchError' });
    }
  },

  createRequest: async (params: CreateLeaveParams) => {
    set({ submitting: true, error: null });
    try {
      const today = new Date().toISOString().split('T')[0];
      await addDoc(collection(db, 'leave_requests'), {
        ...params,
        status: 'pending',
        requestDate: today,
        hasCertificate: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Refresh requests
      await get().fetchRequests(params.tenantId, params.employeeId);
      // Refresh balance
      await get().fetchBalance(params.tenantId, params.employeeId);
      set({ submitting: false });
    } catch {
      set({ submitting: false, error: 'submitError' });
    }
  },

  cancelRequest: async (requestId: string) => {
    set({ submitting: true, error: null });
    try {
      await updateDoc(doc(db, 'leave_requests', requestId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      // Update local state
      set((state) => ({
        requests: state.requests.map((r) =>
          r.id === requestId ? { ...r, status: 'cancelled' as const } : r
        ),
        submitting: false,
      }));
    } catch {
      set({ submitting: false, error: 'cancelError' });
    }
  },

  clear: () => set({ balance: null, requests: [], loading: false, submitting: false, error: null }),
}));
