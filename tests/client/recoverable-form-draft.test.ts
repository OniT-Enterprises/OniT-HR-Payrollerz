import { describe, expect, it } from "vitest";
import {
  clearRecoverableFormDrafts,
  createDraftOperationId,
  readRecoverableFormDraft,
  recoverableFormDraftKey,
  writeRecoverableFormDraft,
} from "@/lib/recoverableFormDraft";
import { formatTime24 } from "@/lib/time";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("recoverable form drafts", () => {
  it("round-trips a tenant- and user-scoped draft with its retry ID", () => {
    const storage = new MemoryStorage();
    const key = recoverableFormDraftKey({ userId: "user 1", tenantId: "tenant/a", form: "invoice-new" });
    const draft = {
      version: 1 as const,
      updatedAt: Date.now(),
      operationId: "retry-123",
      data: { customerId: "customer-1" },
    };

    expect(writeRecoverableFormDraft(storage, key, draft)).toBe(true);
    expect(readRecoverableFormDraft(storage, key)).toEqual(draft);
    expect(key).not.toContain("tenant/a");
  });

  it("clears only the previous tenant on a tenant switch", () => {
    const storage = new MemoryStorage();
    const first = recoverableFormDraftKey({ userId: "u1", tenantId: "t1", form: "employee-new" });
    const second = recoverableFormDraftKey({ userId: "u1", tenantId: "t2", form: "invoice-new" });
    const otherUser = recoverableFormDraftKey({ userId: "u2", tenantId: "t1", form: "invoice-new" });
    [first, second, otherUser].forEach((key) => storage.setItem(key, "draft"));

    clearRecoverableFormDrafts(storage, { userId: "u1", tenantId: "t1" });

    expect(storage.getItem(first)).toBeNull();
    expect(storage.getItem(second)).toBe("draft");
    expect(storage.getItem(otherUser)).toBe("draft");
  });

  it("removes corrupt entries and generates distinct retry IDs", () => {
    const storage = new MemoryStorage();
    storage.setItem("bad", "{broken");
    expect(readRecoverableFormDraft(storage, "bad")).toBeNull();
    expect(storage.getItem("bad")).toBeNull();
    expect(createDraftOperationId()).not.toBe(createDraftOperationId());
  });

  it("does not retain sensitive form data indefinitely", () => {
    const storage = new MemoryStorage();
    const key = recoverableFormDraftKey({ userId: "u1", tenantId: "t1", form: "employee-new" });
    storage.setItem(key, JSON.stringify({
      version: 1,
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      operationId: "old-request",
      data: { salary: "500" },
    }));

    expect(readRecoverableFormDraft(storage, key)).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });
});

describe("24-hour time display", () => {
  it("keeps midnight, midday, and night shifts unambiguous", () => {
    expect(formatTime24("0:00")).toBe("00:00");
    expect(formatTime24("12:05")).toBe("12:05");
    expect(formatTime24("21:30")).toBe("21:30");
    expect(formatTime24("24:00")).toBe("");
  });
});
