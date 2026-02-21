/**
 * Directory store — employee directory listing
 * Path: tenants/{tid}/employees
 * Fetches all active employees, supports search by name
 */
import { create } from 'zustand';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DirectoryEntry } from '../types/directory';

interface DirectoryState {
  entries: DirectoryEntry[];
  loading: boolean;
  error: string | null;
  searchQuery: string;

  fetchDirectory: (tenantId: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  getFilteredEntries: () => DirectoryEntry[];
  clear: () => void;
}

export const useDirectoryStore = create<DirectoryState>((set, get) => ({
  entries: [],
  loading: false,
  error: null,
  searchQuery: '',

  fetchDirectory: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/employees`),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      const entries: DirectoryEntry[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          firstName: data.firstName || data.name?.split(' ')[0] || '',
          lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
          email: data.email || '',
          phone: data.phone,
          department: data.department,
          position: data.position,
          photoUrl: data.photoUrl,
          status: data.status || 'active',
        };
      });

      // Sort alphabetically by first name then last name
      entries.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      set({ entries, loading: false });
    } catch {
      set({ entries: [], loading: false, error: 'fetchError' });
    }
  },

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),

  getFilteredEntries: () => {
    const { entries, searchQuery } = get();
    if (!searchQuery.trim()) return entries;

    const lowerQuery = searchQuery.toLowerCase().trim();
    return entries.filter((entry) => {
      const fullName = `${entry.firstName} ${entry.lastName}`.toLowerCase();
      return (
        fullName.includes(lowerQuery) ||
        entry.email.toLowerCase().includes(lowerQuery) ||
        entry.department?.toLowerCase().includes(lowerQuery) ||
        entry.position?.toLowerCase().includes(lowerQuery)
      );
    });
  },

  clear: () => set({ entries: [], loading: false, error: null, searchQuery: '' }),
}));
