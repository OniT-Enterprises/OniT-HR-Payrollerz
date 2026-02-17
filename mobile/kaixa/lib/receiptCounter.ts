/**
 * Receipt Counter — Sequential receipt numbering for VAT compliance.
 *
 * Uses Firestore document at tenants/{tid}/receiptCounters/{year}
 * with an atomic increment to generate sequential receipt numbers.
 *
 * Format: REC-{YYYY}-{seq} e.g. REC-2026-000042
 */
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { paths } from '@onit/shared';

/**
 * Get the next receipt number for a tenant, atomically incrementing the counter.
 * Uses Dili timezone for the year.
 */
export async function getNextReceiptNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const year = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dili' }).split('-')[0];

  const counterRef = doc(db, paths.receiptCounter(tenantId, year));

  // Try to read current value first
  const snap = await getDoc(counterRef);

  let nextSeq: number;
  if (snap.exists()) {
    const current = snap.data().seq as number;
    nextSeq = current + 1;
    // Use increment for atomic update
    await setDoc(counterRef, { seq: increment(1) }, { merge: true });
  } else {
    // First receipt of the year
    nextSeq = 1;
    await setDoc(counterRef, { seq: 1, year });
  }

  const padded = String(nextSeq).padStart(6, '0');
  return `REC-${year}-${padded}`;
}
