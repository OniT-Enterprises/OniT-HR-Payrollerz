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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FirestoreTimestamp } from "@/types/firebase";

// Pure calculations/thresholds live in a Firebase-free module so they can be
// unit-tested without loading the Firestore client. Imported for internal use
// and re-exported so existing importers of `@/services/attendanceService`
// keep working unchanged.
import {
  computeEntryHours,
  calculateHoursBetween,
  calculateLateMinutes,
  calculateEarlyDeparture,
  calculateNightHours,
  classifyWorkedHours,
  determineStatus,
  calculateHoursBreakdown,
  DEFAULT_EXPECTED_START,
  DEFAULT_EXPECTED_END,
  MAX_REASONABLE_ENTRY_HOURS,
  type WorkedDayHours,
} from "@/lib/attendanceCalculations";
import { getTLPublicHolidays } from "@/lib/payroll/tl-holidays";
import { holidayService } from "@/services/holidayService";
export {
  computeEntryHours,
  calculateHoursBetween,
  calculateLateMinutes,
  calculateEarlyDeparture,
  calculateNightHours,
  classifyWorkedHours,
  needsBreakWarning,
  determineStatus,
  calculateHoursBreakdown,
  DEFAULT_EXPECTED_START,
  DEFAULT_EXPECTED_END,
  LATE_GRACE_MINUTES,
  MAX_REASONABLE_ENTRY_HOURS,
  DEFAULT_BREAK_MINUTES,
} from "@/lib/attendanceCalculations";
export type {
  AttendanceStatus,
  AttendanceSource,
} from "@/lib/attendanceCalculations";

import type {
  AttendanceStatus,
  AttendanceSource,
} from "@/lib/attendanceCalculations";

export interface AttendanceRecord {
  id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId?: string;
  date: string; // YYYY-MM-DD

  // Clock times
  clockIn?: string; // HH:MM
  clockOut?: string; // HH:MM
  breakStart?: string;
  breakEnd?: string;

  // Calculated hours
  regularHours: number;
  overtimeHours: number;
  /** Hours worked in the 21:00–06:00 night window (subset of worked hours). */
  nightHours: number;
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
  deviceType: "zkteco" | "anviz" | "hikvision" | "suprema" | "other";
  importDate: FirestoreTimestamp;
  importedBy: string;

  // Stats
  recordCount: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  errors?: string[];

  // Status
  status: "processing" | "completed" | "failed";

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
  /**
   * Overtime = per-day >8h split PLUS the Art. 25(1) weekly top-up: regular
   * (1×) hours beyond 44 in one ISO week are reclassified here, so a 6×8h
   * week correctly yields 4h of overtime even though no single day passed 8h.
   */
  overtimeHours: number;
  nightHours: number;
  /**
   * Hours actually WORKED on a mandatory national public holiday. Reclassified
   * OUT of regularHours/overtimeHours so payroll pays them the Art. 27 2× rate
   * instead of leaving holiday work at 1× (the old behaviour, which never
   * auto-populated holiday hours at all).
   */
  holidayHours: number;
  /**
   * Hours worked on the weekly rest day — Sunday by default (Art. 30(2)) —
   * reclassified out of regular/overtime exactly like holidayHours so payroll
   * pays the Art. 27(2) 2× rest-day rate. A Sunday that is also a public
   * holiday counts as holiday only (never both). Per-employee non-Sunday rest
   * days are out of scope (manual payroll-row entry covers them).
   */
  restDayHours: number;
  /** Largest single-day overtime in the period — Art. 27(4) caps it at 4h. */
  maxDailyOvertimeHours: number;
  /** Largest single-ISO-week overtime in the period — Art. 27(4) caps it at 16h. */
  maxWeeklyOvertimeHours: number;
  /** Largest single holiday/rest-day worked stretch — Art. 27(3) caps it at 8h. */
  maxHolidayOrRestDayHours: number;
  lateMinutes: number;
  daysPresent: number;
  recordsCount: number;
}

// ============================================
// SERVICE CLASS
// ============================================

