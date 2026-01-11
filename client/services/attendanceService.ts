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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TL_WORKING_HOURS, TL_OVERTIME_RATES } from '@/lib/payroll/constants-tl';

// ============================================
// TYPES
// ============================================

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'half_day' | 'leave' | 'holiday';
export type AttendanceSource = 'manual' | 'fingerprint' | 'mobile_app' | 'qr_code' | 'facial';

export interface AttendanceRecord {
  id?: string;
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
  createdAt?: any;
  updatedAt?: any;
}

export interface AttendanceImportBatch {
  id?: string;
  fileName: string;
  deviceType: 'zkteco' | 'anviz' | 'hikvision' | 'suprema' | 'other';
  importDate: any;
  importedBy: string;

  // Stats
  recordCount: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  errors?: string[];

  // Status
  status: 'processing' | 'completed' | 'failed';

  createdAt?: any;
}

export interface AttendanceSummary {
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

export interface DailyAttendanceReport {
  date: string;
  totalEmployees: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  attendanceRate: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate hours between two time strings
 */
function calculateHoursBetween(start: string, end: string): number {
  if (!start || !end) return 0;

  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

/**
 * Calculate late minutes based on expected start time
 */
function calculateLateMinutes(clockIn: string, expectedStart: string = '08:00'): number {
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
function calculateEarlyDeparture(clockOut: string, expectedEnd: string = '17:00'): number {
  if (!clockOut) return 0;

  const [clockHour, clockMin] = clockOut.split(':').map(Number);
  const [expectedHour, expectedMin] = expectedEnd.split(':').map(Number);

  const clockMinutes = clockHour * 60 + clockMin;
  const expectedMinutes = expectedHour * 60 + expectedMin;

  return Math.max(0, expectedMinutes - clockMinutes);
}

/**
 * Determine attendance status
 */
function determineStatus(
  clockIn: string | undefined,
  clockOut: string | undefined,
  lateMinutes: number,
  totalHours: number
): AttendanceStatus {
  if (!clockIn && !clockOut) return 'absent';
  if (totalHours < 4) return 'half_day';
  if (lateMinutes > 15) return 'late'; // More than 15 min late
  return 'present';
}

/**
 * Calculate regular and overtime hours
 */
function calculateHoursBreakdown(totalHours: number): { regular: number; overtime: number } {
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
   * Get attendance records for a date range
   */
  async getAttendanceByDateRange(
    startDate: string,
    endDate: string,
    department?: string
  ): Promise<AttendanceRecord[]> {
    let q = query(
      this.collectionRef,
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
  async getAttendanceByDate(date: string): Promise<AttendanceRecord[]> {
    return this.getAttendanceByDateRange(date, date);
  }

  /**
   * Get employee's attendance for a month
   */
  async getEmployeeAttendance(
    employeeId: string,
    year: number,
    month: number
  ): Promise<AttendanceRecord[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const q = query(
      this.collectionRef,
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
  async markAttendance(data: {
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
    const existing = await this.getExistingRecord(data.employeeId, data.date);

    // Calculate hours
    const breakMinutes = data.breakStart && data.breakEnd
      ? calculateHoursBetween(data.breakStart, data.breakEnd) * 60
      : 60; // Default 1 hour break

    const rawHours = calculateHoursBetween(data.clockIn || '', data.clockOut || '');
    const totalHours = Math.max(0, rawHours - (breakMinutes / 60));

    const lateMinutes = calculateLateMinutes(data.clockIn || '');
    const earlyDepartureMinutes = calculateEarlyDeparture(data.clockOut || '');

    const { regular, overtime } = calculateHoursBreakdown(totalHours);
    const status = determineStatus(data.clockIn, data.clockOut, lateMinutes, totalHours);

    const record: Omit<AttendanceRecord, 'id'> = {
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
  private async getExistingRecord(employeeId: string, date: string): Promise<AttendanceRecord | null> {
    const q = query(
      this.collectionRef,
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

    // Calculate new hours if times changed
    const newClockIn = adjustments.clockIn || current.clockIn;
    const newClockOut = adjustments.clockOut || current.clockOut;

    const rawHours = calculateHoursBetween(newClockIn || '', newClockOut || '');
    const totalHours = Math.max(0, rawHours - (current.breakMinutes / 60));
    const { regular, overtime } = calculateHoursBreakdown(totalHours);
    const lateMinutes = calculateLateMinutes(newClockIn || '');

    await updateDoc(docRef, {
      clockIn: newClockIn,
      clockOut: newClockOut,
      regularHours: regular,
      overtimeHours: overtime,
      totalHours,
      lateMinutes,
      status: adjustments.status || determineStatus(newClockIn, newClockOut, lateMinutes, totalHours),
      isAdjusted: true,
      adjustedBy: adjustments.adjustedBy,
      adjustmentReason: adjustments.reason,
      originalClockIn: current.clockIn,
      originalClockOut: current.clockOut,
      updatedAt: serverTimestamp(),
    });

    return true;
  }

  /**
   * Delete attendance record
   */
  async deleteAttendance(recordId: string): Promise<boolean> {
    await deleteDoc(doc(db, 'attendance', recordId));
    return true;
  }

  /**
   * Import attendance from fingerprint device
   */
  async importFromDevice(
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

    // Create import batch record
    const importRef = doc(this.importsRef);
    const batchId = importRef.id;

    for (const record of records) {
      try {
        // Check for duplicate
        const existing = await this.getExistingRecord(record.employeeId, record.date);

        if (existing) {
          duplicateCount++;
          continue;
        }

        // Calculate hours
        const rawHours = calculateHoursBetween(record.clockIn || '', record.clockOut || '');
        const totalHours = Math.max(0, rawHours - 1); // Assume 1 hour break
        const { regular, overtime } = calculateHoursBreakdown(totalHours);
        const lateMinutes = calculateLateMinutes(record.clockIn || '');
        const status = determineStatus(record.clockIn, record.clockOut, lateMinutes, totalHours);

        const attendanceRef = doc(this.collectionRef);
        batch.set(attendanceRef, {
          ...record,
          regularHours: regular,
          overtimeHours: overtime,
          lateMinutes,
          earlyDepartureMinutes: calculateEarlyDeparture(record.clockOut || ''),
          breakMinutes: 60,
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
    employeeId: string,
    employeeName: string,
    department: string,
    startDate: string,
    endDate: string
  ): Promise<AttendanceSummary> {
    const records = await this.getAttendanceByDateRange(startDate, endDate);
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
  async getDailyReport(date: string, totalEmployees: number): Promise<DailyAttendanceReport> {
    const records = await this.getAttendanceByDate(date);

    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
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
  async getImportHistory(limitCount: number = 20): Promise<AttendanceImportBatch[]> {
    const q = query(
      this.importsRef,
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
export default attendanceService;
