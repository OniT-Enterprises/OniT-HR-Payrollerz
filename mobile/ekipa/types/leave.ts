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
  | 'bereavement'
  | 'unpaid'
  | 'marriage'
  | 'study'
  | 'custom';

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
