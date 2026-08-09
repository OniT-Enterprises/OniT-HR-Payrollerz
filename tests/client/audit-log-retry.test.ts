import { beforeEach, describe, expect, it, vi } from "vitest";

const { callable, httpsCallable } = vi.hoisted(() => {
  const callable = vi.fn();
  return {
    callable,
    httpsCallable: vi.fn(() => callable),
  };
});

vi.mock("firebase/functions", () => ({ httpsCallable }));
vi.mock("@/lib/firebase", () => ({
  db: {},
  getFunctionsLazy: vi.fn(async () => ({})),
}));

import { auditLogService } from "@/services/auditLogService";

const payrollAudit = {
  userId: "owner-a",
  userEmail: "owner@example.test",
  action: "payroll.run" as const,
  payrollRunId: "run-a",
  period: "2026-08-01 to 2026-08-31",
  tenantId: "tenant-a",
};

describe("payroll audit delivery", () => {
  beforeEach(() => {
    callable.mockReset();
    httpsCallable.mockClear();
  });

  it("retries a transient callable response with one stable event ID", async () => {
    callable
      .mockRejectedValueOnce({ code: "functions/internal" })
      .mockResolvedValueOnce({ data: { id: "payroll:run:run-a" } });

    await expect(
      auditLogService.logPayrollAction(payrollAudit),
    ).resolves.toBe("payroll:run:run-a");

    expect(callable).toHaveBeenCalledTimes(2);
    expect(callable.mock.calls[0][0].eventId).toBe("payroll:run:run-a");
    expect(callable.mock.calls[1][0].eventId).toBe("payroll:run:run-a");
  });

  it("does not retry a validation failure", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    callable.mockRejectedValueOnce({ code: "functions/invalid-argument" });

    try {
      await expect(
        auditLogService.logPayrollAction(payrollAudit),
      ).rejects.toMatchObject({ code: "functions/invalid-argument" });
      expect(callable).toHaveBeenCalledOnce();
    } finally {
      errorLog.mockRestore();
    }
  });
});
