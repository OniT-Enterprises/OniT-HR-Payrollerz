/**
 * ATTL Excel Export Utility
 *
 * Generates filled Excel templates matching the official ATTL
 * Consolidated Monthly Taxes Form format.
 *
 * Based on: https://attl.gov.tl/wp-content/uploads/2021/03/Form_Pay_eng.xlsx
  *
 * PROVENANCE: section/line numbering follows ONLY the official ATTL
 * "Consolidated Monthly Taxes Form" (attl.gov.tl, Form_Pay_eng.xlsx) — a
 * compliance requirement. Not modeled on any client or firm workbook.
 */

import type ExcelJS from "exceljs";
import type { MonthlyWITReturn } from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";
import { getTodayTL } from "@/lib/dateUtils";
import { calculateTLServicesTax } from "@/lib/tax/services-tax-tl";
import { addMoney, roundWholeMoney } from "@/lib/currency";

// ============================================
// TYPES
// ============================================

export interface ATTLWithholdingLine {
  payment: number;
  tax: number;
  /** Actual frozen rate, including a documented treaty override. */
  rateLabel?: string;
}

export interface ATTLFormData {
  // Header
  month: string; // 01-12
  year: string; // YYYY
  tin: string;
  taxpayerName: string;
  establishmentName?: string;

  // Section 1: Wage Income Tax
  totalGrossWages: number; // Line 5
  totalWITWithheld: number; // Line 10

  // Section 2: Withholding Tax (all optional)
  prizesLotteries?: ATTLWithholdingLine;
  royalties?: ATTLWithholdingLine;
  rentLandBuildings?: ATTLWithholdingLine;
  constructionActivities?: ATTLWithholdingLine;
  constructionConsulting?: ATTLWithholdingLine;
  miningServices?: ATTLWithholdingLine;
  airSeaTransport?: ATTLWithholdingLine;
  nonResidentPayments?: ATTLWithholdingLine;

  // Section 3: Services Tax (optional)
  hotelServices?: number;
  restaurantBarServices?: number;
  telecomServices?: number;

  // Section 4: Annual Income Tax Installment (optional)
  annualTaxInstallment?: number;

  // Declaration
  declarantName?: string;
  declarantPhone?: string;
  declarationDate?: string;
}

// ============================================
// CONSTANTS
// ============================================

// Official BNU account numbers for payment
const BNU_ACCOUNTS = {
  wagesIncomeTax: "286442.10.001",
  withholdingTax: "286830.10.001",
  servicesTax: "286636.10.001",
  incomeTaxInstallment: "286539.10.001",
};

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

/**
 * Generate ATTL Consolidated Monthly Taxes Form as Excel
 */
