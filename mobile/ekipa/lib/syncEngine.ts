/**
 * Sync engine — orchestrates offline-first crew clock-in/out sync to Firestore
 *
 * Flow per batch:
 * 1. Read pending batch from SQLite
 * 2. Upload photo to Firebase Storage
 * 3. Build Firestore docs for each worker
 * 4. writeBatch to atomically commit all records
 * 5. Mark SQLite records as synced
 * 6. Cleanup local photo
 */
import {
  collection,
  writeBatch,
  doc,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { db } from './firebase';
import { uploadPhoto, cleanupLocalPhoto } from './photoUtils';
import {
  getPendingBatches,
  getBatchRecords,
  updateBatchSyncStatus,
  updateBatchPhotoUrl,
  getPendingCount,
} from './db';
import type { SyncBatch, PendingClockIn } from '../types/crew';

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000, 900_000]; // 5s, 15s, 1m, 5m, 15m
const POLL_INTERVAL_MS = 30_000;
const STANDARD_DAILY_HOURS = 8;

let _polling = false;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _syncing = false;

// ── Hour calculation helpers (ported from web attendanceService) ──

function calculateHoursBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin < startMin) endMin += 24 * 60; // overnight
  return (endMin - startMin) / 60;
}

function calculateLateMinutes(clockIn: string, expectedStart: string = '08:00'): number {
  if (!clockIn) return 0;
  const [ch, cm] = clockIn.split(':').map(Number);
  const [eh, em] = expectedStart.split(':').map(Number);
  return Math.max(0, (ch * 60 + cm) - (eh * 60 + em));
}

function calculateHoursBreakdown(totalHours: number): { regular: number; overtime: number } {
  if (totalHours <= STANDARD_DAILY_HOURS) {
    return { regular: totalHours, overtime: 0 };
  }
  return { regular: STANDARD_DAILY_HOURS, overtime: totalHours - STANDARD_DAILY_HOURS };
}

function determineStatus(
  clockIn: string | undefined,
  clockOut: string | undefined,
  lateMinutes: number,
  totalHours: number
): string {
  if (!clockIn && !clockOut) return 'absent';
  if (totalHours > 0 && totalHours < 4) return 'half_day';
  if (lateMinutes > 15) return 'late';
  return 'present';
}

// ── Core sync logic ──

