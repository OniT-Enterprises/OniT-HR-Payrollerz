/**
 * Vendor Service
 * Firestore CRUD operations for vendors (suppliers)
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Vendor, VendorFormData } from '@/types/money';

class VendorService {
  private get collectionRef() {
    return collection(db, 'vendors');
  }

  /**
   * Get all vendors
   */
  async getAllVendors(): Promise<Vendor[]> {
    const querySnapshot = await getDocs(
      query(this.collectionRef, orderBy('name', 'asc'))
    );

    return querySnapshot.docs.map((doc) => this.mapVendor(doc));
  }

  /**
   * Get active vendors only
   */
  async getActiveVendors(): Promise<Vendor[]> {
    const q = query(
      this.collectionRef,
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapVendor(doc));
  }

  /**
   * Get a single vendor by ID
   */
  async getVendorById(id: string): Promise<Vendor | null> {
    const docRef = doc(db, 'vendors', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapVendor(docSnap);
  }

  /**
   * Create a new vendor
   */
  async createVendor(data: VendorFormData): Promise<string> {
    const vendor: Omit<Vendor, 'id'> = {
      ...data,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(this.collectionRef, {
      ...vendor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update an existing vendor
   */
  async updateVendor(id: string, data: Partial<VendorFormData>): Promise<boolean> {
    const docRef = doc(db, 'vendors', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Deactivate a vendor (soft delete)
   */
  async deactivateVendor(id: string): Promise<boolean> {
    const docRef = doc(db, 'vendors', id);
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Reactivate a vendor
   */
  async reactivateVendor(id: string): Promise<boolean> {
    const docRef = doc(db, 'vendors', id);
    await updateDoc(docRef, {
      isActive: true,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Search vendors by name
   */
  async searchVendors(searchTerm: string): Promise<Vendor[]> {
    // Firestore doesn't support full-text search, so we fetch all and filter
    const vendors = await this.getActiveVendors();
    const term = searchTerm.toLowerCase();

    return vendors.filter(
      (vendor) =>
        vendor.name.toLowerCase().includes(term) ||
        vendor.email?.toLowerCase().includes(term) ||
        vendor.phone?.includes(term)
    );
  }

  private mapVendor(doc: any): Vendor {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Vendor;
  }
}

export const vendorService = new VendorService();
export default vendorService;
