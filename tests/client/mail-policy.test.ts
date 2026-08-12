import { describe, expect, it } from "vitest";
import {
  announcementEmailContent,
  billingContactCandidates,
  BILINGUAL_FOOTER,
  firebaseStorageObjectPath,
  MAX_ANNOUNCEMENT_RECIPIENTS,
  memberCanNotifyDepartment,
  memberCanRequestClientMail,
  recipientsAreSubset,
  sameRecipients,
  validateClientMailInput,
} from "../../functions/src/mailPolicy";

const invoiceRequest = {
  tenantId: "tenant-a",
  to: " Customer@Example.com ",
  subject: "Invoice INV-1",
  text: "Attached",
  purpose: "invoice",
  relatedId: "inv-1",
};

describe("client mail policy", () => {
  it("normalizes a sanctioned, record-linked request", () => {
    expect(validateClientMailInput(invoiceRequest)).toEqual({
      tenantId: "tenant-a",
      to: ["customer@example.com"],
      subject: "Invoice INV-1",
      text: "Attached",
      purpose: "invoice",
      relatedId: "inv-1",
    });
  });

  it("rejects arbitrary purposes and unlinked product notifications", () => {
    expect(() =>
      validateClientMailInput({
        ...invoiceRequest,
        purpose: "marketing-blast",
      }),
    ).toThrow("Unsupported mail purpose");
    expect(() =>
      validateClientMailInput({ ...invoiceRequest, relatedId: undefined }),
    ).toThrow("relatedId is required for invoice");
    expect(() =>
      validateClientMailInput({
        tenantId: "tenant-a",
        to: "staff@example.com",
        subject: "Notice",
        text: "Body",
        purpose: "announcement",
      }),
    ).toThrow("relatedId is required for announcement");
    expect(() =>
      validateClientMailInput({
        tenantId: "platform",
        to: "admin@example.com",
        subject: "Approval requested",
        html: "<p>Review it</p>",
        purpose: "notification",
      }),
    ).toThrow("relatedId is required for notification");
  });

  it("caps announcement fan-out so queue documents and the marker stay atomic", () => {
    const announcement = {
      tenantId: "tenant-a",
      subject: "Ignored server-derived subject",
      text: "Ignored server-derived body",
      purpose: "announcement",
      relatedId: "announcement-1",
    };
    const address = (index: number) => `staff-${index}@example.com`;
    expect(
      validateClientMailInput({
        ...announcement,
        to: Array.from({ length: MAX_ANNOUNCEMENT_RECIPIENTS }, (_, index) =>
          address(index)),
      }).to,
    ).toHaveLength(MAX_ANNOUNCEMENT_RECIPIENTS);
    expect(() =>
      validateClientMailInput({
        ...announcement,
        to: Array.from(
          { length: MAX_ANNOUNCEMENT_RECIPIENTS + 1 },
          (_, index) => address(index),
        ),
      }),
    ).toThrow("Too many recipients");
  });

  it("limits rich content to the existing HTML mail flows", () => {
    expect(() =>
      validateClientMailInput({
        tenantId: "tenant-a",
        to: "staff@example.com",
        subject: "Announcement",
        html: '<a href="https://evil.invalid">Sign in</a>',
        purpose: "announcement",
      }),
    ).toThrow("HTML is not allowed for announcement");
    expect(() =>
      validateClientMailInput({ ...invoiceRequest, subject: "x".repeat(241) }),
    ).toThrow("subject is too long");
  });

  it("accepts only bounded Firebase Storage URL attachments", () => {
    expect(() =>
      validateClientMailInput({
        ...invoiceRequest,
        attachments: [
          { filename: "invoice.pdf", url: "https://evil.invalid/invoice.pdf" },
        ],
      }),
    ).toThrow("Attachment URL must use Xefe's Firebase Storage");
    expect(() =>
      validateClientMailInput({
        ...invoiceRequest,
        attachments: [{ filename: "invoice.pdf", content: "ZmlsZQ==" }],
      }),
    ).toThrow("Client attachments require a Firebase Storage URL");
    expect(
      validateClientMailInput({
        ...invoiceRequest,
        attachments: [
          {
            filename: "invoice.pdf",
            url: "https://firebasestorage.googleapis.com/v0/b/project/o/tenants%2Ftenant-a%2Finvoices%2Finv-1%2Finvoice.pdf?alt=media",
            contentType: "application/pdf",
          },
        ],
      }).attachments,
    ).toHaveLength(1);
  });

  it("extracts ownership from the configured bucket path, not URL substrings", () => {
    const bucket = "xefe-prod.firebasestorage.app";
    const prefix = "tenants/tenant-a/invoices/inv-1/";
    const valid =
      "https://firebasestorage.googleapis.com/v0/b/xefe-prod.firebasestorage.app/o/tenants%2Ftenant-a%2Finvoices%2Finv-1%2Finvoice.pdf?alt=media";
    const queryInjection =
      "https://firebasestorage.googleapis.com/v0/b/xefe-prod.firebasestorage.app/o/public%2Fother.pdf?fake=tenants%2Ftenant-a%2Finvoices%2Finv-1%2F";
    const wrongBucket = valid.replace(
      "xefe-prod.firebasestorage.app",
      "attacker.appspot.com",
    );

    expect(firebaseStorageObjectPath(valid, bucket)).toBe(
      `${prefix}invoice.pdf`,
    );
    expect(
      firebaseStorageObjectPath(queryInjection, bucket)?.startsWith(prefix),
    ).toBe(false);
    expect(firebaseStorageObjectPath(wrongBucket, bucket)).toBeNull();
  });

  it("compares authoritative recipients case-insensitively", () => {
    expect(
      sameRecipients(["CUSTOMER@example.com"], ["customer@example.com"]),
    ).toBe(true);
    expect(
      sameRecipients(["attacker@example.com"], ["customer@example.com"]),
    ).toBe(false);
    expect(
      recipientsAreSubset(
        ["admin-a@example.com"],
        ["admin-a@example.com", "admin-b@example.com"],
      ),
    ).toBe(true);
    expect(
      recipientsAreSubset(["attacker@example.com"], ["admin-a@example.com"]),
    ).toBe(false);
  });

  it("mirrors the linked-record capability for each tenant mail purpose", () => {
    expect(memberCanRequestClientMail("invoice", "accountant", [])).toBe(true);
    expect(memberCanRequestClientMail("invoice", "manager", ["money"])).toBe(false);
    expect(memberCanRequestClientMail("announcement", "manager", ["staff"])).toBe(false);
    expect(memberCanRequestClientMail("review-submitted", "manager", ["performance"])).toBe(false);
    expect(memberCanRequestClientMail("interview-invitation", "manager", [])).toBe(false);
    expect(memberCanRequestClientMail("interview-invitation", "manager", ["hiring"])).toBe(true);
    expect(memberCanRequestClientMail("application-outcome", "viewer", ["hiring"])).toBe(true);
  });

  it("finds the billing contact where the admin console actually shows it", () => {
    // Redman's shape: the tenant root doc has no billingEmail/ownerEmail and the
    // address lives in settings/config companyDetails. Reading only the root doc
    // reported "no email on file" while the console displayed one.
    expect(
      billingContactCandidates({}, { email: "onit.kiwi.steve@gmail.com" }),
    ).toEqual(["onit.kiwi.steve@gmail.com"]);

    // companyDetails wins — it is what the tenant edits and what is displayed.
    expect(
      billingContactCandidates(
        { billingEmail: "root@example.com", ownerEmail: "owner@example.com" },
        { email: "Company@Example.com" },
      ),
    ).toEqual(["company@example.com", "root@example.com", "owner@example.com"]);

    // Falls back through the root doc, and de-duplicates.
    expect(billingContactCandidates({ ownerEmail: " Owner@Example.com " }, {})).toEqual([
      "owner@example.com",
    ]);
    expect(
      billingContactCandidates({ billingEmail: "a@b.com", ownerEmail: "a@b.com" }, {}),
    ).toEqual(["a@b.com"]);

    // Nothing usable anywhere -> caller must report "nobody notified".
    expect(billingContactCandidates({}, {})).toEqual([]);
    expect(billingContactCandidates({ billingEmail: "   " }, { email: 42 })).toEqual([]);
  });

  it("lets NO tenant role announce complimentary access", () => {
    // The platform grants a comp, not the tenant. Only a superadmin may send
    // this purpose, and superadmins bypass this check in authorizeClientMail —
    // so every role here must be refused, including the owner.
    for (const role of ["owner", "hr-admin", "accountant", "manager", "viewer"]) {
      expect(memberCanRequestClientMail("billing-access-granted", role, [])).toBe(false);
    }
    expect(
      memberCanRequestClientMail("billing-access-granted", "owner", ["payroll", "money"]),
    ).toBe(false);
  });

  it("accepts a billing-access-granted request structurally", () => {
    expect(
      validateClientMailInput({
        tenantId: "tenant-a",
        to: "owner@example.com",
        subject: "Your Xefe account has full access",
        text: "Full access at no charge.",
        purpose: "billing-access-granted",
      }).purpose,
    ).toBe("billing-access-granted");
  });

  it("keeps manager leave mail inside the manager's department", () => {
    expect(memberCanNotifyDepartment("owner", undefined, "dept-b")).toBe(true);
    expect(memberCanNotifyDepartment("manager", "dept-a", "dept-a")).toBe(true);
    expect(memberCanNotifyDepartment("manager", "dept-a", "dept-b")).toBe(false);
    expect(memberCanNotifyDepartment("manager", undefined, "dept-a")).toBe(false);
  });
});

