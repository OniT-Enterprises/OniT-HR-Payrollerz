import { describe, expect, it } from "vitest";
import { advanceRecurringInvoiceDate as advanceClient } from "@/lib/recurringInvoiceSchedule";
import { advanceRecurringInvoiceDate as advanceServer } from "../../functions/src/recurringInvoiceSchedule";

const implementations = [
  ["client", advanceClient],
  ["scheduler", advanceServer],
] as const;

describe.each(implementations)("%s recurring invoice schedule", (_name, advance) => {
  it("keeps end-of-month schedules in the next billing month", () => {
    expect(advance("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(advance("2026-02-28", "monthly")).toBe("2026-03-31");
    expect(advance("2025-11-30", "quarterly")).toBe("2026-02-28");
  });

  it("clamps leap-day yearly schedules without skipping February", () => {
    expect(advance("2024-02-29", "yearly")).toBe("2025-02-28");
  });

  it("does not turn a clamped day-29/30 schedule into end-of-month", () => {
    expect(advance("2026-02-28", "monthly", "2026-01-30")).toBe("2026-03-30");
    expect(advance("2026-02-28", "monthly", "2026-01-29")).toBe("2026-03-29");
    expect(advance("2026-03-30", "monthly", "2026-01-30")).toBe("2026-04-30");
  });

  it("preserves ordinary days and crosses year boundaries", () => {
    expect(advance("2026-12-15", "monthly")).toBe("2027-01-15");
    expect(advance("2026-01-15", "quarterly")).toBe("2026-04-15");
    expect(advance("2026-12-29", "weekly")).toBe("2027-01-05");
  });

  it("rejects malformed calendar dates", () => {
    expect(() => advance("2026-02-30", "monthly")).toThrow("Invalid recurring date");
  });
});
