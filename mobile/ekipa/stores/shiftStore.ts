/**
 * Shift store — employee shift schedule viewing
 * Path: tenants/{tid}/shifts
 * Fetches shifts for current employee, next 14 days, status='published'
 */
import { create } from 'zustand';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Shift } from '../types/shift';

interface ShiftState {
  shifts: Shift[];
  loading: boolean;
  error: string | null;

  fetchShifts: (tenantId: string, employeeId: string) => Promise<void>;
  clear: () => void;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fourteenDaysFromNow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useShiftStore = create<ShiftState>((set) => ({
  shifts: [],
  loading: false,
  error: null,

  fetchShifts: async (tenantId: string, employeeId: string) => {
    set({ loading: true, error: null });
    try {
      const today = todayYYYYMMDD();
      const endDate = fourteenDaysFromNow();
      const q = query(
        collection(db, `tenants/${tenantId}/shifts`),
        where('employeeId', '==', employeeId),
        where('status', '==', 'published'),
        where('date', '>=', today),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );
      const snap = await getDocs(q);
      const shifts: Shift[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          tenantId: data.tenantId || tenantId,
          employeeId: data.employeeId || '',
          employeeName: data.employeeName || '',
          date: data.date || '',
          startTime: data.startTime || '',
          endTime: data.endTime || '',
          location: data.location,
          department: data.department,
          shiftType: data.shiftType,
          status: data.status || 'published',
          notes: data.notes,
        };
      });
      set({ shifts, loading: false });
    } catch {
      set({ shifts: [], loading: false, error: 'fetchError' });
    }
  },

  clear: () => set({ shifts: [], loading: false, error: null }),
}));
