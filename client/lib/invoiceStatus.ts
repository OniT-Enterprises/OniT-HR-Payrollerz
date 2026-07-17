import { getTodayTL } from "@/lib/dateUtils";
import type { Invoice, InvoiceStatus } from "@/types/money";

const OVERDUE_ELIGIBLE_STATUSES: InvoiceStatus[] = [
  "sent",
  "viewed",
  "partial",
  "overdue",
];

/**
 * Derive the status users should see even before the periodic Firestore status
 * updater runs. Keeping this in one place prevents list, detail, and timeline
 * views from disagreeing about a past-due invoice.
 */
export function getEffectiveInvoiceStatus(
  invoice: Pick<Invoice, "status" | "balanceDue" | "dueDate">,
  todayIso = getTodayTL(),
): InvoiceStatus {
  if (
    invoice.balanceDue > 0 &&
    invoice.dueDate < todayIso &&
    OVERDUE_ELIGIBLE_STATUSES.includes(invoice.status)
  ) {
    return "overdue";
  }

  return invoice.status;
}
