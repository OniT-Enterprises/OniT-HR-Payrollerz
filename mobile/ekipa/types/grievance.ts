export type GrievanceCategory = 'harassment' | 'wage_issue' | 'safety_concern' | 'discrimination' | 'other';
export type GrievanceStatus = 'submitted' | 'reviewing' | 'resolved' | 'dismissed';

export interface Grievance {
  id: string;
  tenantId: string;
  // NO userId — truly anonymous
  ticketId: string; // random anonymous ticket ID for tracking
  category: GrievanceCategory;
  description: string;
  attachmentUrls: string[];
  status: GrievanceStatus;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}
