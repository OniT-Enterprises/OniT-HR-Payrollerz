/**
 * Disciplinary Service
 * Manages disciplinary actions and incident reports with persistence
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fileUploadService } from './fileUploadService';
import { getTodayTL } from '@/lib/dateUtils';

// ============================================
// Types
// ============================================

export type DisciplinaryStatus = 'open' | 'in_review' | 'closed';

export type DisciplinaryType =
  | 'warning'
  | 'suspension'
  | 'termination'
  | 'misconduct'
  | 'attendance'
  | 'performance';

export type SeverityLevel = 'low' | 'medium' | 'high';

export interface DisciplinaryRecord {
  id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  departmentId?: string;

  // Incident details
  date: string; // YYYY-MM-DD
  type: DisciplinaryType;
  severity: SeverityLevel;
  summary: string;
  fullDetails?: string;

  // Evidence
  evidenceUrl?: string;
  evidenceFileName?: string;

  // Status & workflow
  status: DisciplinaryStatus;
  actionTaken?: string;

  // Audit trail
  createdBy: string;
  createdDate: string;
  closedDate?: string;
  closedBy?: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DisciplinaryFilters {
  employeeId?: string;
  type?: DisciplinaryType;
  status?: DisciplinaryStatus;
  severity?: SeverityLevel;
}

export interface DisciplinaryStats {
  totalRecords: number;
  open: number;
  inReview: number;
  closed: number;
  byType: Record<DisciplinaryType, number>;
  bySeverity: Record<SeverityLevel, number>;
}

// ============================================
// Constants
// ============================================

const DISCIPLINARY_COLLECTION = 'disciplinary';

export const DISCIPLINARY_TYPES: { id: DisciplinaryType; name: string }[] = [
  { id: 'warning', name: 'Warning' },
  { id: 'suspension', name: 'Suspension' },
  { id: 'termination', name: 'Termination' },
  { id: 'misconduct', name: 'Misconduct' },
  { id: 'attendance', name: 'Attendance Issue' },
  { id: 'performance', name: 'Performance Issue' },
];

export const SEVERITY_LEVELS: { id: SeverityLevel; name: string }[] = [
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
];

const STATUS_OPTIONS: { id: DisciplinaryStatus; name: string }[] = [
  { id: 'open', name: 'Open' },
  { id: 'in_review', name: 'In Review' },
  { id: 'closed', name: 'Closed' },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get display name for type
 */
export function getTypeName(type: DisciplinaryType): string {
  return DISCIPLINARY_TYPES.find((t) => t.id === type)?.name || type;
}

/**
 * Get display name for severity
 */
export function getSeverityName(severity: SeverityLevel): string {
  return SEVERITY_LEVELS.find((s) => s.id === severity)?.name || severity;
}

/**
 * Get display name for status
 */
export function getStatusName(status: DisciplinaryStatus): string {
  return STATUS_OPTIONS.find((s) => s.id === status)?.name || status;
}

// ============================================
// Disciplinary Service
// ============================================