class AttendanceService {
  private get collectionRef() {
    return collection(db, "attendance");
  }

  private get importsRef() {
    return collection(db, "attendanceImports");
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
    departmentId?: string,
  ): Promise<{ start: string; end: string }> {
    try {
      const shiftsRef = collection(db, `tenants/${tenantId}/shifts`);
      const q = departmentId
        ? query(
            shiftsRef,
            where("departmentId", "==", departmentId),
            where("employeeId", "==", employeeId),
            where("date", "==", date),
            limit(1),
          )
        : query(
            shiftsRef,
            where("employeeId", "==", employeeId),
            where("date", "==", date),
            limit(1),
          );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const shift = snap.docs[0].data();
        if (shift.startTime && shift.endTime && shift.status !== "cancelled") {
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
    department?: string,
    employeeId?: string,
    departmentId?: string,
  ): Promise<AttendanceRecord[]> {
    const q = employeeId
      ? query(
          this.collectionRef,
          where("tenantId", "==", tenantId),
          where("employeeId", "==", employeeId),
          where("date", ">=", startDate),
          where("date", "<=", endDate),
          orderBy("date", "desc"),
          orderBy("employeeName", "asc"),
        )
      : departmentId
        ? query(
            this.collectionRef,
            where("tenantId", "==", tenantId),
            where("departmentId", "==", departmentId),
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "desc"),
            orderBy("employeeName", "asc"),
          )
        : query(
            this.collectionRef,
            where("tenantId", "==", tenantId),
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "desc"),
            orderBy("employeeName", "asc"),
          );

    const querySnapshot = await getDocs(q);
    let records = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as AttendanceRecord[];

    // Filter by department if specified
    if (department && department !== "all") {
      records = records.filter((r) => r.department === department);
    }

    return records;
  }

  /**
   * Get attendance for a specific date
   */
  async getAttendanceByDate(
    tenantId: string,
    date: string,
    employeeId?: string,
    departmentId?: string,
  ): Promise<AttendanceRecord[]> {
    return this.getAttendanceByDateRange(
      tenantId,
      date,
      date,
      undefined,
      employeeId,
      departmentId,
    );
  }

