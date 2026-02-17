/**
 * Attendance types — mirrors web attendanceService structure
 * Attendance: global `attendance` collection
 */

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'half_day'
  | 'leave'
  | 'holiday';

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD

  clockIn?: string; // HH:MM
  clockOut?: string;

  regularHours: number;
  overtimeHours: number;
  lateMinutes: number;
  totalHours: number;

  status: AttendanceStatus;
}

export interface AttendanceSummary {
  workingDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysOnLeave: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
}
