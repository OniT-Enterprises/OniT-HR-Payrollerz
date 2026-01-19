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
  limit,
  startAfter,
  serverTimestamp,
  QueryConstraint,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import type { Vendor, VendorFormData } from '@/types/money';

/**
 * Filter options for vendor queries
 */
export interface VendorFilters {
  // Server-side filters
  isActive?: boolean;

  // Pagination
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;

  // Client-side filters
  searchTerm?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalFetched: number;
}

/**
 * Maps Firestore document to Vendor
 */
function mapVendor(docSnap: DocumentSnapshot): Vendor {
  const data = docSnap.data();
  if (!data) throw new Error('Document data is undefined');

  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : data.createdAt || new Date(),
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate()
      : data.updatedAt || new Date(),
  } as Vendor;
}

class VendorService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.vendors(tenantId));
  }

  /**
   * Get vendors with server-side filtering and pagination
   */
  async getVendors(
    tenantId: string,
    filters: VendorFilters = {}
  ): Promise<PaginatedResult<Vendor>> {
    const {
      isActive,
      pageSize = 100,
      startAfterDoc,
      searchTerm,
    } = filters;

    const constraints: QueryConstraint[] = [];

    // Server-side filters
    if (isActive !== undefined) {
      constraints.push(where('isActive', '==', isActive));
    }

    // Ordering and pagination
    constraints.push(orderBy('name', 'asc'));

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    constraints.push(limit(pageSize + 1));

    const q = query(this.collectionRef(tenantId), ...constraints);
    const querySnapshot = await getDocs(q);

    let vendors = querySnapshot.docs.map(mapVendor);
    const hasMore = vendors.length > pageSize;

    if (hasMore) {
      vendors = vendors.slice(0, pageSize);
    }

    const lastDoc = vendors.length > 0
      ? querySnapshot.docs[vendors.length - 1]
      : null;

    // Client-side filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      vendors = vendors.filter(
        (vendor) =>
          vendor.name.toLowerCase().includes(term) ||
          vendor.email?.toLowerCase().includes(term) ||
          vendor.phone?.includes(term)
      );
    }

    return {
      data: vendors,
      lastDoc,
      hasMore,
      totalFetched: vendors.length,
    };
  }

  /**
   * Get all vendors
   * @deprecated Use getVendors() with filters for better performance
   */
  async getAllVendors(tenantId: string): Promise<Vendor[]> {
    const result = await this.getVendors(tenantId, { pageSize: 500 });
    return result.data;
  }

  /**
   * Get active vendors only (server-side filtered)
   */
  async getActiveVendors(tenantId: string): Promise<Vendor[]> {
    const result = await this.getVendors(tenantId, { isActive: true, pageSize: 500 });
    return result.data;
  }

  /**
   * Get a single vendor by ID
   */
  async getVendorById(tenantId: string, id: string): Promise<Vendor | null> {
    const docRef = doc(db, paths.vendor(tenantId, id));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapVendor(docSnap);
  }

  /**
   * Create a new vendor
   */
  async createVendor(tenantId: string, data: VendorFormData): Promise<string> {
    const vendor: Omit<Vendor, 'id'> = {
      ...data,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(this.collectionRef(tenantId), {
      ...vendor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update an existing vendor
   */
  async updateVendor(
    tenantId: string,
    id: string,
    data: Partial<VendorFormData>
  ): Promise<boolean> {
    const docRef = doc(db, paths.vendor(tenantId, id));
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Deactivate a vendor (soft delete)
   */
  async deactivateVendor(tenantId: string, id: string): Promise<boolean> {
    const docRef = doc(db, paths.vendor(tenantId, id));
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Reactivate a vendor
   */
  async reactivateVendor(tenantId: string, id: string): Promise<boolean> {
    const docRef = doc(db, paths.vendor(tenantId, id));
    await updateDoc(docRef, {
      isActive: true,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Search vendors by name (client-side filtering)
   */
  async searchVendors(tenantId: string, searchTerm: string): Promise<Vendor[]> {
    const result = await this.getVendors(tenantId, { searchTerm, isActive: true, pageSize: 500 });
    return result.data;
  }
}

export const vendorService = new VendorService();
export default vendorService;
