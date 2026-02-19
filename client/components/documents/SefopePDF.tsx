/**
 * SEFOPE Registration Form PDF Generator
 * Generates official employment registration forms for Timor-Leste Labor Ministry
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import { Employee } from '@/services/employeeService';
import { CompanyDetails } from '@/types/settings';
import {
  SEFOPE_LABELS,
  SefopeFormData,
  mapToSefopeForm,
  formatSefopeDate,
  formatSefopeCurrency,
} from '@/lib/documents/sefope-form';
import { getTodayTL } from '@/lib/dateUtils';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1f2937',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#4b5563',
    marginBottom: 8,
  },
  registrationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  registrationItem: {
    flexDirection: 'row',
  },
  registrationLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginRight: 4,
  },
  registrationValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#1e40af',
    padding: 6,
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  fieldContainer: {
    flex: 1,
    marginRight: 10,
  },
  fieldContainerLast: {
    flex: 1,
    marginRight: 0,
  },
  fieldLabel: {
    fontSize: 7,
    color: '#6b7280',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 9,
    color: '#1f2937',
    fontWeight: 'bold',
    padding: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minHeight: 18,
  },
  fieldValueSmall: {
    fontSize: 8,
    color: '#1f2937',
    fontWeight: 'bold',
    padding: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minHeight: 16,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 15,
  },
  column: {
    flex: 1,
  },
  threeColumn: {
    flexDirection: 'row',
    gap: 10,
  },
  declaration: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
  },
  declarationText: {
    fontSize: 8,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  signatureBox: {
    width: '45%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 4,
    height: 40,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
  dateBox: {
    marginTop: 15,
    alignItems: 'center',
  },
  dateLine: {
    width: 150,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 4,
    height: 20,
  },
  officialSection: {
    marginTop: 25,
    padding: 15,
    borderWidth: 2,
    borderColor: '#9ca3af',
    borderStyle: 'dashed',
  },
  officialTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 10,
  },
  stampArea: {
    height: 60,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});

interface SefopePDFProps {
  data: SefopeFormData;
}

/**
 * SEFOPE Document Component - The actual PDF document
 */
