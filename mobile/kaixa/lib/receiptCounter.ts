/**
 * Receipt Counter — Sequential receipt numbering for VAT compliance.
 *
 * Uses Firestore document at tenants/{tid}/receiptCounters/{year}
 * with an atomic increment to generate sequential receipt numbers.
 *
 * Format: REC-{YYYY}-{seq} e.g. REC-2026-000042
 */
import { doc, runTransaction, Timestamp } from 'firebase/firestore';
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

  const nextSeq = await runTransaction(db, async (firestoreTx) => {
    const snap = await firestoreTx.get(counterRef);
    const sequence = snap.exists()
      ? ((snap.data().seq as number) || 0) + 1
      : 1;

    firestoreTx.set(
      counterRef,
      {
        seq: sequence,
        year,
        updatedAt: Timestamp.fromDate(now),
      },
      { merge: true }
    );
    return sequence;
  });

  const padded = String(nextSeq).padStart(6, '0');
  return `REC-${year}-${padded}`;
}
