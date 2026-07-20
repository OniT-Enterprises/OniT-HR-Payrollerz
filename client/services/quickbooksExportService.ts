/**
 * QuickBooks Export Service
 * Generates CSV and IIF files for importing payroll journal entries into QuickBooks
 */

import { paths } from "@/lib/paths";

/**
 * Firebase is loaded lazily by the three Firestore-touching functions below
 * (settings get/save + export log). Everything else in this module — the
 * journal builder, mappings, CSV/IIF generators — is pure, so unit tests can
 * import it without Firebase env config, and the page bundle doesn't pull
 * Firestore in until an export actually happens.
 */
async function firestore() {
  const [fs, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("@/lib/firebase"),
  ]);
  return { ...fs, db };
}
import type { PayrollRun, PayrollRecord } from "@/types/payroll";
import type { TLPayrollRun, TLPayrollRecord } from "@/types/payroll-tl";
import type {
  QBAccountMapping,
  QBExportSettings,
  QBJournalLine,
  QBJournalEntry,
  QBExportLog,
  QBExportOptions,
} from "@/types/quickbooks";
import {
  addMoney,
  roundMoney,
  sumMoney,
  multiplyMoneyByFactors,
  subtractMoney,
  maxMoney,
} from "@/lib/currency";

// ============================================
// JOURNAL ENTRY BUILDER
// ============================================

interface PayrollTotals {
  grossPay: number;
  baseSalary: number;
  overtime: number;
  allowances: number; // All cash earnings that are not base or overtime
  wit: number; // Income tax (WIT 10%)
  inssEmployee: number; // INSS 4%
  inssEmployer: number; // INSS 6%
  otherDeductions: number; // Loan/advance repayments, court orders, benefits, etc.
  netPay: number;
  employeeCount: number;
  byDepartment?: Map<string, PayrollTotals>;
}

/**
 * Aggregate totals from payroll records
 */
