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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer, CustomerFormData } from '@/types/money';

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
 * Maps Firestore document to Customer
 */
function mapCustomer(docSnap: DocumentSnapshot): Customer {
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
  } as Customer;
}

class CustomerService {
  private get collectionRef() {
    return collection(db, 'customers');
  }

  /**
   * Get customers with server-side filtering and pagination
   */
  async getCustomers(filters: CustomerFilters = {}): Promise<PaginatedResult<Customer>> {
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

    const q = query(this.collectionRef, ...constraints);
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
   * Get all customers
   * @deprecated Use getCustomers() with filters for better performance
   */
  async getAllCustomers(maxResults: number = 500): Promise<Customer[]> {
    const result = await this.getCustomers({ pageSize: maxResults });
    return result.data;
  }

  /**
   * Get active customers only (server-side filtered)
   */
  async getActiveCustomers(): Promise<Customer[]> {
    const result = await this.getCustomers({ isActive: true, pageSize: 500 });
    return result.data;
  }

  /**
   * Get a single customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    const docRef = doc(db, 'customers', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapCustomer(docSnap);
  }

  /**
   * Create a new customer
   */
  async createCustomer(data: CustomerFormData): Promise<string> {
    const customer: Omit<Customer, 'id'> = {
      ...data,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(this.collectionRef, {
      ...customer,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update an existing customer
   */
  async updateCustomer(id: string, data: Partial<CustomerFormData>): Promise<boolean> {
    const docRef = doc(db, 'customers', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Soft delete a customer (set isActive to false)
   */
  async deactivateCustomer(id: string): Promise<boolean> {
    const docRef = doc(db, 'customers', id);
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Hard delete a customer
   */
  async deleteCustomer(id: string): Promise<boolean> {
    const docRef = doc(db, 'customers', id);
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Search customers by name (client-side filtering)
   */
  async searchCustomers(searchTerm: string): Promise<Customer[]> {
    const result = await this.getCustomers({ searchTerm, pageSize: 500 });
    return result.data;
  }

  /**
   * Get customers with outstanding balance
   * Note: Balance is calculated from invoices, this is a helper
   */
  async getCustomersWithBalance(): Promise<Customer[]> {
    // For now, return all active customers
    // Balance will be calculated when we have invoices
    return this.getActiveCustomers();
  }
}

export const customerService = new CustomerService();
export default customerService;
