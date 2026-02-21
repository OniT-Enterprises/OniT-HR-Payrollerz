/**
 * SQLite database for offline crew clock-in/out storage
 * Uses expo-sqlite with WAL mode for performance
 */
import * as SQLite from 'expo-sqlite';
import type { PendingClockIn, SyncBatch, SyncStatus } from '../types/crew';

const DB_NAME = 'ekipa_crew.db';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DB_NAME);
    _db.execSync('PRAGMA journal_mode = WAL;');
    initTables(_db);
  }
  return _db;
}

function initTables(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS pending_clockins (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      department TEXT,
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      record_type TEXT NOT NULL CHECK(record_type IN ('clock_in', 'clock_out')),

      supervisor_id TEXT NOT NULL,
      supervisor_name TEXT NOT NULL,
      photo_local_path TEXT,
      photo_url TEXT,
      latitude REAL,
      longitude REAL,
      location_accuracy REAL,
      site_id TEXT,
      site_name TEXT,

      sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'uploading', 'synced', 'error')),
      sync_error TEXT,
      sync_attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_batches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      supervisor_id TEXT NOT NULL,
      supervisor_name TEXT NOT NULL,
      record_type TEXT NOT NULL CHECK(record_type IN ('clock_in', 'clock_out')),
      date TEXT NOT NULL,
      site_id TEXT,
      site_name TEXT,
      worker_count INTEGER NOT NULL,

      photo_local_path TEXT,
      photo_url TEXT,
      latitude REAL,
      longitude REAL,
      location_accuracy REAL,

      sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'uploading', 'synced', 'error')),
      sync_error TEXT,
      sync_attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_clockins_batch ON pending_clockins(batch_id);
    CREATE INDEX IF NOT EXISTS idx_clockins_sync ON pending_clockins(sync_status);
    CREATE INDEX IF NOT EXISTS idx_batches_sync ON sync_batches(sync_status);
    CREATE INDEX IF NOT EXISTS idx_batches_date ON sync_batches(date DESC);
  `);
}

// ── Batch operations ──────────────────────────────────────

export function insertBatch(batch: SyncBatch): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO sync_batches (
      id, tenant_id, supervisor_id, supervisor_name, record_type,
      date, site_id, site_name, worker_count,
      photo_local_path, photo_url, latitude, longitude, location_accuracy,
      sync_status, sync_error, sync_attempts, created_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batch.id, batch.tenantId, batch.supervisorId, batch.supervisorName, batch.recordType,
      batch.date, batch.siteId ?? null, batch.siteName ?? null, batch.workerCount,
      batch.photoLocalPath ?? null, batch.photoUrl ?? null,
      batch.latitude ?? null, batch.longitude ?? null, batch.locationAccuracy ?? null,
      batch.syncStatus, batch.syncError ?? null, batch.syncAttempts,
      batch.createdAt, batch.syncedAt ?? null,
    ]
  );
}

export function insertClockIn(record: PendingClockIn): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO pending_clockins (
      id, batch_id, tenant_id, employee_id, employee_name, department,
      date, clock_in, clock_out, record_type,
      supervisor_id, supervisor_name, photo_local_path, photo_url,
      latitude, longitude, location_accuracy, site_id, site_name,
      sync_status, sync_error, sync_attempts, created_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.batchId, record.tenantId, record.employeeId,
      record.employeeName, record.department ?? null,
      record.date, record.clockIn ?? null, record.clockOut ?? null, record.recordType,
      record.supervisorId, record.supervisorName,
      record.photoLocalPath ?? null, record.photoUrl ?? null,
      record.latitude ?? null, record.longitude ?? null, record.locationAccuracy ?? null,
      record.siteId ?? null, record.siteName ?? null,
      record.syncStatus, record.syncError ?? null, record.syncAttempts,
      record.createdAt, record.syncedAt ?? null,
    ]
  );
}

// ── Query operations ──────────────────────────────────────

export function getPendingBatches(): SyncBatch[] {
  const db = getDb();
  const rows = db.getAllSync<Record<string, any>>(
    `SELECT * FROM sync_batches WHERE sync_status IN ('pending', 'error') ORDER BY created_at DESC`
  );
  return rows.map(mapBatchRow);
}

export function getRecentBatches(limit: number = 5): SyncBatch[] {
  const db = getDb();
  const rows = db.getAllSync<Record<string, any>>(
    `SELECT * FROM sync_batches ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(mapBatchRow);
}

export function getBatchRecords(batchId: string): PendingClockIn[] {
  const db = getDb();
  const rows = db.getAllSync<Record<string, any>>(
    `SELECT * FROM pending_clockins WHERE batch_id = ?`,
    [batchId]
  );
  return rows.map(mapClockInRow);
}

