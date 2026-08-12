/**
 * Transactional email sender.
 *
 * Fires on new docs in the `mail` collection (the existing queue written by
 * adminService, invoiceService, etc.) and sends them via Resend, then writes
 * the delivery status back onto the doc.
 *
 * Mail doc shape (Trigger-Email compatible):
 *   { to: string | string[], subject, html?, text?, from?, replyTo?, status,
 *     fromName?, attachments?: [{ filename, url? | content?, contentType? }] }
 *
 * `fromName` renders as "{fromName} via Xefe <invoices@xefe.tl>" — the
 * address itself is fixed here so tenants can brand but never spoof.
 *
 * Secret (set with `firebase functions:secrets:set`):
 *   RESEND_API_KEY — Resend API key (re_...)
 */
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  announcementEmailContent,
  firebaseStorageObjectPath,
  MAX_ANNOUNCEMENT_RECIPIENTS,
  memberCanNotifyDepartment,
  memberCanRequestClientMail,
  normalizeEmailAddress,
  normalizeEmailRecipients,
  recipientsAreSubset,
  sameRecipients,
  BILINGUAL_FOOTER,
  validateClientMailInput,
  type ValidatedClientMailInput,
} from "./mailPolicy";
import {
  isSuperAdmin,
  requireAuth,
  requireSuperAdmin,
  requireTenantMember,
  type TenantMemberData,
} from "./authz";

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// xefe.tl is verified in Resend (account-level), so all queued mail sends from
// the branded Xefe address. Per-message `from` overrides still win when set.
const DEFAULT_FROM = "Xefe <noreply@xefe.tl>";
// Customer-facing business mail (invoices, reminders, receipts) sends as
// "{Business} via Xefe" from this address.
const BUSINESS_FROM_ADDRESS = "invoices@xefe.tl";
const BILLING_SUPPORT_EMAIL = "info@naroman.tl";

type MailDb = ReturnType<typeof getFirestore>;

interface RecipientResolution {
  recipients: string[];
  /** A subset is used only for superadmin-to-superadmin platform notices. */
  subset?: boolean;
  /** Staff announcements are always freshly expanded and privacy-fanned-out. */
  replaceSubmittedRecipients?: boolean;
  attachmentPath?: string;
  /** Server-derived content for record-backed broadcasts. */
  subject?: string;
  text?: string;
}

async function authorizeClientMail(
  input: ValidatedClientMailInput,
  uid: string,
  token: Record<string, unknown>,
): Promise<TenantMemberData | null> {
  if (input.purpose === "notification") {
    if (input.tenantId !== "platform") {
      throw new HttpsError(
        "invalid-argument",
        "Platform notification tenantId must be platform",
      );
    }
    await requireSuperAdmin(uid, token);
    return null;
  }
  if (input.tenantId === "platform") {
    throw new HttpsError(
      "invalid-argument",
      "Tenant mail requires a tenant id",
    );
  }

  if (await isSuperAdmin(uid, token)) return { role: "owner" };
  const member = await requireTenantMember(input.tenantId, uid);
  if (
    !memberCanRequestClientMail(
      input.purpose,
      typeof member.role === "string" ? member.role : undefined,
      member.modules,
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "Your tenant access does not allow this notification",
    );
  }
  return member;
}

function recordEmail(data: Record<string, unknown>, field: string): string[] {
  const value = data[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError(
      "failed-precondition",
      `The linked record has no ${field}`,
    );
  }
  return normalizeEmailRecipients(value);
}

function announcementContent(
  data: Record<string, unknown>,
  companyName?: string,
): {
  subject: string;
  text: string;
} {
  const content = announcementEmailContent(data, companyName);
  if (!content) {
    throw new HttpsError(
      "failed-precondition",
      "Announcement content is not valid for email",
    );
  }
  return content;
}

