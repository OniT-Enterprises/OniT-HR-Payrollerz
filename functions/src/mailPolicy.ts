/**
 * Pure validation for mail requested by browser clients.
 *
 * Recipient authorization is deliberately handled in email.ts, where it can
 * be checked against authoritative Firestore records. Keeping the structural
 * checks here makes the boundary independently unit-testable.
 */

export const CLIENT_MAIL_PURPOSES = [
  "notification",
  "invoice",
  "invoice-reminder",
  "receipt",
  "payslip",
  "billing-invoice-request",
  "leave-decision",
  "announcement",
  "interview-invitation",
  "interview-reminder",
  "interview-reschedule",
  "interview-decision",
  "application-outcome",
  "review-submitted",
  "review-completed",
] as const;

export type ClientMailPurpose = (typeof CLIENT_MAIL_PURPOSES)[number];

/**
 * Mirrors notificationService.bilingualFooter — staff-facing mail always says
 * who sent it and where else to read it, in English and Tetun.
 */
export const BILINGUAL_FOOTER =
  "(Sent via Xefe — also in your Ekipa app / Haruka liuhusi Xefe — haree mós iha Ekipa)";

export interface AnnouncementEmailContent {
  subject: string;
  text: string;
}

/**
 * Compose a staff announcement email from the announcement record itself.
 *
 * The browser no longer supplies the body, so the signature and bilingual
 * footer it used to append have to be rebuilt here — a staff member receiving
 * this must still see which employer sent it and that it is also in Ekipa.
 * Returns null when the record is not fit to email.
 */
export function announcementEmailContent(
  record: Record<string, unknown>,
  companyName?: string,
): AnnouncementEmailContent | null {
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const body = typeof record.body === "string" ? record.body.trim() : "";
  if (!title || title.length > 220 || !body || body.length > 50_000) return null;

  const company =
    typeof companyName === "string" ? companyName.trim().slice(0, 80) : "";
  const sender =
    typeof record.createdByName === "string"
      ? record.createdByName.trim().slice(0, 120)
      : "";
  const signature = [sender, company].filter(Boolean).join(", ");

  return {
    subject: company ? `📢 ${company}: ${title}` : `📢 ${title}`,
    text: [
      body,
      "",
      ...(signature ? [`— ${signature}`] : []),
      BILINGUAL_FOOTER,
    ].join("\n"),
  };
}

/** One outbox marker/content snapshot plus these queue writes fits one transaction. */
export const MAX_ANNOUNCEMENT_RECIPIENTS = 499;

export type ClientMailTenantRole =
  | "owner"
  | "hr-admin"
  | "accountant"
  | "manager"
  | "viewer";

export interface ClientMailAttachment {
  filename: string;
  url?: string;
  contentType?: string;
}

export interface ValidatedClientMailInput {
  tenantId: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: ClientMailAttachment[];
  purpose: ClientMailPurpose;
  relatedId?: string;
  deliveryAttemptId?: string;
  perRecipient?: boolean;
}

const PURPOSE_SET = new Set<string>(CLIENT_MAIL_PURPOSES);
const HTML_PURPOSES = new Set<ClientMailPurpose>([
  "notification",
  "invoice",
  "invoice-reminder",
  "receipt",
  "payslip",
]);
const ATTACHMENT_PURPOSES = new Set<ClientMailPurpose>(["invoice", "payslip"]);
const RELATED_ID_PURPOSES = new Set<ClientMailPurpose>([
  "notification",
  "invoice",
  "invoice-reminder",
  "receipt",
  "payslip",
  "leave-decision",
  "announcement",
  "interview-invitation",
  "interview-reminder",
  "interview-reschedule",
  "interview-decision",
  "application-outcome",
  "review-submitted",
  "review-completed",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Mail request must be an object");
  }
  return value as Record<string, unknown>;
}

function boundedString(
  value: unknown,
  field: string,
  maximum: number,
  required = false,
): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const result = value.trim();
  if (required && !result) throw new Error(`${field} is required`);
  if (result.length > maximum) throw new Error(`${field} is too long`);
  return result || undefined;
}

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