async function syncBatch(batch: SyncBatch): Promise<void> {
  if (batch.syncAttempts >= MAX_ATTEMPTS) return;

  updateBatchSyncStatus(batch.id, 'uploading');

  try {
    // 1. Upload photo if we have a local path but no URL yet
    let photoUrl = batch.photoUrl;
    if (batch.photoLocalPath && !photoUrl) {
      photoUrl = await uploadPhoto(
        batch.photoLocalPath,
        batch.tenantId,
        batch.id,
        batch.date
      );
      updateBatchPhotoUrl(batch.id, photoUrl);
    }

    // 2. Get all records in this batch
    const records = getBatchRecords(batch.id);

    if (batch.recordType === 'clock_in') {
      await syncClockInBatch(batch, records, photoUrl);
    } else {
      await syncClockOutBatch(batch, records, photoUrl);
    }

    // 4. Mark as synced
    updateBatchSyncStatus(batch.id, 'synced');

    // 5. Cleanup local photo
    if (batch.photoLocalPath) {
      cleanupLocalPhoto(batch.photoLocalPath);
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown sync error';
    updateBatchSyncStatus(batch.id, 'error', errorMsg);

    // Schedule retry with exponential backoff
    const attempt = batch.syncAttempts;
    if (attempt < MAX_ATTEMPTS) {
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      setTimeout(() => syncBatch({ ...batch, syncAttempts: attempt + 1 }), delay);
    }
  }
}

async function syncClockInBatch(
  batch: SyncBatch,
  records: PendingClockIn[],
  photoUrl: string | undefined
): Promise<void> {
  const firestoreBatch = writeBatch(db);
  const attendanceRef = collection(db, 'attendance');

  for (const record of records) {
    const lateMinutes = calculateLateMinutes(record.clockIn || '');
    const docRef = doc(attendanceRef);

    firestoreBatch.set(docRef, {
      tenantId: record.tenantId,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      department: record.department || '',
      date: record.date,
      clockIn: record.clockIn || '',
      clockOut: '',
      regularHours: 0,
      overtimeHours: 0,
      lateMinutes,
      totalHours: 0,
      status: 'present',
      source: 'supervisor',
      supervisorId: record.supervisorId,
      supervisorName: record.supervisorName,
      photoUrl: photoUrl || '',
      latitude: record.latitude ?? null,
      longitude: record.longitude ?? null,
      locationAccuracy: record.locationAccuracy ?? null,
      siteId: record.siteId || '',
      siteName: record.siteName || '',
      batchId: batch.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await firestoreBatch.commit();
}

async function syncClockOutBatch(
  batch: SyncBatch,
  records: PendingClockIn[],
  photoUrl: string | undefined
): Promise<void> {
  for (const record of records) {
    // Find the existing clock-in record for this employee + date
    const q = query(
      collection(db, 'attendance'),
      where('tenantId', '==', record.tenantId),
      where('employeeId', '==', record.employeeId),
      where('date', '==', record.date),
      where('source', '==', 'supervisor'),
      where('batchId', '!=', batch.id) // different from clock-out batch
    );

    const snap = await getDocs(q);
    if (snap.empty) continue;

    // Use the first matching clock-in record
    const clockInDoc = snap.docs[0];
    const clockInData = clockInDoc.data();
    const clockIn = clockInData.clockIn || '';
    const clockOut = record.clockOut || '';

    const totalHours = calculateHoursBetween(clockIn, clockOut);
    const lateMinutes = calculateLateMinutes(clockIn);
    const { regular, overtime } = calculateHoursBreakdown(totalHours);
    const status = determineStatus(clockIn, clockOut, lateMinutes, totalHours);

    await updateDoc(doc(db, 'attendance', clockInDoc.id), {
      clockOut,
      totalHours: Math.round(totalHours * 100) / 100,
      regularHours: Math.round(regular * 100) / 100,
      overtimeHours: Math.round(overtime * 100) / 100,
      lateMinutes,
      status,
      ...(photoUrl ? { clockOutPhotoUrl: photoUrl } : {}),
      updatedAt: serverTimestamp(),
    });
  }
}

// ── Public API ──

export async function syncAll(): Promise<void> {
  if (_syncing) return;
  _syncing = true;

  try {
    const batches = getPendingBatches();
    for (const batch of batches) {
      await syncBatch(batch);
    }
  } finally {
    _syncing = false;
  }
}

export async function syncSingleBatch(batchId: string): Promise<void> {
  const batches = getPendingBatches();
  const batch = batches.find((b) => b.id === batchId);
  if (batch) await syncBatch(batch);
}

export function isSyncing(): boolean {
  return _syncing;
}

// ── Auto-sync lifecycle ──

export function startAutoSync(): void {
  if (_polling) return;
  _polling = true;

  // Sync on app foreground
  const handleAppState = (state: AppStateStatus) => {
    if (state === 'active') syncAll();
  };
  const appStateSub = AppState.addEventListener('change', handleAppState);

  // Sync on connectivity restore
  const netInfoUnsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) syncAll();
  });

  // Periodic poll when pending records exist
  _pollTimer = setInterval(() => {
    if (getPendingCount() > 0) syncAll();
  }, POLL_INTERVAL_MS);

  // Store cleanup refs (simple module-level approach)
  _cleanupFns = [
    () => appStateSub.remove(),
    netInfoUnsub,
    () => { if (_pollTimer) clearInterval(_pollTimer); _pollTimer = null; },
  ];
}

let _cleanupFns: Array<() => void> = [];

export function stopAutoSync(): void {
  _polling = false;
  _cleanupFns.forEach((fn) => fn());
  _cleanupFns = [];
}