async function linkedRecord(
  db: MailDb,
  path: string,
  tenantId: string,
): Promise<Record<string, unknown>> {
  const snapshot = await db.doc(path).get();
  if (!snapshot.exists)
    throw new HttpsError("not-found", "Linked mail record not found");
  const data = snapshot.data() as Record<string, unknown>;
  if (data.tenantId !== tenantId) {
    throw new HttpsError(
      "permission-denied",
      "Linked record belongs to another tenant",
    );
  }
  return data;
}

async function employeeRecipients(
  db: MailDb,
  tenantId: string,
  employeeId: unknown,
): Promise<string[]> {
  if (typeof employeeId !== "string" || !employeeId) {
    throw new HttpsError(
      "failed-precondition",
      "Linked record has no employee",
    );
  }
  const employee = await db
    .doc(`tenants/${tenantId}/employees/${employeeId}`)
    .get();
  const email = employee.data()?.personalInfo?.email;
  if (typeof email !== "string" || !email.trim()) {
    throw new HttpsError(
      "failed-precondition",
      "Employee has no email address",
    );
  }
  return normalizeEmailRecipients(email);
}

async function resolveRecipients(
  db: MailDb,
  input: ValidatedClientMailInput,
  actor: TenantMemberData | null,
  companyName?: string,
): Promise<RecipientResolution> {
  const relatedId = input.relatedId || "";
  switch (input.purpose) {
    case "notification": {
      const admins = await db
        .collection("users")
        .where("isSuperAdmin", "==", true)
        .get();
      const adminRecipients = admins.docs.flatMap((snapshot) => {
        const email = snapshot.data().email;
        return typeof email === "string" && email.trim()
          ? [normalizeEmailAddress(email)]
          : [];
      });
      const approvalRequest = await db
        .doc(`superAdminRequests/${relatedId}`)
        .get();
      if (!approvalRequest.exists) {
        throw new HttpsError(
          "not-found",
          "Linked superadmin request not found",
        );
      }
      const requestData = approvalRequest.data() || {};
      const targetEmail = requestData.targetEmail;
      const awaitingTarget =
        requestData.type === "grant" &&
        requestData.status === "awaiting_user" &&
        typeof targetEmail === "string" &&
        targetEmail.trim();
      return {
        recipients: [
          ...new Set([
            ...adminRecipients,
            ...(awaitingTarget ? [normalizeEmailAddress(targetEmail)] : []),
          ]),
        ],
        subset: true,
      };
    }
    case "billing-invoice-request":
      return {
        recipients: [BILLING_SUPPORT_EMAIL],
        replaceSubmittedRecipients: true,
      };
    case "billing-access-granted": {
      // Composed entirely from the tenant record: the browser supplies neither
      // the address nor the wording, so this mail cannot announce free access
      // that was not actually granted, nor to someone who is not the tenant's
      // billing contact.
      const tenantDoc = await db.doc(`tenants/${input.tenantId}`).get();
      const data = (tenantDoc.data() || {}) as Record<string, unknown>;
      if (data.subscriptionComped !== true || data.stripeSubscriptionId) {
        throw new HttpsError(
          "failed-precondition",
          "This tenant does not have complimentary access",
        );
      }
      const paidUntil = data.subscriptionPaidUntil as
        | { toMillis?: () => number }
        | undefined;
      if (typeof paidUntil?.toMillis !== "function") {
        throw new HttpsError(
          "failed-precondition",
          "Complimentary access has no end date",
        );
      }
      const until = new Date(paidUntil.toMillis()).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Dili",
      });
      const name =
        typeof data.name === "string" && data.name.trim()
          ? data.name.trim()
          : input.tenantId;
      const contacts = [
        ...recordEmail(data, "billingEmail"),
        ...recordEmail(data, "ownerEmail"),
      ];
      if (contacts.length === 0) {
        throw new HttpsError(
          "failed-precondition",
          "No billing or owner email on file for this tenant",
        );
      }
      return {
        recipients: [contacts[0]],
        replaceSubmittedRecipients: true,
        subject: "Your Xefe account has full access — free of charge",
        text: [
          `Hi ${name},`,
          "",
          `Your Xefe account has full access until ${until}, at no charge.`,
          "",
          "That includes finalizing payroll runs — the one thing a paid",
          "subscription normally unlocks. Everything else in Xefe was already",
          "free and stays that way.",
          "",
          "There is nothing to pay and no invoice coming. We will be in touch",
          "before the date above.",
          "",
          "Sign in: https://app.xefe.tl",
          "",
          "— The Xefe team",
          "",
          BILINGUAL_FOOTER,
        ].join("\n"),
      };
    }
    case "announcement": {
      const employees = await db
        .collection(`tenants/${input.tenantId}/employees`)
        .where("status", "==", "active")
        .limit(MAX_ANNOUNCEMENT_RECIPIENTS + 1)
        .get();
      if (employees.size > MAX_ANNOUNCEMENT_RECIPIENTS) {
        throw new HttpsError(
          "resource-exhausted",
          `Announcement email is limited to ${MAX_ANNOUNCEMENT_RECIPIENTS} staff`,
        );
      }
      const recipients = employees.docs.flatMap((snapshot) => {
        const email = snapshot.data()?.personalInfo?.email;
        return typeof email === "string" && email.trim()
          ? [normalizeEmailAddress(email)]
          : [];
      });
      if (recipients.length === 0) {
        throw new HttpsError(
          "failed-precondition",
          "No active staff email addresses are available",
        );
      }
      const announcementRef = db.doc(
        `tenants/${input.tenantId}/announcements/${relatedId}`,
      );
      const announcementSnapshot = await announcementRef.get();
      if (!announcementSnapshot.exists) {
        throw new HttpsError("not-found", "Linked announcement not found");
      }
      const announcementData = announcementSnapshot.data() || {};
      if (announcementData.emailedAt || announcementData.emailQueuedAt) {
        throw new HttpsError(
          "already-exists",
          "Announcement email has already been queued",
        );
      }
      const announcement = announcementContent(announcementData, companyName);
      return {
        recipients: [...new Set(recipients)],
        replaceSubmittedRecipients: true,
        subject: announcement.subject,
        text: announcement.text,
      };
    }
    case "invoice":
    case "invoice-reminder":
    case "receipt": {
      const invoice = await db
        .doc(`tenants/${input.tenantId}/invoices/${relatedId}`)
        .get();
      if (!invoice.exists)
        throw new HttpsError("not-found", "Linked invoice not found");
      const invoiceStatus = invoice.data()?.status;
      if (
        input.purpose === "invoice" &&
        ["draft", "cancelled"].includes(invoiceStatus)
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Only an issued invoice can be emailed",
        );
      }
      if (
        input.purpose === "invoice-reminder" &&
        !["sent", "viewed", "partial", "overdue"].includes(invoiceStatus)
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Invoice is not eligible for a reminder",
        );
      }
      if (input.purpose === "receipt" && invoiceStatus !== "paid") {
        throw new HttpsError(
          "failed-precondition",
          "Only a paid invoice can send a receipt",
        );
      }
      if (
        input.deliveryAttemptId &&
        invoice.data()?.deliveryAttemptId !== input.deliveryAttemptId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Invoice delivery attempt is stale",
        );
      }
      return {
        recipients: recordEmail(
          invoice.data() as Record<string, unknown>,
          "customerEmail",
        ),
        ...(input.purpose === "invoice"
          ? {
              attachmentPath: `tenants/${input.tenantId}/invoices/${relatedId}/`,
            }
          : {}),
      };
    }
    case "payslip": {
      const record = await linkedRecord(
        db,
        `payrollRecords/${relatedId}`,
        input.tenantId,
      );
      const runId = record.payrollRunId;
      if (typeof runId !== "string" || !runId) {
        throw new HttpsError(
          "failed-precondition",
          "Payroll record has no run",
        );
      }
      const run = await linkedRecord(
        db,
        `payrollRuns/${runId}`,
        input.tenantId,
      );
      if (run.status !== "approved" && run.status !== "paid") {
        throw new HttpsError(
          "failed-precondition",
          "Payroll run is not ready for payslips",
        );
      }
      return {
        recipients: await employeeRecipients(
          db,
          input.tenantId,
          record.employeeId,
        ),
        attachmentPath: `tenants/${input.tenantId}/payslips/${runId}/${String(record.employeeId)}_`,
      };
    }
    case "leave-decision": {
      const request = await linkedRecord(
        db,
        `leave_requests/${relatedId}`,
        input.tenantId,
      );
      if (request.status !== "approved" && request.status !== "rejected") {
        throw new HttpsError(
          "failed-precondition",
          "Leave request has no final decision",
        );
      }
      if (
        !memberCanNotifyDepartment(
          typeof actor?.role === "string" ? actor.role : undefined,
          actor?.departmentId,
          request.departmentId,
        )
      ) {
        throw new HttpsError(
          "permission-denied",
          "Managers can notify leave decisions only for their department",
        );
      }
      return {
        recipients: await employeeRecipients(
          db,
          input.tenantId,
          request.employeeId,
        ),
      };
    }
    case "review-submitted":
    case "review-completed": {
      const review = await linkedRecord(
        db,
        `reviews/${relatedId}`,
        input.tenantId,
      );
      const expectedStatus =
        input.purpose === "review-submitted" ? "submitted" : "completed";
      if (review.status !== expectedStatus) {
        throw new HttpsError(
          "failed-precondition",
          "Review is not in the required state",
        );
      }
      return {
        recipients: await employeeRecipients(
          db,
          input.tenantId,
          review.employeeId,
        ),
      };
    }
    case "interview-invitation":
    case "interview-reminder":
    case "interview-reschedule":
    case "interview-decision": {
      const interview = await linkedRecord(
        db,
        `interviews/${relatedId}`,
        input.tenantId,
      );
      if (
        input.purpose === "interview-reschedule" &&
        interview.status !== "rescheduled"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Interview is not rescheduled",
        );
      }
      if (
        input.purpose === "interview-decision" &&
        (interview.status !== "completed" ||
          (interview.decision !== "hire" && interview.decision !== "reject"))
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Interview has no final decision",
        );
      }
      if (
        (input.purpose === "interview-invitation" ||
          input.purpose === "interview-reminder") &&
        interview.status !== "scheduled" &&
        interview.status !== "rescheduled"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Interview is not scheduled",
        );
      }
      return { recipients: recordEmail(interview, "candidateEmail") };
    }
    case "application-outcome": {
      const application = await linkedRecord(
        db,
        `jobApplications/${relatedId}`,
        input.tenantId,
      );
      if (
        application.status !== "shortlisted" &&
        application.status !== "rejected"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Application has no notifiable outcome",
        );
      }
      return { recipients: recordEmail(application, "email") };
    }
  }
}