/** Parse only the object path from a URL in the configured Firebase bucket. */
export function firebaseStorageObjectPath(
  url: string,
  expectedBucket: string,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  let bucket: string;
  let encodedObject: string;
  if (parsed.hostname === "firebasestorage.googleapis.com") {
    const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) return null;
    bucket = decodeURIComponent(match[1]);
    encodedObject = match[2];
  } else if (parsed.hostname === "storage.googleapis.com") {
    const match = parsed.pathname.match(/^\/([^/]+)\/(.+)$/);
    if (!match) return null;
    bucket = decodeURIComponent(match[1]);
    encodedObject = match[2];
  } else if (
    parsed.hostname === expectedBucket &&
    expectedBucket.endsWith(".firebasestorage.app")
  ) {
    bucket = expectedBucket;
    encodedObject = parsed.pathname.replace(/^\//, "");
  } else {
    return null;
  }
  if (bucket !== expectedBucket || !encodedObject) return null;
  try {
    return decodeURIComponent(encodedObject);
  } catch {
    return null;
  }
}

export function normalizeEmailRecipients(
  value: unknown,
  maximum = 50,
): string[] {
  const raw = Array.isArray(value) ? value : [value];
  if (raw.length > maximum) throw new Error("Too many recipients");
  const recipients = [
    ...new Set(
      raw.map((item) => {
        if (typeof item !== "string")
          throw new Error("Recipient must be an email address");
        const email = normalizeEmailAddress(item);
        if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
          throw new Error("Invalid recipient email address");
        }
        return email;
      }),
    ),
  ];
  if (recipients.length === 0)
    throw new Error("At least one recipient is required");
  return recipients;
}

function parseAttachments(
  value: unknown,
  purpose: ClientMailPurpose,
): ClientMailAttachment[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!ATTACHMENT_PURPOSES.has(purpose)) {
    throw new Error(`Attachments are not allowed for ${purpose}`);
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > 3) {
    throw new Error("Attachments must contain between one and three files");
  }

  return value.map((raw) => {
    const attachment = objectValue(raw);
    const filename = boundedString(
      attachment.filename,
      "attachment.filename",
      180,
      true,
    )!;
    const url = boundedString(attachment.url, "attachment.url", 2048);
    const contentType = boundedString(
      attachment.contentType,
      "attachment.contentType",
      100,
    );
    if (!url || attachment.content !== undefined) {
      throw new Error("Client attachments require a Firebase Storage URL");
    }
    if (url) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error("Attachment URL is invalid");
      }
      const firebaseAppStorage = parsed.hostname.endsWith(
        ".firebasestorage.app",
      );
      if (
        parsed.protocol !== "https:" ||
        (!STORAGE_HOSTS.has(parsed.hostname) && !firebaseAppStorage)
      ) {
        throw new Error("Attachment URL must use Xefe's Firebase Storage");
      }
    }
    if (
      !filename.toLowerCase().endsWith(".pdf") ||
      contentType !== "application/pdf"
    ) {
      throw new Error("Client attachments must be PDF files");
    }
    return {
      filename,
      url,
      ...(contentType ? { contentType } : {}),
    };
  });
}

