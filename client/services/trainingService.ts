/**
 * Training & Certifications Service
 * Manages employee training records and certifications with persistence
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

export type TrainingStatus = 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled';

export interface TrainingRecord {
  id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  departmentId?: string;

  // Training details
  courseTitle: string;
  provider: string;
  description?: string;
  category?: string;

  // Dates
  startDate: string; // YYYY-MM-DD
  completionDate?: string;
  expiryDate?: string;

  // Certificate
  certificateUrl?: string;
  certificateFileName?: string;

  // Status
  status: TrainingStatus;

  // Costs
  cost?: number;
  currency?: string;

  // Notes
  notes?: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export interface TrainingFilters {
  employeeId?: string;
  status?: TrainingStatus;
  category?: string;
  expiringSoon?: boolean; // Records expiring within 30 days
}

export interface TrainingStats {
  totalRecords: number;
  pending: number;
  inProgress: number;
  completed: number;
  expired: number;
  expiringSoon: number;
}

// ============================================
// Constants
// ============================================

const TRAINING_COLLECTION = 'trainings';

export const TRAINING_CATEGORIES = [
  'Technical',
  'Compliance',
  'Leadership',
  'Safety',
  'Soft Skills',
  'Certification',
  'Other',
];

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate status based on dates
 */
function calculateTrainingStatus(
  startDate: string,
  completionDate?: string,
  expiryDate?: string
): TrainingStatus {
  const today = getTodayTL();

  // If completed and has expiry date, check if expired
  if (completionDate && expiryDate) {
    if (expiryDate < today) {
      return 'expired';
    }
    return 'completed';
  }

  // If completed without expiry
  if (completionDate) {
    return 'completed';
  }

  // If started but not completed
  if (startDate <= today) {
    return 'in_progress';
  }

  // Not yet started
  return 'pending';
}

/**
 * Check if training is expiring soon (within 30 days)
 */
export function isExpiringSoon(expiryDate?: string): boolean {
  if (!expiryDate) return false;

  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 && diffDays <= 30;
}

// ============================================
// Training Service
// ============================================

