/**
 * ATTL Excel Export Utility
 *
 * Generates filled Excel templates matching the official ATTL
 * Consolidated Monthly Taxes Form format.
 *
 * Based on: https://attl.gov.tl/wp-content/uploads/2021/03/Form_Pay_eng.xlsx
 */

import * as XLSX from "xlsx";
import type { MonthlyWITReturn } from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";

// ============================================
// TYPES
// ============================================

interface ATTLFormData {
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
  prizesLotteries?: { payment: number; tax: number };
  royalties?: { payment: number; tax: number };
  rentLandBuildings?: { payment: number; tax: number };
  constructionActivities?: { payment: number; tax: number };
  constructionConsulting?: { payment: number; tax: number };
  miningServices?: { payment: number; tax: number };
  airSeaTransport?: { payment: number; tax: number };
  nonResidentPayments?: { payment: number; tax: number };

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

const MONTH_NAMES: Record<string, string> = {
  "01": "January",
  "02": "February",
  "03": "March",
  "04": "April",
  "05": "May",
  "06": "June",
  "07": "July",
  "08": "August",
  "09": "September",
  "10": "October",
  "11": "November",
  "12": "December",
};

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
export function generateATTLExcel(
  witReturn: MonthlyWITReturn,
  company?: Partial<CompanyDetails>,
  additionalData?: Partial<ATTLFormData>
): Blob {
  // Parse period
  const [year, month] = witReturn.reportingPeriod.split("-");

  // Build form data
  const formData: ATTLFormData = {
    month,
    year,
    tin: company?.tinNumber || witReturn.employerTIN || "",
    taxpayerName: company?.legalName || witReturn.employerName || "",
    establishmentName: company?.tradingName,
    totalGrossWages: Math.round(witReturn.totalGrossWages), // Whole dollars
    totalWITWithheld: Math.round(witReturn.totalWITWithheld), // Whole dollars
    declarantName: additionalData?.declarantName,
    declarantPhone: additionalData?.declarantPhone,
    declarationDate: additionalData?.declarationDate || new Date().toISOString().split("T")[0],
    ...additionalData,
  };

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create main form sheet
  const formSheet = createFormSheet(formData);
  XLSX.utils.book_append_sheet(wb, formSheet, "Monthly Tax Form");

  // Create employee detail sheet (supplementary)
  const detailSheet = createEmployeeDetailSheet(witReturn);
  XLSX.utils.book_append_sheet(wb, detailSheet, "Employee Details");

  // Generate binary
  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbOut], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Create the main ATTL form sheet
 */
function createFormSheet(data: ATTLFormData): XLSX.WorkSheet {
  // Build the form as an array of arrays (rows)
  const rows: (string | number | null)[][] = [];

  // === HEADER ===
  rows.push(["CONSOLIDATED MONTHLY TAXES FORM"]);
  rows.push(["REPÚBLICA DEMOCRÁTICA DE TIMOR-LESTE"]);
  rows.push(["MINISTÉRIO DAS FINANÇAS"]);
  rows.push(["AUTORIDADE TRIBUTÁRIA DE TIMOR-LESTE"]);
  rows.push([]);

  // Period info
  rows.push(["Month:", data.month, "Year:", data.year]);
  rows.push(["TIN:", data.tin]);
  rows.push(["Taxpayer Name:", data.taxpayerName]);
  if (data.establishmentName) {
    rows.push(["Establishment Name:", data.establishmentName]);
  }
  rows.push([]);

  // === SECTION 1: WAGE INCOME TAX ===
  rows.push(["SECTION 1: WAGE INCOME TAX"]);
  rows.push([]);
  rows.push(["Line", "Description", "Amount (USD)"]);
  rows.push([5, "Total gross wages paid during the month", data.totalGrossWages]);
  rows.push([]);
  rows.push([10, "Total Wages Income Tax (withheld during the month)", data.totalWITWithheld]);
  rows.push([]);

  // === SECTION 2: WITHHOLDING TAX ===
  rows.push(["SECTION 2: WITHHOLDING TAX"]);
  rows.push([]);
  rows.push(["Line", "Payment Type", "Gross Payment", "Tax Rate", "Tax Withheld"]);

  const withholdingItems = [
    { line: "45/50", type: "Prizes and Lotteries", rate: "10%", data: data.prizesLotteries },
    { line: "55/60", type: "Royalties", rate: "10%", data: data.royalties },
    { line: "65/70", type: "Rent land and buildings", rate: "10%", data: data.rentLandBuildings },
    { line: "75/80", type: "Construction and building activities", rate: "2%", data: data.constructionActivities },
    { line: "85/90", type: "Construction consulting services", rate: "4%", data: data.constructionConsulting },
    { line: "95/100", type: "Mining and mining support services", rate: "4%", data: data.miningServices },
    { line: "105/110", type: "Transportation - Air and Sea", rate: "2.64%", data: data.airSeaTransport },
    { line: "115/120", type: "Non-resident without permanent establishment", rate: "10%", data: data.nonResidentPayments },
  ];

  let totalWithholdingTax = 0;
  for (const item of withholdingItems) {
    const payment = item.data?.payment || 0;
    const tax = item.data?.tax || 0;
    totalWithholdingTax += tax;
    rows.push([item.line, item.type, payment || "", item.rate, tax || ""]);
  }

  rows.push([130, "TOTAL WITHHOLDING TAX", "", "", totalWithholdingTax || ""]);
  rows.push([]);

  // === SECTION 3: SERVICES TAX ===
  rows.push(["SECTION 3: SERVICES TAX"]);
  rows.push([]);
  rows.push(["Line", "Service Type", "Total Sales", "Rate", "Tax"]);

  const hotelSales = data.hotelServices || 0;
  const restaurantSales = data.restaurantBarServices || 0;
  const telecomSales = data.telecomServices || 0;
  const totalServiceSales = hotelSales + restaurantSales + telecomSales;
  const servicesTaxPayable = Math.round(totalServiceSales * 0.05);

  rows.push([15, "Hotel services", hotelSales || "", "5%", hotelSales ? Math.round(hotelSales * 0.05) : ""]);
  rows.push([20, "Restaurant and bar services", restaurantSales || "", "5%", restaurantSales ? Math.round(restaurantSales * 0.05) : ""]);
  rows.push([30, "Telecommunications services", telecomSales || "", "5%", telecomSales ? Math.round(telecomSales * 0.05) : ""]);
  rows.push([35, "Total Sales (before tax)", totalServiceSales || ""]);
  rows.push([40, "Services Tax Payable", "", "", servicesTaxPayable || ""]);
  rows.push([]);

  // === SECTION 4: ANNUAL INCOME TAX INSTALLMENT ===
  rows.push(["SECTION 4: ANNUAL INCOME TAX INSTALLMENT"]);
  rows.push([]);
  rows.push([20, "Installment Amount (0.5% of turnover)", data.annualTaxInstallment || ""]);
  rows.push([]);

  // === SECTION 5: PAYMENT ADVICE ===
  rows.push(["SECTION 5: PAYMENT ADVICE"]);
  rows.push([]);
  rows.push(["Tax Type", "Amount", "BNU Account"]);
  rows.push(["Wages Income Tax (Line 10)", data.totalWITWithheld, BNU_ACCOUNTS.wagesIncomeTax]);
  rows.push(["Withholding Tax (Line 130)", totalWithholdingTax || "", BNU_ACCOUNTS.withholdingTax]);
  rows.push(["Services Tax (Line 40)", servicesTaxPayable || "", BNU_ACCOUNTS.servicesTax]);
  rows.push(["Income Tax Installment (Line 20)", data.annualTaxInstallment || "", BNU_ACCOUNTS.incomeTaxInstallment]);

  const totalPayment = (data.totalWITWithheld || 0) + totalWithholdingTax + servicesTaxPayable + (data.annualTaxInstallment || 0);
  rows.push(["TOTAL TO PAY", totalPayment, ""]);
  rows.push([]);

  // === SECTION 6: DECLARATION ===
  rows.push(["SECTION 6: DECLARATION"]);
  rows.push([]);
  rows.push(["I declare that the information provided is true and complete."]);
  rows.push([]);
  rows.push(["Full Name:", data.declarantName || ""]);
  rows.push(["Date:", data.declarationDate || ""]);
  rows.push(["Telephone:", data.declarantPhone || ""]);
  rows.push(["Signature:", "____________________"]);

  // Convert to worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 12 }, // A - Line numbers
    { wch: 45 }, // B - Descriptions
    { wch: 15 }, // C - Amounts/Payments
    { wch: 10 }, // D - Rates
    { wch: 15 }, // E - Tax amounts
  ];

