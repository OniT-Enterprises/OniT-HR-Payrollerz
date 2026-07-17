# Email & Notifications — architecture

_Last updated: 2026-07-17. Audience: agents and developers adding any
outbound email or notification._

## Pipeline

```
client: notificationService.queueEmail()  ─┐
server: db.collection("mail").add(...)    ─┼─►  mail/{id} doc  ─►  sendQueuedEmail (functions/src/email.ts)  ─►  Resend
                                           ┘    (status: pending)   (onDocumentCreated trigger)                 noreply@xefe.tl
```

- Doc shape (Trigger-Email compatible): `{tenantId, to: string[], subject,
  text?|html?, replyTo?, fromName?, attachments?, status:'pending', purpose,
  relatedId?, createdBy?, createdAt}`.
- `fromName` renders as **"{Business} via Xefe <invoices@xefe.tl>"** — the
  address is fixed server-side so tenants can brand but never spoof.
- `attachments`: `[{filename, url | content(base64), contentType?}]` — url is
  fetched by Resend (Storage download URLs work).
- Delivery status (`SENT`/`ERROR` + providerId) is written back onto the doc.

## The one rule

**Never write `mail` docs directly from client code.** Go through
`client/services/notificationService.ts` (`queueEmail`), which enforces:

- **Per-recipient fan-out** by default for multi-recipient sends — there is
  no BCC; a shared `to` leaks every address. Only pass `perRecipient: false`
  for recipients who already know each other (internal admins, one
  customer's contacts).
- Trimmed, de-duplicated recipients; zero valid recipients → returns 0,
  no write, no throw.
- A `purpose` tag on every doc (greppable audit trail).
- `bilingualFooter()` (EN + Tetun) for staff-facing mail. Customer-facing
  mail (invoices) keeps its own voice; candidate-facing mail uses inline
  EN + Tetun paragraphs.

Helpers: `getEmployeeEmail(tenantId, employeeId)` (reads
`personalInfo.email`), `getActiveStaffEmails(tenantId)`.

Server-side senders use the Admin SDK with the same doc shape — keep them in
sync with the client service.

**Sending must never break the action.** Every caller wraps the email in
try/catch (or the service call is structured non-fatally): a failed email
never rolls back an approval/publish/decision. Missing recipient email →
surface an honest toast ("no email on file"), don't pretend.

## Firestore rules

`mail` create is allowed for tenant **managers and admins**
(`isTenantManagerOrAdmin`) — managers approve leave/expenses, which email.
Public/unauthenticated flows can NOT write mail docs — their emails are sent
by server-side triggers (see `sendApplicationReceivedEmail`).

## Current senders (purpose tags)

### Client (via notificationService)
| Flow | purpose | Recipients |
|---|---|---|
| Invoice send | `invoice` | customer |
| Invoice payment reminder | `invoice-reminder` | customer |
| Payslip bulk send (manual, with PDFs) | `payslip` | staff (per-recipient) |
| Platform/superadmin notices | `notification` | admins (shared to) |
| Leave decision | `leave-decision` | employee |
| Announcement broadcast (opt-in checkbox) | `announcement` | all active staff (per-recipient) |
| Billing invoice request | `billing-invoice-request` | info@naroman.tl |
| Interview invitation / reminder / reschedule / decision | `interview-*` | candidate |
| Application verified/rejected | `application-outcome` | applicant |
| Performance review submitted / completed | `review-submitted` / `review-completed` | employee |

### Server (Admin SDK)
| Function | purpose | Recipients |
|---|---|---|
| `sendWelcomeEmail`, `requestPasswordReset`, member invites (tenant.ts) | `welcome` / `password-reset` | user |
| `sendRenewalReminders` (daily 08:00 Dili) | `billing-renewal-reminder(-ops)` | tenant + ops |
| `sendApplicationReceivedEmail` (on public application create) | `application-received` | applicant |
| `notifyEkipaExpenseDecision` (also sends Ekipa push) | `expense-decision` | employee |
| `checkDocumentExpiry` digest (daily 06:00 Dili, only on days with NEW alerts) | `document-expiry-digest` | tenant owner/billing email |

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
- **CI does NOT deploy functions** — deploy changed triggers manually.
- Resend sender domain is xefe.tl (verified account-level). Default from:
  `Xefe <noreply@xefe.tl>`; business sends may use `fromName`.
- Firestore batches cap at 500 ops — the service chunks fan-outs at 400.
