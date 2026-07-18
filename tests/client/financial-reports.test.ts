/**
 * Money -> ledger -> financial-report cross-check.
 *
 * The reports (income statement, balance sheet) are what a business actually
 * reads, and they derive from the posted ledger. These tests verify:
 *  - the invoice journal builds balanced to the right accounts;
 *  - the report derivations apply the right sign conventions and totals;
 *  - the master invariant — across a mix of real posted journals (payroll +
 *    invoice + a bill), total debits equal total credits, and the balance
 *    sheet balances (assets = liabilities + equity).
 */
import { describe, expect, it } from "vitest";
import {
  buildBillPaymentJournalLines,
  buildInvoiceJournalLines,
  buildPayrollJournalLines,
  deriveBalanceSheet,
  deriveIncomeStatement,
  type ReportAccount,
} from "@/lib/accounting/calculations";
import { sumMoney, subtractMoney } from "@/lib/currency";

type Line = { accountCode: string; debit: number; credit: number };

// A minimal test chart covering every account the scenarios touch.
const CHART: ReportAccount[] = [
  { code: "1120", name: "Cash in Bank", type: "asset" },
  { code: "1210", name: "Trade Receivables", type: "asset" },
  { code: "2110", name: "Trade Payables", type: "liability" },
  { code: "2210", name: "Net Salaries Payable", type: "liability" },
  { code: "2220", name: "WIT Payable", type: "liability" },
  { code: "2230", name: "INSS Employee Payable", type: "liability" },
  { code: "2240", name: "INSS Employer Payable", type: "liability" },
  { code: "2310", name: "Sales Tax Payable", type: "liability" },
  { code: "3100", name: "Owner Capital", type: "equity" },
  { code: "4100", name: "Service Revenue", type: "revenue" },
  { code: "5110", name: "Salaries Expense", type: "expense" },
  { code: "5150", name: "Employer INSS Expense", type: "expense" },
  { code: "5200", name: "Rent Expense", type: "expense" },
];

const resolve = (code: string) => ({ id: `acct-${code}`, name: `Account ${code}` });

/** net = debits − credits per account code, the shape the reports read. */
function netByCode(lines: Line[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of lines) {
    map.set(l.accountCode, subtractMoney((map.get(l.accountCode) ?? 0) + l.debit, l.credit));
  }
  return map;
}
const netOf = (m: Map<string, number>) => (a: ReportAccount) => m.get(a.code) ?? 0;

describe("invoice journal builder", () => {
  it("balances: debit AR total, credit revenue + VAT", () => {
    const { lines, totalDebit, totalCredit } = buildInvoiceJournalLines(
      { invoiceNumber: "INV-1", total: 110, taxAmount: 10 },
      resolve,
      { receivable: "1210", revenue: "4100", tax: "2310" },
    );
    expect(lines.find((l) => l.accountCode === "1210")?.debit).toBe(110);
    expect(lines.find((l) => l.accountCode === "4100")?.credit).toBe(100);
    expect(lines.find((l) => l.accountCode === "2310")?.credit).toBe(10);
    expect(totalDebit).toBe(110);
    expect(totalCredit).toBe(110);
  });

  it("omits the VAT line when there is no tax", () => {
    const { lines, totalDebit, totalCredit } = buildInvoiceJournalLines(
      { invoiceNumber: "INV-2", total: 250, taxAmount: 0 },
      resolve,
      { receivable: "1210", revenue: "4100", tax: "2310" },
    );
    expect(lines.some((l) => l.accountCode === "2310")).toBe(false);
    expect(lines.find((l) => l.accountCode === "4100")?.credit).toBe(250);
    expect(totalDebit).toBe(totalCredit);
  });
});

describe("bill payment journal builder (the supplier-withholding split)", () => {
  const codes = { payable: "2110", cashOnHand: "1110", bank: "1120", withholding: "2320" };

  it("no withholding: clears AP in full against cash, and balances", () => {
    const { lines, totalDebit, totalCredit } = buildBillPaymentJournalLines(
      { amount: 500, method: "bank_transfer", vendorName: "Vendor", billId: "bill-1" },
      resolve,
      codes,
    );
    expect(lines.find((l) => l.accountCode === "2110")?.debit).toBe(500); // AP cleared
    expect(lines.find((l) => l.accountCode === "1120")?.credit).toBe(500); // paid from bank
    expect(lines.some((l) => l.accountCode === "2320")).toBe(false); // no WHT line
    expect(totalDebit).toBe(500);
    expect(totalCredit).toBe(500);
  });

  it("with withholding: AP debit splits into cash paid + tax withheld, and balances", () => {
    // Gross $1000: supplier receives $960, $40 (4%) withheld and owed to the state.
    const { lines, totalDebit, totalCredit } = buildBillPaymentJournalLines(
      { amount: 1000, cashPaid: 960, withholdingTax: 40, method: "bank_transfer", vendorName: "Supplier Lda", billId: "bill-2" },
      resolve,
      codes,
    );
    expect(lines.find((l) => l.accountCode === "2110")?.debit).toBe(1000); // full AP cleared
    expect(lines.find((l) => l.accountCode === "1120")?.credit).toBe(960); // supplier gets net
    expect(lines.find((l) => l.accountCode === "2320")?.credit).toBe(40); // WHT payable to state
    expect(totalDebit).toBe(1000);
    expect(totalCredit).toBe(1000); // 960 + 40 — the split balances the AP cleared
  });

  it("routes cash payments to cash-on-hand, not the bank account", () => {
    const { lines } = buildBillPaymentJournalLines(
      { amount: 100, method: "cash", vendorName: "V", billId: "bill-3" },
      resolve,
      codes,
    );
    expect(lines.some((l) => l.accountCode === "1110")).toBe(true); // cash on hand
    expect(lines.some((l) => l.accountCode === "1120")).toBe(false);
  });
});