  /**
   * Get summarized attendance by employee for a date range
   * Used by payroll to sync real attendance metrics into payroll inputs.
   */
  async getAttendanceSummaryByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceEmployeeSummary[]> {
    const records = await this.getAttendanceByDateRange(
      tenantId,
      startDate,
      endDate,
    );

    // One record per employee per day. The old department-scoped probe could
    // create duplicate day records (and older mobile syncs still might);
    // summing both would double-count the hours straight into payroll. Keep
    // the most recently updated record — edits go through markAttendance,
    // which updates in place.
    const updatedMillis = (record: AttendanceRecord): number =>
      record.updatedAt instanceof Date ? record.updatedAt.getTime() : 0;
    const byEmployeeDay = new Map<string, AttendanceRecord>();
    for (const record of records) {
      if (!record.employeeId || !record.date) continue;
      const key = `${record.employeeId}|${record.date}`;
      const kept = byEmployeeDay.get(key);
      if (!kept || updatedMillis(record) >= updatedMillis(kept)) {
        byEmployeeDay.set(key, record);
      }
    }

    // Public holidays spanning the range. Hours worked on these dates are
    // Art. 27(2) 2× time, so they must be reclassified out of regular/overtime
    // into holidayHours — otherwise holiday work is silently paid at 1×.
    // Tenant overrides MUST apply here, with the same effective set the payroll
    // sync uses for its absence baseline: the variable Islamic dates ship as
    // estimates that tenants are told to correct via overrides, so a removed
    // date is (usually) "the government moved it", not "we don't observe it".
    // If the two sets diverged, a worked removed-date would book phantom
    // absence next to a bogus 2× premium.
    const holidayDates = new Set<string>();
    const startYear = Number(startDate.slice(0, 4));
    const endYear = Number(endDate.slice(0, 4));
    for (let y = startYear; y <= endYear; y++) {
      for (const h of getTLPublicHolidays(y)) {
        if (h.date >= startDate && h.date <= endDate) holidayDates.add(h.date);
      }
    }
    try {
      const overrides = (
        await Promise.all(
          Array.from({ length: endYear - startYear + 1 }, (_, i) =>
            holidayService.listTenantHolidayOverrides(tenantId, startYear + i),
          ),
        )
      ).flat();
      for (const override of overrides) {
        if (override.date < startDate || override.date > endDate) continue;
        if (override.isHoliday) holidayDates.add(override.date);
        else holidayDates.delete(override.date);
      }
    } catch (error) {
      // Degrade to the national list rather than failing the whole summary —
      // matches the payroll sync's fallback for the same lookup.
      console.error("Failed to load tenant holiday overrides for attendance summary:", error);
    }

    // First pass: per-employee day list plus the additive counters. The
    // per-day holiday/rest-day reclassification and the Art. 25(1) weekly
    // 44h overtime top-up live in the pure, unit-tested classifyWorkedHours
    // (client/lib/attendanceCalculations.ts).
    interface EmployeeAccumulator {
      employeeId: string;
      employeeName: string;
      department: string;
      days: WorkedDayHours[];
      nightHours: number;
      lateMinutes: number;
      daysPresent: number;
      recordsCount: number;
    }
    const byEmployee = new Map<string, EmployeeAccumulator>();
    for (const record of byEmployeeDay.values()) {
      if (!record.employeeId) continue;

      // Records written before night-hours tracking have no `nightHours`;
      // derive it from the clock times so historical months still credit the
      // night premium.
      const nightHours =
        record.nightHours ??
        calculateNightHours(
          record.clockIn || "",
          record.clockOut || "",
          record.totalHours,
        );

      let accumulator = byEmployee.get(record.employeeId);
      if (!accumulator) {
        accumulator = {
          employeeId: record.employeeId,
          employeeName: record.employeeName,
          department: record.department,
          days: [],
          nightHours: 0,
          lateMinutes: 0,
          daysPresent: 0,
          recordsCount: 0,
        };
        byEmployee.set(record.employeeId, accumulator);
      }
      accumulator.days.push({
        date: record.date,
        regularHours: record.regularHours || 0,
        overtimeHours: record.overtimeHours || 0,
      });
      accumulator.nightHours += nightHours;
      accumulator.lateMinutes += record.lateMinutes || 0;
      accumulator.recordsCount += 1;
      if (
        (record.totalHours || 0) > 0 ||
        record.status === "present" ||
        record.status === "late"
      ) {
        accumulator.daysPresent += 1;
      }
    }

    // Second pass: classify each employee's days — holiday (Art. 27(2) 2×),
    // Sunday rest day (Arts. 30(2), 27(2) 2×, holiday wins on overlap), then
    // the weekly pass reclassifying regular hours beyond 44/ISO-week into
    // overtime (Art. 25(1)) and computing the Art. 27(3)/(4) cap maxima.
    // Weeks straddling the range boundary only count in-range days (accepted:
    // run periods start at month boundaries — see classifyWorkedHours docs).
    return Array.from(byEmployee.values())
      .map((accumulator): AttendanceEmployeeSummary => {
        const classified = classifyWorkedHours(accumulator.days, holidayDates);
        return {
          employeeId: accumulator.employeeId,
          employeeName: accumulator.employeeName,
          department: accumulator.department,
          regularHours: classified.regularHours,
          overtimeHours: classified.overtimeHours,
          holidayHours: classified.holidayHours,
          restDayHours: classified.restDayHours,
          maxDailyOvertimeHours: classified.maxDailyOvertimeHours,
          maxWeeklyOvertimeHours: classified.maxWeeklyOvertimeHours,
          maxHolidayOrRestDayHours: classified.maxHolidayOrRestDayHours,
          nightHours: accumulator.nightHours,
          lateMinutes: accumulator.lateMinutes,
          daysPresent: accumulator.daysPresent,
          recordsCount: accumulator.recordsCount,
        };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }

  /**
   * Get employee's attendance for a month
   */
  async getEmployeeAttendance(
    tenantId: string,
    employeeId: string,
    year: number,
    month: number,
  ): Promise<AttendanceRecord[]> {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

    const q = query(
      this.collectionRef,
      where("tenantId", "==", tenantId),
      where("employeeId", "==", employeeId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "asc"),
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
  async markAttendance(
    tenantId: string,
    data: {
      employeeId: string;
      employeeName: string;
      department: string;
      departmentId?: string;
      date: string;
      clockIn?: string;
      clockOut?: string;
      breakStart?: string;
      breakEnd?: string;
      source: AttendanceSource;
      notes?: string;
    },
  ): Promise<string> {
    // Check if record already exists for this employee/date
    const existing = await this.getExistingRecord(
      tenantId,
      data.employeeId,
      data.date,
    );

    // Calculate hours
    const explicitBreak =
      data.breakStart && data.breakEnd
        ? calculateHoursBetween(data.breakStart, data.breakEnd) * 60
        : undefined;
    const { breakMinutes, totalHours } = computeEntryHours(
      data.clockIn || "",
      data.clockOut || "",
      explicitBreak,
    );

    if (totalHours > MAX_REASONABLE_ENTRY_HOURS) {
      throw new Error(
        `Entry computes to ${totalHours.toFixed(1)}h — check clock-in/clock-out times`,
      );
    }

    const expected = await this.getExpectedTimes(
      tenantId,
      data.employeeId,
      data.date,
      data.departmentId,
    );
    const lateMinutes = calculateLateMinutes(
      data.clockIn || "",
      expected.start,
    );
    const earlyDepartureMinutes = calculateEarlyDeparture(
      data.clockOut || "",
      expected.end,
    );

    const { regular, overtime } = calculateHoursBreakdown(totalHours);
    const nightHours = calculateNightHours(
      data.clockIn || "",
      data.clockOut || "",
      totalHours,
    );
    const status = determineStatus(
      data.clockIn,
      data.clockOut,
      lateMinutes,
      totalHours,
    );

    const record: Omit<AttendanceRecord, "id"> = {
      tenantId,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      department: data.department,
      departmentId: data.departmentId,
      date: data.date,
      clockIn: data.clockIn,
      clockOut: data.clockOut,
      breakStart: data.breakStart,
      breakEnd: data.breakEnd,
      regularHours: regular,
      overtimeHours: overtime,
      nightHours,
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
      await updateDoc(doc(db, "attendance", existing.id!), {
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
   * Get the existing attendance record for an employee on a date, if any.
   *
   * Deliberately dept-agnostic: an employee has at most one attendance record
   * per calendar day, so the probe keys only on tenant + employee + date.
   * Filtering by departmentId here used to MISS a legacy/field-less record (or
   * one written under a different departmentId) for the same employee/day, so
   * markAttendance would addDoc a SECOND record that
   * getAttendanceSummaryByDateRange then double-counted into payroll.
   */
  private async getExistingRecord(
    tenantId: string,
    employeeId: string,
    date: string,
  ): Promise<AttendanceRecord | null> {
    const q = query(
      this.collectionRef,
      where("tenantId", "==", tenantId),
      where("employeeId", "==", employeeId),
      where("date", "==", date),
      limit(1),
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
    },
  ): Promise<boolean> {
    const docRef = doc(db, "attendance", recordId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Attendance record not found");
    }

    const current = docSnap.data() as AttendanceRecord;

    // Verify tenant ownership
    if (current.tenantId !== tenantId) {
      throw new Error("Access denied");
    }

    // Calculate new hours if times changed
    const newClockIn = adjustments.clockIn || current.clockIn;
    const newClockOut = adjustments.clockOut || current.clockOut;

    const hadExplicitBreak = Boolean(current.breakStart && current.breakEnd);
    const { breakMinutes, totalHours } = computeEntryHours(
      newClockIn || "",
      newClockOut || "",
      hadExplicitBreak ? current.breakMinutes : undefined,
    );

    if (totalHours > MAX_REASONABLE_ENTRY_HOURS) {
      throw new Error(
        `Entry computes to ${totalHours.toFixed(1)}h — check clock-in/clock-out times`,
      );
    }

    const expected = await this.getExpectedTimes(
      tenantId,
      current.employeeId,
      current.date,
      current.departmentId,
    );
    const { regular, overtime } = calculateHoursBreakdown(totalHours);
    const nightHours = calculateNightHours(
      newClockIn || "",
      newClockOut || "",
      totalHours,
    );
    const lateMinutes = calculateLateMinutes(newClockIn || "", expected.start);
    const earlyDepartureMinutes = calculateEarlyDeparture(
      newClockOut || "",
      expected.end,
    );

    await updateDoc(docRef, {
      clockIn: newClockIn,
      clockOut: newClockOut,
      regularHours: regular,
      overtimeHours: overtime,
      nightHours,
      totalHours,
      breakMinutes,
      lateMinutes,
      earlyDepartureMinutes,
      status:
        adjustments.status ||
        determineStatus(newClockIn, newClockOut, lateMinutes, totalHours),
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
    const docRef = doc(db, "attendance", recordId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.tenantId !== tenantId) {
        throw new Error("Access denied");
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
      departmentId?: string;
      date: string;
      clockIn?: string;
      clockOut?: string;
    }[],
    metadata: {
      fileName: string;
      deviceType: AttendanceImportBatch["deviceType"];
      importedBy: string;
    },
  ): Promise<{
    batchId: string;
    stats: { success: number; errors: number; duplicates: number };
  }> {
    if (records.length === 0) {
      throw new Error("No attendance records to import");
    }

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    // Prefetch existing records for the date range to avoid N+1 queries
    const dates = [...new Set(records.map((r) => r.date))].sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const existingQuery = query(
      this.collectionRef,
      where("tenantId", "==", tenantId),
      where("date", ">=", minDate),
      where("date", "<=", maxDate),
    );
    const existingSnapshot = await getDocs(existingQuery);
    const existingKeys = new Set(
      existingSnapshot.docs.map(
        (d) => `${d.data().employeeId}:${d.data().date}`,
      ),
    );

    // Prefetch scheduled shifts for the range so lateness is judged against
    // each employee's actual shift, not the default day-shift start
    const expectedByKey = new Map<string, { start: string; end: string }>();
    try {
      const shiftsSnapshot = await getDocs(
        query(
          collection(db, `tenants/${tenantId}/shifts`),
          where("date", ">=", minDate),
          where("date", "<=", maxDate),
        ),
      );
      for (const d of shiftsSnapshot.docs) {
        const s = d.data();
        if (
          s.employeeId &&
          s.startTime &&
          s.endTime &&
          s.status !== "cancelled"
        ) {
          expectedByKey.set(`${s.employeeId}:${s.date}`, {
            start: s.startTime,
            end: s.endTime,
          });
        }
      }
    } catch {
      // Best-effort — records fall back to default expected times
    }

    // Create import batch record
    const importRef = doc(this.importsRef);
    const batchId = importRef.id;

    let batch = writeBatch(db);
    let writesInBatch = 0;
    let rowNumber = 1;
    const commitBatchIfFull = async () => {
      if (writesInBatch < 450) return;
      await batch.commit();
      batch = writeBatch(db);
      writesInBatch = 0;
    };

    for (const record of records) {
      rowNumber += 1;
      try {
        // Check for duplicate using prefetched data
        if (existingKeys.has(`${record.employeeId}:${record.date}`)) {
          duplicateCount++;
          continue;
        }

        // Calculate hours
        const { breakMinutes, totalHours } = computeEntryHours(
          record.clockIn || "",
          record.clockOut || "",
        );
        if (totalHours > MAX_REASONABLE_ENTRY_HOURS) {
          throw new Error(`Entry computes to ${totalHours.toFixed(1)}h`);
        }
        const { regular, overtime } = calculateHoursBreakdown(totalHours);
        const nightHours = calculateNightHours(
          record.clockIn || "",
          record.clockOut || "",
          totalHours,
        );
        const expected = expectedByKey.get(
          `${record.employeeId}:${record.date}`,
        ) ?? { start: DEFAULT_EXPECTED_START, end: DEFAULT_EXPECTED_END };
        const lateMinutes = calculateLateMinutes(
          record.clockIn || "",
          expected.start,
        );
        const status = determineStatus(
          record.clockIn,
          record.clockOut,
          lateMinutes,
          totalHours,
        );

        const attendanceRef = doc(this.collectionRef);
        batch.set(attendanceRef, {
          ...record,
          tenantId,
          regularHours: regular,
          overtimeHours: overtime,
          nightHours,
          lateMinutes,
          earlyDepartureMinutes: calculateEarlyDeparture(
            record.clockOut || "",
            expected.end,
          ),
          breakMinutes,
          totalHours,
          status,
          source: "fingerprint",
          importBatchId: batchId,
          isAdjusted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        writesInBatch += 1;
        existingKeys.add(`${record.employeeId}:${record.date}`);
        await commitBatchIfFull();

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(
          `Row ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`,
        );
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
      status: errorCount > 0 && successCount === 0 ? "failed" : "completed",
      importDate: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    writesInBatch += 1;

    if (writesInBatch > 0) await batch.commit();

    return {
      batchId,
      stats: {
        success: successCount,
        errors: errorCount,
        duplicates: duplicateCount,
      },
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
    endDate: string,
  ): Promise<AttendanceSummary> {
    const records = await this.getAttendanceByDateRange(
      tenantId,
      startDate,
      endDate,
    );
    const employeeRecords = records.filter((r) => r.employeeId === employeeId);

    // Calculate working days (excluding weekends)
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    let workingDays = 0;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) workingDays++;
    }

    const summary: AttendanceSummary = {
      employeeId,
      employeeName,
      department,
      periodStart: startDate,
      periodEnd: endDate,
      workingDays,
      daysPresent: employeeRecords.filter(
        (r) => r.status === "present" || r.status === "late",
      ).length,
      daysAbsent: employeeRecords.filter((r) => r.status === "absent").length,
      daysLate: employeeRecords.filter((r) => r.status === "late").length,
      daysOnLeave: employeeRecords.filter((r) => r.status === "leave").length,
      holidays: employeeRecords.filter((r) => r.status === "holiday").length,
      totalRegularHours: employeeRecords.reduce(
        (sum, r) => sum + r.regularHours,
        0,
      ),
      totalOvertimeHours: employeeRecords.reduce(
        (sum, r) => sum + r.overtimeHours,
        0,
      ),
      totalLateMinutes: employeeRecords.reduce(
        (sum, r) => sum + r.lateMinutes,
        0,
      ),
      averageHoursPerDay: 0,
    };

    summary.averageHoursPerDay =
      summary.daysPresent > 0
        ? (summary.totalRegularHours + summary.totalOvertimeHours) /
          summary.daysPresent
        : 0;

    return summary;
  }

  /**
   * Get daily attendance report
   */
  async getDailyReport(
    tenantId: string,
    date: string,
    totalEmployees: number,
  ): Promise<DailyAttendanceReport> {
    const records = await this.getAttendanceByDate(tenantId, date);

    const present = records.filter(
      (r) => r.status === "present" || r.status === "late",
    ).length;
    const absent = records.filter((r) => r.status === "absent").length;
    const late = records.filter((r) => r.status === "late").length;
    const onLeave = records.filter((r) => r.status === "leave").length;

    return {
      date,
      totalEmployees,
      present,
      absent,
      late,
      onLeave,
      attendanceRate: totalEmployees > 0 ? (present / totalEmployees) * 100 : 0,
    };
  }

  /**
   * Get import history
   */
  async getImportHistory(
    tenantId: string,
    limitCount: number = 20,
  ): Promise<AttendanceImportBatch[]> {
    const q = query(
      this.importsRef,
      where("tenantId", "==", tenantId),
      orderBy("createdAt", "desc"),
      limit(limitCount),
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
