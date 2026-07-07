/**
 * Attendance Service - Firebase Operations
 * Handles attendance tracking, fingerprint imports, and calculations
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TL_WORKING_HOURS } from '@/lib/payroll/constants-tl';
import { FirestoreTimestamp } from '@/types/firebase';

// ============================================
// TYPES
// ============================================

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'half_day' | 'leave' | 'holiday';
export type AttendanceSource = 'manual' | 'fingerprint' | 'mobile_app' | 'qr_code' | 'facial';

export interface AttendanceRecord {
  id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string; // YYYY-MM-DD

  // Clock times
  clockIn?: string; // HH:MM
  clockOut?: string; // HH:MM
  breakStart?: string;
  breakEnd?: string;

  // Calculated hours
  regularHours: number;
  overtimeHours: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  breakMinutes: number;
  totalHours: number;

  // Status
  status: AttendanceStatus;

  // Source
  source: AttendanceSource;
  deviceId?: string;
  importBatchId?: string;

  // Adjustments
  isAdjusted: boolean;
  adjustedBy?: string;
  adjustmentReason?: string;
  originalClockIn?: string;
  originalClockOut?: string;

  // Notes
  notes?: string;

  // Timestamps
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

interface AttendanceImportBatch {
  id?: string;
  tenantId: string;
  fileName: string;
  deviceType: 'zkteco' | 'anviz' | 'hikvision' | 'suprema' | 'other';
  importDate: FirestoreTimestamp;
  importedBy: string;

  // Stats
  recordCount: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  errors?: string[];

  // Status
  status: 'processing' | 'completed' | 'failed';

  createdAt?: FirestoreTimestamp;
}

interface AttendanceSummary {
  employeeId: string;
  employeeName: string;
  department: string;

  // Period
  periodStart: string;
  periodEnd: string;

  // Days
  workingDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysOnLeave: number;
  holidays: number;

  // Hours
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalLateMinutes: number;
  averageHoursPerDay: number;
}

interface DailyAttendanceReport {
  date: string;
  totalEmployees: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  attendanceRate: number;
}

export interface AttendanceEmployeeSummary {
  employeeId: string;
  employeeName: string;
  department: string;
  regularHours: number;
  overtimeHours: number;
  lateMinutes: number;
  daysPresent: number;
  recordsCount: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Default expected work times when the employee has no scheduled shift that day */
export const DEFAULT_EXPECTED_START = '08:00';
export const DEFAULT_EXPECTED_END = '17:00';

/** Minutes of lateness tolerated before an entry is marked "late" */
export const LATE_GRACE_MINUTES = 15;

/** A single entry computing to more hours than this is almost certainly a typo */
export const MAX_REASONABLE_ENTRY_HOURS = 16;

/** Unpaid break assumed when none is recorded (only for entries of 6h+ raw) */
export const DEFAULT_BREAK_MINUTES = 60;

/**
 * Calculate hours between two time strings (end before start = overnight)
 */