describe("report derivations — sign conventions", () => {
  it("income statement shows revenue positive and nets against expenses", () => {
    // Revenue account net is credit-normal (negative); expense debit-normal.
    const balances = new Map<string, number>([
      ["4100", -1000], // $1000 revenue
      ["5110", 700], // $700 expense
    ]);
    const is = deriveIncomeStatement(CHART, netOf(balances));
    expect(is.totalRevenue).toBe(1000);
    expect(is.totalExpenses).toBe(700);
    expect(is.netIncome).toBe(300);
  });

  it("balance sheet folds revenue/expense into accumulated earnings and balances", () => {
    // Cash 1300 (asset debit), owner capital 1000 (equity credit),
    // revenue 500, expense 200 -> earnings 300; 1000 + 300 = 1300 = assets.
    const balances = new Map<string, number>([
      ["1120", 1300],
      ["3100", -1000],
      ["4100", -500],
      ["5200", 200],
    ]);
    const bs = deriveBalanceSheet(CHART, netOf(balances));
    expect(bs.totalAssets).toBe(1300);
    expect(bs.totalLiabilities).toBe(0);
    expect(bs.totalEquity).toBe(1300); // 1000 capital + 300 earnings
    expect(bs.equityItems.some((r) => r.accountName === "Accumulated Earnings" && r.amount === 300)).toBe(true);
    expect(bs.isBalanced).toBe(true);
  });
});

describe("master invariant — a mixed month across payroll, invoice, and a bill", () => {
  it("keeps the whole ledger balanced and the balance sheet balancing", () => {
    // 1) Payroll: 1 employee, gross 1000, employer INSS 60, WIT 55,
    //    employee INSS 40, net 905. (Real product builder.)
    const payroll = buildPayrollJournalLines(
      {
        totalGrossPay: 1000,
        totalINSSEmployer: 60,
        totalIncomeTax: 55,
        totalINSSEmployee: 40,
        totalNetPay: 905,
      },
      resolve,
    ).lines;

    // 2) Invoice: $220 with $20 VAT. (Real product builder.)
    const invoice = buildInvoiceJournalLines(
      { invoiceNumber: "INV-1", total: 220, taxAmount: 20 },
      resolve,
      { receivable: "1210", revenue: "4100", tax: "2310" },
    ).lines;

    // 3) A rent bill: debit rent expense, credit trade payables (representative
    //    balanced entry — the money builders funnel through the same guard).
    const bill: Line[] = [
      { accountCode: "5200", debit: 300, credit: 0 },
      { accountCode: "2110", debit: 0, credit: 300 },
    ];

    const allLines: Line[] = [...payroll, ...invoice, ...bill];

    // MASTER INVARIANT: the whole ledger balances.
    const totalDebit = sumMoney(allLines.map((l) => l.debit));
    const totalCredit = sumMoney(allLines.map((l) => l.credit));
    expect(totalDebit).toBe(totalCredit);
    // Debits: wages 1000 + employer INSS 60 + AR 220 + rent 300.
    expect(totalDebit).toBe(1580);

    const balances = netByCode(allLines);

    // Income statement: revenue $200 (invoice net), expenses $1360
    // (wages 1000 + employer INSS 60 + rent 300).
    const is = deriveIncomeStatement(CHART, netOf(balances));
    expect(is.totalRevenue).toBe(200);
    expect(is.totalExpenses).toBe(1360);
    expect(is.netIncome).toBe(-1160); // a loss this month

    // Balance sheet must balance: assets (AR 220) = liabilities + equity,
    // where equity is the accumulated (negative) earnings.
    const bs = deriveBalanceSheet(CHART, netOf(balances));
    expect(bs.totalAssets).toBe(220); // trade receivables from the invoice
    // Liabilities: AP 300 + net 905 + WIT 55 + empINSS 40 + employerINSS 60 + VAT 20
    expect(bs.totalLiabilities).toBe(1380);
    expect(bs.equityItems.some((r) => r.accountName === "Accumulated Earnings" && r.amount === -1160)).toBe(true);
    expect(bs.isBalanced).toBe(true); // 220 === 1380 + (-1160)
    expect(subtractMoney(bs.totalAssets, bs.totalLiabilities + bs.totalEquity)).toBe(0);
  });
});
