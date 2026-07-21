/**
 * Grievance store — anonymous grievance submission
 * Path: tenants/{tid}/grievances
 * Key: NO userId stored. Uses random ticketId for anonymous tracking.
 */
import { create } from 'zustand';
import {
  doc,
  getDoc,
  writeBatch,
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
 * Generate a 16-character token (80 bits) so the ticket itself can safely act
 * as the bearer secret for the read-only status document.
 * Uses crypto.getRandomValues for secure randomness
 */
function generateTicketId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous: 0/O, 1/I
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < 16; i++) {
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

      const grievanceRef = doc(
        db,
        `tenants/${params.tenantId}/grievances/${ticketId}`,
      );
      const statusRef = doc(
        db,
        `tenants/${params.tenantId}/grievanceStatuses/${ticketId}`,
      );
      const batch = writeBatch(db);
      batch.set(grievanceRef, {
        tenantId: params.tenantId,
        // NO userId — truly anonymous
        ticketId,
        category: params.category,
        description: params.description,
        attachmentUrls: params.attachmentUrls ?? [],
        status: 'submitted',
        createdAt: serverTimestamp(),
      });
      batch.set(statusRef, {
        tenantId: params.tenantId,
        ticketId,
        category: params.category,
        status: 'submitted',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

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
      const normalizedTicket = ticketId.trim().toUpperCase();
      const snap = await getDoc(
        doc(db, `tenants/${tenantId}/grievanceStatuses/${normalizedTicket}`),
      );

      if (!snap.exists()) {
        set({ checking: false, error: 'notFound' });
        return;
      }

      const data = snap.data();
      const grievance: Grievance = {
        id: snap.id,
        tenantId: data.tenantId || tenantId,
        ticketId: data.ticketId,
        category: data.category || 'other',
        description: '',
        attachmentUrls: [],
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