function assertAttachmentScope(
  input: ValidatedClientMailInput,
  path: string | undefined,
  storageBucket: string,
): void {
  if (!input.attachments?.length) return;
  if (!path)
    throw new HttpsError(
      "permission-denied",
      "Attachments are not allowed for this mail",
    );
  for (const attachment of input.attachments) {
    if (!attachment.url) continue;
    const objectPath = firebaseStorageObjectPath(attachment.url, storageBucket);
    if (!objectPath || !objectPath.startsWith(path)) {
      throw new HttpsError(
        "permission-denied",
        "Attachment does not belong to the linked record",
      );
    }
  }
}

async function allowedReplyToAddresses(
  db: MailDb,
  tenantId: string,
  actorEmail: unknown,
  tenant: Record<string, unknown>,
): Promise<Set<string>> {
  const [config, invoice] = await Promise.all([
    db.doc(`tenants/${tenantId}/settings/config`).get(),
    db.doc(`tenants/${tenantId}/settings/invoice_settings`).get(),
  ]);
  const companyEmail = config.data()?.companyDetails?.email;
  const candidates = [
    actorEmail,
    tenant.ownerEmail,
    tenant.billingEmail,
    companyEmail,
    invoice.data()?.companyEmail,
  ];
  return new Set(
    candidates.flatMap((value) =>
      typeof value === "string" && value.trim()
        ? [normalizeEmailAddress(value)]
        : [],
    ),
  );
}