function aggregatePayrollTotals(
  records: (PayrollRecord | TLPayrollRecord)[],
  groupByDepartment: boolean = false,
): PayrollTotals {
  const totals: PayrollTotals = {
    grossPay: 0,
    baseSalary: 0,
    overtime: 0,
    allowances: 0,
    wit: 0,
    inssEmployee: 0,
    inssEmployer: 0,
    otherDeductions: 0,
    netPay: 0,
    employeeCount: records.length,
    byDepartment: groupByDepartment ? new Map() : undefined,
  };

  for (const record of records) {
    // Discriminate generic PayrollRecord from TL-specific TLPayrollRecord by a
    // field UNIQUE to the generic shape. `incomeTax` was added to the generic
    // record for the statutory filing generators, so "incomeTax" in record is
    // true for BOTH shapes now — using it routed every wizard-produced (generic)
    // record down the TL branch, which reads record.grossPay/monthlySalary
    // (absent on generic → undefined) and dropped the entire wage-expense debit.
    // totalGrossPay exists only on the generic record; grossPay only on TL.
    const isTLRecord = !("totalGrossPay" in record);

    // Gross pay (contractual, before unpaid-absence/late reductions).
    const grossPay = isTLRecord
      ? (record as TLPayrollRecord).grossPay
      : (record as PayrollRecord).totalGrossPay;

    // The wage EXPENSE is the wages actually earned this period — gross less any
    // unpaid-absence/late reduction (`wagesPaid`). Booking the full contractual
    // gross instead overstates the expense and shunts the reduction into the
    // "other deductions" residual, which gets credited to 2260 as a payable owed
    // to no one. Legacy records that don't track wagesPaid derive it the same
    // way client/lib/payroll/accounting-summary.ts does — gross less the
    // absence/late_arrival deduction lines — so their exports can't re-create
    // that phantom payable either.
    const recordWagesPaid = (record as { wagesPaid?: number }).wagesPaid;
    const attendanceReductions = sumMoney(
      (
        (record as { deductions?: { type?: string; amount?: number }[] })
          .deductions || []
      )
        .filter((d) => d.type === "absence" || d.type === "late_arrival")
        .map((d) => d.amount || 0),
    );
    const wageBase =
      typeof recordWagesPaid === "number"
        ? recordWagesPaid
        : maxMoney(0, subtractMoney(grossPay || 0, attendanceReductions));
    totals.grossPay = addMoney(totals.grossPay, wageBase);

    // Split the wage base across base salary, overtime, and everything else so
    // the wage-expense debit reconciles, no matter which earning types a record
    // carries (allowances, bonus, subsidio anual, night/holiday/rest premiums,
    // service compensation, per diem, transport/food, ...). Whatever isn't plain
    // regular or overtime pay falls into the allowances / other-earnings bucket,
    // so base + overtime + allowances always equals the wage base.
    let baseSalary: number;
    let overtime: number;
    if (isTLRecord) {
      const tlRecord = record as TLPayrollRecord;
      baseSalary = tlRecord.monthlySalary || 0;
      overtime = multiplyMoneyByFactors(
        tlRecord.hourlyRate || 0,
        tlRecord.overtimeHours || 0,
        1.5,
      );
    } else {
      const genRecord = record as PayrollRecord;
      baseSalary =
        genRecord.earnings?.find((e) => e.type === "regular")?.amount || 0;
      overtime =
        genRecord.earnings?.find((e) => e.type === "overtime")?.amount || 0;
    }
    // Keep the split within the wage base so no component goes negative and the
    // three always sum to it (the raw base/overtime can exceed it when a monthly
    // salary is reduced by unpaid absence).
    baseSalary = maxMoney(0, Math.min(baseSalary, wageBase));
    overtime = maxMoney(
      0,
      Math.min(overtime, subtractMoney(wageBase, baseSalary)),
    );
    const allowances = subtractMoney(wageBase, baseSalary, overtime);
    totals.baseSalary = addMoney(totals.baseSalary, baseSalary);
    totals.overtime = addMoney(totals.overtime, overtime);
    totals.allowances = addMoney(totals.allowances, allowances);

    // Tax deductions (map generic federal tax -> WIT, social security -> INSS)
    let wit: number;
    let inssEmployee: number;
    let inssEmployer: number;
    if (isTLRecord) {
      const tlRecord = record as TLPayrollRecord;
      wit = tlRecord.incomeTax || 0;
      inssEmployee = tlRecord.inssEmployee || 0;
      inssEmployer = tlRecord.inssEmployer || 0;
    } else {
      const genRecord = record as PayrollRecord;
      wit =
        genRecord.deductions?.find((d) => d.type === "income_tax")?.amount || 0;
      inssEmployee =
        genRecord.deductions?.find((d) => d.type === "inss_employee")?.amount ||
        0;
      inssEmployer =
        genRecord.employerTaxes?.find((t) => t.type === "inss_employer")
          ?.amount || 0;
    }
    totals.wit = addMoney(totals.wit, wit);
    totals.inssEmployee = addMoney(totals.inssEmployee, inssEmployee);
    totals.inssEmployer = addMoney(totals.inssEmployer, inssEmployer);

    // Net pay
    const netPay = isTLRecord
      ? (record as TLPayrollRecord).netPay
      : (record as PayrollRecord).netPay;
    totals.netPay = addMoney(totals.netPay, netPay);

    // Every remaining reduction to take-home pay (loan/advance repayments, court
    // orders, benefit contributions, etc.) must still be credited or the journal
    // will not balance. Derive it from the WAGE BASE (not contractual gross) so
    // an unpaid-absence reduction does NOT masquerade as a deduction payable:
    //   net + WIT + employee INSS + other == wages actually paid.
    const otherDeductions = maxMoney(
      0,
      subtractMoney(wageBase, netPay, wit, inssEmployee),
    );
    totals.otherDeductions = addMoney(totals.otherDeductions, otherDeductions);

    // Department grouping
    if (groupByDepartment && totals.byDepartment) {
      const dept = record.department || "Unknown";
      if (!totals.byDepartment.has(dept)) {
        totals.byDepartment.set(dept, {
          grossPay: 0,
          baseSalary: 0,
          overtime: 0,
          allowances: 0,
          wit: 0,
          inssEmployee: 0,
          inssEmployer: 0,
          otherDeductions: 0,
          netPay: 0,
          employeeCount: 0,
        });
      }
      const deptTotals = totals.byDepartment.get(dept)!;
      deptTotals.grossPay = addMoney(deptTotals.grossPay, wageBase);
      deptTotals.netPay = addMoney(deptTotals.netPay, netPay);
      deptTotals.employeeCount += 1;
      // Add other fields as needed
    }
  }

  return totals;
}

