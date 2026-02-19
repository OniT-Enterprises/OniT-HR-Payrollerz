/**
 * WIT Return PDF Generator
 * Creates downloadable PDF documents for ATTL Monthly WIT returns
 * Uses @react-pdf/renderer
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { MonthlyWITReturn } from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";

// Styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1f2937",
  },
  header: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#f59e0b",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 8,
  },
  officialText: {
    fontSize: 9,
    color: "#9ca3af",
    textAlign: "center",
    fontStyle: "italic",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    width: "50%",
    marginBottom: 4,
  },
  infoLabel: {
    width: 100,
    fontSize: 9,
    color: "#6b7280",
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
    color: "#1f2937",
    fontWeight: "bold",
  },
  table: {
    width: "100%",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  tableCell: {
    fontSize: 9,
    color: "#1f2937",
  },
  // Column widths
  colNum: { width: "5%" },
  colName: { width: "22%" },
  colTIN: { width: "13%" },
  colResident: { width: "10%" },
  colGross: { width: "12%", textAlign: "right" },
  colTaxable: { width: "12%", textAlign: "right" },
  colWIT: { width: "12%", textAlign: "right" },
  colRate: { width: "8%", textAlign: "right" },
  summaryBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "#fef3c7",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#92400e",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#78350f",
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#78350f",
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#f59e0b",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#92400e",
  },
  totalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#92400e",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
  certification: {
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
  },
  certText: {
    fontSize: 9,
    color: "#374151",
    marginBottom: 15,
  },
  signatureBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
  },
  signatureLine: {
    width: "40%",
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
});

// Format currency
const formatCurrency = (amount: number): string => {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Format period
const formatPeriod = (period: string): string => {
  const [year, month] = period.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

interface WITReturnDocumentProps {
  witReturn: MonthlyWITReturn;
  company?: Partial<CompanyDetails>;
  generatedDate: Date;
}

/**
 * WIT Return PDF Document Component
 */
const WITReturnDocument = ({
  witReturn,
  company,
  generatedDate,
}: WITReturnDocumentProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Wage Income Tax Return</Text>
        <Text style={styles.subtitle}>
          Autoridade Tributaria Timor-Leste (ATTL)
        </Text>
        <Text style={styles.officialText}>
          Form for reporting monthly WIT deductions under Decree-Law No. 8/2008
        </Text>
      </View>

      {/* Employer Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Employer Information</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>TIN:</Text>
            <Text style={styles.infoValue}>
              {witReturn.employerTIN || company?.tinNumber || "Not specified"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reporting Period:</Text>
            <Text style={styles.infoValue}>
              {formatPeriod(witReturn.reportingPeriod)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Company Name:</Text>
            <Text style={styles.infoValue}>
              {witReturn.employerName ||
                company?.legalName ||
                company?.tradingName ||
                "Not specified"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Employees:</Text>
            <Text style={styles.infoValue}>{witReturn.totalEmployees}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>
              {witReturn.employerAddress ||
                company?.registeredAddress ||
                "Not specified"}
            </Text>
          </View>
        </View>
      </View>

      {/* Employee Details Table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Employee WIT Details</Text>
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colNum]}>#</Text>
            <Text style={[styles.tableHeaderCell, styles.colName]}>Name</Text>
            <Text style={[styles.tableHeaderCell, styles.colTIN]}>TIN</Text>
            <Text style={[styles.tableHeaderCell, styles.colResident]}>
              Status
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colGross]}>Gross</Text>
            <Text style={[styles.tableHeaderCell, styles.colTaxable]}>
              Taxable
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colWIT]}>WIT</Text>
            <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate</Text>
          </View>

          {/* Table Rows */}
          {witReturn.employees.map((emp, index) => (
            <View
              key={emp.employeeId}
              style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}
            >
              <Text style={[styles.tableCell, styles.colNum]}>{index + 1}</Text>
              <Text style={[styles.tableCell, styles.colName]}>
                {emp.fullName}
              </Text>
              <Text style={[styles.tableCell, styles.colTIN]}>
                {emp.tinNumber || "N/A"}
              </Text>
              <Text style={[styles.tableCell, styles.colResident]}>
                {emp.isResident ? "Res" : "Non-Res"}
              </Text>
              <Text style={[styles.tableCell, styles.colGross]}>
                {formatCurrency(emp.grossWages)}
              </Text>
              <Text style={[styles.tableCell, styles.colTaxable]}>
                {formatCurrency(emp.taxableWages)}
              </Text>
              <Text style={[styles.tableCell, styles.colWIT]}>
                {formatCurrency(emp.witWithheld)}
              </Text>
              <Text style={[styles.tableCell, styles.colRate]}>
                {emp.taxableWages > 0
                  ? `${((emp.witWithheld / emp.taxableWages) * 100).toFixed(0)}%`
                  : "0%"}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>Return Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Gross Wages:</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(witReturn.totalGrossWages)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Taxable Wages:</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(witReturn.totalTaxableWages)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotal]}>
          <Text style={styles.totalLabel}>Total WIT Withheld:</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(witReturn.totalWITWithheld)}
          </Text>
        </View>
      </View>

      {/* Certification */}
      <View style={styles.certification}>
        <Text style={styles.certText}>
          I hereby certify that the information provided in this return is true
          and correct to the best of my knowledge. The total WIT amount of{" "}
          {formatCurrency(witReturn.totalWITWithheld)} has been withheld from
          employees during the reporting period of{" "}
          {formatPeriod(witReturn.reportingPeriod)} and will be remitted to the
          Autoridade Tributaria Timor-Leste by the 15th of the following month.
        </Text>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Authorized Signature</Text>
          </View>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Generated: {generatedDate.toLocaleDateString()} at{" "}
          {generatedDate.toLocaleTimeString()}
        </Text>
        <Text style={styles.footerText}>
          Meza - ATTL Monthly WIT Return
        </Text>
      </View>
    </Page>
  </Document>
);

/**
 * Generate WIT Return PDF as Blob
 */
// eslint-disable-next-line react-refresh/only-export-components
export const generateWITReturnBlob = async (
  witReturn: MonthlyWITReturn,
  company?: Partial<CompanyDetails>
): Promise<Blob> => {
  const doc = (
    <WITReturnDocument
      witReturn={witReturn}
      company={company}
      generatedDate={new Date()}
    />
  );

  return await pdf(doc).toBlob();
};

/**
 * Download WIT Return as PDF
 */
// eslint-disable-next-line react-refresh/only-export-components
export const downloadWITReturnPDF = async (
  witReturn: MonthlyWITReturn,
  company?: Partial<CompanyDetails>,
  filename?: string
): Promise<void> => {
  const blob = await generateWITReturnBlob(witReturn, company);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download =
    filename || `wit-return-${witReturn.reportingPeriod}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default WITReturnDocument;
