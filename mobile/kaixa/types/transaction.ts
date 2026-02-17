/**
 * Kaixa Transaction Types — VAT-ready from day one.
 *
 * Every transaction captures VAT fields even when rate is 0%.
 * When TL implements VAT, these fields populate automatically
 * without any schema migration.
 */
import type { VATCategory } from '@onit/shared';

// ============================================
// Transaction
// ============================================

export interface KaixaTransaction {
  id: string;
  type: 'in' | 'out';

  // Money
  amount: number;           // Total (VAT-inclusive when VAT is active)
  netAmount: number;        // Amount excluding VAT
  vatRate: number;          // 0, 5, 10, etc. (0 until VAT active)
  vatAmount: number;        // Calculated VAT (0 until VAT active)
  vatCategory: VATCategory; // 'none' until VAT active

  // Details
  category: string;
  note: string;
  timestamp: Date;

  // Receipt compliance (populated when VAT active)
  receiptNumber?: string;
  businessVatId?: string;   // Seller's VAT registration
  customerVatId?: string;   // Buyer's VAT ID (B2B only)

  // Sync with Meza
  syncedToMeza: boolean;
  mezaInvoiceId?: string;

  // Metadata
  tenantId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Categories
// ============================================

export interface TransactionCategory {
  key: string;
  label: string;
  labelTL?: string;        // Tetum label
  icon?: string;
  type: 'in' | 'out' | 'both';
}

export const INCOME_CATEGORIES: TransactionCategory[] = [
  { key: 'sales', label: 'Sales', labelTL: 'Vendas', type: 'in' },
  { key: 'service', label: 'Service', labelTL: 'Servisu', type: 'in' },
  { key: 'payment_received', label: 'Payment received', labelTL: 'Simu pagamentu', type: 'in' },
  { key: 'other_income', label: 'Other', labelTL: 'Seluk', type: 'in' },
];

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  { key: 'stock', label: 'Stock / Inventory', labelTL: 'Estoke', type: 'out' },
  { key: 'rent', label: 'Rent', labelTL: 'Alugel', type: 'out' },
  { key: 'supplies', label: 'Supplies', labelTL: 'Fornese', type: 'out' },
  { key: 'salary', label: 'Salary', labelTL: 'Saláriu', type: 'out' },
  { key: 'transport', label: 'Transport', labelTL: 'Transporte', type: 'out' },
  { key: 'food', label: 'Food', labelTL: 'Hahan', type: 'out' },
  { key: 'other_expense', label: 'Other', labelTL: 'Seluk', type: 'out' },
];

// ============================================
// Helpers
// ============================================

/**
 * Create a new transaction with VAT fields initialized.
 * VAT is calculated if the config has a non-zero rate.
 */
export function createTransaction(
  params: {
    type: 'in' | 'out';
    amount: number;
    category: string;
    note: string;
    tenantId: string;
    createdBy: string;
    vatRate?: number;
    vatCategory?: VATCategory;
  }
): Omit<KaixaTransaction, 'id'> {
  const vatRate = params.vatRate ?? 0;
  const vatCategory = params.vatCategory ?? 'none';

  // If VAT is active and category is taxable, extract VAT from the amount
  // (Kaixa treats entered amounts as VAT-inclusive, like retail)
  let netAmount: number;
  let vatAmount: number;

  if (vatRate > 0 && vatCategory !== 'exempt' && vatCategory !== 'none') {
    // Extract VAT from gross amount
    const divisor = 1 + vatRate / 100;
    netAmount = Math.round((params.amount / divisor) * 100) / 100;
    vatAmount = Math.round((params.amount - netAmount) * 100) / 100;
  } else {
    netAmount = params.amount;
    vatAmount = 0;
  }

  const now = new Date();
  return {
    type: params.type,
    amount: params.amount,
    netAmount,
    vatRate,
    vatAmount,
    vatCategory,
    category: params.category,
    note: params.note,
    timestamp: now,
    syncedToMeza: false,
    tenantId: params.tenantId,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}
