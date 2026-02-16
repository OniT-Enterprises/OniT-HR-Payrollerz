/**
 * Kaixa — Receipt Generator
 *
 * Generates a text-based receipt from a transaction.
 * Designed for WhatsApp sharing (most used app in TL).
 * Bluetooth thermal printer support (ESC/POS) is Phase D.
 */
import type { KaixaTransaction } from '../types/transaction';

export interface ReceiptData {
  transaction: KaixaTransaction;
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  vatRegNumber?: string;
  receiptNumber?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Venda',
  service: 'Servisu',
  payment_received: 'Pagamentu simu',
  other_income: 'Rendimentu seluk',
  stock: 'Estoke',
  rent: 'Alugel',
  supplies: 'Fornese',
  salary: 'Saláriu',
  transport: 'Transporte',
  food: 'Hahan',
  other_expense: 'Despeza seluk',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Dili',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dili',
  });
}

/**
 * Generate a plain-text receipt suitable for WhatsApp sharing.
 */
export function generateTextReceipt(data: ReceiptData): string {
  const { transaction: tx, businessName, businessPhone, businessAddress, vatRegNumber, receiptNumber } = data;

  const lines: string[] = [];
  const divider = '────────────────────';

  // Header
  if (businessName) {
    lines.push(`*${businessName}*`);
  }
  if (businessAddress) {
    lines.push(businessAddress);
  }
  if (businessPhone) {
    lines.push(`Tel: ${businessPhone}`);
  }
  if (vatRegNumber) {
    lines.push(`VAT: ${vatRegNumber}`);
  }

  lines.push(divider);

  // Receipt info
  if (receiptNumber) {
    lines.push(`No: ${receiptNumber}`);
  }
  lines.push(`Data: ${formatDate(tx.timestamp)}`);
  lines.push(`Oras: ${formatTime(tx.timestamp)}`);

  lines.push(divider);

  // Transaction details
  const typeLabel = tx.type === 'in' ? 'OSAN TAMA' : 'OSAN SAI';
  const categoryLabel = CATEGORY_LABELS[tx.category] || tx.category;

  lines.push(`Tipu: ${typeLabel}`);
  lines.push(`Kategoria: ${categoryLabel}`);

  if (tx.note) {
    lines.push(`Nota: ${tx.note}`);
  }

  lines.push(divider);

  // Amount
  if (tx.vatAmount > 0) {
    lines.push(`Subtotal: $${tx.netAmount.toFixed(2)}`);
    lines.push(`VAT ${tx.vatRate}%: $${tx.vatAmount.toFixed(2)}`);
    lines.push(`*TOTAL: $${tx.amount.toFixed(2)}*`);
  } else {
    lines.push(`*TOTAL: $${tx.amount.toFixed(2)}*`);
  }

  lines.push(divider);

  // Footer
  lines.push('Obrigadu barak!');
  lines.push('_Powered by Kaixa_');

  return lines.join('\n');
}

/**
 * Generate a WhatsApp share URL with the receipt text.
 */
export function getWhatsAppShareURL(receiptText: string, phone?: string): string {
  const encoded = encodeURIComponent(receiptText);
  if (phone) {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    return `whatsapp://send?phone=${cleanPhone}&text=${encoded}`;
  }
  return `whatsapp://send?text=${encoded}`;
}
