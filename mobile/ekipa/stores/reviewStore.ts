import { create } from 'zustand';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PerformanceReview } from '../types/review';

interface ReviewState {
  reviews: PerformanceReview[];
  loading: boolean;
  savingId: string | null;
  error: string | null;
  fetchReviews: (tenantId: string, employeeId: string) => Promise<void>;
  acknowledge: (
    tenantId: string,
    reviewId: string,
    employeeComments?: string,
  ) => Promise<boolean>;
  clear: () => void;
}

const asDate = (value: unknown): Date | undefined => {
  if (value instanceof Timestamp) return value.toDate();
  return value instanceof Date ? value : undefined;
};

export const useReviewStore = create<ReviewState>((set) => ({
  reviews: [],
  loading: false,
  savingId: null,
  error: null,

  fetchReviews: async (tenantId, employeeId) => {
    set({ loading: true, error: null });
    try {
      const snapshot = await getDocs(query(
        collection(db, 'reviews'),
        where('tenantId', '==', tenantId),
        where('employeeId', '==', employeeId),
        where('status', 'in', ['submitted', 'acknowledged', 'completed']),
      ));
      const reviews = snapshot.docs
        .map((snapshotDoc) => {
          const data = snapshotDoc.data();
          return {
            id: snapshotDoc.id,
            tenantId: data.tenantId,
            employeeId: data.employeeId,
            employeeName: data.employeeName || '',
            reviewType: data.reviewType || 'review',
            reviewPeriodStart: data.reviewPeriodStart || '',
            reviewPeriodEnd: data.reviewPeriodEnd || '',
            reviewDate: data.reviewDate || '',
            reviewerName: data.reviewerName || '',
            overallRating: Number(data.overallRating || 0),
            competencies: Array.isArray(data.competencies) ? data.competencies : [],
            strengths: data.strengths || '',
            areasForImprovement: data.areasForImprovement || '',
            managerComments: data.managerComments || '',
            developmentPlan: data.developmentPlan || '',
            employeeComments: data.employeeComments,
            status: data.status || 'draft',
            acknowledgedAt: asDate(data.acknowledgedAt),
            submittedAt: asDate(data.submittedAt),
            completedAt: asDate(data.completedAt),
          } as PerformanceReview;
        })
        .sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
      set({ reviews, loading: false });
    } catch {
      set({ reviews: [], loading: false, error: 'fetchError' });
    }
  },

  acknowledge: async (tenantId, reviewId, employeeComments) => {
    set({ savingId: reviewId, error: null });
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        status: 'acknowledged',
        employeeComments: employeeComments?.trim() || '',
        acknowledgedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      set((state) => ({
        savingId: null,
        reviews: state.reviews.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                status: 'acknowledged',
                employeeComments: employeeComments?.trim() || '',
                acknowledgedAt: new Date(),
              }
            : review,
        ),
      }));
      return true;
    } catch {
      set({ savingId: null, error: 'saveError' });
      return false;
    }
  },

  clear: () => set({ reviews: [], loading: false, savingId: null, error: null }),
}));
