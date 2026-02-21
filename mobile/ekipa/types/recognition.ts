export type RecognitionCategory = 'teamwork' | 'above_and_beyond' | 'safety' | 'customer_service' | 'innovation' | 'leadership';

export interface Recognition {
  id: string;
  tenantId: string;
  fromEmployeeId: string;
  fromEmployeeName: string;
  toEmployeeId: string;
  toEmployeeName: string;
  message: string;
  category: RecognitionCategory;
  createdAt: Date;
}
