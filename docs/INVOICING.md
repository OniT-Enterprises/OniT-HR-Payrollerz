# Invoicing — delivery architecture (hosted pages, PDFs, emails)

_Last updated: 2026-07-18. Audience: agents and developers touching invoice
delivery, the public invoice page, or invoice/receipt emails. Shipped and
verified in prod 2026-07-17 (commits 3488909..b16b1e0)._

## The customer-facing flow

Every non-draft invoice can be delivered three ways, all built on the same
public link:

```
Send ──► journal posted ──► invoice_links/{token} published ──► PDF frozen to Storage
                                     │                                │
             email ("View invoice online" + PDF attached) ◄──────────┘
             WhatsApp share (wa.me prefilled message + link)
             Copy link (clipboard)
                                     │
                        customer opens xefe.tl/i/{token}
                                     │
              viewedAt stamped ──► onInvoiceLinkViewed fn ──► invoice status "viewed"
```

The hosted page (`client/pages/money/PublicInvoice.tsx`, route `/i/:token` in
`routes.tsx`, listed in AppLayout `PUBLIC_PATHS`) is **Tetun-first** and shows:
status banner (amount due / PAID / cancelled / link-removed), Download PDF,
and the InvoicePaper with bank details. No login, no app chrome.

## invoice_links — the public mirror

Top-level collection, **doc id = unguessable share token** (24 chars, stored
on the invoice as `shareToken`). Holds a **sanitized snapshot**: invoice
fields minus customer email/phone and all internal accounting/reminder
fields, plus a branding subset of InvoiceSettings and `pdfUrl`.

Written client-side by tenant admins via `invoiceService`:

| Method | When |
|---|---|
| `ensureShareLink(tenantId, invoice, settings?)` | markAsSent, Share/WhatsApp/Copy actions, reminder + receipt emails — creates or refreshes the doc, returns `{token, url}` |
| `syncPublicLink(tenantId, invoiceId)` | after recordPayment, cancelInvoice, updateInvoiceTemplate — refresh-if-exists, never fails the parent action |
| `regenerateShareLink(tenantId, invoiceId)` | "Reset link" UI — deletes the old doc (old URL dies instantly), new token, new doc |

**Firestore rules** (`firestore.rules`, tested in
`tests/rules/invoice-links.test.ts` — 19 tests):
- Public `get` only when `revoked == false`; **`resource == null` must stay
  allowed** or ensureShareLink's existence check is denied and links can
  never be created (learned in prod).
- **No public `list`** — links are not enumerable.
- Public may stamp `viewedAt` exactly once, server-time only, nothing else.
- Create/update/delete: tenant admins of `tenantId` (tenant binding
  immutable); create requires the full snapshot shape and `revoked: false`.

`invoice_links` is keyed to tenants by a `tenantId` FIELD — it is in the
`ROOT_COLLECTIONS` sweep of `scripts/{delete-tenant,wipe-tenant-data}.mjs`;
keep it in any new cleanup script.

## As-sent PDF (persistence)

On first send, `freezeSentPdf` renders the invoice via the existing
`generateInvoiceBlob` (@react-pdf) and uploads to
`tenants/{tid}/invoices/{invoiceId}/{number}.pdf`
(`fileUploadService.uploadInvoicePdf`). The download URL is stored as
`Invoice.sentPdfUrl` + `invoice_links.pdfUrl`. Rationale: invoices are
edit-locked after send but templates/branding are not — the frozen PDF keeps
the document the customer received reproducible (TL ~5-year record keeping).

The public page serves the frozen PDF while unpaid; once paid it re-renders
client-side so the customer's copy carries the PAID stamp. Storage rules:
read tenant members, write tenant admins + `application/pdf` only. Customers
reach the file through the tokenized download URL, no public Storage rule.

**⚠️ Storage cross-service IAM**: these rules (like every tenant-scoped
Storage rule) call `firestore.get()/exists()`, which only works because
`service-<project#>@gcp-sa-firebasestorage.iam.gserviceaccount.com` holds
`roles/firebaserules.firestoreServiceAgent` (granted 2026-07-17 — before
that EVERY membership-gated upload 403'd, logos and payslips included).
`scripts/deploy-rules.mjs` does NOT provision this; a new project/bucket
needs the gcloud grant. See the comment at the top of `storage.rules`.

## Emails (see docs/EMAIL_NOTIFICATIONS.md for the pipeline)

| Email | purpose | Contents |
|---|---|---|
| Invoice send (first send only, needs customerEmail) | `invoice` | full HTML invoice + "View invoice online" button + frozen PDF attached |
| Payment reminder (manual) | `invoice-reminder` | summary + hosted-page button |
| Receipt (auto when fully paid) | `receipt` | amount received, PAID banner, "View receipt online" |

All send as **"{Business} via Xefe <invoices@xefe.tl>"** (`fromName` on the
mail doc), reply-to = the business's own email. Email failures never fail
the send/payment (try/catch at every call site).

## View tracking

The public page stamps `viewedAt` (rules-constrained one-time write);
`onInvoiceLinkViewed` (functions/src/invoiceLinks.ts, Firestore trigger)
propagates it to the tenant invoice and flips `sent → viewed`. The old
client-side `markAsViewed` was removed — clients can't write tenant
invoices from a public page.

## WhatsApp

`buildInvoiceWhatsAppUrl` (client/lib/publicInvoice.ts) opens wa.me with a
prefilled message (number, amount, due date, link). 8-digit TL numbers get
the 670 prefix. Sending from the owner's own WhatsApp is deliberate — more
trusted than any automated sender, zero infra.

## Gotchas / known gaps

- **Functions deploys are manual** (`firebase deploy --only functions
  --project onit-hr-payroll`) — CI never deploys them.
- `PUBLIC_BASE_URL` is `https://xefe.tl` in prod builds, window origin in
  dev (client/lib/publicInvoice.ts).
- "Open customer page" / WhatsApp call `window.open` after an await —
  popup blockers may eat the tab in some browsers; Copy link always works.
- **Recurring autoSend invoices still email nobody** (pre-existing gap:
  functions/src/money.ts marks sent + posts the journal but never queued a
  customer email). Their share link is created lazily when the owner shares.
- The public page is hardcoded Tetun-first bilingual — public routes render
  outside the i18n-authenticated context; admin-UI strings live in
  `client/i18n/locales/{en,tet,pt}.ts` (`money.invoices.*`), master rebuilt
  with `pnpm i18n:rebuild-master`.
- TUQR (BCTL national QR, launching Aug 2026) belongs on the hosted page's
  payment section when banks support it — the page is the natural home for
  it, a PDF isn't.