/**
 * Build journal entry lines from payroll totals
 */
function buildJournalLines(
  totals: PayrollTotals,
  mappings: QBAccountMapping[],
  _includeEmployeeDetail: boolean = false,
): QBJournalLine[] {
  const lines: QBJournalLine[] = [];

  const getAccountName = (code: string): string => {
    const mapping = mappings.find((m) => m.onitAccountCode === code);
    return mapping?.qbAccountName || mapping?.onitAccountName || code;
  };

  // DEBITS (Expenses)

  // Base salary expense
  if (totals.baseSalary > 0) {
    lines.push({
      accountCode: "5110",
      accountName: getAccountName("5110"),
      debit: roundMoney(totals.baseSalary),
      credit: 0,
      memo: "Base salaries",
      className: "Payroll",
    });
  }

  // Overtime expense
  if (totals.overtime > 0) {
    lines.push({
      accountCode: "5120",
      accountName: getAccountName("5120"),
      debit: roundMoney(totals.overtime),
      credit: 0,
      memo: "Overtime pay (150%)",
      className: "Payroll",
    });
  }

  // Allowances / other earnings expense (bonus, subsidio anual, night/holiday/
  // rest premiums, service compensation, per diem, transport/food, ...)
  if (totals.allowances > 0) {
    lines.push({
      accountCode: "5160",
      accountName: getAccountName("5160"),
      debit: roundMoney(totals.allowances),
      credit: 0,
      memo: "Allowances and other earnings",
      className: "Payroll",
    });
  }

  // INSS Employer expense (6%)
  if (totals.inssEmployer > 0) {
    lines.push({
      accountCode: "5150",
      accountName: getAccountName("5150"),
      debit: roundMoney(totals.inssEmployer),
      credit: 0,
      memo: "INSS employer contribution (6%)",
      className: "Payroll",
    });
  }

  // CREDITS (Liabilities)

  // WIT Payable (10% income tax)
  if (totals.wit > 0) {
    lines.push({
      accountCode: "2220",
      accountName: getAccountName("2220"),
      debit: 0,
      credit: roundMoney(totals.wit),
      memo: "WIT withholding (10%)",
      className: "Payroll",
    });
  }

  // INSS Employee Payable (4%)
  if (totals.inssEmployee > 0) {
    lines.push({
      accountCode: "2230",
      accountName: getAccountName("2230"),
      debit: 0,
      credit: roundMoney(totals.inssEmployee),
      memo: "INSS employee (4%)",
      className: "Payroll",
    });
  }

  // INSS Employer Payable (6%)
  if (totals.inssEmployer > 0) {
    lines.push({
      accountCode: "2240",
      accountName: getAccountName("2240"),
      debit: 0,
      credit: roundMoney(totals.inssEmployer),
      memo: "INSS employer (6%)",
      className: "Payroll",
    });
  }

  // Other Payroll Deductions Payable (loan/advance repayments, court orders,
  // benefit contributions, etc.) — required for the entry to balance whenever a
  // record withholds anything beyond WIT and employee INSS.
  if (totals.otherDeductions > 0) {
    lines.push({
      accountCode: "2260",
      accountName: getAccountName("2260"),
      debit: 0,
      credit: roundMoney(totals.otherDeductions),
      memo: "Other payroll deductions",
      className: "Payroll",
    });
  }

  // Net Payroll Payable (wages payable)
  if (totals.netPay > 0) {
    lines.push({
      accountCode: "2210",
      accountName: getAccountName("2210"),
      debit: 0,
      credit: roundMoney(totals.netPay),
      memo: `Net pay (${totals.employeeCount} employees)`,
      className: "Payroll",
    });
  }

  return lines;
}