/**
 * Queue the entire private announcement fan-out and its idempotency marker in
 * one Firestore transaction. A failed validation or queue write therefore
 * leaves no marker and no partial audience behind.
 */
async function enqueueAnnouncementAtomically(
  db: MailDb,
  tenantId: string,
  announcementId: string,
  recipients: string[],
  base: Record<string, unknown>,
  companyName?: string,
): Promise<void> {
  if (
    recipients.length === 0 ||
    recipients.length > MAX_ANNOUNCEMENT_RECIPIENTS
  ) {
    throw new HttpsError(
      "resource-exhausted",
      `Announcement email is limited to ${MAX_ANNOUNCEMENT_RECIPIENTS} staff`,
    );
  }
  const announcementRef = db.doc(
    `tenants/${tenantId}/announcements/${announcementId}`,
  );
  const outboxRef = db.doc(
    `tenants/${tenantId}/announcementMailOutboxes/${announcementId}`,
  );
  await db.runTransaction(async (transaction) => {
    const announcementSnapshot = await transaction.get(announcementRef);
    const outboxSnapshot = await transaction.get(outboxRef);
    if (!announcementSnapshot.exists) {
      throw new HttpsError("not-found", "Linked announcement not found");
    }
    const announcementData = announcementSnapshot.data() || {};
    if (
      announcementData.emailedAt ||
      announcementData.emailQueuedAt ||
      outboxSnapshot.exists
    ) {
      throw new HttpsError(
        "already-exists",
        "Announcement email has already been queued",
      );
    }
    const content = announcementContent(announcementData, companyName);
    const queueBase = { ...base };
    delete queueBase.subject;
    delete queueBase.text;
    delete queueBase.html;
    for (const email of recipients) {
      transaction.set(db.collection("mail").doc(), {
        ...queueBase,
        to: [email],
      });
    }
    // This server-only document is both the immutable content snapshot and the
    // idempotency marker. Keeping the body once avoids Firestore's 10 MiB
    // transaction limit while all audience queue docs still commit atomically.
    transaction.set(outboxRef, {
      tenantId,
      announcementId,
      subject: content.subject,
      text: content.text,
      queuedCount: recipients.length,
      createdBy: base.createdBy,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Browser mail boundary. Clients can request only a named product
 * notification; authorization, recipients, actor metadata and branding are
 * all resolved server-side before the Admin SDK writes the queue document.
 */
export const queueTenantEmail = onCall(async (request) => {
  const auth = requireAuth(request);
  let input: ValidatedClientMailInput;
  try {
    input = validateClientMailInput(request.data);
  } catch (error) {
    throw new HttpsError(
      "invalid-argument",
      error instanceof Error ? error.message : "Invalid mail request",
    );
  }

  const actor = await authorizeClientMail(input, auth.uid, auth.token);
  const db = getFirestore();
  const tenantSnapshot =
    input.tenantId === "platform"
      ? null
      : await db.doc(`tenants/${input.tenantId}`).get();
  if (tenantSnapshot && !tenantSnapshot.exists) {
    throw new HttpsError("not-found", "Tenant not found");
  }
  const tenant = (tenantSnapshot?.data() || {}) as Record<string, unknown>;
  // Resolved before recipients because record-backed broadcasts compose their
  // own subject and footer from the employer's name.
  const fromNameCandidate =
    tenant.tradingName || tenant.name || tenant.legalName;
  const fromName =
    typeof fromNameCandidate === "string" && fromNameCandidate.trim()
      ? fromNameCandidate.trim().slice(0, 80)
      : undefined;
  const resolution = await resolveRecipients(db, input, actor, fromName);
  const recipients = resolution.replaceSubmittedRecipients
    ? resolution.recipients
    : input.to;
  if (resolution.recipients.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "No authorized recipients are available",
    );
  }
  const authorized = resolution.subset
    ? recipientsAreSubset(input.to, resolution.recipients)
    : resolution.replaceSubmittedRecipients ||
      sameRecipients(input.to, resolution.recipients);
  if (!authorized) {
    throw new HttpsError(
      "permission-denied",
      "Recipient does not match the linked record",
    );
  }
  assertAttachmentScope(
    input,
    resolution.attachmentPath,
    getStorage().bucket().name,
  );

  if (input.replyTo && input.tenantId !== "platform") {
    const allowedReplyTo = await allowedReplyToAddresses(
      db,
      input.tenantId,
      auth.token.email,
      tenant,
    );
    if (!allowedReplyTo.has(input.replyTo)) {
      throw new HttpsError(
        "permission-denied",
        "replyTo is not an authorized tenant address",
      );
    }
  }

  const effectiveText = resolution.text ?? input.text;
  const effectiveHtml = resolution.text ? undefined : input.html;
  const base = {
    tenantId: input.tenantId,
    subject: resolution.subject ?? input.subject,
    status: "pending",
    purpose: input.purpose,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: auth.uid,
    ...(effectiveText ? { text: effectiveText } : {}),
    ...(effectiveHtml ? { html: effectiveHtml } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(fromName ? { fromName } : {}),
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    ...(input.relatedId ? { relatedId: input.relatedId } : {}),
    ...(input.deliveryAttemptId
      ? { deliveryAttemptId: input.deliveryAttemptId }
      : {}),
  };
  if (input.purpose === "announcement") {
    await enqueueAnnouncementAtomically(
      db,
      input.tenantId,
      input.relatedId!,
      recipients,
      base,
      fromName,
    );
    return { queued: recipients.length };
  }
  const fanOut =
    input.perRecipient ?? recipients.length > 1;
  if (!fanOut || recipients.length === 1) {
    await db.collection("mail").add({ ...base, to: recipients });
    return { queued: recipients.length };
  }

  for (let index = 0; index < recipients.length; index += 400) {
    const batch = db.batch();
    for (const email of recipients.slice(index, index + 400)) {
      batch.set(db.collection("mail").doc(), { ...base, to: [email] });
    }
    await batch.commit();
  }
  return { queued: recipients.length };
});

/** "Lele Café" -> "Lele Café via Xefe <invoices@xefe.tl>" (header-safe). */
function businessFrom(fromName: unknown): string | null {
  if (typeof fromName !== "string") return null;
  const name = fromName.replace(/[<>"\r\n]/g, "").trim().slice(0, 80);
  if (!name) return null;
  return `${name} via Xefe <${BUSINESS_FROM_ADDRESS}>`;
}

export const sendQueuedEmail = onDocumentCreated(
  { document: "mail/{mailId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as Record<string, unknown>;

    // Only process freshly-queued docs; ignore anything already handled.
    if (data.status && data.status !== "pending") return;

    const to = Array.isArray(data.to)
      ? (data.to as string[]).filter(Boolean)
      : data.to
        ? [data.to as string]
        : [];
    if (to.length === 0) {
      await snap.ref.update({ status: "ERROR", error: "No recipient", attemptedAt: FieldValue.serverTimestamp() });
      return;
    }

    let subject =
      typeof data.subject === "string" && data.subject.trim()
        ? data.subject
        : "(no subject)";
    let html = typeof data.html === "string" ? data.html : undefined;
    let text = typeof data.text === "string" ? data.text : undefined;
    if (data.purpose === "announcement") {
      const tenantId = typeof data.tenantId === "string" ? data.tenantId : "";
      const announcementId =
        typeof data.relatedId === "string" ? data.relatedId : "";
      const outbox =
        tenantId && announcementId
          ? await getFirestore()
              .doc(
                `tenants/${tenantId}/announcementMailOutboxes/${announcementId}`,
              )
              .get()
          : null;
      const outboxData = outbox?.data();
      if (
        !outbox?.exists ||
        outboxData?.tenantId !== tenantId ||
        outboxData?.announcementId !== announcementId ||
        typeof outboxData?.subject !== "string" ||
        !outboxData.subject.trim() ||
        typeof outboxData?.text !== "string" ||
        !outboxData.text.trim()
      ) {
        await snap.ref.update({
          status: "ERROR",
          error: "Announcement outbox is missing or invalid",
          attemptedAt: FieldValue.serverTimestamp(),
        });
        return;
      }
      subject = outboxData.subject;
      text = outboxData.text;
      html = undefined;
    }
    if (!html && !text) {
      await snap.ref.update({ status: "ERROR", error: "No html or text body", attemptedAt: FieldValue.serverTimestamp() });
      return;
    }

    // The sender is ALWAYS derived server-side. A client-supplied `from` is
    // ignored: honoring it let any tenant manager send DKIM-signed mail from an
    // arbitrary @xefe.tl address (spoofing/phishing). Branding still works via
    // the sanitized fromName ("{Business} via Xefe <invoices@xefe.tl>").
    const payload: Record<string, unknown> = {
      from: businessFrom(data.fromName) || DEFAULT_FROM,
      to,
      subject,
    };
    if (html) payload.html = html;
    if (text) payload.text = text;
    if (typeof data.replyTo === "string") payload.reply_to = data.replyTo;
    // `cc` is intentionally not forwarded from the doc — no sanctioned caller
    // sets it, and honoring it added an unbounded extra recipient list.

    // Attachments: {filename, url|content} → Resend {filename, path|content}.
    // (Previously ignored — payslip PDFs never actually rode along.)
    if (Array.isArray(data.attachments)) {
      const attachments = (data.attachments as Array<Record<string, unknown>>)
        .map((a) => {
          if (typeof a?.filename !== "string") return null;
          if (typeof a.url === "string" && a.url) return { filename: a.filename, path: a.url };
          if (typeof a.content === "string" && a.content) return { filename: a.filename, content: a.content };
          return null;
        })
        .filter(Boolean);
      if (attachments.length > 0) payload.attachments = attachments;
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

      if (!res.ok) {
        console.error("Resend send failed:", res.status, body);
        await snap.ref.update({
          status: "ERROR",
          error: (body.message || `HTTP ${res.status}`).slice(0, 500),
          attemptedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      await snap.ref.update({
        status: "SENT",
        providerId: body.id ?? null,
        sentAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error("Resend send threw:", error);
      await snap.ref.update({
        status: "ERROR",
        error: (error as Error).message.slice(0, 500),
        attemptedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

/**
 * Mirror the provider result onto the invoice so the app distinguishes
 * "queued" from actually sent and exposes a useful retry when delivery fails.
 */
export const syncInvoiceDeliveryStatus = onDocumentUpdated(
  "mail/{mailId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || after.purpose !== "invoice") return;
    if (before.status === after.status) return;
    if (after.status !== "SENT" && after.status !== "ERROR") return;

    const tenantId =
      typeof after.tenantId === "string" ? after.tenantId : "";
    const invoiceId =
      typeof after.relatedId === "string" ? after.relatedId : "";
    const deliveryAttemptId =
      typeof after.deliveryAttemptId === "string"
        ? after.deliveryAttemptId
        : "";
    if (!tenantId || !invoiceId || !deliveryAttemptId) return;

    const update =
      after.status === "SENT"
        ? {
            deliveryStatus: "sent",
            deliveryError: FieldValue.delete(),
            emailSentAt: after.sentAt || FieldValue.serverTimestamp(),
            deliveryUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }
        : {
            deliveryStatus: "failed",
            deliveryError:
              typeof after.error === "string"
                ? after.error.slice(0, 500)
                : "Email delivery failed",
            deliveryUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          };

    const invoiceRef = getFirestore().doc(
      `tenants/${tenantId}/invoices/${invoiceId}`,
    );
    await getFirestore().runTransaction(async (transaction) => {
      const invoice = await transaction.get(invoiceRef);
      if (!invoice.exists) return;
      if (invoice.data()?.deliveryAttemptId !== deliveryAttemptId) return;
      transaction.update(invoiceRef, update);
    });
  },
);
