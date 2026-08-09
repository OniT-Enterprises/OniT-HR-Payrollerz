/**
 * Notification service — the ONE place that knows how Xefe queues email.
 *
 * Browser callers request a named product notification through the
 * queueTenantEmail callable. The callable authorizes the purpose, resolves
 * recipients from linked tenant records, and writes the `mail` queue through
 * the Admin SDK; browsers cannot write that queue directly.
 *
 *  - **Per-recipient fan-out** (default when multiple recipients): one doc
 *    per address so staff never see each other's emails — the sender has no
 *    BCC support. Pass `perRecipient: false` only when recipients already
 *    know each other (e.g. one customer's contacts) or for internal admin
 *    notifications.
 *  - **Purpose tags** on every doc for auditing/filtering.
 *  - **Bilingual footer** helper (EN + Tetun) — staff-facing mail should use
 *    it; customer-facing mail (invoices) keeps its own voice.
 *  - Recipients are trimmed, de-duplicated, and empties dropped. Zero valid
 *    recipients returns 0 without writing or throwing.
 *
 * Server-side senders (functions/src/billing.ts renewal reminders,
 * authEmails) may still write the same queue shape with the Admin SDK.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, getFunctionsLazy } from '@/lib/firebase';
import { paths } from '@/lib/paths';

export type EmailPurpose =
  | 'notification'
  | 'invoice'
  | 'invoice-reminder'
  | 'receipt'
  | 'payslip'
  | 'billing-invoice-request'
  | 'leave-decision'
  | 'announcement'
  | 'interview-invitation'
  | 'interview-reminder'
  | 'interview-reschedule'
  | 'interview-decision'
  | 'application-outcome'
  | 'review-submitted'
  | 'review-completed';

export interface EmailAttachment {
  filename: string;
  /** Download URL — the sender fetches it (preferred for Storage files). */
  url?: string;
  contentType?: string;
}

export interface QueueEmailInput {
  /** Tenant id, or "platform" for cross-tenant admin notifications. */
  tenantId: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  /**
   * Legacy caller hint. The callable ignores it and derives tenant branding.
   */
  fromName?: string;
  attachments?: EmailAttachment[];
  purpose: EmailPurpose;
  relatedId?: string;
  /** Legacy caller hint. The callable always binds createdBy to auth.uid. */
  createdBy?: string;
  /** Correlates provider status back to the latest invoice delivery attempt. */
  deliveryAttemptId?: string;
  /**
   * Default true when there are multiple recipients: one mail doc per
   * address (privacy). Set false to send a single doc with a shared "to".
   */
  perRecipient?: boolean;
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return [...new Set(list.map((e) => e?.trim()).filter((e): e is string => Boolean(e)))];
}

export const notificationService = {
  /**
   * Queue email(s). Returns how many recipients were queued (0 when no valid
   * recipients). Throws on callable failure — callers decide whether
   * the surrounding action should survive that (it usually should).
   */
  async queueEmail(input: QueueEmailInput): Promise<number> {
    const recipients = normalizeRecipients(input.to);
    if (recipients.length === 0) return 0;
    if (!input.text && !input.html) {
      throw new Error('queueEmail requires text or html');
    }

    const payload: QueueEmailInput = {
      tenantId: input.tenantId,
      to: recipients,
      subject: input.subject,
      purpose: input.purpose,
      ...(input.text ? { text: input.text } : {}),
      ...(input.html ? { html: input.html } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      ...(input.relatedId ? { relatedId: input.relatedId } : {}),
      ...(input.deliveryAttemptId
        ? { deliveryAttemptId: input.deliveryAttemptId }
        : {}),
      ...(input.perRecipient !== undefined
        ? { perRecipient: input.perRecipient }
        : {}),
    };

    const [{ httpsCallable }, functions] = await Promise.all([
      import('firebase/functions'),
      getFunctionsLazy(),
    ]);
    const callable = httpsCallable<QueueEmailInput, { queued: number }>(
      functions,
      'queueTenantEmail',
    );
    const result = await callable(payload);
    return result.data.queued;
  },

  /** The employee's email address on file, or null. */
  async getEmployeeEmail(tenantId: string, employeeId: string): Promise<string | null> {
    const snap = await getDoc(doc(db, `${paths.employees(tenantId)}/${employeeId}`));
    const email = (snap.data()?.personalInfo?.email as string | undefined)?.trim();
    return email || null;
  },

  /** Unique emails of all ACTIVE employees (the "all staff" audience). */
  async getActiveStaffEmails(tenantId: string): Promise<string[]> {
    const snap = await getDocs(
      query(collection(db, paths.employees(tenantId)), where('status', '==', 'active')),
    );
    return normalizeRecipients(
      snap.docs.map((d) => (d.data()?.personalInfo?.email as string | undefined) ?? ''),
    );
  },

  /**
   * Standard staff-facing footer, EN + Tetun. Keep every staff email ending
   * with this so the voice stays consistent.
   */
  bilingualFooter(opts?: { senderName?: string; companyName?: string }): string {
    const signature =
      opts?.senderName || opts?.companyName
        ? `— ${[opts?.senderName, opts?.companyName].filter(Boolean).join(', ')}\n`
        : '';
    return `${signature}(Sent via Xefe — also in your Ekipa app / Haruka liuhusi Xefe — haree mós iha Ekipa)`;
  },
};
