/**
 * Recognition store — peer recognition / kudos
 * Path: tenants/{tid}/recognition
 * Last 50, ordered by createdAt desc
 */
import { create } from 'zustand';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Recognition, RecognitionCategory } from '../types/recognition';

interface RecognitionState {
  recognitions: Recognition[];
  loading: boolean;
  submitting: boolean;
  error: string | null;

  fetchRecognitions: (tenantId: string) => Promise<void>;
  sendRecognition: (params: SendRecognitionParams) => Promise<void>;
  clear: () => void;
}

interface SendRecognitionParams {
  tenantId: string;
  fromEmployeeId: string;
  fromEmployeeName: string;
  toEmployeeId: string;
  toEmployeeName: string;
  message: string;
  category: RecognitionCategory;
}

export const useRecognitionStore = create<RecognitionState>((set, get) => ({
  recognitions: [],
  loading: false,
  submitting: false,
  error: null,

  fetchRecognitions: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/recognition`),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const recognitions: Recognition[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          tenantId: data.tenantId || tenantId,
          fromEmployeeId: data.fromEmployeeId || '',
          fromEmployeeName: data.fromEmployeeName || '',
          toEmployeeId: data.toEmployeeId || '',
          toEmployeeName: data.toEmployeeName || '',
          message: data.message || '',
          category: data.category || 'teamwork',
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt || new Date(),
        };
      });
      set({ recognitions, loading: false });
    } catch {
      set({ recognitions: [], loading: false, error: 'fetchError' });
    }
  },

  sendRecognition: async (params: SendRecognitionParams) => {
    set({ submitting: true, error: null });
    try {
      await addDoc(collection(db, `tenants/${params.tenantId}/recognition`), {
        tenantId: params.tenantId,
        fromEmployeeId: params.fromEmployeeId,
        fromEmployeeName: params.fromEmployeeName,
        toEmployeeId: params.toEmployeeId,
        toEmployeeName: params.toEmployeeName,
        message: params.message,
        category: params.category,
        createdAt: serverTimestamp(),
      });

      // Refresh recognitions
      await get().fetchRecognitions(params.tenantId);
      set({ submitting: false });
    } catch {
      set({ submitting: false, error: 'submitError' });
    }
  },

  clear: () => set({ recognitions: [], loading: false, submitting: false, error: null }),
}));
