import { describe, expect, it } from "vitest";
import {
  helpCenterPath,
  helpHashTarget,
  helpResultPath,
  helpSearchQuery,
} from "../../client/lib/help/navigation";

describe("help search navigation", () => {
  it("keeps a trimmed search query on result and return paths", () => {
    expect(helpCenterPath("  bank reconciliation  ")).toBe(
      "/help?q=bank+reconciliation",
    );
    expect(
      helpResultPath(
        "/help/guide/invoices-and-money",
        "bank reconciliation",
        "bank-reconciliation",
      ),
    ).toBe(
      "/help/guide/invoices-and-money?q=bank+reconciliation#bank-reconciliation",
    );
  });

  it("omits empty query state and safely reads URL state", () => {
    expect(helpCenterPath("   ")).toBe("/help");
    expect(helpResultPath("/help/your-month", "", "wit")).toBe(
      "/help/your-month#wit",
    );
    expect(helpSearchQuery("?q=%20severance%20")).toBe("severance");
    expect(helpHashTarget("#service-compensation")).toBe(
      "service-compensation",
    );
    expect(helpHashTarget("#%E0%A4%A")).toBe("");
  });
});
