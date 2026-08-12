# Email & Notifications — architecture

_Last updated: 2026-08-09. Audience: agents and developers adding any
outbound email or notification. Invoice/receipt email specifics live in
docs/INVOICING.md._

## Pipeline

```
client: notificationService.queueEmail() ─► queueTenantEmail callable ─┐
server: db.collection("mail").add(...)                                ─┼─► mail/{id} ─► sendQueuedEmail ─► Resend
                                                                       ┘   pending      (Firestore trigger)
```

- Doc shape (Trigger-Email compatible): `{tenantId, to: string[], subject,
text?|html?, replyTo?, fromName?, attachments?, status:'pending', purpose,
relatedId?, createdBy?, createdAt}`.
- For browser requests, the callable binds `createdBy` to `auth.uid`, derives
  `fromName` from the tenant, and permits `replyTo` only when it is the actor or
  a configured tenant address. `fromName` renders as **"{Business} via Xefe
  <invoices@xefe.tl>"**; the address is always fixed server-side.
- Browser attachments are limited to invoice/payslip Firebase Storage URLs
  whose object path belongs to the linked invoice or payroll record. Trusted
  Admin SDK senders may also use base64 content when required.
- Delivery status (`SENT`/`ERROR` + providerId) is written back onto the doc.

## The one rule

**Never write `mail` docs directly from client code.** Go through
`client/services/notificationService.ts` (`queueEmail`). It invokes the
`queueTenantEmail` callable, which enforces:

- **Per-recipient fan-out** by default for multi-recipient sends — there is
  no BCC; a shared `to` leaks every address. Only pass `perRecipient: false`
  for recipients who already know each other (internal admins, one
  customer's contacts).
- A fixed purpose allowlist, role checks, bounded recipients/subject/body,
  purpose-specific HTML and attachment permissions, and server-bound actor
  metadata/branding.
- Record-bound recipients: invoice customers, a payroll record's employee,
  interview candidates, applicants, leave/review employees, current active
  staff for announcements, configured Xefe billing support, or current
  superadmins (plus an approved pending grantee) for platform notices. A
  client-supplied unrelated address is rejected; announcements and billing
  requests ignore the submitted audience and resolve it afresh.
- Trimmed, de-duplicated recipients; zero valid recipients at the client helper
  returns 0 without invoking the callable.
- A `purpose` tag on every doc (greppable audit trail).
- `bilingualFooter()` (EN + Tetun) for staff-facing mail. Customer-facing
  mail (invoices) keeps its own voice; candidate-facing mail uses inline
  EN + Tetun paragraphs.

Helpers: `getEmployeeEmail(tenantId, employeeId)` (reads
`personalInfo.email`), `getActiveStaffEmails(tenantId)`.

Server-side senders use the Admin SDK with the same doc shape. They bypass
Firestore rules by design and remain responsible for deriving their own
recipients and bounding their payloads.

**Sending must never break the action.** Every caller wraps the email in
try/catch (or the service call is structured non-fatally): a failed email
never rolls back an approval/publish/decision. Missing recipient email →
surface an honest toast ("no email on file"), don't pretend.

## Firestore rules

All client create/update/delete access to `mail` is denied, including tenant
owners and superadmins. Sanctioned authenticated browser flows use
`queueTenantEmail`; public/unauthenticated flows use server-side triggers (see
`sendApplicationReceivedEmail`). Read access remains tenant-admin scoped for
delivery history.

Adding a browser mail flow requires all three: add its literal purpose to
`functions/src/mailPolicy.ts`, add a role and authoritative-recipient branch in
`functions/src/email.ts`, and add policy/regression tests. Do not add a generic
purpose or recipient escape hatch.

## Current senders (purpose tags)

### Client (via notificationService)

| Flow                                                               | purpose                                 | Recipients                       |
| ------------------------------------------------------------------ | --------------------------------------- | -------------------------------- |
| Invoice send (hosted-page link + as-sent PDF attached, `fromName`) | `invoice`                               | customer                         |
| Invoice payment reminder (hosted-page link)                        | `invoice-reminder`                      | customer                         |
| Payment receipt (auto when invoice fully paid)                     | `receipt`                               | customer                         |
| Payslip bulk send (manual, with PDFs)                              | `payslip`                               | staff (per-recipient)            |
| Platform/superadmin notices                                        | `notification`                          | admins (shared to)               |
| Leave decision                                                     | `leave-decision`                        | employee                         |
| Announcement broadcast (opt-in checkbox)                           | `announcement`                          | all active staff (per-recipient) |
| Billing invoice request                                            | `billing-invoice-request`               | info@naroman.tl                  |
| Complimentary access granted (superadmin only)                     | `billing-access-granted`                | tenant billing/owner contact     |
| Interview invitation / reminder / reschedule / decision            | `interview-*`                           | candidate                        |
| Application verified/rejected                                      | `application-outcome`                   | applicant                        |
| Performance review submitted / completed                           | `review-submitted` / `review-completed` | employee                         |

### Server (Admin SDK)

| Function                                                                      | purpose                          | Recipients                 |
| ----------------------------------------------------------------------------- | -------------------------------- | -------------------------- |
| `sendWelcomeEmail`, `requestPasswordReset`, member invites (tenant.ts)        | `welcome` / `password-reset`     | user                       |
| `sendRenewalReminders` (daily 08:00 Dili)                                     | `billing-renewal-reminder(-ops)` | tenant + ops               |
| `sendApplicationReceivedEmail` (on public application create)                 | `application-received`           | applicant                  |
| `notifyEkipaExpenseDecision` (also sends Ekipa push)                          | `expense-decision`               | employee                   |
| `checkDocumentExpiry` digest (daily 06:00 Dili, only on days with NEW alerts) | `document-expiry-digest`         | tenant owner/billing email |

### UX conventions

- Actions that email someone **say so before firing** — e.g. the leave
  approve/reject dialogs state "{name} will be notified by email", the
  announcement dialog has an explicit opt-in checkbox.
- Internal notes/reasons are **never** emailed to candidates/applicants
  (rejection reasons stay internal; a courteous generic goes out). Leave
  rejection reasons ARE shared with the employee (they wrote the request).
- Candidate/staff emails are bilingual EN + Tetun.

## Deliberately NOT emailed (decided 2026-07-17 — revisit only on request)

- Payslip auto-send on payroll finalize (manual bulk send + Ekipa push cover
  it; auto would double-send)
- Candidate kanban status drags (accidental-drag footgun — the deliberate
  decision points email instead)
- Shift schedule published (push territory; many shift workers have no email)
- WIT certificate to employees (needs a product decision; attachments are
  supported now)
- Disciplinary records (sensitive — intentionally manual)

## Ekipa push notifications

`functions/src/notifications.ts` — Expo push to the staff app (announcements,
leave/expense decisions, payslips, document requests), localized tet/en/pt/id.
Email and push are complementary: push for in-app immediacy, email for the
paper trail and staff without the app.

## Gotchas

- Pushes to `main` deploy changed Functions automatically after the release
  gates pass. Use the manual Functions workflow only for a standalone redeploy.
- Resend sender domain is xefe.tl (verified account-level). Default from:
  `Xefe <noreply@xefe.tl>`; business sends may use `fromName`.
- Firestore batches cap at 500 ops — the callable chunks fan-outs at 400.
