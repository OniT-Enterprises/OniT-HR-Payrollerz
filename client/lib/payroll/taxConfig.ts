/**
 * Runtime Tax Configuration
 * Fetches TL tax rates and labor law constants from Firestore
 * Allows updating tax rates without redeploying the application
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ============================================
// TAX CONFIGURATION TYPES
// ============================================

export interface TLTaxConfig {
  // Withholding Income Tax (WIT)
  incomeTax: {
    rate: number;                  // e.g., 0.10 for 10%
    residentThreshold: number;     // e.g., 500 for $500 monthly threshold
    nonResidentThreshold: number;  // e.g., 0 for first-dollar taxation
  };

  // Social Security (INSS)
  inss: {
    employeeRate: number;          // e.g., 0.04 for 4%
    employerRate: number;          // e.g., 0.06 for 6%
  };

  // Minimum Wage
  minimumWage: {
    monthly: number;               // e.g., 115
    effectiveDate: string;         // YYYY-MM-DD
  };

  // Working Hours
  workingHours: {
    standardWeeklyHours: number;   // e.g., 44
    standardDailyHours: number;    // e.g., 8
    maxOvertimePerDay: number;     // e.g., 4
    maxOvertimePerWeek: number;    // e.g., 16
  };

  // Overtime Rates
  overtimeRates: {
    standard: number;              // e.g., 1.5 for 150%
    nightShift: number;            // e.g., 1.25 for 125%
    restDay: number;               // e.g., 2.0 for 200%
    publicHoliday: number;         // e.g., 2.0 for 200%
  };

  // Leave Entitlements
  annualLeave: {
    minimumDays: number;           // e.g., 12
    after3Years: number;           // e.g., 15
    after6Years: number;           // e.g., 18
    after9Years: number;           // e.g., 22
  };

  // Sick Leave
  sickLeave: {
    totalDays: number;             // e.g., 12
    fullPayDays: number;           // e.g., 6
    reducedPayRate: number;        // e.g., 0.5 for 50%
  };

  // Maternity Leave
  maternityLeave: {
    totalDays: number;             // e.g., 90
    preNatalDays: number;          // e.g., 30
    postNatalDays: number;         // e.g., 60
    payRate: number;               // e.g., 1.0 for 100%
  };

  // Severance
  severance: {
    daysPerYear: number;           // e.g., 30
    minimumMonths: number;         // e.g., 3
    noticePeriodDays: number;      // e.g., 30
  };

  // Metadata
  lastUpdated: Date | null;
  updatedBy: string | null;
  version: number;
  effectiveDate: string;           // When this config takes effect
  notes?: string;                  // Admin notes about changes
}

// ============================================
// DEFAULT VALUES (Fallback)
// ============================================

const DEFAULT_TAX_CONFIG: TLTaxConfig = {
  incomeTax: {
    rate: 0.10,
    residentThreshold: 500,
    nonResidentThreshold: 0,
  },
  inss: {
    employeeRate: 0.04,
    employerRate: 0.06,
  },
  minimumWage: {
    monthly: 115,
    effectiveDate: '2023-01-01',
  },
  workingHours: {
    standardWeeklyHours: 44,
    standardDailyHours: 8,
    maxOvertimePerDay: 4,
    maxOvertimePerWeek: 16,
  },
  overtimeRates: {
    standard: 1.5,
    nightShift: 1.25,
    restDay: 2.0,
    publicHoliday: 2.0,
  },
  annualLeave: {
    minimumDays: 12,
    after3Years: 15,
    after6Years: 18,
    after9Years: 22,
  },
  sickLeave: {
    totalDays: 12,
    fullPayDays: 6,
    reducedPayRate: 0.5,
  },
  maternityLeave: {
    totalDays: 90,
    preNatalDays: 30,
    postNatalDays: 60,
    payRate: 1.0,
  },
  severance: {
    daysPerYear: 30,
    minimumMonths: 3,
    noticePeriodDays: 30,
  },
  lastUpdated: null,
  updatedBy: null,
  version: 1,
  effectiveDate: '2023-01-01',
};

// ============================================
// CACHE
// ============================================

let cachedConfig: TLTaxConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// FETCH FUNCTIONS
// ============================================

/**
 * Fetch tax configuration from Firestore
 * Falls back to defaults if not found
 * Caches result for 5 minutes
 */
export async function getTaxConfig(): Promise<TLTaxConfig> {
  // Return cached config if still valid
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const configDoc = await getDoc(doc(db, 'system_config', 'tl_tax_config'));

    if (configDoc.exists()) {
      const data = configDoc.data();
      cachedConfig = {
        ...DEFAULT_TAX_CONFIG,
        ...data,
        lastUpdated: data.lastUpdated?.toDate?.() || null,
      } as TLTaxConfig;
    } else {
      // Config doesn't exist, use defaults
      cachedConfig = DEFAULT_TAX_CONFIG;
    }

    cacheTimestamp = Date.now();
    return cachedConfig;
  } catch (error) {
    console.error('Error fetching tax config:', error);
    // Return defaults on error
    return DEFAULT_TAX_CONFIG;
  }
}

