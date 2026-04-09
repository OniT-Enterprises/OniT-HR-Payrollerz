/**
 * Performance Review Service
 * Manages employee performance reviews with Firestore persistence
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  getAggregateFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  sum,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ============================================
// Types
// ============================================

export type ReviewStatus = 'draft' | 'submitted' | 'acknowledged' | 'completed';

export type ReviewType = 'annual' | 'mid_year' | 'quarterly' | 'probation' | 'project' | 'adhoc';

export type RatingValue = 1 | 2 | 3 | 4 | 5;

export interface CompetencyRating {
  name: string;
  rating: RatingValue;
  comments?: string;
}

export interface GoalAssessment {
  goalId?: string;
  goalTitle: string;
  achievement: 'exceeded' | 'met' | 'partially_met' | 'not_met';
  comments?: string;
}

export interface PerformanceReview {
  id?: string;
  tenantId: string;

  // Employee info
  employeeId: string;
  employeeName: string;
  department?: string;
  position?: string;

  // Review metadata
  reviewType: ReviewType;
  reviewPeriodStart: string; // YYYY-MM-DD
  reviewPeriodEnd: string;
  reviewDate: string;

  // Reviewer info
  reviewerId: string;
  reviewerName: string;

  // Ratings
  overallRating: RatingValue;
  competencies: CompetencyRating[];
  goalAssessments: GoalAssessment[];

  // Comments
  strengths: string;
  areasForImprovement: string;
  managerComments: string;
  developmentPlan: string;

  // Self assessment (optional)
  selfAssessment?: {
    overallRating: RatingValue;
    achievements: string;
    challenges: string;
    goals: string;
    submitted: boolean;
    submittedAt?: Date;
  };

  // Employee acknowledgement
  employeeComments?: string;
  acknowledgedAt?: Date;

  // Status
  status: ReviewStatus;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  submittedAt?: Date;
  completedAt?: Date;
}

export interface ReviewFilters {
  employeeId?: string;
  reviewerId?: string;
  status?: ReviewStatus;
  reviewType?: ReviewType;
  year?: number;
}

interface ReviewStats {
  totalReviews: number;
  draft: number;
  submitted: number;
  acknowledged: number;
  completed: number;
  byType: Record<ReviewType, number>;
  averageRating: number;
}

// ============================================
// Constants
// ============================================

const REVIEWS_COLLECTION = 'reviews';

export const REVIEW_TYPES: { id: ReviewType; name: string }[] = [
  { id: 'annual', name: 'Annual Review' },
  { id: 'mid_year', name: 'Mid-Year Review' },
  { id: 'quarterly', name: 'Quarterly Review' },
  { id: 'probation', name: 'Probation Review' },
  { id: 'project', name: 'Project Review' },
  { id: 'adhoc', name: 'Ad-hoc Review' },
];

export const DEFAULT_COMPETENCIES = [
  'Job Knowledge',
  'Quality of Work',
  'Productivity',
  'Communication',
  'Teamwork',
  'Initiative',
  'Problem Solving',
  'Reliability',
];

const RATING_LABELS: Record<RatingValue, string> = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get rating label
 */
export function getRatingLabel(rating: RatingValue): string {
  return RATING_LABELS[rating] || `Rating ${rating}`;
}

/**
 * Get review type name
 */
export function getReviewTypeName(type: ReviewType): string {
  return REVIEW_TYPES.find((t) => t.id === type)?.name || type;
}

// ============================================
// Review Service
// ============================================

