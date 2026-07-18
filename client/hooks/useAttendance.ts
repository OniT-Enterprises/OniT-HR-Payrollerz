/**
 * React Query hooks for attendance data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import {
  attendanceService,
  type AttendanceSource,
  type AttendanceStatus,
  type AttendanceEmployeeSummary,
} from '@/services/attendanceService';

export const attendanceKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'attendance'] as const,
  byDate: (tenantId: string, date: string, employeeId?: string, departmentId?: string) =>
    [...attendanceKeys.all(tenantId), 'date', date, employeeId ?? 'all', departmentId ?? 'all-departments'] as const,
  summaryByRange: (tenantId: string, startDate: string, endDate: string) =>
    [...attendanceKeys.all(tenantId), 'summary', startDate, endDate] as const,
};

/**
 * Fetch attendance records for a specific date
 */
export function useAttendanceByDate(
  date: string,
  employeeId?: string,
  enabled: boolean = true,
  departmentId?: string,
) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: attendanceKeys.byDate(tenantId, date, employeeId, departmentId),
    queryFn: () => attendanceService.getAttendanceByDate(tenantId, date, employeeId, departmentId),
    staleTime: 2 * 60 * 1000, // 2 minutes — attendance changes frequently
    gcTime: 10 * 60 * 1000,
    enabled: !!tenantId && !!date && enabled,
  });
}

/**
 * Fetch employee attendance summary for a date range
 */
export function useAttendanceSummary(startDate: string, endDate: string) {
  const tenantId = useTenantId();
  return useQuery<AttendanceEmployeeSummary[]>({
    queryKey: attendanceKeys.summaryByRange(tenantId, startDate, endDate),
    queryFn: () => attendanceService.getAttendanceSummaryByDateRange(tenantId, startDate, endDate),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!tenantId && !!startDate && !!endDate,
  });
}

/**
 * Mark attendance for an employee
 */
export function useMarkAttendance() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
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
    }) => attendanceService.markAttendance(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all(tenantId) });
    },
  });
}

/**
 * Adjust an existing attendance record (audit-logged)
 */
export function useAdjustAttendance() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, adjustments }: {
      recordId: string;
      adjustments: {
        clockIn?: string;
        clockOut?: string;
        status?: AttendanceStatus;
        reason: string;
        adjustedBy: string;
      };
    }) => attendanceService.adjustAttendance(tenantId, recordId, adjustments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all(tenantId) });
    },
  });
}

/**
 * Delete an attendance record
 */
export function useDeleteAttendance() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => attendanceService.deleteAttendance(tenantId, recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all(tenantId) });
    },
  });
}
