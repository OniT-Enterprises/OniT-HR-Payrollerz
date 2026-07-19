import { describe, expect, it } from "vitest";
import { leaveKeys } from "@/hooks/useLeaveRequests";

const TID = "tenant-a";

// Mirrors @tanstack/react-query's partialMatchKey: a query is invalidated when
// the invalidation key is a prefix of the query's key.
function isPrefixMatch(queryKey: readonly unknown[], filter: readonly unknown[]) {
  if (filter.length > queryKey.length) return false;
  return filter.every((seg, i) => JSON.stringify(seg) === JSON.stringify(queryKey[i]));
}

describe("leaveKeys factory", () => {
  it("keeps stats under the shared leave root", () => {
    // finding 6: stats must live in the same ["tenants", tid, "leave"] namespace
    // so mutation invalidation can target it alongside requests/balances.
    expect(leaveKeys.all(TID)).toEqual(["tenants", TID, "leave"]);
    expect(leaveKeys.stats(TID)).toEqual(["tenants", TID, "leave", "stats"]);
    expect(leaveKeys.stats(TID).slice(0, 3)).toEqual(leaveKeys.all(TID));
  });

  it("invalidating stats() prefix-matches every filtered stats query", () => {
    // useLeaveStats builds its key as [...leaveKeys.stats(tid), filters].
    const noFilter = [...leaveKeys.stats(TID), {}];
    const byEmployee = [...leaveKeys.stats(TID), { employeeId: "e1" }];
    const byDept = [...leaveKeys.stats(TID), { departmentId: "d1" }];

    for (const key of [noFilter, byEmployee, byDept]) {
      expect(isPrefixMatch(key, leaveKeys.stats(TID))).toBe(true);
    }
  });

  it("stats sits beside requests/balances, not inside them", () => {
    // A requests/balances invalidation must NOT accidentally cover stats and
    // vice-versa — they are distinct sub-namespaces under all().
    expect(isPrefixMatch(leaveKeys.stats(TID), leaveKeys.requests(TID))).toBe(false);
    expect(isPrefixMatch(leaveKeys.stats(TID), leaveKeys.balances(TID))).toBe(false);
  });
});