export function validateClientMailInput(
  value: unknown,
): ValidatedClientMailInput {
  const input = objectValue(value);
  const tenantId = boundedString(input.tenantId, "tenantId", 128, true)!;
  if (!/^[A-Za-z0-9_-]+$/.test(tenantId))
    throw new Error("tenantId is invalid");
  const purposeValue = boundedString(input.purpose, "purpose", 64, true)!;
  if (!PURPOSE_SET.has(purposeValue))
    throw new Error("Unsupported mail purpose");
  const purpose = purposeValue as ClientMailPurpose;
  const subject = boundedString(input.subject, "subject", 240, true)!;
  const text = boundedString(input.text, "text", 50_000);
  const html = boundedString(input.html, "html", 100_000);
  if (!text && !html) throw new Error("Mail requires text or html");
  if (html && !HTML_PURPOSES.has(purpose)) {
    throw new Error(`HTML is not allowed for ${purpose}`);
  }
  const replyTo = boundedString(input.replyTo, "replyTo", 254);
  if (replyTo && !EMAIL_PATTERN.test(replyTo))
    throw new Error("Invalid replyTo email address");
  const relatedId = boundedString(input.relatedId, "relatedId", 256);
  if (relatedId && !/^[A-Za-z0-9_-]+$/.test(relatedId)) {
    throw new Error("relatedId is invalid");
  }
  if (RELATED_ID_PURPOSES.has(purpose) && !relatedId) {
    throw new Error(`relatedId is required for ${purpose}`);
  }
  const deliveryAttemptId = boundedString(
    input.deliveryAttemptId,
    "deliveryAttemptId",
    256,
  );
  if (deliveryAttemptId && purpose !== "invoice") {
    throw new Error("deliveryAttemptId is only allowed for invoice mail");
  }
  if (
    input.perRecipient !== undefined &&
    typeof input.perRecipient !== "boolean"
  ) {
    throw new Error("perRecipient must be a boolean");
  }
  const attachments = parseAttachments(input.attachments, purpose);

  return {
    tenantId,
    to: normalizeEmailRecipients(
      input.to,
      purpose === "announcement" ? MAX_ANNOUNCEMENT_RECIPIENTS : 50,
    ),
    subject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    ...(replyTo ? { replyTo: normalizeEmailAddress(replyTo) } : {}),
    ...(attachments ? { attachments } : {}),
    purpose,
    ...(relatedId ? { relatedId } : {}),
    ...(deliveryAttemptId ? { deliveryAttemptId } : {}),
    ...(input.perRecipient !== undefined
      ? { perRecipient: input.perRecipient }
      : {}),
  };
}

export function sameRecipients(actual: string[], permitted: string[]): boolean {
  const left = [...new Set(actual.map(normalizeEmailAddress))].sort();
  const right = [...new Set(permitted.map(normalizeEmailAddress))].sort();
  return (
    left.length === right.length &&
    left.every((email, index) => email === right[index])
  );
}

export function recipientsAreSubset(
  actual: string[],
  permitted: string[],
): boolean {
  const permittedSet = new Set(permitted.map(normalizeEmailAddress));
  return actual.every((email) =>
    permittedSet.has(normalizeEmailAddress(email)),
  );
}

/** Mirrors the Firestore capability needed to reach each linked record. */
export function memberCanRequestClientMail(
  purpose: Exclude<ClientMailPurpose, "notification">,
  role: string | undefined,
  modules: unknown,
): boolean {
  const moduleList = Array.isArray(modules)
    ? modules.filter((module): module is string => typeof module === "string")
    : [];
  if (["invoice", "invoice-reminder", "receipt", "payslip"].includes(purpose)) {
    return role === "owner" || role === "hr-admin" || role === "accountant";
  }
  if (purpose === "billing-invoice-request") {
    return role === "owner" || role === "hr-admin";
  }
  if (purpose === "leave-decision") {
    return role === "owner" || role === "hr-admin" || role === "manager";
  }
  if (
    purpose === "announcement" ||
    purpose === "review-submitted" ||
    purpose === "review-completed"
  ) {
    return role === "owner" || role === "hr-admin";
  }
  // Hiring records use canAccessHiringRecords in Firestore: owners/HR admins
  // have every module; any other role needs an explicit hiring grant.
  return role === "owner" || role === "hr-admin" || moduleList.includes("hiring");
}

/** Managers may notify only employees in the department they manage. */
export function memberCanNotifyDepartment(
  role: string | undefined,
  memberDepartmentId: unknown,
  recordDepartmentId: unknown,
): boolean {
  if (role !== "manager") return true;
  return (
    typeof memberDepartmentId === "string" &&
    memberDepartmentId.length > 0 &&
    memberDepartmentId === recordDepartmentId
  );
}
