/**
 * Crew store — supervisor time tracking state
 * Manages worker selection, batch submission, and recent activity
 */
import { create } from 'zustand';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  insertBatch,
  insertClockIn,
  getRecentBatches,
  getTodayClockInsWithoutClockOut,
} from '../lib/db';
import { syncAll } from '../lib/syncEngine';
import type {
  CrewMember,
  SyncBatch,
  PendingClockIn,
  LocationData,
} from '../types/crew';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CrewState {
  // Workers
  workers: CrewMember[];
  workersLoading: boolean;
  selectedWorkerIds: Set<string>;

  // Context
  currentSiteId: string | null;
  currentSiteName: string | null;
  currentDate: string;
  currentPhoto: string | null; // local URI
  currentLocation: LocationData | null;
  clockInMode: 'clock_in' | 'clock_out';

  // Submission
  submitting: boolean;
  error: string | null;

  // Recent
  recentBatches: SyncBatch[];

  // Actions
  fetchWorkers: (tenantId: string) => Promise<void>;
  toggleWorker: (id: string) => void;
  selectAll: (workerIds?: string[]) => void;
  deselectAll: () => void;
  addWorkerByQR: (qrValue: string) => { found: boolean; name?: string };
  setSite: (id: string | null, name: string | null) => void;
  setDate: (date: string) => void;
  setPhoto: (uri: string | null) => void;
  setLocation: (loc: LocationData | null) => void;
  setMode: (mode: 'clock_in' | 'clock_out') => void;
  submitBatch: (params: {
    tenantId: string;
    supervisorId: string;
    supervisorName: string;
  }) => Promise<{ ok: true } | { ok: false; error: 'no_workers_selected' | 'submission_failed'; details?: string }>;
  loadRecentBatches: () => void;
  getWorkersNeedingClockOut: (tenantId: string) => PendingClockIn[];
  reset: () => void;
}

export const useCrewStore = create<CrewState>((set, get) => ({
  workers: [],
  workersLoading: false,
  selectedWorkerIds: new Set(),
  currentSiteId: null,
  currentSiteName: null,
  currentDate: todayYYYYMMDD(),
  currentPhoto: null,
  currentLocation: null,
  clockInMode: 'clock_in',
  submitting: false,
  error: null,
  recentBatches: [],

  fetchWorkers: async (tenantId: string) => {
    set({ workersLoading: true });
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/employees`),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      const workers: CrewMember[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          employeeId: d.id,
          firstName: data.firstName || data.name?.split(' ')[0] || '',
          lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
          department: data.department || '',
          position: data.position || '',
          qrCode: data.qrCode || d.id,
        };
      });
      set({ workers, workersLoading: false });
    } catch {
      set({ workers: [], workersLoading: false, error: 'Failed to fetch workers' });
    }
  },

  toggleWorker: (id: string) => {
    set((state) => {
      const next = new Set(state.selectedWorkerIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedWorkerIds: next };
    });
  },

  selectAll: (workerIds) => {
    set((state) => ({
      selectedWorkerIds: new Set(
        workerIds ? workerIds : state.workers.map((w) => w.employeeId)
      ),
    }));
  },

  deselectAll: () => set({ selectedWorkerIds: new Set() }),

  addWorkerByQR: (qrValue: string) => {
    const { workers } = get();
    const match = workers.find(
      (w) => w.qrCode === qrValue || w.employeeId === qrValue
    );
    if (!match) return { found: false };

    set((state) => {
      const next = new Set(state.selectedWorkerIds);
      next.add(match.employeeId);
      return { selectedWorkerIds: next };
    });
    return { found: true, name: `${match.firstName} ${match.lastName}` };
  },

  setSite: (id, name) => set({ currentSiteId: id, currentSiteName: name }),
  setDate: (date) => set({ currentDate: date }),
  setPhoto: (uri) => set({ currentPhoto: uri }),
  setLocation: (loc) => set({ currentLocation: loc }),
  setMode: (mode) => set({ clockInMode: mode, selectedWorkerIds: new Set() }),

  submitBatch: async ({ tenantId, supervisorId, supervisorName }) => {
    const state = get();
    if (state.selectedWorkerIds.size === 0) {
      set({ error: 'no_workers_selected' });
      return { ok: false, error: 'no_workers_selected' };
    }

    set({ submitting: true, error: null });

    try {
      const batchId = generateId();
      const time = nowHHMM();

      // Create batch record
      const batch: SyncBatch = {
        id: batchId,
        tenantId,
        supervisorId,
        supervisorName,
        recordType: state.clockInMode,
        date: state.currentDate,
        siteId: state.currentSiteId ?? undefined,
        siteName: state.currentSiteName ?? undefined,
        workerCount: state.selectedWorkerIds.size,
        photoLocalPath: state.currentPhoto ?? undefined,
        latitude: state.currentLocation?.latitude,
        longitude: state.currentLocation?.longitude,
        locationAccuracy: state.currentLocation?.accuracy,
        syncStatus: 'pending',
        syncAttempts: 0,
        createdAt: new Date().toISOString(),
      };
      insertBatch(batch);

      // Create individual records
      const selectedWorkers = state.workers.filter((w) =>
        state.selectedWorkerIds.has(w.employeeId)
      );

      for (const worker of selectedWorkers) {
        const record: PendingClockIn = {
          id: generateId(),
          batchId,
          tenantId,
          employeeId: worker.employeeId,
          employeeName: `${worker.firstName} ${worker.lastName}`.trim(),
          department: worker.department,
          date: state.currentDate,
          clockIn: state.clockInMode === 'clock_in' ? time : undefined,
          clockOut: state.clockInMode === 'clock_out' ? time : undefined,
          recordType: state.clockInMode,
          supervisorId,
          supervisorName,
          photoLocalPath: state.currentPhoto ?? undefined,
          latitude: state.currentLocation?.latitude,
          longitude: state.currentLocation?.longitude,
          locationAccuracy: state.currentLocation?.accuracy,
          siteId: state.currentSiteId ?? undefined,
          siteName: state.currentSiteName ?? undefined,
          syncStatus: 'pending',
          syncAttempts: 0,
          createdAt: new Date().toISOString(),
        };
        insertClockIn(record);
      }

      // Attempt immediate sync
      syncAll();

      // Refresh recent batches
      set({
        submitting: false,
        recentBatches: getRecentBatches(5),
        selectedWorkerIds: new Set(),
        currentPhoto: null,
      });
      return { ok: true };
    } catch (err: any) {
      set({ submitting: false, error: 'submission_failed' });
      return {
        ok: false,
        error: 'submission_failed',
        details: err?.message ? String(err.message) : undefined,
      };
    }
  },

  loadRecentBatches: () => {
    set({ recentBatches: getRecentBatches(5) });
  },

  getWorkersNeedingClockOut: (tenantId: string) => {
    const { currentDate } = get();
    return getTodayClockInsWithoutClockOut(tenantId, currentDate);
  },

  reset: () =>
    set({
      selectedWorkerIds: new Set(),
      currentPhoto: null,
      currentLocation: null,
      error: null,
    }),
}));