class DisciplinaryService {
  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Create a new disciplinary record
   */
  async createRecord(
    tenantId: string,
    record: Omit<DisciplinaryRecord, 'id' | 'tenantId' | 'status' | 'createdAt' | 'updatedAt'>,
    evidenceFile?: File
  ): Promise<string> {
    try {
      // Upload evidence if provided
      let evidenceUrl: string | undefined;
      let evidenceFileName: string | undefined;

      if (evidenceFile) {
        const uploadResult = await this.uploadEvidence(
          tenantId,
          record.employeeId,
          evidenceFile
        );
        evidenceUrl = uploadResult.url;
        evidenceFileName = uploadResult.fileName;
      }

      const docRef = await addDoc(collection(db, DISCIPLINARY_COLLECTION), {
        ...record,
        tenantId,
        status: 'open' as DisciplinaryStatus,
        evidenceUrl,
        evidenceFileName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating disciplinary record:', error);
      throw error;
    }
  }

  /**
   * Get a disciplinary record by ID
   */
  async getRecord(tenantId: string, recordId: string): Promise<DisciplinaryRecord | null> {
    try {
      const docRef = doc(db, DISCIPLINARY_COLLECTION, recordId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tenantId !== tenantId) {
          return null;
        }
        return this.mapDocToRecord(docSnap.id, data);
      }

      return null;
    } catch (error) {
      console.error('Error getting disciplinary record:', error);
      throw error;
    }
  }

  /**
   * Get all disciplinary records with optional filters
   */
  async getRecords(
    tenantId: string,
    filters?: DisciplinaryFilters
  ): Promise<DisciplinaryRecord[]> {
    try {
      let q = query(
        collection(db, DISCIPLINARY_COLLECTION),
        where('tenantId', '==', tenantId),
        orderBy('date', 'desc')
      );

      if (filters?.employeeId) {
        q = query(q, where('employeeId', '==', filters.employeeId));
      }

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.type) {
        q = query(q, where('type', '==', filters.type));
      }

      if (filters?.severity) {
        q = query(q, where('severity', '==', filters.severity));
      }

      const querySnapshot = await getDocs(q);
      const records: DisciplinaryRecord[] = [];

      querySnapshot.forEach((doc) => {
        records.push(this.mapDocToRecord(doc.id, doc.data()));
      });

      return records;
    } catch (error) {
      console.error('Error getting disciplinary records:', error);
      throw error;
    }
  }

  /**
   * Update a disciplinary record
   */
  async updateRecord(
    tenantId: string,
    recordId: string,
    updates: Partial<Omit<DisciplinaryRecord, 'id' | 'tenantId' | 'createdAt'>>,
    newEvidenceFile?: File
  ): Promise<void> {
    try {
      // Verify ownership first
      const existing = await this.getRecord(tenantId, recordId);
      if (!existing) {
        throw new Error('Disciplinary record not found');
      }

      // Handle evidence update
      let evidenceUpdates: Partial<DisciplinaryRecord> = {};
      if (newEvidenceFile) {
        // Delete old evidence if exists
        if (existing.evidenceUrl) {
          try {
            await fileUploadService.deleteFile(existing.evidenceUrl);
          } catch (e) {
            console.warn('Failed to delete old evidence:', e);
          }
        }

        const uploadResult = await this.uploadEvidence(
          tenantId,
          existing.employeeId,
          newEvidenceFile
        );
        evidenceUpdates = {
          evidenceUrl: uploadResult.url,
          evidenceFileName: uploadResult.fileName,
        };
      }

      const docRef = doc(db, DISCIPLINARY_COLLECTION, recordId);
      await updateDoc(docRef, {
        ...updates,
        ...evidenceUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating disciplinary record:', error);
      throw error;
    }
  }

  /**
   * Delete a disciplinary record
   */
  async deleteRecord(tenantId: string, recordId: string): Promise<void> {
    try {
      // Verify ownership and get evidence URL for cleanup
      const existing = await this.getRecord(tenantId, recordId);
      if (!existing) {
        throw new Error('Disciplinary record not found');
      }

      // Delete evidence file if exists
      if (existing.evidenceUrl) {
        try {
          await fileUploadService.deleteFile(existing.evidenceUrl);
        } catch (e) {
          console.warn('Failed to delete evidence file:', e);
        }
      }

      const docRef = doc(db, DISCIPLINARY_COLLECTION, recordId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting disciplinary record:', error);
      throw error;
    }
  }

  // ----------------------------------------
  // Status Workflow
  // ----------------------------------------

  /**
   * Move record to In Review status
   */
  async moveToReview(tenantId: string, recordId: string): Promise<void> {
    await this.updateRecord(tenantId, recordId, {
      status: 'in_review',
    });
  }

  /**
   * Close a disciplinary case
   */
  async closeCase(
    tenantId: string,
    recordId: string,
    closedBy: string,
    actionTaken?: string
  ): Promise<void> {
    await this.updateRecord(tenantId, recordId, {
      status: 'closed',
      closedDate: getTodayTL(),
      closedBy,
      ...(actionTaken && { actionTaken }),
    });
  }

  /**
   * Reopen a closed case
   */
  async reopenCase(tenantId: string, recordId: string): Promise<void> {
    await this.updateRecord(tenantId, recordId, {
      status: 'open',
      closedDate: undefined,
      closedBy: undefined,
    });
  }

  // ----------------------------------------
  // Evidence Upload
  // ----------------------------------------

  /**
   * Upload evidence file
   */
  private async uploadEvidence(
    tenantId: string,
    employeeId: string,
    file: File
  ): Promise<{ url: string; fileName: string }> {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `evidence_${timestamp}.${fileExtension}`;
    const path = `tenants/${tenantId}/disciplinary/${employeeId}/${fileName}`;

    const url = await fileUploadService.uploadFile(file, path);
    return { url, fileName: file.name };
  }

  /**
   * Validate evidence file
   */
  validateEvidenceFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 15 * 1024 * 1024; // 15MB
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Please upload a PDF, image (JPG, PNG), or Word document',
      };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be under 15MB' };
    }

    return { valid: true };
  }

