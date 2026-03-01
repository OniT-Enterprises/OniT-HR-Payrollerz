/**
 * Face Recognition Service - Firestore CRUD for face embeddings
 * Stores 128-dim float arrays per employee for client-side facial matching
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { paths } from '@/lib/paths';

export interface FaceEmbeddingDoc {
  employeeId: string;
  employeeName: string;
  tenantId: string;
  embeddings: number[][];        // 3-5 reference vectors, each 128 floats
  photoUrls: string[];           // Firebase Storage download URLs
  registeredAt: Date;
  registeredBy: string;
  isActive: boolean;
  updatedAt: Date;
}

class FaceRecognitionService {
  /**
   * Fetch all active face embeddings for a tenant (used for matching)
   */
  async getAllEmbeddings(tenantId: string): Promise<FaceEmbeddingDoc[]> {
    const q = query(
      collection(db, paths.faceEmbeddings(tenantId)),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        registeredAt: data.registeredAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as FaceEmbeddingDoc;
    });
  }

  /**
   * Get a single employee's face embedding
   */
  async getEmbedding(tenantId: string, employeeId: string): Promise<FaceEmbeddingDoc | null> {
    const docRef = doc(db, paths.faceEmbedding(tenantId, employeeId));
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      ...data,
      registeredAt: data.registeredAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    } as FaceEmbeddingDoc;
  }

  /**
   * Register face embeddings for an employee
   */
  async registerFace(
    tenantId: string,
    employeeId: string,
    data: {
      employeeName: string;
      embeddings: number[][];
      photoUrls: string[];
      registeredBy: string;
    }
  ): Promise<void> {
    const docRef = doc(db, paths.faceEmbedding(tenantId, employeeId));
    await setDoc(docRef, {
      employeeId,
      employeeName: data.employeeName,
      tenantId,
      embeddings: data.embeddings,
      photoUrls: data.photoUrls,
      registeredBy: data.registeredBy,
      isActive: true,
      registeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Soft-deactivate face embeddings
   */
  async deactivateFace(tenantId: string, employeeId: string): Promise<void> {
    const docRef = doc(db, paths.faceEmbedding(tenantId, employeeId));
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Upload a face photo blob to Firebase Storage
   * Returns the download URL
   */
  async uploadFacePhoto(
    blob: Blob,
    tenantId: string,
    employeeId: string,
    index: number
  ): Promise<string> {
    const timestamp = Date.now();
    const storageRef = ref(
      storage,
      `tenants/${tenantId}/face_photos/${employeeId}/ref_${index}_${timestamp}.jpg`
    );
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
  }
}

export const faceRecognitionService = new FaceRecognitionService();