// The browser used to compose this body, so the employer name and the EN+Tetun
// footer travelled with it. Server-derived content has to carry both, or staff
// get an unattributed email from an address they do not recognise.
describe("announcement email content", () => {
  const record = {
    title: "  Payday moved to Friday  ",
    body: "  Salaries land one day early this month.  ",
    createdByName: "  Ana Soares  ",
  };

  it("names the employer and keeps the bilingual footer", () => {
    expect(announcementEmailContent(record, "  Kafé Aroma Dili  ")).toEqual({
      subject: "📢 Kafé Aroma Dili: Payday moved to Friday",
      text: [
        "Salaries land one day early this month.",
        "",
        "— Ana Soares, Kafé Aroma Dili",
        BILINGUAL_FOOTER,
      ].join("\n"),
    });
  });

  it("still footers an announcement with no tenant name or author on file", () => {
    const content = announcementEmailContent({
      title: "Office closed",
      body: "Back Monday.",
    });
    expect(content?.subject).toBe("📢 Office closed");
    expect(content?.text).toBe(`Back Monday.\n\n${BILINGUAL_FOOTER}`);
  });

  it("refuses a record that is not fit to email", () => {
    expect(announcementEmailContent({ title: "", body: "x" })).toBeNull();
    expect(announcementEmailContent({ title: "x", body: "   " })).toBeNull();
    expect(announcementEmailContent({ title: "x" })).toBeNull();
    expect(
      announcementEmailContent({ title: "x".repeat(221), body: "y" }),
    ).toBeNull();
  });
});