export const SefopeDocument = ({ data }: SefopePDFProps) => {
  const today = new Date().toLocaleDateString('pt-TL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{SEFOPE_LABELS.formTitle}</Text>
          <Text style={styles.headerSubtitle}>{SEFOPE_LABELS.formSubtitle}</Text>
          <Text style={styles.headerSubtitle}>RDTL - República Democrática de Timor-Leste</Text>

          <View style={styles.registrationInfo}>
            <View style={styles.registrationItem}>
              <Text style={styles.registrationLabel}>{SEFOPE_LABELS.registrationNumber}:</Text>
              <Text style={styles.registrationValue}>{data.sefopeNumber || '________________'}</Text>
            </View>
            <View style={styles.registrationItem}>
              <Text style={styles.registrationLabel}>{SEFOPE_LABELS.registrationDate}:</Text>
              <Text style={styles.registrationValue}>
                {formatSefopeDate(data.sefopeRegistrationDate) || today}
              </Text>
            </View>
          </View>
        </View>

        {/* Employer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{SEFOPE_LABELS.employerSection}</Text>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.companyName}</Text>
              <Text style={styles.fieldValue}>{data.companyName}</Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.companyTIN}</Text>
              <Text style={styles.fieldValue}>{data.companyTIN || '-'}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.companyAddress}</Text>
              <Text style={styles.fieldValue}>
                {[data.companyAddress, data.companyCity].filter(Boolean).join(', ') || '-'}
              </Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.businessType}</Text>
              <Text style={styles.fieldValue}>{data.businessType || '-'}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.companyPhone}</Text>
              <Text style={styles.fieldValueSmall}>{data.companyPhone || '-'}</Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.companyEmail}</Text>
              <Text style={styles.fieldValueSmall}>{data.companyEmail || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Employee Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{SEFOPE_LABELS.employeeSection}</Text>

          <View style={styles.fieldRow}>
            <View style={{ flex: 2, marginRight: 10 }}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.fullName}</Text>
              <Text style={styles.fieldValue}>{data.employeeFullName}</Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.dateOfBirth}</Text>
              <Text style={styles.fieldValue}>{formatSefopeDate(data.dateOfBirth)}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.biNumber}</Text>
              <Text style={styles.fieldValue}>{data.biNumber || '-'}</Text>
            </View>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.biExpiry}</Text>
              <Text style={styles.fieldValue}>{formatSefopeDate(data.biExpiry) || '-'}</Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.nationality}</Text>
              <Text style={styles.fieldValue}>{data.nationality}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.residencyStatus}</Text>
              <Text style={styles.fieldValue}>{data.residencyStatus}</Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.phone}</Text>
              <Text style={styles.fieldValue}>{data.employeePhone || '-'}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.address}</Text>
              <Text style={styles.fieldValue}>{data.employeeAddress || '-'}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.emergencyContact}</Text>
              <Text style={styles.fieldValueSmall}>
                {data.emergencyContactName ? `${data.emergencyContactName} - ${data.emergencyContactPhone}` : '-'}
              </Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.email}</Text>
              <Text style={styles.fieldValueSmall}>{data.employeeEmail || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Employment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{SEFOPE_LABELS.employmentSection}</Text>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.employeeId}</Text>
              <Text style={styles.fieldValue}>{data.employeeId}</Text>
            </View>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.hireDate}</Text>
              <Text style={styles.fieldValue}>{formatSefopeDate(data.hireDate)}</Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.employmentType}</Text>
              <Text style={styles.fieldValue}>{data.employmentType || '-'}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.position}</Text>
              <Text style={styles.fieldValue}>{data.position}</Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.department}</Text>
              <Text style={styles.fieldValue}>{data.department || '-'}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.workLocation}</Text>
              <Text style={styles.fieldValue}>{data.workLocation || '-'}</Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.monthlySalary}</Text>
              <Text style={styles.fieldValue}>{formatSefopeCurrency(data.monthlySalary)}</Text>
            </View>
          </View>

          {(data.fundingSource || data.projectCode) && (
            <View style={styles.fieldRow}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>{SEFOPE_LABELS.fundingSource}</Text>
                <Text style={styles.fieldValueSmall}>{data.fundingSource || '-'}</Text>
              </View>
              <View style={styles.fieldContainerLast}>
                <Text style={styles.fieldLabel}>{SEFOPE_LABELS.projectCode}</Text>
                <Text style={styles.fieldValueSmall}>{data.projectCode || '-'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Social Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{SEFOPE_LABELS.socialSecuritySection}</Text>

          <View style={styles.fieldRow}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.inssNumber}</Text>
              <Text style={styles.fieldValue}>{data.inssNumber || '-'}</Text>
            </View>
            <View style={styles.fieldContainerLast}>
              <Text style={styles.fieldLabel}>{SEFOPE_LABELS.taxStatus}</Text>
              <Text style={styles.fieldValue}>
                {data.isResident ? 'Residente' : 'Não Residente'}
              </Text>
            </View>
          </View>
        </View>

        {/* Declaration */}
        <View style={styles.declaration}>
          <Text style={styles.declarationText}>{SEFOPE_LABELS.declaration}</Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>{SEFOPE_LABELS.employerSignature}</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>{SEFOPE_LABELS.employeeSignature}</Text>
          </View>
        </View>

        <View style={styles.dateBox}>
          <View style={styles.dateLine} />
          <Text style={styles.signatureLabel}>{SEFOPE_LABELS.date}</Text>
        </View>

        {/* Official Use Section */}
        <View style={styles.officialSection}>
          <Text style={styles.officialTitle}>{SEFOPE_LABELS.officialUseOnly}</Text>
          <View style={styles.stampArea}>
            <Text style={styles.stampText}>{SEFOPE_LABELS.stampArea}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Este documento é gerado automaticamente pelo sistema Meza.
          {'\n'}
          Document generated on {today} | SEFOPE Employment Registration Form
        </Text>
      </Page>
    </Document>
  );
};

/**
 * Generate and download SEFOPE form for an employee
 */
// eslint-disable-next-line react-refresh/only-export-components
export const downloadSefopeForm = async (
  employee: Employee,
  company: Partial<CompanyDetails>
): Promise<void> => {
  const formData = mapToSefopeForm(employee, company);

  const doc = <SefopeDocument data={formData} />;
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Generate filename
  const safeName = `${employee.personalInfo.firstName}_${employee.personalInfo.lastName}`.replace(/[^a-zA-Z0-9]/g, '_');
  const today = getTodayTL();
  link.download = `SEFOPE_${safeName}_${today}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate SEFOPE form as blob (for preview or upload)
 */
// eslint-disable-next-line react-refresh/only-export-components
export const generateSefopeBlob = async (
  employee: Employee,
  company: Partial<CompanyDetails>
): Promise<Blob> => {
  const formData = mapToSefopeForm(employee, company);
  const doc = <SefopeDocument data={formData} />;
  return await pdf(doc).toBlob();
};

/**
 * Bulk generate SEFOPE forms for multiple employees
 */
// eslint-disable-next-line react-refresh/only-export-components
export const downloadBulkSefopeForms = async (
  employees: Employee[],
  company: Partial<CompanyDetails>
): Promise<void> => {
  // For bulk download, generate each form and trigger individual downloads
  // In a more sophisticated implementation, these could be zipped together
  for (const employee of employees) {
    await downloadSefopeForm(employee, company);
    // Small delay to prevent browser blocking multiple downloads
    await new Promise(resolve => setTimeout(resolve, 200));
  }
};

export default SefopeDocument;