export function getPendingCount(): number {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_batches WHERE sync_status IN ('pending', 'error')`
  );
  return row?.count ?? 0;
}

export function getErrorCount(): number {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_batches WHERE sync_status = 'error'`
  );
  return row?.count ?? 0;
}

export function getTodayClockInIds(tenantId: string, date: string): string[] {
  const db = getDb();
  const rows = db.getAllSync<{ employee_id: string }>(
    `SELECT DISTINCT employee_id FROM pending_clockins
     WHERE tenant_id = ? AND date = ? AND record_type = 'clock_in'`,
    [tenantId, date]
  );
  return rows.map((r) => r.employee_id);
}

export function getTodayClockInsWithoutClockOut(tenantId: string, date: string): PendingClockIn[] {
  const db = getDb();
  const rows = db.getAllSync<Record<string, any>>(
    `SELECT ci.* FROM pending_clockins ci
     WHERE ci.tenant_id = ? AND ci.date = ? AND ci.record_type = 'clock_in'
     AND ci.employee_id NOT IN (
       SELECT employee_id FROM pending_clockins
       WHERE tenant_id = ? AND date = ? AND record_type = 'clock_out'
     )`,
    [tenantId, date, tenantId, date]
  );
  return rows.map(mapClockInRow);
}

export function getAllBatchesByMonth(tenantId: string, yearMonth: string): SyncBatch[] {
  const db = getDb();
  const rows = db.getAllSync<Record<string, any>>(
    `SELECT * FROM sync_batches WHERE tenant_id = ? AND date LIKE ? ORDER BY created_at DESC`,
    [tenantId, `${yearMonth}%`]
  );
  return rows.map(mapBatchRow);
}

// ── Update operations ──────────────────────────────────────

export function updateBatchSyncStatus(
  batchId: string,
  status: SyncStatus,
  error?: string
): void {
  const db = getDb();
  db.runSync(
    `UPDATE sync_batches SET
      sync_status = ?,
      sync_error = ?,
      sync_attempts = sync_attempts + 1,
      synced_at = CASE WHEN ? = 'synced' THEN datetime('now') ELSE synced_at END
    WHERE id = ?`,
    [status, error ?? null, status, batchId]
  );
  db.runSync(
    `UPDATE pending_clockins SET
      sync_status = ?,
      sync_error = ?,
      sync_attempts = sync_attempts + 1,
      synced_at = CASE WHEN ? = 'synced' THEN datetime('now') ELSE synced_at END
    WHERE batch_id = ?`,
    [status, error ?? null, status, batchId]
  );
}

export function updateBatchPhotoUrl(batchId: string, photoUrl: string): void {
  const db = getDb();
  db.runSync(
    `UPDATE sync_batches SET photo_url = ? WHERE id = ?`,
    [photoUrl, batchId]
  );
  db.runSync(
    `UPDATE pending_clockins SET photo_url = ? WHERE batch_id = ?`,
    [photoUrl, batchId]
  );
}

// ── Delete operations ──────────────────────────────────────

export function deleteBatch(batchId: string): void {
  const db = getDb();
  db.runSync(`DELETE FROM pending_clockins WHERE batch_id = ?`, [batchId]);
  db.runSync(`DELETE FROM sync_batches WHERE id = ?`, [batchId]);
}

// ── Row mappers ──────────────────────────────────────────

function mapBatchRow(row: Record<string, any>): SyncBatch {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    supervisorId: row.supervisor_id,
    supervisorName: row.supervisor_name,
    recordType: row.record_type,
    date: row.date,
    siteId: row.site_id ?? undefined,
    siteName: row.site_name ?? undefined,
    workerCount: row.worker_count,
    photoLocalPath: row.photo_local_path ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    locationAccuracy: row.location_accuracy ?? undefined,
    syncStatus: row.sync_status,
    syncError: row.sync_error ?? undefined,
    syncAttempts: row.sync_attempts,
    createdAt: row.created_at,
    syncedAt: row.synced_at ?? undefined,
  };
}

function mapClockInRow(row: Record<string, any>): PendingClockIn {
  return {
    id: row.id,
    batchId: row.batch_id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department ?? undefined,
    date: row.date,
    clockIn: row.clock_in ?? undefined,
    clockOut: row.clock_out ?? undefined,
    recordType: row.record_type,
    supervisorId: row.supervisor_id,
    supervisorName: row.supervisor_name,
    photoLocalPath: row.photo_local_path ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    locationAccuracy: row.location_accuracy ?? undefined,
    siteId: row.site_id ?? undefined,
    siteName: row.site_name ?? undefined,
    syncStatus: row.sync_status,
    syncError: row.sync_error ?? undefined,
    syncAttempts: row.sync_attempts,
    createdAt: row.created_at,
    syncedAt: row.synced_at ?? undefined,
  };
}