/**
 * Build a complete journal entry for a payroll run
 */
export function buildJournalEntry(
  payrollRun: PayrollRun | TLPayrollRun,
  records: (PayrollRecord | TLPayrollRecord)[],
  mappings: QBAccountMapping[],
  options: QBExportOptions,
): QBJournalEntry {
  const totals = aggregatePayrollTotals(records, options.groupByDepartment);
  const lines = buildJournalLines(
    totals,
    mappings,
    options.includeEmployeeDetail,
  );

  // Calculate totals
  const totalDebits = sumMoney(lines.map((l) => l.debit));
  const totalCredits = sumMoney(lines.map((l) => l.credit));

  // Format reference number
  const payDate = new Date(payrollRun.payDate);
  const refNumber = `PAY-${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, "0")}`;

  // Format period name
  const periodName = formatPeriodName(
    payrollRun.periodStart,
    payrollRun.periodEnd,
  );

  return {
    refNumber,
    txnDate: payrollRun.payDate,
    memo: `${periodName} Payroll - ${totals.employeeCount} employees`,
    lines,
    totalDebits: roundMoney(totalDebits),
    totalCredits: roundMoney(totalCredits),
  };
}

// ============================================
// CSV EXPORT
// ============================================

/**
 * Generate CSV content for QuickBooks Online import
 * Compatible with Transaction Pro Importer
 */
function generateCSV(journalEntry: QBJournalEntry): string {
  const headers = [
    "RefNumber",
    "TxnDate",
    "Account",
    "Debit",
    "Credit",
    "Memo",
    "Name",
    "Class",
  ];
  const rows: string[][] = [headers];

  // Format date as MM/DD/YYYY for QuickBooks
  const txnDate = formatDateForQB(journalEntry.txnDate);

  for (const line of journalEntry.lines) {
    rows.push([
      journalEntry.refNumber,
      txnDate,
      escapeCSV(line.accountName),
      line.debit > 0 ? line.debit.toFixed(2) : "",
      line.credit > 0 ? line.credit.toFixed(2) : "",
      escapeCSV(line.memo),
      escapeCSV(line.name || ""),
      escapeCSV(line.className || "Payroll"),
    ]);
  }

  return rows.map((row) => row.join(",")).join("\n");
}

// ============================================
// IIF EXPORT (QuickBooks Desktop)
// ============================================

/**
 * Generate IIF content for QuickBooks Desktop import
 */
