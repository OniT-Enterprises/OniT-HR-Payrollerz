import { describe, expect, it } from "vitest";
import {
  buildCashflowData,
  summarizeCashMovements,
} from "@/lib/reports/cashflow";

describe("cash-flow report calculations", () => {
  it("nets cash accounts by journal and excludes internal transfers", () => {
    const summary = summarizeCashMovements(
      [
        {
          journalEntryId: "receipt",
          accountId: "bank",
          accountCode: "1010",
          debit: 100.1,
          credit: 0,
        },
        {
          journalEntryId: "payment",
          accountId: "bank",
          accountCode: "1010",
          debit: 0,
          credit: 40.05,
        },
        {
          journalEntryId: "transfer",
          accountId: "bank",
          accountCode: "1010",
          debit: 10,
          credit: 0,
        },
        {
          journalEntryId: "transfer",
          accountId: "cash",
          accountCode: "1000",
          debit: 0,
          credit: 10,
        },
        {
          journalEntryId: "non-cash",
          accountId: "expense",
          accountCode: "5000",
          debit: 999,
          credit: 0,
        },
      ],
      new Set(["bank", "cash"]),
      new Set(["1010", "1000"]),
    );

    expect(summary).toEqual({ totalInflows: 100.1, totalOutflows: 40.05 });
  });

  it("reconciles opening, movements, classifications and closing cash", () => {
    expect(
      buildCashflowData({
        customerPayments: 80.05,
        vendorPayments: 25.01,
        expenses: 10.02,
        totalInflows: 100.1,
        totalOutflows: 40.05,
        openingBalance: 12.34,
      }),
    ).toEqual({
      customerPayments: 80.05,
      otherInflows: 20.05,
      totalInflows: 100.1,
      vendorPayments: 25.01,
      expenses: 10.02,
      otherOutflows: 5.02,
      totalOutflows: 40.05,
      netCashflow: 60.05,
      openingBalance: 12.34,
      closingBalance: 72.39,
    });
  });
});
