/**
 * Customer Service
 * Firestore CRUD operations for customers
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  QueryConstraint,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import type { Customer, CustomerFormData } from '@/types/money';
import { firestoreCustomerSchema } from '@/lib/validations';

/**
 * Filter options for customer queries
 */
export interface CustomerFilters {
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
 * Maps Firestore document to Customer with Zod validation
 */
function mapCustomer(docSnap: DocumentSnapshot): Customer {
  const data = docSnap.data();
  if (!data) throw new Error('Document data is undefined');

  // Validate with Zod schema
  const validated = firestoreCustomerSchema.safeParse(data);

  if (!validated.success) {
    console.warn(`Customer validation warning (${docSnap.id}):`, validated.error.flatten().fieldErrors);
  }

  const parsed = validated.success ? validated.data : data;

  return {
    id: docSnap.id,
    ...parsed,
  } as Customer;
}

class CustomerService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.customers(tenantId));
  }

  /**
   * Get customers with server-side filtering and pagination
   */
  async getCustomers(
    tenantId: string,
    filters: CustomerFilters = {}
  ): Promise<PaginatedResult<Customer>> {
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

    let customers = querySnapshot.docs.map(mapCustomer);
    const hasMore = customers.length > pageSize;

    if (hasMore) {
      customers = customers.slice(0, pageSize);
    }

    const lastDoc = customers.length > 0
      ? querySnapshot.docs[customers.length - 1]
      : null;

    // Client-side filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      customers = customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(term) ||
          customer.email?.toLowerCase().includes(term) ||
          customer.phone?.includes(term)
      );
    }

    return {
      data: customers,
      lastDoc,
      hasMore,
      totalFetched: customers.length,
    };
  }

  /**
   * Get all customers (fetches every page via getCustomers pagination loop)
   */
  async getAllCustomers(tenantId: string): Promise<Customer[]> {
    const MAX_PAGES = 100;
    const all: Customer[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getAllCustomers: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getCustomers(tenantId, { pageSize: 500, startAfterDoc: lastDoc });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }
    return all;
  }

  /**
   * Get active customers only (server-side filtered, paginated)
   */
  async getActiveCustomers(tenantId: string): Promise<Customer[]> {
    const MAX_PAGES = 100;
    const all: Customer[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getActiveCustomers: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getCustomers(tenantId, { isActive: true, pageSize: 500, startAfterDoc: lastDoc });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }
    return all;
  }

  /**
   * Get a single customer by ID
   */
  async getCustomerById(tenantId: string, id: string): Promise<Customer | null> {
    const docRef = doc(db, paths.customer(tenantId, id));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapCustomer(docSnap);
  }

  /**
   * Create a new customer
   */
  async createCustomer(tenantId: string, data: CustomerFormData): Promise<string> {
    const customer: Omit<Customer, 'id'> = {
      ...data,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(this.collectionRef(tenantId), {
      ...customer,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update an existing customer
   */
  async updateCustomer(
    tenantId: string,
    id: string,
    data: Partial<CustomerFormData>
  ): Promise<boolean> {
    const docRef = doc(db, paths.customer(tenantId, id));
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Soft delete a customer (set isActive to false)
   */
  async deactivateCustomer(tenantId: string, id: string): Promise<boolean> {
    const docRef = doc(db, paths.customer(tenantId, id));
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Hard delete a customer
   */
  async deleteCustomer(tenantId: string, id: string): Promise<boolean> {
    const docRef = doc(db, paths.customer(tenantId, id));
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Search customers by name (client-side filtering)
   */
  async searchCustomers(tenantId: string, searchTerm: string): Promise<Customer[]> {
    const result = await this.getCustomers(tenantId, { searchTerm, pageSize: 500 });
    return result.data;
  }

  /**
   * Get customers with outstanding balance
   * Note: Balance is calculated from invoices, this is a helper
   */
  async getCustomersWithBalance(tenantId: string): Promise<Customer[]> {
    // For now, return all active customers
    // Balance will be calculated when we have invoices
    return this.getActiveCustomers(tenantId);
  }
}

export const customerService = new CustomerService();