function generateIIF(journalEntry: QBJournalEntry): string {
  const lines: string[] = [];

  // IIF header
  lines.push(
    "!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO",
  );
  lines.push(
    "!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO",
  );
  lines.push("!ENDTRNS");

  const txnDate = formatDateForQB(journalEntry.txnDate);

  // First entry is TRNS
  const firstDebit = journalEntry.lines.find((l) => l.debit > 0);
  if (firstDebit) {
    lines.push(
      [
        "TRNS",
        "",
        "GENERAL JOURNAL",
        txnDate,
        firstDebit.accountName,
        "",
        "Payroll",
        firstDebit.debit.toFixed(2),
        journalEntry.refNumber,
        journalEntry.memo,
      ].join("\t"),
    );
  }

  // Split lines (SPL)
  for (const line of journalEntry.lines) {
    if (line === firstDebit) continue;

    const amount = line.debit > 0 ? line.debit : -line.credit;
    lines.push(
      [
        "SPL",
        "",
        "GENERAL JOURNAL",
        txnDate,
        line.accountName,
        "",
        "Payroll",
        amount.toFixed(2),
        journalEntry.refNumber,
        line.memo,
      ].join("\t"),
    );
  }

  lines.push("ENDTRNS");

  return lines.join("\n");
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

/**
 * Default export settings (used when no doc is saved yet, and to
 * backfill fields missing from older saved docs).
 */
function defaultExportSettings(): QBExportSettings {
  return {
    defaultFormat: "csv",
    includeEmployeeDetail: false,
    groupByDepartment: false,
    accountMappings: getDefaultMappings(),
  };
}

/**
 * Get QuickBooks export settings (tenant-scoped).
 *
 * Always resolves to a well-formed shape: `defaultFormat` is a valid
 * 'csv' | 'iif' and `accountMappings` is non-empty (falling back to the
 * defaults for anything a legacy/partial doc is missing). The export
 * dialog and `exportPayrollToQuickBooks` both rely on this. No caching —
 * every call reads Firestore.
 */
export async function getExportSettingsForTenant(
  tenantId: string,
): Promise<QBExportSettings> {
  try {
    const { db, doc, getDoc } = await firestore();
    const docRef = doc(db, paths.quickbooksExportSettings(tenantId));
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const saved = docSnap.data() as Partial<QBExportSettings>;
      const defaults = defaultExportSettings();
      return {
        ...defaults,
        ...saved,
        defaultFormat: saved.defaultFormat === "iif" ? "iif" : "csv",
        accountMappings:
          Array.isArray(saved.accountMappings) &&
          saved.accountMappings.length > 0
            ? saved.accountMappings
            : defaults.accountMappings,
      };
    }
  } catch (error) {
    console.error("Error loading QB export settings:", error);
    throw error;
  }

  // Return defaults
  return defaultExportSettings();
}

/**
 * Save QuickBooks export settings
 */
