export type ExpenseCategory = 'travel' | 'supplies' | 'meals' | 'transport' | 'equipment' | 'other';
export type ExpenseStatus = 'submitted' | 'approved' | 'rejected' | 'paid';

export interface Expense {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  description: string;
  receiptUrl?: string;
  status: ExpenseStatus;
  approvedBy?: string;
  approverName?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