  // ----------------------------------------
  // Statistics & Queries
  // ----------------------------------------

  /**
   * Get disciplinary statistics
   */
  async getStats(tenantId: string): Promise<DisciplinaryStats> {
    try {
      const allRecords = await this.getRecords(tenantId);

      const open = allRecords.filter((r) => r.status === 'open').length;
      const inReview = allRecords.filter((r) => r.status === 'in_review').length;
      const closed = allRecords.filter((r) => r.status === 'closed').length;

      // Count by type
      const byType: Record<DisciplinaryType, number> = {
        warning: 0,
        suspension: 0,
        termination: 0,
        misconduct: 0,
        attendance: 0,
        performance: 0,
      };
      allRecords.forEach((r) => {
        byType[r.type]++;
      });

      // Count by severity
      const bySeverity: Record<SeverityLevel, number> = {
        low: 0,
        medium: 0,
        high: 0,
      };
      allRecords.forEach((r) => {
        bySeverity[r.severity]++;
      });

      return {
        totalRecords: allRecords.length,
        open,
        inReview,
        closed,
        byType,
        bySeverity,
      };
    } catch (error) {
      console.error('Error getting disciplinary stats:', error);
      throw error;
    }
  }

  /**
   * Get records for an employee
   */
  async getEmployeeRecords(
    tenantId: string,
    employeeId: string
  ): Promise<DisciplinaryRecord[]> {
    return this.getRecords(tenantId, { employeeId });
  }

  /**
   * Get open/in-review cases (for dashboard alerts)
   */
  async getActiveCases(tenantId: string): Promise<DisciplinaryRecord[]> {
    const allRecords = await this.getRecords(tenantId);
    return allRecords.filter((r) => r.status !== 'closed');
  }

  // ----------------------------------------
  // Helper Methods
  // ----------------------------------------

  /**
   * Map Firestore document to DisciplinaryRecord
   */
  private mapDocToRecord(id: string, data: DocumentData): DisciplinaryRecord {
    return {
      id,
      tenantId: data.tenantId,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      department: data.department,
      departmentId: data.departmentId,
      date: data.date,
      type: data.type,
      severity: data.severity,
      summary: data.summary,
      fullDetails: data.fullDetails,
      evidenceUrl: data.evidenceUrl,
      evidenceFileName: data.evidenceFileName,
      status: data.status,
      actionTaken: data.actionTaken,
      createdBy: data.createdBy,
      createdDate: data.createdDate,
      closedDate: data.closedDate,
      closedBy: data.closedBy,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : data.updatedAt,
    };
  }
}

export const disciplinaryService = new DisciplinaryService();