export async function saveExportSettingsForTenant(
  tenantId: string,
  settings: QBExportSettings,
): Promise<void> {
  const { db, doc, setDoc, serverTimestamp } = await firestore();
  const docRef = doc(db, paths.quickbooksExportSettings(tenantId));
  await setDoc(docRef, {
    ...settings,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get default account mappings
 */
export function getDefaultMappings(): QBAccountMapping[] {
  return [
    // Expenses
    {
      onitAccountCode: "5110",
      onitAccountName: "Salaries and Wages",
      qbAccountName: "Payroll Expenses",
      accountType: "expense",
      isDefault: true,
    },
    {
      onitAccountCode: "5150",
      onitAccountName: "INSS Employer Contribution",
      qbAccountName: "Payroll Expenses:INSS Employer",
      accountType: "expense",
      isDefault: true,
    },
    {
      onitAccountCode: "5120",
      onitAccountName: "Overtime Expense",
      qbAccountName: "Payroll Expenses:Overtime",
      accountType: "expense",
      isDefault: true,
    },
    {
      onitAccountCode: "5140",
      onitAccountName: "Subsidio Anual Expense",
      qbAccountName: "Payroll Expenses:13th Month",
      accountType: "expense",
      isDefault: true,
    },
    {
      onitAccountCode: "5160",
      onitAccountName: "Employee Benefits",
      qbAccountName: "Payroll Expenses:Allowances",
      accountType: "expense",
      isDefault: true,
    },
    // Liabilities
    {
      onitAccountCode: "2220",
      onitAccountName: "Withholding Income Tax (WIT)",
      qbAccountName: "Payroll Liabilities:WIT Payable",
      accountType: "liability",
      isDefault: true,
    },
    {
      onitAccountCode: "2230",
      onitAccountName: "INSS Payable - Employee",
      qbAccountName: "Payroll Liabilities:INSS Employee",
      accountType: "liability",
      isDefault: true,
    },
    {
      onitAccountCode: "2240",
      onitAccountName: "INSS Payable - Employer",
      qbAccountName: "Payroll Liabilities:INSS Employer",
      accountType: "liability",
      isDefault: true,
    },
    {
      onitAccountCode: "2210",
      onitAccountName: "Salaries Payable",
      qbAccountName: "Payroll Liabilities:Wages Payable",
      accountType: "liability",
      isDefault: true,
    },
    {
      onitAccountCode: "2250",
      onitAccountName: "Subsidio Anual Accrued",
      qbAccountName: "Payroll Liabilities:13th Month Accrual",
      accountType: "liability",
      isDefault: true,
    },
    {
      onitAccountCode: "2260",
      onitAccountName: "Other Payroll Deductions Payable",
      qbAccountName: "Payroll Liabilities:Other Deductions",
      accountType: "liability",
      isDefault: true,
    },
    // Assets
    {
      onitAccountCode: "1130",
      onitAccountName: "Cash in Bank - Payroll",
      qbAccountName: "Checking",
      accountType: "asset",
      isDefault: true,
    },
  ];
}

// ============================================
// EXPORT LOG
// ============================================

/**
 * Log an export for audit trail
 */
async function logExport(
  log: Omit<QBExportLog, "id" | "createdAt">,
): Promise<string> {
  if (!log.tenantId) {
    throw new Error("Missing tenantId for QB export log");
  }

  const { db, addDoc, collection, serverTimestamp } = await firestore();
  const docRef = await addDoc(
    collection(db, paths.qbExportLogs(log.tenantId)),
    {
      ...log,
      createdAt: serverTimestamp(),
    },
  );
  return docRef.id;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// roundMoney imported from @/lib/currency

function formatDateForQB(dateStr: string): string {
  // Convert YYYY-MM-DD to MM/DD/YYYY
  const [year, month, day] = dateStr.split("-");
  return `${month}/${day}/${year}`;
}

function formatPeriodName(periodStart: string, periodEnd: string): string {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // If same month, just show "January 2026"
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
  }

  // Different months: "Jan 15 - Feb 14, 2026"
  return `${monthNames[start.getMonth()].slice(0, 3)} ${start.getDate()} - ${monthNames[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
}

function escapeCSV(value: string): string {
  if (!value) return "";
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

interface ExportResult {
  content: string;
  fileName: string;
  mimeType: string;
  journalEntry: QBJournalEntry;
}

/**
 * Generate export file for a payroll run
 */
export async function exportPayrollToQuickBooks(
  tenantId: string,
  payrollRun: PayrollRun | TLPayrollRun,
  records: (PayrollRecord | TLPayrollRecord)[],
  options: QBExportOptions,
  exportedBy: string,
): Promise<ExportResult> {
  // Get account mappings
  const settings = await getExportSettingsForTenant(tenantId);
  const mappings =
    options.useCustomMappings && options.customMappings
      ? options.customMappings
      : settings.accountMappings;

  // Build journal entry
  const journalEntry = buildJournalEntry(
    payrollRun,
    records,
    mappings,
    options,
  );

  // Generate file content
  let content: string;
  let extension: string;
  let mimeType: string;

  if (options.format === "iif") {
    content = generateIIF(journalEntry);
    extension = "iif";
    mimeType = "text/plain";
  } else {
    content = generateCSV(journalEntry);
    extension = "csv";
    mimeType = "text/csv";
  }

  // Generate filename
  const payDate = new Date(payrollRun.payDate);
  const fileName = `Xefe_Payroll_${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, "0")}.${extension}`;

  // Log the export
  await logExport({
    tenantId,
    payrollRunId: payrollRun.id || "",
    payrollPeriod: formatPeriodName(
      payrollRun.periodStart,
      payrollRun.periodEnd,
    ),
    payDate: payrollRun.payDate,
    exportDate: new Date().toISOString(),
    exportedBy,
    format: options.format,
    fileName,
    recordCount: records.length,
    totalDebits: journalEntry.totalDebits,
    totalCredits: journalEntry.totalCredits,
  });

  return {
    content,
    fileName,
    mimeType,
    journalEntry,
  };
}

/**
 * Trigger file download in browser
 */
export function downloadFile(
  content: string,
  fileName: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
