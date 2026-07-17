/**
 * Notification service — the ONE place that knows how Xefe queues email.
 *
 * Emails are Firestore docs in the `mail` collection (Trigger-Email
 * compatible shape) delivered by functions/src/email.ts via Resend from
 * noreply@xefe.tl. Conventions enforced here:
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
 * Firestore rules allow tenant managers/admins to create mail docs for their
 * tenant. Server-side senders (functions/src/billing.ts renewal reminders,
 * authEmails) write the same shape with the Admin SDK — keep them in sync.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';

export type EmailPurpose =
  | 'notification'
  | 'invoice'
  | 'invoice-reminder'
  | 'billing-invoice-request'
  | 'leave-decision'
  | 'announcement'
  // Open for new flows — prefer adding a literal here so purposes stay greppable
  | (string & {});

export interface EmailAttachment {
  filename: string;
  /** Download URL — the sender fetches it (preferred for Storage files). */
  url?: string;
  /** Base64 content — for small, generated-in-memory files. */
  content?: string;
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
  attachments?: EmailAttachment[];
  purpose: EmailPurpose;
  relatedId?: string;
  createdBy?: string;
  /**
   * Default true when there are multiple recipients: one mail doc per
   * address (privacy). Set false to send a single doc with a shared "to".
   */
  perRecipient?: boolean;
}

// Firestore batches cap at 500 ops; stay under with headroom.
const BATCH_SIZE = 400;

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return [...new Set(list.map((e) => e?.trim()).filter((e): e is string => Boolean(e)))];
}

export const notificationService = {
  /**
   * Queue email(s). Returns how many mail docs were written (0 when no valid
   * recipients). Throws on Firestore write failure — callers decide whether
   * the surrounding action should survive that (it usually should).
   */
  async queueEmail(input: QueueEmailInput): Promise<number> {
    const recipients = normalizeRecipients(input.to);
    if (recipients.length === 0) return 0;
    if (!input.text && !input.html) {
      throw new Error('queueEmail requires text or html');
    }

    const base: Record<string, unknown> = {
      tenantId: input.tenantId,
      subject: input.subject,
      status: 'pending',
      purpose: input.purpose,
      createdAt: serverTimestamp(),
      ...(input.text ? { text: input.text } : {}),
      ...(input.html ? { html: input.html } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      ...(input.relatedId ? { relatedId: input.relatedId } : {}),
      ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    };

    const perRecipient = input.perRecipient ?? recipients.length > 1;
    if (!perRecipient || recipients.length === 1) {
      await addDoc(collection(db, 'mail'), { ...base, to: recipients });
      return recipients.length;
    }

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      for (const email of recipients.slice(i, i + BATCH_SIZE)) {
        batch.set(doc(collection(db, 'mail')), { ...base, to: [email] });
      }
      await batch.commit();
    }
    return recipients.length;
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
