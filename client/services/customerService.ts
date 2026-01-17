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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer, CustomerFormData } from '@/types/money';

class CustomerService {
  private get collectionRef() {
    return collection(db, 'customers');
  }

  /**
   * Get all customers
   */
  async getAllCustomers(maxResults: number = 500): Promise<Customer[]> {
    const querySnapshot = await getDocs(
      query(this.collectionRef, orderBy('name', 'asc'), limit(maxResults))
    );

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Customer;
    });
  }

  /**
   * Get active customers only
   */
  async getActiveCustomers(): Promise<Customer[]> {
    const q = query(
      this.collectionRef,
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Customer;
    });
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

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Customer;
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
   * Search customers by name
   */
  async searchCustomers(searchTerm: string): Promise<Customer[]> {
    const customers = await this.getAllCustomers();
    const term = searchTerm.toLowerCase();

    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.email?.toLowerCase().includes(term) ||
        customer.phone?.includes(term)
    );
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