class ReviewService {
  private buildStatsBaseQuery(tenantId: string, year?: number) {
    const constraints = [where('tenantId', '==', tenantId)];

    if (year) {
      constraints.push(where('reviewDate', '>=', `${year}-01-01`));
      constraints.push(where('reviewDate', '<=', `${year}-12-31`));
    }

    return query(collection(db, REVIEWS_COLLECTION), ...constraints);
  }

  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Create a new performance review
   */
  async createReview(
    tenantId: string,
    review: Omit<PerformanceReview, 'id' | 'tenantId' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), {
        ...review,
        tenantId,
        status: 'draft' as ReviewStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating review:', error);
      throw error;
    }
  }

  /**
   * Get a review by ID
   */
  async getReview(tenantId: string, reviewId: string): Promise<PerformanceReview | null> {
    try {
      const docRef = doc(db, REVIEWS_COLLECTION, reviewId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tenantId !== tenantId) {
          return null;
        }
        return this.mapDocToReview(docSnap.id, data);
      }

      return null;
    } catch (error) {
      console.error('Error getting review:', error);
      throw error;
    }
  }

  /**
   * Get all reviews with optional filters
   */
  async getReviews(
    tenantId: string,
    filters?: ReviewFilters
  ): Promise<PerformanceReview[]> {
    try {
      const canApplyYearServerSide = Boolean(
        filters?.year &&
        !filters.employeeId &&
        !filters.reviewerId &&
        !filters.status &&
        !filters.reviewType
      );

      let q = canApplyYearServerSide
        ? query(
            collection(db, REVIEWS_COLLECTION),
            where('tenantId', '==', tenantId),
            where('reviewDate', '>=', `${filters!.year!}-01-01`),
            where('reviewDate', '<=', `${filters!.year!}-12-31`),
            orderBy('reviewDate', 'desc')
          )
        : query(
            collection(db, REVIEWS_COLLECTION),
            where('tenantId', '==', tenantId),
            orderBy('createdAt', 'desc')
          );

      if (filters?.employeeId) {
        q = query(q, where('employeeId', '==', filters.employeeId));
      }

      if (filters?.reviewerId) {
        q = query(q, where('reviewerId', '==', filters.reviewerId));
      }

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.reviewType) {
        q = query(q, where('reviewType', '==', filters.reviewType));
      }

      const querySnapshot = await getDocs(q);
      let reviews: PerformanceReview[] = [];

      querySnapshot.forEach((doc) => {
        reviews.push(this.mapDocToReview(doc.id, doc.data()));
      });

      // Client-side year filter when the query shape would otherwise require too many composite indexes.
      if (filters?.year && !canApplyYearServerSide) {
        reviews = reviews.filter((r) => {
          if (!r.reviewDate) return false;
          return new Date(r.reviewDate).getFullYear() === filters.year;
        });
      }

      return reviews;
    } catch (error) {
      console.error('Error getting reviews:', error);
      throw error;
    }
  }

  /**
   * Update a review
   */
  async updateReview(
    tenantId: string,
    reviewId: string,
    updates: Partial<Omit<PerformanceReview, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<void> {
    try {
      // Verify ownership
      const existing = await this.getReview(tenantId, reviewId);
      if (!existing) {
        throw new Error('Review not found');
      }

      const docRef = doc(db, REVIEWS_COLLECTION, reviewId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating review:', error);
      throw error;
    }
  }

  /**
   * Delete a review
   */
  async deleteReview(tenantId: string, reviewId: string): Promise<void> {
    try {
      const existing = await this.getReview(tenantId, reviewId);
      if (!existing) {
        throw new Error('Review not found');
      }

      // Only allow deletion of draft reviews
      if (existing.status !== 'draft') {
        throw new Error('Only draft reviews can be deleted');
      }

      const docRef = doc(db, REVIEWS_COLLECTION, reviewId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting review:', error);
      throw error;
    }
  }

  // ----------------------------------------
  // Status Workflow
  // ----------------------------------------

  /**
   * Submit a review for employee acknowledgement
   */
  async submitReview(tenantId: string, reviewId: string): Promise<void> {
    const existing = await this.getReview(tenantId, reviewId);
    if (!existing) {
      throw new Error('Review not found');
    }

    if (existing.status !== 'draft') {
      throw new Error('Only draft reviews can be submitted');
    }

    await this.updateReview(tenantId, reviewId, {
      status: 'submitted',
      submittedAt: new Date(),
    });
  }

  /**
   * Employee acknowledges the review
   */
  async acknowledgeReview(
    tenantId: string,
    reviewId: string,
    employeeComments?: string
  ): Promise<void> {
    const existing = await this.getReview(tenantId, reviewId);
    if (!existing) {
      throw new Error('Review not found');
    }

    if (existing.status !== 'submitted') {
      throw new Error('Only submitted reviews can be acknowledged');
    }

    await this.updateReview(tenantId, reviewId, {
      status: 'acknowledged',
      employeeComments,
      acknowledgedAt: new Date(),
    });
  }

  /**
   * Complete/finalize a review
   */
  async completeReview(tenantId: string, reviewId: string): Promise<void> {
    const existing = await this.getReview(tenantId, reviewId);
    if (!existing) {
      throw new Error('Review not found');
    }

    if (existing.status !== 'acknowledged') {
      throw new Error('Only acknowledged reviews can be completed');
    }

    await this.updateReview(tenantId, reviewId, {
      status: 'completed',
      completedAt: new Date(),
    });
  }

  /**
   * Revert to draft (only from submitted)
   */
  async revertToDraft(tenantId: string, reviewId: string): Promise<void> {
    const existing = await this.getReview(tenantId, reviewId);
    if (!existing) {
      throw new Error('Review not found');
    }

    if (existing.status !== 'submitted') {
      throw new Error('Only submitted reviews can be reverted to draft');
    }

    await this.updateReview(tenantId, reviewId, {
      status: 'draft',
      submittedAt: undefined,
    });
  }

  // ----------------------------------------
  // Self Assessment
  // ----------------------------------------

  /**
   * Submit employee self-assessment
   */
  async submitSelfAssessment(
    tenantId: string,
    reviewId: string,
    selfAssessment: Omit<NonNullable<PerformanceReview['selfAssessment']>, 'submitted' | 'submittedAt'>
  ): Promise<void> {
    await this.updateReview(tenantId, reviewId, {
      selfAssessment: {
        ...selfAssessment,
        submitted: true,
        submittedAt: new Date(),
      },
    });
  }

  // ----------------------------------------
  // Statistics & Queries
  // ----------------------------------------

  /**
   * Get review statistics
   */
  async getStats(tenantId: string, year?: number): Promise<ReviewStats> {
    try {
      const baseQuery = this.buildStatsBaseQuery(tenantId, year);
      const completedQuery = query(baseQuery, where('status', '==', 'completed'));

      const [
        totalSnapshot,
        draftSnapshot,
        submittedSnapshot,
        acknowledgedSnapshot,
        completedSnapshot,
        completedRatingsSnapshot,
        typeSnapshots,
      ] = await Promise.all([
        getCountFromServer(baseQuery),
        getCountFromServer(query(baseQuery, where('status', '==', 'draft'))),
        getCountFromServer(query(baseQuery, where('status', '==', 'submitted'))),
        getCountFromServer(query(baseQuery, where('status', '==', 'acknowledged'))),
        getCountFromServer(completedQuery),
        getAggregateFromServer(completedQuery, {
          totalRating: sum('overallRating'),
        }),
        Promise.all(
          REVIEW_TYPES.map(({ id }) =>
            getCountFromServer(query(baseQuery, where('reviewType', '==', id)))
          )
        ),
      ]);

      const completed = completedSnapshot.data().count;
      const totalRating = Number(completedRatingsSnapshot.data().totalRating ?? 0);

      const byType = REVIEW_TYPES.reduce<Record<ReviewType, number>>((acc, { id }, index) => {
        acc[id] = typeSnapshots[index].data().count;
        return acc;
      }, {
        annual: 0,
        mid_year: 0,
        quarterly: 0,
        probation: 0,
        project: 0,
        adhoc: 0,
      });

      const averageRating = completed > 0
        ? Math.round((totalRating / completed) * 10) / 10
        : 0;

      return {
        totalReviews: totalSnapshot.data().count,
        draft: draftSnapshot.data().count,
        submitted: submittedSnapshot.data().count,
        acknowledged: acknowledgedSnapshot.data().count,
        completed,
        byType,
        averageRating,
      };
    } catch (error) {
      console.error('Error getting review stats:', error);
      throw error;
    }
  }

  /**
   * Get reviews for an employee
   */
  async getEmployeeReviews(tenantId: string, employeeId: string): Promise<PerformanceReview[]> {
    return this.getReviews(tenantId, { employeeId });
  }

  /**
   * Get reviews by a reviewer
   */
  async getReviewerReviews(tenantId: string, reviewerId: string): Promise<PerformanceReview[]> {
    return this.getReviews(tenantId, { reviewerId });
  }

  /**
   * Get pending reviews (draft + submitted)
   */
  async getPendingReviews(tenantId: string): Promise<PerformanceReview[]> {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('tenantId', '==', tenantId),
      where('status', 'in', ['draft', 'submitted']),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapDocToReview(doc.id, doc.data()));
  }

  /**
   * Check if employee has a pending review
   */
  async hasActiveReview(tenantId: string, employeeId: string): Promise<boolean> {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('tenantId', '==', tenantId),
      where('employeeId', '==', employeeId),
      where('status', 'in', ['draft', 'submitted']),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  }

  // ----------------------------------------
  // Helper Methods
  // ----------------------------------------

  /**
   * Map Firestore document to PerformanceReview
   */
  private mapDocToReview(id: string, data: DocumentData): PerformanceReview {
    return {
      id,
      tenantId: data.tenantId,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      department: data.department,
      position: data.position,
      reviewType: data.reviewType,
      reviewPeriodStart: data.reviewPeriodStart,
      reviewPeriodEnd: data.reviewPeriodEnd,
      reviewDate: data.reviewDate,
      reviewerId: data.reviewerId,
      reviewerName: data.reviewerName,
      overallRating: data.overallRating,
      competencies: data.competencies || [],
      goalAssessments: data.goalAssessments || [],
      strengths: data.strengths || '',
      areasForImprovement: data.areasForImprovement || '',
      managerComments: data.managerComments || '',
      developmentPlan: data.developmentPlan || '',
      selfAssessment: data.selfAssessment,
      employeeComments: data.employeeComments,
      acknowledgedAt: data.acknowledgedAt instanceof Timestamp
        ? data.acknowledgedAt.toDate()
        : data.acknowledgedAt,
      status: data.status,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : data.updatedAt,
      submittedAt: data.submittedAt instanceof Timestamp
        ? data.submittedAt.toDate()
        : data.submittedAt,
      completedAt: data.completedAt instanceof Timestamp
        ? data.completedAt.toDate()
        : data.completedAt,
    };
  }
}

export const reviewService = new ReviewService();
