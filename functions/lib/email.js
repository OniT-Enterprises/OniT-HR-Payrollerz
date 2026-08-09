"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncInvoiceDeliveryStatus = exports.sendQueuedEmail = exports.queueTenantEmail = void 0;
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
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firestore_2 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const mailPolicy_1 = require("./mailPolicy");
const authz_1 = require("./authz");
const RESEND_API_KEY = (0, params_1.defineSecret)("RESEND_API_KEY");
// xefe.tl is verified in Resend (account-level), so all queued mail sends from
// the branded Xefe address. Per-message `from` overrides still win when set.
const DEFAULT_FROM = "Xefe <noreply@xefe.tl>";
// Customer-facing business mail (invoices, reminders, receipts) sends as
// "{Business} via Xefe" from this address.
const BUSINESS_FROM_ADDRESS = "invoices@xefe.tl";
const BILLING_SUPPORT_EMAIL = "info@naroman.tl";
async function authorizeClientMail(input, uid, token) {
    if (input.purpose === "notification") {
        if (input.tenantId !== "platform") {
            throw new https_1.HttpsError("invalid-argument", "Platform notification tenantId must be platform");
        }
        await (0, authz_1.requireSuperAdmin)(uid, token);
        return null;
    }
    if (input.tenantId === "platform") {
        throw new https_1.HttpsError("invalid-argument", "Tenant mail requires a tenant id");
    }
    if (await (0, authz_1.isSuperAdmin)(uid, token))
        return { role: "owner" };
    const member = await (0, authz_1.requireTenantMember)(input.tenantId, uid);
    if (!(0, mailPolicy_1.memberCanRequestClientMail)(input.purpose, typeof member.role === "string" ? member.role : undefined, member.modules)) {
        throw new https_1.HttpsError("permission-denied", "Your tenant access does not allow this notification");
    }
    return member;
}
function recordEmail(data, field) {
    const value = data[field];
    if (typeof value !== "string" || !value.trim()) {
        throw new https_1.HttpsError("failed-precondition", `The linked record has no ${field}`);
    }
    return (0, mailPolicy_1.normalizeEmailRecipients)(value);
}
function announcementContent(data, companyName) {
    const content = (0, mailPolicy_1.announcementEmailContent)(data, companyName);
    if (!content) {
        throw new https_1.HttpsError("failed-precondition", "Announcement content is not valid for email");
    }
    return content;
}
async function linkedRecord(db, path, tenantId) {
    const snapshot = await db.doc(path).get();
    if (!snapshot.exists)
        throw new https_1.HttpsError("not-found", "Linked mail record not found");
    const data = snapshot.data();
    if (data.tenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "Linked record belongs to another tenant");
    }
    return data;
}
async function employeeRecipients(db, tenantId, employeeId) {
    var _a, _b;
    if (typeof employeeId !== "string" || !employeeId) {
        throw new https_1.HttpsError("failed-precondition", "Linked record has no employee");
    }
    const employee = await db
        .doc(`tenants/${tenantId}/employees/${employeeId}`)
        .get();
    const email = (_b = (_a = employee.data()) === null || _a === void 0 ? void 0 : _a.personalInfo) === null || _b === void 0 ? void 0 : _b.email;
    if (typeof email !== "string" || !email.trim()) {
        throw new https_1.HttpsError("failed-precondition", "Employee has no email address");
    }
    return (0, mailPolicy_1.normalizeEmailRecipients)(email);
}
async function resolveRecipients(db, input, actor, companyName) {
    var _a, _b;
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
                    ? [(0, mailPolicy_1.normalizeEmailAddress)(email)]
                    : [];
            });
            const approvalRequest = await db
                .doc(`superAdminRequests/${relatedId}`)
                .get();
            if (!approvalRequest.exists) {
                throw new https_1.HttpsError("not-found", "Linked superadmin request not found");
            }
            const requestData = approvalRequest.data() || {};
            const targetEmail = requestData.targetEmail;
            const awaitingTarget = requestData.type === "grant" &&
                requestData.status === "awaiting_user" &&
                typeof targetEmail === "string" &&
                targetEmail.trim();
            return {
                recipients: [
                    ...new Set([
                        ...adminRecipients,
                        ...(awaitingTarget ? [(0, mailPolicy_1.normalizeEmailAddress)(targetEmail)] : []),
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
        case "announcement": {
            const employees = await db
                .collection(`tenants/${input.tenantId}/employees`)
                .where("status", "==", "active")
                .limit(mailPolicy_1.MAX_ANNOUNCEMENT_RECIPIENTS + 1)
                .get();
            if (employees.size > mailPolicy_1.MAX_ANNOUNCEMENT_RECIPIENTS) {
                throw new https_1.HttpsError("resource-exhausted", `Announcement email is limited to ${mailPolicy_1.MAX_ANNOUNCEMENT_RECIPIENTS} staff`);
            }
            const recipients = employees.docs.flatMap((snapshot) => {
                var _a, _b;
                const email = (_b = (_a = snapshot.data()) === null || _a === void 0 ? void 0 : _a.personalInfo) === null || _b === void 0 ? void 0 : _b.email;
                return typeof email === "string" && email.trim()
                    ? [(0, mailPolicy_1.normalizeEmailAddress)(email)]
                    : [];
            });
            if (recipients.length === 0) {
                throw new https_1.HttpsError("failed-precondition", "No active staff email addresses are available");
            }
            const announcementRef = db.doc(`tenants/${input.tenantId}/announcements/${relatedId}`);
            const announcementSnapshot = await announcementRef.get();
            if (!announcementSnapshot.exists) {
                throw new https_1.HttpsError("not-found", "Linked announcement not found");
            }
            const announcementData = announcementSnapshot.data() || {};
            if (announcementData.emailedAt || announcementData.emailQueuedAt) {
                throw new https_1.HttpsError("already-exists", "Announcement email has already been queued");
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
                throw new https_1.HttpsError("not-found", "Linked invoice not found");
            const invoiceStatus = (_a = invoice.data()) === null || _a === void 0 ? void 0 : _a.status;
            if (input.purpose === "invoice" &&
                ["draft", "cancelled"].includes(invoiceStatus)) {
                throw new https_1.HttpsError("failed-precondition", "Only an issued invoice can be emailed");
            }
            if (input.purpose === "invoice-reminder" &&
                !["sent", "viewed", "partial", "overdue"].includes(invoiceStatus)) {
                throw new https_1.HttpsError("failed-precondition", "Invoice is not eligible for a reminder");
            }
            if (input.purpose === "receipt" && invoiceStatus !== "paid") {
                throw new https_1.HttpsError("failed-precondition", "Only a paid invoice can send a receipt");
            }
            if (input.deliveryAttemptId &&
                ((_b = invoice.data()) === null || _b === void 0 ? void 0 : _b.deliveryAttemptId) !== input.deliveryAttemptId) {
                throw new https_1.HttpsError("failed-precondition", "Invoice delivery attempt is stale");
            }
            return Object.assign({ recipients: recordEmail(invoice.data(), "customerEmail") }, (input.purpose === "invoice"
                ? {
                    attachmentPath: `tenants/${input.tenantId}/invoices/${relatedId}/`,
                }
                : {}));
        }
        case "payslip": {
            const record = await linkedRecord(db, `payrollRecords/${relatedId}`, input.tenantId);
            const runId = record.payrollRunId;
            if (typeof runId !== "string" || !runId) {
                throw new https_1.HttpsError("failed-precondition", "Payroll record has no run");
            }
            const run = await linkedRecord(db, `payrollRuns/${runId}`, input.tenantId);
            if (run.status !== "approved" && run.status !== "paid") {
                throw new https_1.HttpsError("failed-precondition", "Payroll run is not ready for payslips");
            }
            return {
                recipients: await employeeRecipients(db, input.tenantId, record.employeeId),
                attachmentPath: `tenants/${input.tenantId}/payslips/${runId}/${String(record.employeeId)}_`,
            };
        }
        case "leave-decision": {
            const request = await linkedRecord(db, `leave_requests/${relatedId}`, input.tenantId);
            if (request.status !== "approved" && request.status !== "rejected") {
                throw new https_1.HttpsError("failed-precondition", "Leave request has no final decision");
            }
            if (!(0, mailPolicy_1.memberCanNotifyDepartment)(typeof (actor === null || actor === void 0 ? void 0 : actor.role) === "string" ? actor.role : undefined, actor === null || actor === void 0 ? void 0 : actor.departmentId, request.departmentId)) {
                throw new https_1.HttpsError("permission-denied", "Managers can notify leave decisions only for their department");
            }
            return {
                recipients: await employeeRecipients(db, input.tenantId, request.employeeId),
            };
        }
        case "review-submitted":
        case "review-completed": {
            const review = await linkedRecord(db, `reviews/${relatedId}`, input.tenantId);
            const expectedStatus = input.purpose === "review-submitted" ? "submitted" : "completed";
            if (review.status !== expectedStatus) {
                throw new https_1.HttpsError("failed-precondition", "Review is not in the required state");
            }
            return {
                recipients: await employeeRecipients(db, input.tenantId, review.employeeId),
            };
        }
        case "interview-invitation":
        case "interview-reminder":
        case "interview-reschedule":
        case "interview-decision": {
            const interview = await linkedRecord(db, `interviews/${relatedId}`, input.tenantId);
            if (input.purpose === "interview-reschedule" &&
                interview.status !== "rescheduled") {
                throw new https_1.HttpsError("failed-precondition", "Interview is not rescheduled");
            }
            if (input.purpose === "interview-decision" &&
                (interview.status !== "completed" ||
                    (interview.decision !== "hire" && interview.decision !== "reject"))) {
                throw new https_1.HttpsError("failed-precondition", "Interview has no final decision");
            }
            if ((input.purpose === "interview-invitation" ||
                input.purpose === "interview-reminder") &&
                interview.status !== "scheduled" &&
                interview.status !== "rescheduled") {
                throw new https_1.HttpsError("failed-precondition", "Interview is not scheduled");
            }
            return { recipients: recordEmail(interview, "candidateEmail") };
        }
        case "application-outcome": {
            const application = await linkedRecord(db, `jobApplications/${relatedId}`, input.tenantId);
            if (application.status !== "shortlisted" &&
                application.status !== "rejected") {
                throw new https_1.HttpsError("failed-precondition", "Application has no notifiable outcome");
            }
            return { recipients: recordEmail(application, "email") };
        }
    }
}
function assertAttachmentScope(input, path, storageBucket) {
    var _a;
    if (!((_a = input.attachments) === null || _a === void 0 ? void 0 : _a.length))
        return;
    if (!path)
        throw new https_1.HttpsError("permission-denied", "Attachments are not allowed for this mail");
    for (const attachment of input.attachments) {
        if (!attachment.url)
            continue;
        const objectPath = (0, mailPolicy_1.firebaseStorageObjectPath)(attachment.url, storageBucket);
        if (!objectPath || !objectPath.startsWith(path)) {
            throw new https_1.HttpsError("permission-denied", "Attachment does not belong to the linked record");
        }
    }
}
async function allowedReplyToAddresses(db, tenantId, actorEmail, tenant) {
    var _a, _b, _c;
    const [config, invoice] = await Promise.all([
        db.doc(`tenants/${tenantId}/settings/config`).get(),
        db.doc(`tenants/${tenantId}/settings/invoice_settings`).get(),
    ]);
    const companyEmail = (_b = (_a = config.data()) === null || _a === void 0 ? void 0 : _a.companyDetails) === null || _b === void 0 ? void 0 : _b.email;
    const candidates = [
        actorEmail,
        tenant.ownerEmail,
        tenant.billingEmail,
        companyEmail,
        (_c = invoice.data()) === null || _c === void 0 ? void 0 : _c.companyEmail,
    ];
    return new Set(candidates.flatMap((value) => typeof value === "string" && value.trim()
        ? [(0, mailPolicy_1.normalizeEmailAddress)(value)]
        : []));
}
/**
 * Queue the entire private announcement fan-out and its idempotency marker in
 * one Firestore transaction. A failed validation or queue write therefore
 * leaves no marker and no partial audience behind.
 */
async function enqueueAnnouncementAtomically(db, tenantId, announcementId, recipients, base, companyName) {
    if (recipients.length === 0 ||
        recipients.length > mailPolicy_1.MAX_ANNOUNCEMENT_RECIPIENTS) {
        throw new https_1.HttpsError("resource-exhausted", `Announcement email is limited to ${mailPolicy_1.MAX_ANNOUNCEMENT_RECIPIENTS} staff`);
    }
    const announcementRef = db.doc(`tenants/${tenantId}/announcements/${announcementId}`);
    const outboxRef = db.doc(`tenants/${tenantId}/announcementMailOutboxes/${announcementId}`);
    await db.runTransaction(async (transaction) => {
        const announcementSnapshot = await transaction.get(announcementRef);
        const outboxSnapshot = await transaction.get(outboxRef);
        if (!announcementSnapshot.exists) {
            throw new https_1.HttpsError("not-found", "Linked announcement not found");
        }
        const announcementData = announcementSnapshot.data() || {};
        if (announcementData.emailedAt ||
            announcementData.emailQueuedAt ||
            outboxSnapshot.exists) {
            throw new https_1.HttpsError("already-exists", "Announcement email has already been queued");
        }
        const content = announcementContent(announcementData, companyName);
        const queueBase = Object.assign({}, base);
        delete queueBase.subject;
        delete queueBase.text;
        delete queueBase.html;
        for (const email of recipients) {
            transaction.set(db.collection("mail").doc(), Object.assign(Object.assign({}, queueBase), { to: [email] }));
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
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        });
    });
}
/**
 * Browser mail boundary. Clients can request only a named product
 * notification; authorization, recipients, actor metadata and branding are
 * all resolved server-side before the Admin SDK writes the queue document.
 */
exports.queueTenantEmail = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d;
    const auth = (0, authz_1.requireAuth)(request);
    let input;
    try {
        input = (0, mailPolicy_1.validateClientMailInput)(request.data);
    }
    catch (error) {
        throw new https_1.HttpsError("invalid-argument", error instanceof Error ? error.message : "Invalid mail request");
    }
    const actor = await authorizeClientMail(input, auth.uid, auth.token);
    const db = (0, firestore_2.getFirestore)();
    const tenantSnapshot = input.tenantId === "platform"
        ? null
        : await db.doc(`tenants/${input.tenantId}`).get();
    if (tenantSnapshot && !tenantSnapshot.exists) {
        throw new https_1.HttpsError("not-found", "Tenant not found");
    }
    const tenant = ((tenantSnapshot === null || tenantSnapshot === void 0 ? void 0 : tenantSnapshot.data()) || {});
    // Resolved before recipients because record-backed broadcasts compose their
    // own subject and footer from the employer's name.
    const fromNameCandidate = tenant.tradingName || tenant.name || tenant.legalName;
    const fromName = typeof fromNameCandidate === "string" && fromNameCandidate.trim()
        ? fromNameCandidate.trim().slice(0, 80)
        : undefined;
    const resolution = await resolveRecipients(db, input, actor, fromName);
    const recipients = resolution.replaceSubmittedRecipients
        ? resolution.recipients
        : input.to;
    if (resolution.recipients.length === 0) {
        throw new https_1.HttpsError("failed-precondition", "No authorized recipients are available");
    }
    const authorized = resolution.subset
        ? (0, mailPolicy_1.recipientsAreSubset)(input.to, resolution.recipients)
        : resolution.replaceSubmittedRecipients ||
            (0, mailPolicy_1.sameRecipients)(input.to, resolution.recipients);
    if (!authorized) {
        throw new https_1.HttpsError("permission-denied", "Recipient does not match the linked record");
    }
    assertAttachmentScope(input, resolution.attachmentPath, (0, storage_1.getStorage)().bucket().name);
    if (input.replyTo && input.tenantId !== "platform") {
        const allowedReplyTo = await allowedReplyToAddresses(db, input.tenantId, auth.token.email, tenant);
        if (!allowedReplyTo.has(input.replyTo)) {
            throw new https_1.HttpsError("permission-denied", "replyTo is not an authorized tenant address");
        }
    }
    const effectiveText = (_a = resolution.text) !== null && _a !== void 0 ? _a : input.text;
    const effectiveHtml = resolution.text ? undefined : input.html;
    const base = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ tenantId: input.tenantId, subject: (_b = resolution.subject) !== null && _b !== void 0 ? _b : input.subject, status: "pending", purpose: input.purpose, createdAt: firestore_2.FieldValue.serverTimestamp(), createdBy: auth.uid }, (effectiveText ? { text: effectiveText } : {})), (effectiveHtml ? { html: effectiveHtml } : {})), (input.replyTo ? { replyTo: input.replyTo } : {})), (fromName ? { fromName } : {})), (((_c = input.attachments) === null || _c === void 0 ? void 0 : _c.length) ? { attachments: input.attachments } : {})), (input.relatedId ? { relatedId: input.relatedId } : {})), (input.deliveryAttemptId
        ? { deliveryAttemptId: input.deliveryAttemptId }
        : {}));
    if (input.purpose === "announcement") {
        await enqueueAnnouncementAtomically(db, input.tenantId, input.relatedId, recipients, base, fromName);
        return { queued: recipients.length };
    }
    const fanOut = (_d = input.perRecipient) !== null && _d !== void 0 ? _d : recipients.length > 1;
    if (!fanOut || recipients.length === 1) {
        await db.collection("mail").add(Object.assign(Object.assign({}, base), { to: recipients }));
        return { queued: recipients.length };
    }
    for (let index = 0; index < recipients.length; index += 400) {
        const batch = db.batch();
        for (const email of recipients.slice(index, index + 400)) {
            batch.set(db.collection("mail").doc(), Object.assign(Object.assign({}, base), { to: [email] }));
        }
        await batch.commit();
    }
    return { queued: recipients.length };
});
/** "Lele Café" -> "Lele Café via Xefe <invoices@xefe.tl>" (header-safe). */
function businessFrom(fromName) {
    if (typeof fromName !== "string")
        return null;
    const name = fromName.replace(/[<>"\r\n]/g, "").trim().slice(0, 80);
    if (!name)
        return null;
    return `${name} via Xefe <${BUSINESS_FROM_ADDRESS}>`;
}
exports.sendQueuedEmail = (0, firestore_1.onDocumentCreated)({ document: "mail/{mailId}", secrets: [RESEND_API_KEY] }, async (event) => {
    var _a;
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    // Only process freshly-queued docs; ignore anything already handled.
    if (data.status && data.status !== "pending")
        return;
    const to = Array.isArray(data.to)
        ? data.to.filter(Boolean)
        : data.to
            ? [data.to]
            : [];
    if (to.length === 0) {
        await snap.ref.update({ status: "ERROR", error: "No recipient", attemptedAt: firestore_2.FieldValue.serverTimestamp() });
        return;
    }
    let subject = typeof data.subject === "string" && data.subject.trim()
        ? data.subject
        : "(no subject)";
    let html = typeof data.html === "string" ? data.html : undefined;
    let text = typeof data.text === "string" ? data.text : undefined;
    if (data.purpose === "announcement") {
        const tenantId = typeof data.tenantId === "string" ? data.tenantId : "";
        const announcementId = typeof data.relatedId === "string" ? data.relatedId : "";
        const outbox = tenantId && announcementId
            ? await (0, firestore_2.getFirestore)()
                .doc(`tenants/${tenantId}/announcementMailOutboxes/${announcementId}`)
                .get()
            : null;
        const outboxData = outbox === null || outbox === void 0 ? void 0 : outbox.data();
        if (!(outbox === null || outbox === void 0 ? void 0 : outbox.exists) ||
            (outboxData === null || outboxData === void 0 ? void 0 : outboxData.tenantId) !== tenantId ||
            (outboxData === null || outboxData === void 0 ? void 0 : outboxData.announcementId) !== announcementId ||
            typeof (outboxData === null || outboxData === void 0 ? void 0 : outboxData.subject) !== "string" ||
            !outboxData.subject.trim() ||
            typeof (outboxData === null || outboxData === void 0 ? void 0 : outboxData.text) !== "string" ||
            !outboxData.text.trim()) {
            await snap.ref.update({
                status: "ERROR",
                error: "Announcement outbox is missing or invalid",
                attemptedAt: firestore_2.FieldValue.serverTimestamp(),
            });
            return;
        }
        subject = outboxData.subject;
        text = outboxData.text;
        html = undefined;
    }
    if (!html && !text) {
        await snap.ref.update({ status: "ERROR", error: "No html or text body", attemptedAt: firestore_2.FieldValue.serverTimestamp() });
        return;
    }
    // The sender is ALWAYS derived server-side. A client-supplied `from` is
    // ignored: honoring it let any tenant manager send DKIM-signed mail from an
    // arbitrary @xefe.tl address (spoofing/phishing). Branding still works via
    // the sanitized fromName ("{Business} via Xefe <invoices@xefe.tl>").
    const payload = {
        from: businessFrom(data.fromName) || DEFAULT_FROM,
        to,
        subject,
    };
    if (html)
        payload.html = html;
    if (text)
        payload.text = text;
    if (typeof data.replyTo === "string")
        payload.reply_to = data.replyTo;
    // `cc` is intentionally not forwarded from the doc — no sanctioned caller
    // sets it, and honoring it added an unbounded extra recipient list.
    // Attachments: {filename, url|content} → Resend {filename, path|content}.
    // (Previously ignored — payslip PDFs never actually rode along.)
    if (Array.isArray(data.attachments)) {
        const attachments = data.attachments
            .map((a) => {
            if (typeof (a === null || a === void 0 ? void 0 : a.filename) !== "string")
                return null;
            if (typeof a.url === "string" && a.url)
                return { filename: a.filename, path: a.url };
            if (typeof a.content === "string" && a.content)
                return { filename: a.filename, content: a.content };
            return null;
        })
            .filter(Boolean);
        if (attachments.length > 0)
            payload.attachments = attachments;
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
        const body = (await res.json().catch(() => ({})));
        if (!res.ok) {
            console.error("Resend send failed:", res.status, body);
            await snap.ref.update({
                status: "ERROR",
                error: (body.message || `HTTP ${res.status}`).slice(0, 500),
                attemptedAt: firestore_2.FieldValue.serverTimestamp(),
            });
            return;
        }
        await snap.ref.update({
            status: "SENT",
            providerId: (_a = body.id) !== null && _a !== void 0 ? _a : null,
            sentAt: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        console.error("Resend send threw:", error);
        await snap.ref.update({
            status: "ERROR",
            error: error.message.slice(0, 500),
            attemptedAt: firestore_2.FieldValue.serverTimestamp(),
        });
    }
});
/**
 * Mirror the provider result onto the invoice so the app distinguishes
 * "queued" from actually sent and exposes a useful retry when delivery fails.
 */
exports.syncInvoiceDeliveryStatus = (0, firestore_1.onDocumentUpdated)("mail/{mailId}", async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after || after.purpose !== "invoice")
        return;
    if (before.status === after.status)
        return;
    if (after.status !== "SENT" && after.status !== "ERROR")
        return;
    const tenantId = typeof after.tenantId === "string" ? after.tenantId : "";
    const invoiceId = typeof after.relatedId === "string" ? after.relatedId : "";
    const deliveryAttemptId = typeof after.deliveryAttemptId === "string"
        ? after.deliveryAttemptId
        : "";
    if (!tenantId || !invoiceId || !deliveryAttemptId)
        return;
    const update = after.status === "SENT"
        ? {
            deliveryStatus: "sent",
            deliveryError: firestore_2.FieldValue.delete(),
            emailSentAt: after.sentAt || firestore_2.FieldValue.serverTimestamp(),
            deliveryUpdatedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }
        : {
            deliveryStatus: "failed",
            deliveryError: typeof after.error === "string"
                ? after.error.slice(0, 500)
                : "Email delivery failed",
            deliveryUpdatedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        };
    const invoiceRef = (0, firestore_2.getFirestore)().doc(`tenants/${tenantId}/invoices/${invoiceId}`);
    await (0, firestore_2.getFirestore)().runTransaction(async (transaction) => {
        var _a;
        const invoice = await transaction.get(invoiceRef);
        if (!invoice.exists)
            return;
        if (((_a = invoice.data()) === null || _a === void 0 ? void 0 : _a.deliveryAttemptId) !== deliveryAttemptId)
            return;
        transaction.update(invoiceRef, update);
    });
});
//# sourceMappingURL=email.js.map