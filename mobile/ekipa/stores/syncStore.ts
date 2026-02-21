/**
 * Sync store — manages offline sync queue state
 * Reads from SQLite, triggers sync engine
 */
import { create } from 'zustand';
import {
  getPendingCount,
  getErrorCount,
  getPendingBatches,
  deleteBatch,
} from '../lib/db';
import {
  syncAll,
  syncSingleBatch,
  startAutoSync,
  stopAutoSync,
  isSyncing,
} from '../lib/syncEngine';
import type { SyncBatch } from '../types/crew';

interface SyncState {
  pendingCount: number;
  errorCount: number;
  syncing: boolean;
  lastSyncAt: string | null;
  pendingBatches: SyncBatch[];

  refreshCounts: () => void;
  triggerSyncAll: () => Promise<void>;
  retryBatch: (batchId: string) => Promise<void>;
  removeBatch: (batchId: string) => void;
  startAutoSync: () => void;
  stopAutoSync: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  pendingCount: 0,
  errorCount: 0,
  syncing: false,
  lastSyncAt: null,
  pendingBatches: [],

  refreshCounts: () => {
    set({
      pendingCount: getPendingCount(),
      errorCount: getErrorCount(),
      pendingBatches: getPendingBatches(),
      syncing: isSyncing(),
    });
  },

  triggerSyncAll: async () => {
    set({ syncing: true });
    try {
      await syncAll();
      set({
        syncing: false,
        lastSyncAt: new Date().toISOString(),
        pendingCount: getPendingCount(),
        errorCount: getErrorCount(),
        pendingBatches: getPendingBatches(),
      });
    } catch {
      set({
        syncing: false,
        pendingCount: getPendingCount(),
        errorCount: getErrorCount(),
        pendingBatches: getPendingBatches(),
      });
    }
  },

  retryBatch: async (batchId: string) => {
    set({ syncing: true });
    try {
      await syncSingleBatch(batchId);
    } finally {
      set({
        syncing: false,
        pendingCount: getPendingCount(),
        errorCount: getErrorCount(),
        pendingBatches: getPendingBatches(),
      });
    }
  },

  removeBatch: (batchId: string) => {
    deleteBatch(batchId);
    set({
      pendingCount: getPendingCount(),
      errorCount: getErrorCount(),
      pendingBatches: getPendingBatches(),
    });
  },

  startAutoSync: () => {
    startAutoSync();
  },

  stopAutoSync: () => {
    stopAutoSync();
  },
}));
