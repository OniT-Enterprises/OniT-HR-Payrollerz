import { describe, expect, it } from "vitest";
import { getEffectiveInvoiceStatus } from "../../client/lib/invoiceStatus";

describe("effective invoice status", () => {
  it("marks an outstanding sent invoice overdue only after its due date", () => {
    const invoice = {
      status: "sent" as const,
      balanceDue: 100,
      dueDate: "2026-07-16",
    };

    expect(getEffectiveInvoiceStatus(invoice, "2026-07-16")).toBe("sent");
    expect(getEffectiveInvoiceStatus(invoice, "2026-07-17")).toBe("overdue");
  });

  it("does not override paid, cancelled, draft, or zero-balance invoices", () => {
    expect(
      getEffectiveInvoiceStatus(
        { status: "paid", balanceDue: 0, dueDate: "2026-07-01" },
        "2026-07-17",
      ),
    ).toBe("paid");
    expect(
      getEffectiveInvoiceStatus(
        { status: "cancelled", balanceDue: 100, dueDate: "2026-07-01" },
        "2026-07-17",
      ),
    ).toBe("cancelled");
    expect(
      getEffectiveInvoiceStatus(
        { status: "draft", balanceDue: 100, dueDate: "2026-07-01" },
        "2026-07-17",
      ),
    ).toBe("draft");
    expect(
      getEffectiveInvoiceStatus(
        { status: "sent", balanceDue: 0, dueDate: "2026-07-01" },
        "2026-07-17",
      ),
    ).toBe("sent");
  });
});
