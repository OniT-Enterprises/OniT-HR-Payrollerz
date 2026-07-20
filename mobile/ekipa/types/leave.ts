/**
 * Leave types — mirrors web leaveService structure
 * Leave requests: global `leave_requests` collection
 * Leave balances: global `leave_balances` collection
 */

export type LeaveType =
  | 'annual'
  | 'sick'
  | 'maternity'
  | 'paternity'
  // Pooled justified absence — Lei 4/2012 Art. 33(3): 3 paid days/year covering
  // marriage, family death, and community/religious events.
  | 'special'
  | 'unpaid'
  | 'study'
  | 'custom'
  // Legacy render-only: no longer requestable (pooled into 'special');
  // kept so existing requests keep rendering.
  | 'bereavement'
  | 'marriage';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId: string;

  leaveType: LeaveType;
  leaveTypeLabel: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  duration: number; // working days

  reason: string;
  status: LeaveStatus;
  requestDate: string;

  approverId?: string;
  approverName?: string;
  approvedDate?: string;
  rejectionReason?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface LeaveBalanceItem {
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface LeaveBalance {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  year: number;

  annual: LeaveBalanceItem;
  sick: LeaveBalanceItem;
  maternity?: LeaveBalanceItem;
  paternity?: LeaveBalanceItem;
  unpaid: LeaveBalanceItem;

  carryOver: number;
  updatedAt?: Date;
}