class TrainingService {
  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Create a new training record
   */
  async createTrainingRecord(
    tenantId: string,
    record: Omit<TrainingRecord, 'id' | 'tenantId' | 'status' | 'createdAt' | 'updatedAt'>,
    certificateFile?: File,
    createdBy?: string
  ): Promise<string> {
    try {
      // Calculate initial status
      const status = calculateTrainingStatus(
        record.startDate,
        record.completionDate,
        record.expiryDate
      );

      // Upload certificate if provided
      let certificateUrl: string | undefined;
      let certificateFileName: string | undefined;

      if (certificateFile) {
        const uploadResult = await this.uploadCertificate(
          tenantId,
          record.employeeId,
          certificateFile
        );
        certificateUrl = uploadResult.url;
        certificateFileName = uploadResult.fileName;
      }

      const docRef = await addDoc(collection(db, TRAINING_COLLECTION), {
        ...record,
        tenantId,
        status,
        certificateUrl,
        certificateFileName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy,
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating training record:', error);
      throw error;
    }
  }

  /**
   * Get a training record by ID
   */
  async getTrainingRecord(tenantId: string, recordId: string): Promise<TrainingRecord | null> {
    try {
      const docRef = doc(db, TRAINING_COLLECTION, recordId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Verify tenant ownership
        if (data.tenantId !== tenantId) {
          return null;
        }
        return this.mapDocToRecord(docSnap.id, data);
      }

      return null;
    } catch (error) {
      console.error('Error getting training record:', error);
      throw error;
    }
  }

  /**
   * Get all training records with optional filters
   */
  async getTrainingRecords(
    tenantId: string,
    filters?: TrainingFilters
  ): Promise<TrainingRecord[]> {
    try {
      let q = query(
        collection(db, TRAINING_COLLECTION),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc')
      );

      if (filters?.employeeId) {
        q = query(q, where('employeeId', '==', filters.employeeId));
      }

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.category) {
        q = query(q, where('category', '==', filters.category));
      }

      const querySnapshot = await getDocs(q);
      let records: TrainingRecord[] = [];

      querySnapshot.forEach((doc) => {
        records.push(this.mapDocToRecord(doc.id, doc.data()));
      });

      // Client-side filter for expiring soon
      if (filters?.expiringSoon) {
        records = records.filter((r) => isExpiringSoon(r.expiryDate));
      }

      return records;
    } catch (error) {
      console.error('Error getting training records:', error);
      throw error;
    }
  }

  /**
   * Update a training record
   */
  async updateTrainingRecord(
    tenantId: string,
    recordId: string,
    updates: Partial<Omit<TrainingRecord, 'id' | 'tenantId' | 'createdAt'>>,
    newCertificateFile?: File
  ): Promise<void> {
    try {
      // Verify ownership first
      const existing = await this.getTrainingRecord(tenantId, recordId);
      if (!existing) {
        throw new Error('Training record not found');
      }

      // Recalculate status if dates changed
      const startDate = updates.startDate || existing.startDate;
      const completionDate = updates.completionDate !== undefined
        ? updates.completionDate
        : existing.completionDate;
      const expiryDate = updates.expiryDate !== undefined
        ? updates.expiryDate
        : existing.expiryDate;

      const status = calculateTrainingStatus(startDate, completionDate, expiryDate);

      // Handle certificate update
      let certificateUpdates: Partial<TrainingRecord> = {};
      if (newCertificateFile) {
        // Delete old certificate if exists
        if (existing.certificateUrl) {
          try {
            await fileUploadService.deleteFile(existing.certificateUrl);
          } catch (e) {
            console.warn('Failed to delete old certificate:', e);
          }
        }

        const uploadResult = await this.uploadCertificate(
          tenantId,
          existing.employeeId,
          newCertificateFile
        );
        certificateUpdates = {
          certificateUrl: uploadResult.url,
          certificateFileName: uploadResult.fileName,
        };
      }

      const docRef = doc(db, TRAINING_COLLECTION, recordId);
      await updateDoc(docRef, {
        ...updates,
        ...certificateUpdates,
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating training record:', error);
      throw error;
    }
  }

  /**
   * Delete a training record
   */
  async deleteTrainingRecord(tenantId: string, recordId: string): Promise<void> {
    try {
      // Verify ownership and get certificate URL for cleanup
      const existing = await this.getTrainingRecord(tenantId, recordId);
      if (!existing) {
        throw new Error('Training record not found');
      }

      // Delete certificate file if exists
      if (existing.certificateUrl) {
        try {
          await fileUploadService.deleteFile(existing.certificateUrl);
        } catch (e) {
          console.warn('Failed to delete certificate file:', e);
        }
      }

      const docRef = doc(db, TRAINING_COLLECTION, recordId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting training record:', error);
      throw error;
    }
  }

  // ----------------------------------------
  // Certificate Upload
  // ----------------------------------------

  /**
   * Upload a certificate file
   */
  private async uploadCertificate(
    tenantId: string,
    employeeId: string,
    file: File
  ): Promise<{ url: string; fileName: string }> {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `certificate_${timestamp}.${fileExtension}`;
    const path = `tenants/${tenantId}/training/${employeeId}/${fileName}`;

    const url = await fileUploadService.uploadFile(file, path);
    return { url, fileName: file.name };
  }

  /**
   * Validate certificate file
   */
  validateCertificateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Please upload a PDF or image file (JPG, PNG, WebP)' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be under 10MB' };
    }

    return { valid: true };
  }

  // ----------------------------------------
  // Statistics & Queries
  // ----------------------------------------

  /**
   * Get training statistics
   */
  async getTrainingStats(tenantId: string): Promise<TrainingStats> {
    try {
      const allRecords = await this.getTrainingRecords(tenantId);

      const pending = allRecords.filter((r) => r.status === 'pending').length;
      const inProgress = allRecords.filter((r) => r.status === 'in_progress').length;
      const completed = allRecords.filter((r) => r.status === 'completed').length;
      const expired = allRecords.filter((r) => r.status === 'expired').length;
      const expiringSoon = allRecords.filter((r) => isExpiringSoon(r.expiryDate)).length;

      return {
        totalRecords: allRecords.length,
        pending,
        inProgress,
        completed,
        expired,
        expiringSoon,
      };
    } catch (error) {
      console.error('Error getting training stats:', error);
      throw error;
    }
  }

  /**
   * Get training records for an employee
   */
  async getEmployeeTrainings(tenantId: string, employeeId: string): Promise<TrainingRecord[]> {
    return this.getTrainingRecords(tenantId, { employeeId });
  }

  /**
   * Get expiring certifications (for alerts)
   */
  async getExpiringCertifications(tenantId: string): Promise<TrainingRecord[]> {
    const allRecords = await this.getTrainingRecords(tenantId);
    return allRecords.filter(
      (r) => r.status === 'completed' && r.expiryDate && isExpiringSoon(r.expiryDate)
    );
  }

  /**
   * Update all statuses (to be called periodically or on page load)
   */
  async refreshStatuses(tenantId: string): Promise<void> {
    try {
      const allRecords = await this.getTrainingRecords(tenantId);

      for (const record of allRecords) {
        const newStatus = calculateTrainingStatus(
          record.startDate,
          record.completionDate,
          record.expiryDate
        );

        if (newStatus !== record.status) {
          const docRef = doc(db, TRAINING_COLLECTION, record.id!);
          await updateDoc(docRef, {
            status: newStatus,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error('Error refreshing statuses:', error);
      // Don't throw - this is a background operation
    }
  }

  // ----------------------------------------
  // Helper Methods
  // ----------------------------------------

  /**
   * Map Firestore document to TrainingRecord
   */
  private mapDocToRecord(id: string, data: DocumentData): TrainingRecord {
    return {
      id,
      tenantId: data.tenantId,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      department: data.department,
      departmentId: data.departmentId,
      courseTitle: data.courseTitle,
      provider: data.provider,
      description: data.description,
      category: data.category,
      startDate: data.startDate,
      completionDate: data.completionDate,
      expiryDate: data.expiryDate,
      certificateUrl: data.certificateUrl,
      certificateFileName: data.certificateFileName,
      status: data.status,
      cost: data.cost,
      currency: data.currency,
      notes: data.notes,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : data.updatedAt,
      createdBy: data.createdBy,
    };
  }
}

export const trainingService = new TrainingService();
