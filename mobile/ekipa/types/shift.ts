export type ShiftStatus = 'draft' | 'published' | 'confirmed' | 'cancelled';

export interface Shift {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location?: string;
  department?: string;
  shiftType?: string; // morning, afternoon, night
  status: ShiftStatus;
  notes?: string;
}
