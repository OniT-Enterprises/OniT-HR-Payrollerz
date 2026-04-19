/**
 * Staff CV Generator
 * Standardised print-ready CV for TL government paperwork (MTCI etc.).
 */

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { Employee } from "@/services/employeeService";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
    paddingBottom: 12,
    marginBottom: 18,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    color: "#4b5563",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#374151",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 4,
    marginBottom: 8,
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 110,
    color: "#6b7280",
  },
  value: {
    flex: 1,
  },
  twoCol: {
    flexDirection: "row",
    gap: 24,
  },
  col: {
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
});

interface StaffCvDocProps {
  employee: Employee;
  companyName: string;
  issuedOn: string;
}

const Field = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

function formatDate(d?: string): string | undefined {
  if (!d) return undefined;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// eslint-disable-next-line react-refresh/only-export-components
const StaffCvDocument = ({ employee, companyName, issuedOn }: StaffCvDocProps) => {
  const { personalInfo, jobDetails, compensation, documents } = employee;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>
            {personalInfo.firstName} {personalInfo.lastName}
          </Text>
          <Text style={styles.title}>
            {jobDetails.position}
            {jobDetails.department ? ` · ${jobDetails.department}` : ""}
            {companyName ? ` · ${companyName}` : ""}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Personal information</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Field label="Full name" value={`${personalInfo.firstName} ${personalInfo.lastName}`} />
            <Field label="Date of birth" value={formatDate(personalInfo.dateOfBirth)} />
            <Field label="Nationality" value={documents?.nationality} />
            <Field label="Address" value={personalInfo.address} />
          </View>
          <View style={styles.col}>
            <Field label="Mobile" value={personalInfo.phone} />
            <Field label="Email" value={personalInfo.email} />
            <Field label="Emergency contact" value={personalInfo.emergencyContactName} />
            <Field label="Emergency phone" value={personalInfo.emergencyContactPhone} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Identification</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Field
              label="Bilhete Identidade"
              value={documents?.bilheteIdentidade?.number || documents?.employeeIdCard?.number}
            />
            <Field label="Electoral card" value={documents?.electoralCard?.number} />
            <Field label="Passport" value={documents?.passport?.number} />
          </View>
          <View style={styles.col}>
            <Field label="INSS (Social Security)" value={documents?.socialSecurityNumber?.number} />
            <Field label="TIN / Tax ID" value={personalInfo.socialSecurityNumber} />
            <Field
              label="Work permit"
              value={documents?.workingVisaResidency?.number}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Employment</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Field label="Employee ID" value={jobDetails.employeeId} />
            <Field label="Position" value={jobDetails.position} />
            <Field label="Department" value={jobDetails.department} />
            <Field label="Work location" value={jobDetails.workLocation} />
          </View>
          <View style={styles.col}>
            <Field label="Hire date" value={formatDate(jobDetails.hireDate)} />
            <Field label="Employment type" value={jobDetails.employmentType} />
            <Field label="Contract end" value={formatDate(jobDetails.contractEndDate)} />
            <Field label="Manager" value={jobDetails.manager} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Compensation</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Field
              label="Monthly salary"
              value={
                compensation.monthlySalary
                  ? `$${compensation.monthlySalary.toLocaleString()}`
                  : undefined
              }
            />
            <Field
              label="Pay frequency"
              value={compensation.payFrequency || "monthly"}
            />
          </View>
          <View style={styles.col}>
            <Field
              label="Annual leave"
              value={
                compensation.annualLeaveDays
                  ? `${compensation.annualLeaveDays} days`
                  : undefined
              }
            />
            <Field label="Benefits" value={compensation.benefitsPackage} />
          </View>
        </View>

        <Text style={styles.footer}>
          Issued by {companyName || "OniT HR"} on {issuedOn} · Generated by Meza HR
        </Text>
      </Page>
    </Document>
  );
};

export async function downloadStaffCv(
  employee: Employee,
  companyName = "OniT HR",
): Promise<void> {
  const issuedOn = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const blob = await pdf(
    <StaffCvDocument employee={employee} companyName={companyName} issuedOn={issuedOn} />,
  ).toBlob();
  const { downloadBlob } = await import("@/lib/downloadBlob");
  const safeName = `${employee.personalInfo.firstName}_${employee.personalInfo.lastName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_");
  downloadBlob(blob, `CV_${safeName}.pdf`);
}

export default StaffCvDocument;
