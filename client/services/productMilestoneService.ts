import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';

export const PRODUCT_MILESTONES = [
  'signup_completed',
  'first_employee_created',
  'first_payroll_run_created',
  'first_invoice_created',
  'first_bill_created',
  'first_recurring_invoice_created',
] as const;

export type ProductMilestone = (typeof PRODUCT_MILESTONES)[number];

/**
 * Records one immutable, tenant-level product milestone. The document carries
 * no actor, entity, customer, employee, money, or device data. Tracking is
 * best-effort and must never make the business operation appear to fail.
 */
export async function recordProductMilestone(
  tenantId: string,
  milestone: ProductMilestone,
): Promise<void> {
  if (!tenantId) return;

  try {
    const milestoneRef = doc(db, paths.productMilestone(tenantId, milestone));
    // Queue the immutable write immediately. Reading first adds a network round
    // trip during which a route change or tab close can discard the milestone.
    // Firestore rules keep this create-only, so a repeated first action simply
    // loses the race below and remains harmless to the business operation.
    await setDoc(milestoneRef, {
      milestone,
      schemaVersion: 1,
      reachedAt: serverTimestamp(),
    });
  } catch (error) {
    // A concurrent first action can win the create-only rule. Either way the
    // milestone exists, and analytics must never interrupt the user's work.
    console.warn('Product milestone recording skipped:', error);
  }
}
