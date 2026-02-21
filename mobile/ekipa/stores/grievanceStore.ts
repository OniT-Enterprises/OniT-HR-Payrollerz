/**
 * Grievance store — anonymous grievance submission
 * Path: tenants/{tid}/grievances
 * Key: NO userId stored. Uses random ticketId for anonymous tracking.
 */
import { create } from 'zustand';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Grievance, GrievanceCategory } from '../types/grievance';

interface GrievanceState {
  trackedGrievance: Grievance | null;
  submitting: boolean;
  checking: boolean;
  error: string | null;

  submitGrievance: (params: SubmitGrievanceParams) => Promise<string>; // returns ticketId
  checkStatus: (tenantId: string, ticketId: string) => Promise<void>;
  clear: () => void;
}

interface SubmitGrievanceParams {
  tenantId: string;
  category: GrievanceCategory;
  description: string;
  attachmentUrls?: string[];
}

/**
 * Generate a random 8-character alphanumeric ticket ID
 * Uses crypto.getRandomValues for secure randomness
 */
function generateTicketId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous: 0/O, 1/I
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export const useGrievanceStore = create<GrievanceState>((set) => ({
  trackedGrievance: null,
  submitting: false,
  checking: false,
  error: null,

  submitGrievance: async (params: SubmitGrievanceParams) => {
    set({ submitting: true, error: null });
    try {
      const ticketId = generateTicketId();

      await addDoc(collection(db, `tenants/${params.tenantId}/grievances`), {
        tenantId: params.tenantId,
        // NO userId — truly anonymous
        ticketId,
        category: params.category,
        description: params.description,
        attachmentUrls: params.attachmentUrls ?? [],
        status: 'submitted',
        createdAt: serverTimestamp(),
      });

      set({ submitting: false });
      return ticketId;
    } catch {
      set({ submitting: false, error: 'submitError' });
      return '';
    }
  },

  checkStatus: async (tenantId: string, ticketId: string) => {
    set({ checking: true, error: null, trackedGrievance: null });
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/grievances`),
        where('ticketId', '==', ticketId)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        set({ checking: false, error: 'notFound' });
        return;
      }

      const d = snap.docs[0];
      const data = d.data();
      const grievance: Grievance = {
        id: d.id,
        tenantId: data.tenantId || tenantId,
        ticketId: data.ticketId,
        category: data.category || 'other',
        description: data.description || '',
        attachmentUrls: data.attachmentUrls || [],
        status: data.status || 'submitted',
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt || new Date(),
        resolvedAt: data.resolvedAt instanceof Timestamp ? data.resolvedAt.toDate() : data.resolvedAt,
        resolution: data.resolution,
      };

      set({ trackedGrievance: grievance, checking: false });
    } catch {
      set({ checking: false, error: 'fetchError' });
    }
  },

  clear: () => set({ trackedGrievance: null, submitting: false, checking: false, error: null }),
}));
