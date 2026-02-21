/**
 * Announcement store — company announcements feed
 * Path: tenants/{tid}/announcements
 * Sorted: pinned first, then createdAt desc
 */
import { create } from 'zustand';
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Announcement } from '../types/announcement';

interface AnnouncementState {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;

  fetchAnnouncements: (tenantId: string) => Promise<void>;
  markAsRead: (tenantId: string, announcementId: string, uid: string) => Promise<void>;
  getUnreadCount: (uid: string) => number;
  clear: () => void;
}

export const useAnnouncementStore = create<AnnouncementState>((set, get) => ({
  announcements: [],
  loading: false,
  error: null,

  fetchAnnouncements: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/announcements`),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const announcements: Announcement[] = snap.docs.map((d) => {
        const data = d.data();
        const readBy: Record<string, Date> = {};
        if (data.readBy && typeof data.readBy === 'object') {
          for (const [uid, ts] of Object.entries(data.readBy)) {
            readBy[uid] = ts instanceof Timestamp ? ts.toDate() : (ts as Date);
          }
        }
        return {
          id: d.id,
          tenantId: data.tenantId || tenantId,
          title: data.title || '',
          body: data.body || '',
          imageUrl: data.imageUrl,
          pinned: data.pinned ?? false,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt || new Date(),
          createdBy: data.createdBy || '',
          createdByName: data.createdByName || '',
          readBy,
        };
      });

      // Sort: pinned first, then by createdAt desc
      announcements.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      set({ announcements, loading: false });
    } catch {
      set({ announcements: [], loading: false, error: 'fetchError' });
    }
  },

  markAsRead: async (tenantId: string, announcementId: string, uid: string) => {
    try {
      await updateDoc(doc(db, `tenants/${tenantId}/announcements`, announcementId), {
        [`readBy.${uid}`]: serverTimestamp(),
      });

      // Update local state
      set((state) => ({
        announcements: state.announcements.map((a) =>
          a.id === announcementId
            ? { ...a, readBy: { ...a.readBy, [uid]: new Date() } }
            : a
        ),
      }));
    } catch {
      // Non-critical — silently fail
    }
  },

  getUnreadCount: (uid: string) => {
    const { announcements } = get();
    return announcements.filter((a) => !a.readBy?.[uid]).length;
  },

  clear: () => set({ announcements: [], loading: false, error: null }),
}));
