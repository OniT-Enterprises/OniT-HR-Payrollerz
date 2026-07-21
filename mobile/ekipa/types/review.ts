export type ReviewStatus = 'draft' | 'submitted' | 'acknowledged' | 'completed';

export interface CompetencyRating {
  name: string;
  rating: number;
  comments?: string;
}

export interface PerformanceReview {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  reviewType: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  reviewDate: string;
  reviewerName: string;
  overallRating: number;
  competencies: CompetencyRating[];
  strengths: string;
  areasForImprovement: string;
  managerComments: string;
  developmentPlan: string;
  employeeComments?: string;
  status: ReviewStatus;
  acknowledgedAt?: Date;
  submittedAt?: Date;
  completedAt?: Date;
}
