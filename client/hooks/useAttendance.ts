/**
 * React Query hooks for attendance data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { attendanceService, type AttendanceSource } from '@/services/attendanceService';

export const attendanceKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'attendance'] as const,
  byDate: (tenantId: string, date: string) => [...attendanceKeys.all(tenantId), 'date', date] as const,
};

/**
 * Fetch attendance records for a specific date
 */
export function useAttendanceByDate(date: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: attendanceKeys.byDate(tenantId, date),
    queryFn: () => attendanceService.getAttendanceByDate(tenantId, date),
    staleTime: 2 * 60 * 1000, // 2 minutes — attendance changes frequently
    gcTime: 10 * 60 * 1000,
    enabled: !!tenantId && !!date,
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
