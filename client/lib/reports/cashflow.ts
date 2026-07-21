import { addMoney, subtractMoney } from "@/lib/currency";

export interface CashMovementLine {
  journalEntryId: string;
  accountId: string;
  accountCode: string;
  debit: number;
  credit: number;
}

export interface CashflowData {
  customerPayments: number;
  customerRefunds: number;
  otherInflows: number;
  totalInflows: number;
  vendorPayments: number;
  expenses: number;
  otherOutflows: number;
  totalOutflows: number;
  netCashflow: number;
  openingBalance: number;
  closingBalance: number;
}

/**
 * Net cash lines per journal first, so transfers between two cash accounts do
 * not inflate both inflows and outflows.
 */
export function summarizeCashMovements(
  entries: CashMovementLine[],
  cashAccountIds: Set<string>,
  cashAccountCodes: Set<string>,
): { totalInflows: number; totalOutflows: number } {
  const netByJournal = new Map<string, number>();
  for (const entry of entries) {
    if (
      !cashAccountIds.has(entry.accountId) &&
      !cashAccountCodes.has(entry.accountCode)
    ) {
      continue;
    }
    netByJournal.set(
      entry.journalEntryId,
      addMoney(
        netByJournal.get(entry.journalEntryId) || 0,
        subtractMoney(entry.debit, entry.credit),
      ),
    );
  }

  let totalInflows = 0;
  let totalOutflows = 0;
  for (const netCash of netByJournal.values()) {
    if (netCash > 0) totalInflows = addMoney(totalInflows, netCash);
    if (netCash < 0) {
      totalOutflows = addMoney(totalOutflows, subtractMoney(0, netCash));
    }
  }
  return { totalInflows, totalOutflows };
}

export function buildCashflowData(input: {
  customerPayments: number;
  customerRefunds: number;
  vendorPayments: number;
  expenses: number;
  totalInflows: number;
  totalOutflows: number;
  openingBalance: number;
}): CashflowData {
  const netCashflow = subtractMoney(input.totalInflows, input.totalOutflows);
  return {
    customerPayments: input.customerPayments,
    customerRefunds: input.customerRefunds,
    otherInflows: subtractMoney(input.totalInflows, input.customerPayments),
    totalInflows: input.totalInflows,
    vendorPayments: input.vendorPayments,
    expenses: input.expenses,
    otherOutflows: subtractMoney(
      input.totalOutflows,
      input.customerRefunds,
      input.vendorPayments,
      input.expenses,
    ),
    totalOutflows: input.totalOutflows,
    netCashflow,
    openingBalance: input.openingBalance,
    closingBalance: addMoney(input.openingBalance, netCashflow),
  };
}
