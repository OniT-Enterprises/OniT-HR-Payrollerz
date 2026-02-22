/**
 * Payroll Constants
 * Status labels, formatting helpers, and deduction types
 */

// ============================================
// PAY PERIOD DATES HELPER
// ============================================

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ============================================
// STATUS LABELS & COLORS
// ============================================

export const PAYROLL_STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    color: 'gray',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-800',
  },
  writing_records: {
    label: 'Saving...',
    color: 'yellow',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
  },
  processing: {
    label: 'Processing',
    color: 'blue',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
  },
  approved: {
    label: 'Approved',
    color: 'green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
  },
  paid: {
    label: 'Paid',
    color: 'emerald',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-800',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'red',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
  },
  rejected: {
    label: 'Rejected',
    color: 'orange',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-800',
  },
};

// ============================================
// CURRENCY FORMATTING
// ============================================

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// ============================================
// DATE HELPERS
// ============================================

export const formatPayPeriod = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = MONTHS[start.getMonth()];
  const endMonth = MONTHS[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
  }

  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
};

export const getPayPeriodLabel = (periodStart: string, _periodEnd: string): string => {
  const start = new Date(periodStart);
  const month = MONTHS[start.getMonth()];
  const year = start.getFullYear();
  return `${month} ${year}`;
};
