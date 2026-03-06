/**
 * Employee store — fetch own employee record
 * Path: tenants/{tid}/employees/{empId}
 */
import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeEmployeeDoc } from '../lib/employeeDoc';

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

  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  qrCode?: string;
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
        set({
          employee: normalizeEmployeeDoc(empDoc.id, empDoc.data()),
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
