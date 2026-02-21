/**
 * Crew time tracking types — supervisor mode
 * Extends existing attendance types for supervisor-submitted batch clock-ins
 */
import type { AttendanceStatus } from './attendance';

export type AttendanceSource = 'manual' | 'import' | 'biometric' | 'supervisor';

export interface SupervisorAttendanceRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  date: string; // YYYY-MM-DD

  clockIn?: string; // HH:MM
  clockOut?: string;

  regularHours: number;
  overtimeHours: number;
  lateMinutes: number;
  totalHours: number;

  status: AttendanceStatus;
  source: AttendanceSource;

  // Supervisor fields
  supervisorId: string;
  supervisorName: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  siteId?: string;
  siteName?: string;
  batchId: string;
}

export type SyncStatus = 'pending' | 'uploading' | 'synced' | 'error';

export interface PendingClockIn {
  id: string;
  batchId: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  recordType: 'clock_in' | 'clock_out';

  supervisorId: string;
  supervisorName: string;
  photoLocalPath?: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  siteId?: string;
  siteName?: string;

  syncStatus: SyncStatus;
  syncError?: string;
  syncAttempts: number;
  createdAt: string; // ISO
  syncedAt?: string;
}

export interface SyncBatch {
  id: string;
  tenantId: string;
  supervisorId: string;
  supervisorName: string;
  recordType: 'clock_in' | 'clock_out';
  date: string;
  siteId?: string;
  siteName?: string;
  workerCount: number;

  photoLocalPath?: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;

  syncStatus: SyncStatus;
  syncError?: string;
  syncAttempts: number;
  createdAt: string;
  syncedAt?: string;
}

export interface CrewMember {
  employeeId: string;
  firstName: string;
  lastName: string;
  department?: string;
  position?: string;
  qrCode?: string;
}

export interface WorkSite {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}