export async function generateATTLExcel(
  witReturn: MonthlyWITReturn,
  company?: Partial<CompanyDetails>,
  additionalData?: Partial<ATTLFormData>
): Promise<Blob> {
  // Parse period
  const [year, month] = witReturn.reportingPeriod.split("-");

  // Line 5 / Line 10 must equal the TOTAL row of the employee annex in the
  // same workbook, which sums the whole-dollar per-employee rows. ATTL's own
  // assessments work per employee, so summing the rounded rows is both the
  // authority-matching figure and the only one that reconciles internally —
  // rounding the precise totals instead can drift a few dollars from the
  // annex on any real headcount.
  const formGrossWages = witReturn.employees.length
    ? witReturn.employees.reduce(
        (sum, emp) => sum + roundWholeMoney(emp.grossWages),
        0,
      )
    : roundWholeMoney(witReturn.totalGrossWages);
  const formWITWithheld = witReturn.employees.length
    ? witReturn.employees.reduce(
        (sum, emp) => sum + roundWholeMoney(emp.witWithheld),
        0,
      )
    : roundWholeMoney(witReturn.totalWITWithheld);

  // Build form data
  const formData: ATTLFormData = {
    month,
    year,
    tin: company?.tinNumber || witReturn.employerTIN || "",
    taxpayerName: company?.legalName || witReturn.employerName || "",
    establishmentName: company?.tradingName,
    totalGrossWages: formGrossWages,
    totalWITWithheld: formWITWithheld,
    declarantName: additionalData?.declarantName,
    declarantPhone: additionalData?.declarantPhone,
    declarationDate: additionalData?.declarationDate || getTodayTL(),
    ...additionalData,
  };

  // Lazy-load ExcelJS (~750KB) only when generating a report
  const { default: ExcelJSLib } = await import("exceljs");

  // Create workbook
  const wb = new ExcelJSLib.Workbook();

  // Create main form sheet
  createFormSheet(wb, formData);

  // Create employee detail sheet (supplementary)
  createEmployeeDetailSheet(wb, witReturn);

  // Generate binary
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Create the main ATTL form sheet
 */
function createFormSheet(wb: ExcelJS.Workbook, data: ATTLFormData): void {
  const ws = wb.addWorksheet("Monthly Tax Form");

  // Set column widths
  ws.columns = [
    { width: 12 }, // A - Line numbers
    { width: 45 }, // B - Descriptions
    { width: 15 }, // C - Amounts/Payments
    { width: 10 }, // D - Rates
    { width: 15 }, // E - Tax amounts
  ];

  // === HEADER ===
  ws.addRow(["CONSOLIDATED MONTHLY TAXES FORM"]);
  ws.addRow(["REPÚBLICA DEMOCRÁTICA DE TIMOR-LESTE"]);
  ws.addRow(["MINISTÉRIO DAS FINANÇAS"]);
  ws.addRow(["AUTORIDADE TRIBUTÁRIA DE TIMOR-LESTE"]);
  ws.addRow([]);

  // Period info
  ws.addRow(["Month:", data.month, "Year:", data.year]);
  ws.addRow(["TIN:", data.tin]);
  ws.addRow(["Taxpayer Name:", data.taxpayerName]);
  if (data.establishmentName) {
    ws.addRow(["Establishment Name:", data.establishmentName]);
  }
  ws.addRow([]);

  // === SECTION 1: WAGE INCOME TAX ===
  ws.addRow(["SECTION 1: WAGE INCOME TAX"]);
  ws.addRow([]);
  ws.addRow(["Line", "Description", "Amount (USD)"]);
  ws.addRow([5, "Total gross wages paid during the month", data.totalGrossWages]);
  ws.addRow([]);
  ws.addRow([10, "Total Wages Income Tax (withheld during the month)", data.totalWITWithheld]);
  ws.addRow([]);

  // === SECTION 2: WITHHOLDING TAX ===
  ws.addRow(["SECTION 2: WITHHOLDING TAX"]);
  ws.addRow([]);
  ws.addRow(["Line", "Payment Type", "Gross Payment", "Tax Rate", "Tax Withheld"]);

  const withholdingItems = [
    {
      line: "45/50",
      type: "Prizes and Lotteries",
      rate: "10%",
      data: data.prizesLotteries,
    },
    { line: "55/60", type: "Royalties", rate: "10%", data: data.royalties },
    {
      line: "65/70",
      type: "Rent land and buildings",
      rate: "10%",
      data: data.rentLandBuildings,
    },
    {
      line: "75/80",
      type: "Construction and building activities",
      rate: "2%",
      data: data.constructionActivities,
    },
    {
      line: "85/90",
      type: "Construction consulting services",
      rate: "4%",
      data: data.constructionConsulting,
    },
    {
      line: "95/100",
      type: "Mining and mining support services",
      rate: "4.5%",
      data: data.miningServices,
    },
    {
      line: "105/110",
      type: "Transportation - Air and Sea",
      rate: "2.64%",
      data: data.airSeaTransport,
    },
    {
      line: "115/120",
      type: "Non-resident without permanent establishment",
      rate: "10%",
      data: data.nonResidentPayments,
    },
  ];

  let totalWithholdingTax = 0;
  for (const item of withholdingItems) {
    const payment = roundWholeMoney(item.data?.payment ?? 0);
    const tax = roundWholeMoney(item.data?.tax ?? 0);
    totalWithholdingTax = addMoney(totalWithholdingTax, tax);
    ws.addRow([
      item.line,
      item.type,
      payment || "",
      item.data?.rateLabel || item.rate,
      tax || "",
    ]);
  }

  ws.addRow([130, "TOTAL WITHHOLDING TAX", "", "", totalWithholdingTax || ""]);
  ws.addRow([]);

  // === SECTION 3: SERVICES TAX ===
  ws.addRow(["SECTION 3: SERVICES TAX"]);
  ws.addRow([]);
  ws.addRow(["Line", "Service Type", "Total Sales", "Rate", "Tax"]);

  const servicesTax = calculateTLServicesTax({
    hotelServices: data.hotelServices ?? 0,
    restaurantBarServices: data.restaurantBarServices ?? 0,
    telecommunicationsServices: data.telecomServices ?? 0,
  });
  const {
    receipts: {
      hotelServices: hotelSales,
      restaurantBarServices: restaurantSales,
      telecommunicationsServices: telecomSales,
    },
    taxByService,
    totalDesignatedReceipts: totalServiceSales,
    taxDue: servicesTaxPayable,
  } = servicesTax;

  ws.addRow([
    15,
    "Hotel services",
    hotelSales ? roundWholeMoney(hotelSales) : "",
    "5%",
    taxByService.hotelServices ? roundWholeMoney(taxByService.hotelServices) : "",
  ]);
  ws.addRow([
    20,
    "Restaurant and bar services",
    restaurantSales ? roundWholeMoney(restaurantSales) : "",
    "5%",
    taxByService.restaurantBarServices ? roundWholeMoney(taxByService.restaurantBarServices) : "",
  ]);
  ws.addRow([
    30,
    "Telecommunications services",
    telecomSales ? roundWholeMoney(telecomSales) : "",
    "5%",
    taxByService.telecommunicationsServices ? roundWholeMoney(taxByService.telecommunicationsServices) : "",
  ]);
  ws.addRow([35, "Total designated-service receipts", totalServiceSales ? roundWholeMoney(totalServiceSales) : ""]);
  ws.addRow([40, "Services Tax Payable", "", "", servicesTaxPayable ? roundWholeMoney(servicesTaxPayable) : ""]);
  ws.addRow([]);

  // === SECTION 4: ANNUAL INCOME TAX INSTALLMENT ===
  ws.addRow(["SECTION 4: ANNUAL INCOME TAX INSTALLMENT"]);
  ws.addRow([]);
  const installmentPayment = roundWholeMoney(data.annualTaxInstallment ?? 0);
  ws.addRow([20, "Installment Amount (0.5% of turnover)", installmentPayment || ""]);
  ws.addRow([]);

  // === SECTION 5: PAYMENT ADVICE ===
  ws.addRow(["SECTION 5: PAYMENT ADVICE"]);
  ws.addRow([]);
  ws.addRow(["Tax Type", "Amount", "BNU Account"]);
  ws.addRow(["Wages Income Tax (Line 10)", data.totalWITWithheld, BNU_ACCOUNTS.wagesIncomeTax]);
  ws.addRow(["Withholding Tax (Line 130)", totalWithholdingTax || "", BNU_ACCOUNTS.withholdingTax]);
  const wholeServicesTaxPayable = roundWholeMoney(servicesTaxPayable);
  ws.addRow(["Services Tax (Line 40)", wholeServicesTaxPayable || "", BNU_ACCOUNTS.servicesTax]);
  ws.addRow(["Income Tax Installment (Line 20)", installmentPayment || "", BNU_ACCOUNTS.incomeTaxInstallment]);

  const totalPayment = addMoney(
    data.totalWITWithheld || 0,
    totalWithholdingTax,
    wholeServicesTaxPayable,
    installmentPayment
  );
  ws.addRow(["TOTAL TO PAY", totalPayment, ""]);
  ws.addRow([]);

  // === SECTION 6: DECLARATION ===
  ws.addRow(["SECTION 6: DECLARATION"]);
  ws.addRow([]);
  ws.addRow(["I declare that the information provided is true and complete."]);
  ws.addRow([]);
  ws.addRow(["Full Name:", data.declarantName || ""]);
  ws.addRow(["Date:", data.declarationDate || ""]);
  ws.addRow(["Telephone:", data.declarantPhone || ""]);
  ws.addRow(["Signature:", "____________________"]);
}

/**
 * Create supplementary employee detail sheet
 */
function createEmployeeDetailSheet(wb: ExcelJS.Workbook, witReturn: MonthlyWITReturn): void {
  const ws = wb.addWorksheet("Employee Details");

  // Set column widths
  ws.columns = [
    { width: 15 }, // Employee ID
    { width: 25 }, // Full Name
    { width: 15 }, // TIN
    { width: 10 }, // Resident
    { width: 18 }, // Gross Wages
    { width: 18 }, // Taxable Wages
    { width: 18 }, // WIT Withheld
    { width: 12 }, // Effective Rate
  ];

  // Header
  ws.addRow(["EMPLOYEE WAGE INCOME TAX DETAILS"]);
  ws.addRow([`Period: ${witReturn.reportingPeriod}`]);
  ws.addRow([`Employer: ${witReturn.employerName}`]);
  ws.addRow([`TIN: ${witReturn.employerTIN}`]);
  ws.addRow([]);

  // Column headers
  ws.addRow([
    "Employee ID",
    "Full Name",
    "TIN",
    "Resident",
    "Gross Wages (USD)",
    "Taxable Wages (USD)",
    "WIT Withheld (USD)",
    "Effective Rate",
  ]);

  // Employee rows. Total the ROUNDED per-row values (not the rounded sum of the
  // precise values) so the whole-dollar rows always add up to the whole-dollar
  // TOTAL on the page — otherwise cent rounding on each row could leave the
  // column visibly off by a dollar from its own total.
  let rowGross = 0;
  let rowTaxable = 0;
  let rowWit = 0;
  for (const emp of witReturn.employees) {
    const effectiveRate = emp.taxableWages > 0 ? ((emp.witWithheld / emp.taxableWages) * 100).toFixed(1) + "%" : "0%";
    const gross = roundWholeMoney(emp.grossWages);
    const taxable = roundWholeMoney(emp.taxableWages);
    const wit = roundWholeMoney(emp.witWithheld);
    rowGross += gross;
    rowTaxable += taxable;
    rowWit += wit;

    ws.addRow([
      emp.employeeId,
      emp.fullName,
      emp.tinNumber || "",
      emp.isResident ? "Yes" : "No",
      gross,
      taxable,
      wit,
      effectiveRate,
    ]);
  }

  // Totals row — reconciles exactly to the rounded rows above.
  ws.addRow([]);
  ws.addRow([
    "",
    "TOTAL",
    "",
    "",
    rowGross,
    rowTaxable,
    rowWit,
    "",
  ]);

  // Summary
  ws.addRow([]);
  ws.addRow(["Summary:"]);
  ws.addRow(["Total Employees:", witReturn.totalEmployees]);
  ws.addRow(["Resident Employees:", witReturn.totalResidentEmployees]);
  ws.addRow(["Non-Resident Employees:", witReturn.totalNonResidentEmployees]);
}

// ============================================
// DOWNLOAD HELPER
// ============================================

/**
 * Download ATTL form as Excel file
 */
export async function downloadATTLExcel(
  witReturn: MonthlyWITReturn,
  company?: Partial<CompanyDetails>,
  filename?: string,
  additionalData?: Partial<ATTLFormData>,
): Promise<void> {
  const { downloadBlob } = await import("@/lib/downloadBlob");
  const blob = await generateATTLExcel(witReturn, company, additionalData);
  downloadBlob(blob, filename || `ATTL_Monthly_Tax_${witReturn.reportingPeriod}.xlsx`);
}