export function calculateHoursBetween(start: string, end: string): number {
  if (!start || !end) return 0;

  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  if ([startHour, startMin, endHour, endMin].some(Number.isNaN)) return 0;

  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

/**
 * Net hours for an entry: raw span minus break. When no break is recorded,
 * a default break is deducted only for entries long enough to include one.
 * Shared by the service and the entry dialogs (for live preview/validation).
 */
export function computeEntryHours(
  clockIn: string,
  clockOut: string,
  breakMinutes?: number,
): { rawHours: number; breakMinutes: number; totalHours: number; isOvernight: boolean } {
  const rawHours = calculateHoursBetween(clockIn, clockOut);
  const effectiveBreak =
    breakMinutes !== undefined
      ? breakMinutes
      : rawHours >= 6
        ? DEFAULT_BREAK_MINUTES
        : 0;
  const totalHours = Math.max(0, rawHours - effectiveBreak / 60);
  const isOvernight = Boolean(clockIn && clockOut && clockOut < clockIn);
  return { rawHours, breakMinutes: effectiveBreak, totalHours, isOvernight };
}

/**
 * Calculate late minutes based on expected start time
 */
export function calculateLateMinutes(clockIn: string, expectedStart: string = DEFAULT_EXPECTED_START): number {
  if (!clockIn) return 0;

  const [clockHour, clockMin] = clockIn.split(':').map(Number);
  const [expectedHour, expectedMin] = expectedStart.split(':').map(Number);

  const clockMinutes = clockHour * 60 + clockMin;
  const expectedMinutes = expectedHour * 60 + expectedMin;

  return Math.max(0, clockMinutes - expectedMinutes);
}

/**
 * Calculate early departure minutes based on expected end time
 */
export function calculateEarlyDeparture(clockOut: string, expectedEnd: string = DEFAULT_EXPECTED_END): number {
  if (!clockOut) return 0;

  const [clockHour, clockMin] = clockOut.split(':').map(Number);
  const [expectedHour, expectedMin] = expectedEnd.split(':').map(Number);

  const clockMinutes = clockHour * 60 + clockMin;
  const expectedMinutes = expectedHour * 60 + expectedMin;

  return Math.max(0, expectedMinutes - clockMinutes);
}

/**
 * Determine attendance status.
 * An entry with clock-in but no clock-out is a shift in progress — present
 * (or late), never half_day: hours can only be judged once clocked out.
 */
export function determineStatus(
  clockIn: string | undefined,
  clockOut: string | undefined,
  lateMinutes: number,
  totalHours: number
): AttendanceStatus {
  if (!clockIn && !clockOut) return 'absent';
  if (clockIn && !clockOut) return lateMinutes > LATE_GRACE_MINUTES ? 'late' : 'present';
  if (totalHours < 4) return 'half_day';
  if (lateMinutes > LATE_GRACE_MINUTES) return 'late';
  return 'present';
}

/**
 * Calculate regular and overtime hours
 */
export function calculateHoursBreakdown(totalHours: number): { regular: number; overtime: number } {
  const standardDailyHours = TL_WORKING_HOURS.standardDailyHours;

  if (totalHours <= standardDailyHours) {
    return { regular: totalHours, overtime: 0 };
  }

  return {
    regular: standardDailyHours,
    overtime: totalHours - standardDailyHours,
  };
}

// ============================================
// SERVICE CLASS
// ============================================

class AttendanceService {
  private get collectionRef() {
    return collection(db, 'attendance');
  }

  private get importsRef() {
    return collection(db, 'attendanceImports');
  }

  /**
   * Expected work times for an employee on a date: their scheduled shift if
   * one exists, otherwise the tenant-wide defaults. Keeps afternoon/night
   * shift workers from being flagged "late" against a 08:00 day-shift start.
   */
  private async getExpectedTimes(
    tenantId: string,
    employeeId: string,
    date: string,
  ): Promise<{ start: string; end: string }> {
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/shifts`),
        where('employeeId', '==', employeeId),
        where('date', '==', date),
        limit(1),
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const shift = snap.docs[0].data();
        if (shift.startTime && shift.endTime && shift.status !== 'cancelled') {
          return { start: shift.startTime, end: shift.endTime };
        }
      }
    } catch {
      // Shift lookup is best-effort — fall back to defaults
    }
    return { start: DEFAULT_EXPECTED_START, end: DEFAULT_EXPECTED_END };
  }

  /**
   * Get attendance records for a date range
   */
  async getAttendanceByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
    department?: string
  ): Promise<AttendanceRecord[]> {
    let q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc'),
      orderBy('employeeName', 'asc')
    );

    const querySnapshot = await getDocs(q);
    let records = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as AttendanceRecord[];

    // Filter by department if specified
    if (department && department !== 'all') {
      records = records.filter(r => r.department === department);
    }

    return records;
  }

  /**
   * Get attendance for a specific date
   */
  async getAttendanceByDate(tenantId: string, date: string): Promise<AttendanceRecord[]> {
    return this.getAttendanceByDateRange(tenantId, date, date);
  }

  /**
   * Get summarized attendance by employee for a date range
   * Used by payroll to sync real attendance metrics into payroll inputs.
   */
  async getAttendanceSummaryByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<AttendanceEmployeeSummary[]> {
    const records = await this.getAttendanceByDateRange(tenantId, startDate, endDate);
    const byEmployee = new Map<string, AttendanceEmployeeSummary>();

    for (const record of records) {
      if (!record.employeeId) continue;

      const existing = byEmployee.get(record.employeeId);
      if (existing) {
        existing.regularHours += record.regularHours || 0;
        existing.overtimeHours += record.overtimeHours || 0;
        existing.lateMinutes += record.lateMinutes || 0;
        existing.recordsCount += 1;
        if ((record.totalHours || 0) > 0 || record.status === 'present' || record.status === 'late') {
          existing.daysPresent += 1;
        }
        continue;
      }

      byEmployee.set(record.employeeId, {
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        department: record.department,
        regularHours: record.regularHours || 0,
        overtimeHours: record.overtimeHours || 0,
        lateMinutes: record.lateMinutes || 0,
        daysPresent: (record.totalHours || 0) > 0 || record.status === 'present' || record.status === 'late' ? 1 : 0,
        recordsCount: 1,
      });
    }

    return Array.from(byEmployee.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }

  /**
   * Get employee's attendance for a month
   */
  async getEmployeeAttendance(
    tenantId: string,
    employeeId: string,
    year: number,
    month: number
  ): Promise<AttendanceRecord[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('employeeId', '==', employeeId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as AttendanceRecord[];
  }

  /**
   * Create or update attendance record
   */
  async markAttendance(tenantId: string, data: {
    employeeId: string;
    employeeName: string;
    department: string;
    date: string;
    clockIn?: string;
    clockOut?: string;
    breakStart?: string;
    breakEnd?: string;
    source: AttendanceSource;
    notes?: string;
  }): Promise<string> {
    // Check if record already exists for this employee/date
    const existing = await this.getExistingRecord(tenantId, data.employeeId, data.date);

    // Calculate hours
    const explicitBreak = data.breakStart && data.breakEnd
      ? calculateHoursBetween(data.breakStart, data.breakEnd) * 60
      : undefined;
    const { breakMinutes, totalHours } = computeEntryHours(
      data.clockIn || '',
      data.clockOut || '',
      explicitBreak,
    );

    if (totalHours > MAX_REASONABLE_ENTRY_HOURS) {
      throw new Error(
        `Entry computes to ${totalHours.toFixed(1)}h — check clock-in/clock-out times`,
      );
    }

    const expected = await this.getExpectedTimes(tenantId, data.employeeId, data.date);
    const lateMinutes = calculateLateMinutes(data.clockIn || '', expected.start);
    const earlyDepartureMinutes = calculateEarlyDeparture(data.clockOut || '', expected.end);

    const { regular, overtime } = calculateHoursBreakdown(totalHours);
    const status = determineStatus(data.clockIn, data.clockOut, lateMinutes, totalHours);

    const record: Omit<AttendanceRecord, 'id'> = {
      tenantId,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      department: data.department,
      date: data.date,
      clockIn: data.clockIn,
      clockOut: data.clockOut,
      breakStart: data.breakStart,
      breakEnd: data.breakEnd,
      regularHours: regular,
      overtimeHours: overtime,
      lateMinutes,
      earlyDepartureMinutes,
      breakMinutes,
      totalHours,
      status,
      source: data.source,
      isAdjusted: false,
      notes: data.notes,
    };

    if (existing) {
      // Update existing record
      await updateDoc(doc(db, 'attendance', existing.id!), {
        ...record,
        updatedAt: serverTimestamp(),
      });
      return existing.id!;
    } else {
      // Create new record
      const docRef = await addDoc(this.collectionRef, {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    }
  }

  /**
   * Get existing record for employee/date
   */
  private async getExistingRecord(tenantId: string, employeeId: string, date: string): Promise<AttendanceRecord | null> {
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('employeeId', '==', employeeId),
      where('date', '==', date),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as AttendanceRecord;
  }

  /**
   * Adjust attendance record
   */
  async adjustAttendance(
    tenantId: string,
    recordId: string,
    adjustments: {
      clockIn?: string;
      clockOut?: string;
      status?: AttendanceStatus;
      reason: string;
      adjustedBy: string;
    }
  ): Promise<boolean> {
    const docRef = doc(db, 'attendance', recordId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Attendance record not found');
    }

    const current = docSnap.data() as AttendanceRecord;

    // Verify tenant ownership
    if (current.tenantId !== tenantId) {
      throw new Error('Access denied');
    }

    // Calculate new hours if times changed
    const newClockIn = adjustments.clockIn || current.clockIn;
    const newClockOut = adjustments.clockOut || current.clockOut;

    const hadExplicitBreak = Boolean(current.breakStart && current.breakEnd);
    const { breakMinutes, totalHours } = computeEntryHours(
      newClockIn || '',
      newClockOut || '',
      hadExplicitBreak ? current.breakMinutes : undefined,
    );

    if (totalHours > MAX_REASONABLE_ENTRY_HOURS) {
      throw new Error(
        `Entry computes to ${totalHours.toFixed(1)}h — check clock-in/clock-out times`,
      );
    }

    const expected = await this.getExpectedTimes(tenantId, current.employeeId, current.date);
    const { regular, overtime } = calculateHoursBreakdown(totalHours);
    const lateMinutes = calculateLateMinutes(newClockIn || '', expected.start);
    const earlyDepartureMinutes = calculateEarlyDeparture(newClockOut || '', expected.end);

    await updateDoc(docRef, {
      clockIn: newClockIn,
      clockOut: newClockOut,
      regularHours: regular,
      overtimeHours: overtime,
      totalHours,
      breakMinutes,
      lateMinutes,
      earlyDepartureMinutes,
      status: adjustments.status || determineStatus(newClockIn, newClockOut, lateMinutes, totalHours),
      isAdjusted: true,
      adjustedBy: adjustments.adjustedBy,
      adjustmentReason: adjustments.reason,
      originalClockIn: current.clockIn ?? null,
      originalClockOut: current.clockOut ?? null,
      updatedAt: serverTimestamp(),
    });

    return true;
  }

  /**
   * Delete attendance record
   */
  async deleteAttendance(tenantId: string, recordId: string): Promise<boolean> {
    const docRef = doc(db, 'attendance', recordId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.tenantId !== tenantId) {
        throw new Error('Access denied');
      }
    }

    await deleteDoc(docRef);
    return true;
  }

  /**
   * Import attendance from fingerprint device
   */
  async importFromDevice(
    tenantId: string,
    records: {
      employeeId: string;
      employeeName: string;
      department: string;
      date: string;
      clockIn?: string;
      clockOut?: string;
    }[],
    metadata: {
      fileName: string;
      deviceType: AttendanceImportBatch['deviceType'];
      importedBy: string;
    }
  ): Promise<{ batchId: string; stats: { success: number; errors: number; duplicates: number } }> {
    const batch = writeBatch(db);

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    // Prefetch existing records for the date range to avoid N+1 queries
    const dates = [...new Set(records.map(r => r.date))].sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const existingQuery = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('date', '>=', minDate),
      where('date', '<=', maxDate)
    );
    const existingSnapshot = await getDocs(existingQuery);
    const existingKeys = new Set(
      existingSnapshot.docs.map(d => `${d.data().employeeId}:${d.data().date}`)
    );

    // Prefetch scheduled shifts for the range so lateness is judged against
    // each employee's actual shift, not the default day-shift start
    const expectedByKey = new Map<string, { start: string; end: string }>();
    try {
      const shiftsSnapshot = await getDocs(query(
        collection(db, `tenants/${tenantId}/shifts`),
        where('date', '>=', minDate),
        where('date', '<=', maxDate),
      ));
      for (const d of shiftsSnapshot.docs) {
        const s = d.data();
        if (s.employeeId && s.startTime && s.endTime && s.status !== 'cancelled') {
          expectedByKey.set(`${s.employeeId}:${s.date}`, { start: s.startTime, end: s.endTime });
        }
      }
    } catch {
      // Best-effort — records fall back to default expected times
    }

    // Create import batch record
    const importRef = doc(this.importsRef);
    const batchId = importRef.id;

    for (const record of records) {
      try {
        // Check for duplicate using prefetched data
        if (existingKeys.has(`${record.employeeId}:${record.date}`)) {
          duplicateCount++;
          continue;
        }

        // Calculate hours
        const { breakMinutes, totalHours } = computeEntryHours(record.clockIn || '', record.clockOut || '');
        const { regular, overtime } = calculateHoursBreakdown(totalHours);
        const expected = expectedByKey.get(`${record.employeeId}:${record.date}`)
          ?? { start: DEFAULT_EXPECTED_START, end: DEFAULT_EXPECTED_END };
        const lateMinutes = calculateLateMinutes(record.clockIn || '', expected.start);
        const status = determineStatus(record.clockIn, record.clockOut, lateMinutes, totalHours);

        const attendanceRef = doc(this.collectionRef);
        batch.set(attendanceRef, {
          ...record,
          tenantId,
          regularHours: regular,
          overtimeHours: overtime,
          lateMinutes,
          earlyDepartureMinutes: calculateEarlyDeparture(record.clockOut || '', expected.end),
          breakMinutes,
          totalHours,
          status,
          source: 'fingerprint',
          importBatchId: batchId,
          isAdjusted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Row ${records.indexOf(record) + 1}: ${error}`);
      }
    }

    // Save import batch record
    batch.set(importRef, {
      ...metadata,
      tenantId,
      recordCount: records.length,
      successCount,
      errorCount,
      duplicateCount,
      errors: errors.slice(0, 50), // Limit stored errors
      status: errorCount > 0 && successCount === 0 ? 'failed' : 'completed',
      importDate: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    return {
      batchId,
      stats: { success: successCount, errors: errorCount, duplicates: duplicateCount },
    };
  }

  /**
   * Get attendance summary for an employee
   */
  async getEmployeeSummary(
    tenantId: string,
    employeeId: string,
    employeeName: string,
    department: string,
    startDate: string,
    endDate: string
  ): Promise<AttendanceSummary> {
    const records = await this.getAttendanceByDateRange(tenantId, startDate, endDate);
    const employeeRecords = records.filter(r => r.employeeId === employeeId);

    // Calculate working days (excluding weekends)
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) workingDays++;
    }

    const summary: AttendanceSummary = {
      employeeId,
      employeeName,
      department,
      periodStart: startDate,
      periodEnd: endDate,
      workingDays,
      daysPresent: employeeRecords.filter(r => r.status === 'present' || r.status === 'late').length,
      daysAbsent: employeeRecords.filter(r => r.status === 'absent').length,
      daysLate: employeeRecords.filter(r => r.status === 'late').length,
      daysOnLeave: employeeRecords.filter(r => r.status === 'leave').length,
      holidays: employeeRecords.filter(r => r.status === 'holiday').length,
      totalRegularHours: employeeRecords.reduce((sum, r) => sum + r.regularHours, 0),
      totalOvertimeHours: employeeRecords.reduce((sum, r) => sum + r.overtimeHours, 0),
      totalLateMinutes: employeeRecords.reduce((sum, r) => sum + r.lateMinutes, 0),
      averageHoursPerDay: 0,
    };

    summary.averageHoursPerDay = summary.daysPresent > 0
      ? (summary.totalRegularHours + summary.totalOvertimeHours) / summary.daysPresent
      : 0;

    return summary;
  }

  /**
   * Get daily attendance report
   */
  async getDailyReport(tenantId: string, date: string, totalEmployees: number): Promise<DailyAttendanceReport> {
    const records = await this.getAttendanceByDate(tenantId, date);

    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const _absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const onLeave = records.filter(r => r.status === 'leave').length;

    return {
      date,
      totalEmployees,
      present,
      absent: totalEmployees - present - onLeave,
      late,
      onLeave,
      attendanceRate: totalEmployees > 0 ? (present / totalEmployees) * 100 : 0,
    };
  }

  /**
   * Get import history
   */
  async getImportHistory(tenantId: string, limitCount: number = 20): Promise<AttendanceImportBatch[]> {
    const q = query(
      this.importsRef,
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      importDate: doc.data().importDate?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as AttendanceImportBatch[];
  }
}

export const attendanceService = new AttendanceService();
