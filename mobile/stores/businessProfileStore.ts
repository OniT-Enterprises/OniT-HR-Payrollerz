/**
 * Business Profile Store — Firestore-backed business info.
 *
 * Stores business name, address, phone, and VAT registration.
 * Path: tenants/{tid}/settings/business_profile
 */
import { create } from 'zustand';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface BusinessProfile {
  businessName: string;
  address: string;
  phone: string;
  vatRegNumber: string;
  logoUrl: string;
  updatedAt: Date;
}

const EMPTY_PROFILE: BusinessProfile = {
  businessName: '',
  address: '',
  phone: '',
  vatRegNumber: '',
  logoUrl: '',
  updatedAt: new Date(),
};

interface BusinessProfileState {
  profile: BusinessProfile;
  loading: boolean;
  saving: boolean;
  error: string | null;

  load: (tenantId: string) => Promise<void>;
  save: (tenantId: string, data: Partial<BusinessProfile>) => Promise<void>;
  clear: () => void;
}

function docPath(tenantId: string) {
  return `tenants/${tenantId}/settings/business_profile`;
}

export const useBusinessProfileStore = create<BusinessProfileState>(
  (set, get) => ({
    profile: { ...EMPTY_PROFILE },
    loading: false,
    saving: false,
    error: null,

    load: async (tenantId) => {
      set({ loading: true, error: null });
      try {
        const ref = doc(db, docPath(tenantId));
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          set({
            profile: {
              businessName: (data.businessName as string) || '',
              address: (data.address as string) || '',
              phone: (data.phone as string) || '',
              vatRegNumber: (data.vatRegNumber as string) || '',
              logoUrl: (data.logoUrl as string) || '',
              updatedAt: data.updatedAt?.toDate?.() || new Date(),
            },
            loading: false,
          });
        } else {
          set({ profile: { ...EMPTY_PROFILE }, loading: false });
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to load business profile';
        set({ error: message, loading: false });
      }
    },

    save: async (tenantId, data) => {
      set({ saving: true, error: null });
      try {
        const current = get().profile;
        const updated: BusinessProfile = {
          ...current,
          ...data,
          updatedAt: new Date(),
        };
        const ref = doc(db, docPath(tenantId));
        await setDoc(ref, updated, { merge: true });
        set({ profile: updated, saving: false });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to save business profile';
        set({ error: message, saving: false });
        throw err;
      }
    },

    clear: () => set({ profile: { ...EMPTY_PROFILE }, loading: false, error: null }),
  })
);
