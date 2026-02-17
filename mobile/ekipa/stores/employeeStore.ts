/**
 * Employee store — fetch own employee record
 * Path: tenants/{tid}/employees/{empId}
 */
import { create } from 'zustand';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  nationalId?: string;

  // Job details
  department?: string;
  departmentId?: string;
  position?: string;
  positionId?: string;
  employmentType?: string; // full_time, part_time, contract
  startDate?: string;
  status?: string; // active, on_leave, terminated

  // Salary
  baseSalary?: number;
  currency?: string;

  // Documents
  documents?: EmployeeDocument[];

  // Photo
  photoUrl?: string;
}

export interface EmployeeDocument {
  name: string;
  type: string;
  url?: string;
  expiryDate?: string;
  status?: string;
}

interface EmployeeState {
  employee: Employee | null;
  loading: boolean;
  error: string | null;

  fetchEmployee: (tenantId: string, employeeId: string) => Promise<void>;
  clear: () => void;
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  employee: null,
  loading: false,
  error: null,

  fetchEmployee: async (tenantId: string, employeeId: string) => {
    set({ loading: true, error: null });
    try {
      const empDoc = await getDoc(doc(db, `tenants/${tenantId}/employees/${employeeId}`));
      if (empDoc.exists()) {
        const data = empDoc.data();
        set({
          employee: {
            id: empDoc.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            address: data.address,
            nationalId: data.nationalId,
            department: data.department,
            departmentId: data.departmentId,
            position: data.position,
            positionId: data.positionId,
            employmentType: data.employmentType,
            startDate: data.startDate instanceof Timestamp
              ? data.startDate.toDate().toISOString().split('T')[0]
              : data.startDate,
            status: data.status || 'active',
            baseSalary: data.baseSalary,
            currency: data.currency || 'USD',
            documents: data.documents || [],
            photoUrl: data.photoUrl,
          },
          loading: false,
        });
      } else {
        set({ employee: null, loading: false, error: 'notFound' });
      }
    } catch {
      set({ employee: null, loading: false, error: 'fetchError' });
    }
  },

  clear: () => set({ employee: null, loading: false, error: null }),
}));