  return ws;
}

/**
 * Create supplementary employee detail sheet
 */
function createEmployeeDetailSheet(witReturn: MonthlyWITReturn): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [];

  // Header
  rows.push(["EMPLOYEE WAGE INCOME TAX DETAILS"]);
  rows.push([`Period: ${witReturn.reportingPeriod}`]);
  rows.push([`Employer: ${witReturn.employerName}`]);
  rows.push([`TIN: ${witReturn.employerTIN}`]);
  rows.push([]);

  // Column headers
  rows.push([
    "Employee ID",
    "Full Name",
    "TIN",
    "Resident",
    "Gross Wages (USD)",
    "Taxable Wages (USD)",
    "WIT Withheld (USD)",
    "Effective Rate",
  ]);

  // Employee rows
  for (const emp of witReturn.employees) {
    const effectiveRate = emp.taxableWages > 0
      ? ((emp.witWithheld / emp.taxableWages) * 100).toFixed(1) + "%"
      : "0%";

    rows.push([
      emp.employeeId,
      emp.fullName,
      emp.tinNumber || "",
      emp.isResident ? "Yes" : "No",
      Math.round(emp.grossWages),
      Math.round(emp.taxableWages),
      Math.round(emp.witWithheld),
      effectiveRate,
    ]);
  }

  // Totals row
  rows.push([]);
  rows.push([
    "",
    "TOTAL",
    "",
    "",
    Math.round(witReturn.totalGrossWages),
    Math.round(witReturn.totalTaxableWages),
    Math.round(witReturn.totalWITWithheld),
    "",
  ]);

  // Summary
  rows.push([]);
  rows.push(["Summary:"]);
  rows.push(["Total Employees:", witReturn.totalEmployees]);
  rows.push(["Resident Employees:", witReturn.totalResidentEmployees]);
  rows.push(["Non-Resident Employees:", witReturn.totalNonResidentEmployees]);

  // Convert to worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 15 }, // Employee ID
    { wch: 25 }, // Full Name
    { wch: 15 }, // TIN
    { wch: 10 }, // Resident
    { wch: 18 }, // Gross Wages
    { wch: 18 }, // Taxable Wages
    { wch: 18 }, // WIT Withheld
    { wch: 12 }, // Effective Rate
  ];

  return ws;
}

// ============================================
// DOWNLOAD HELPER
// ============================================

/**
 * Download ATTL form as Excel file
 */
export function downloadATTLExcel(
  witReturn: MonthlyWITReturn,
  company?: Partial<CompanyDetails>,
  filename?: string
): void {
  const blob = generateATTLExcel(witReturn, company);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `ATTL_Monthly_Tax_${witReturn.reportingPeriod}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
