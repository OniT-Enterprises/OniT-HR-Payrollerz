/**
 * Attendance store — fetch own attendance from global `attendance` collection
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
import type { AttendanceRecord, AttendanceSummary } from '../types/attendance';

interface AttendanceState {
  records: AttendanceRecord[];
  summary: AttendanceSummary | null;
  loading: boolean;
  error: string | null;

  fetchAttendance: (tenantId: string, employeeId: string, month?: string) => Promise<void>;
  clear: () => void;
}

function computeSummary(records: AttendanceRecord[]): AttendanceSummary {
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLate = 0;
  let daysOnLeave = 0;
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;

  for (const r of records) {
    if (r.status === 'present') daysPresent++;
    else if (r.status === 'late') { daysPresent++; daysLate++; }
    else if (r.status === 'absent') daysAbsent++;
    else if (r.status === 'leave') daysOnLeave++;
    else if (r.status === 'half_day') daysPresent++;

    totalRegularHours += r.regularHours || 0;
    totalOvertimeHours += r.overtimeHours || 0;
  }

  return {
    workingDays: records.length,
    daysPresent,
    daysAbsent,
    daysLate,
    daysOnLeave,
    totalRegularHours: Math.round(totalRegularHours * 10) / 10,
    totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
  };
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  records: [],
  summary: null,
  loading: false,
  error: null,

  fetchAttendance: async (tenantId: string, employeeId: string, month?: string) => {
    set({ loading: true, error: null });
    try {
      // Default to current month
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = now.getMonth(); // 0-indexed
      const startDate = month
        ? `${month}-01`
        : `${yyyy}-${String(mm + 1).padStart(2, '0')}-01`;
      const endMonth = month
        ? month
        : `${yyyy}-${String(mm + 1).padStart(2, '0')}`;
      const endDate = `${endMonth}-31`; // Safe upper bound

      const q = query(
        collection(db, 'attendance'),
        where('tenantId', '==', tenantId),
        where('employeeId', '==', employeeId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );

      const snap = await getDocs(q);
      const records: AttendanceRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          tenantId: data.tenantId,
          employeeId: data.employeeId,
          date: data.date,
          clockIn: data.clockIn,
          clockOut: data.clockOut,
          regularHours: data.regularHours || 0,
          overtimeHours: data.overtimeHours || 0,
          lateMinutes: data.lateMinutes || 0,
          totalHours: data.totalHours || 0,
          status: data.status || 'present',
        };
      });

      set({
        records,
        summary: computeSummary(records),
        loading: false,
      });
    } catch {
      set({ records: [], summary: null, loading: false, error: 'fetchError' });
    }
  },

  clear: () => set({ records: [], summary: null, loading: false, error: null }),
}));
