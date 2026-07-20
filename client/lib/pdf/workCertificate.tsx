/**
 * Certificado de Trabalho — Lei do Trabalho n.º 4/2012, Art. 57.
 *
 * MANDATORY on every contract cessation: the employer must give the worker a
 * certificate stating their name, the contract start/end dates and the
 * functions performed — and nothing else (no conduct/performance references).
 * Bilingual: Portuguese primary, English secondary.
 *
 * SIMPLIFICATION (deliberate, this round): Art. 57 also requires a second
 * document with the worker's social-security deduction data. We do NOT build
 * that annex here — the footer notes that the INSS contribution history is
 * available via the payslips and the monthly INSS declarations, which carry
 * the same data. Build the dedicated annex if/when a tenant needs it.
 *
 * Same @react-pdf pipeline as client/components/staff/StaffCvPdf.tsx; import
 * this module dynamically from UI handlers so @react-pdf stays out of the
 * page bundle.
 */

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { CompanyDetails } from "@/types/settings";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  companyBlock: {
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
    paddingBottom: 12,
    marginBottom: 28,
  },
  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 3,
  },
  companyMeta: {
    fontSize: 9,
    color: "#4b5563",
    marginBottom: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 4,
  },
  titleEn: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 2,
  },
  legalRef: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 26,
  },
  paragraph: {
    lineHeight: 1.6,
    marginBottom: 8,
    textAlign: "justify",
  },
  paragraphEn: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.5,
    marginBottom: 22,
    textAlign: "justify",
  },
  fieldTable: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    padding: 12,
    marginBottom: 30,
  },
  row: {
    flexDirection: "row",
    marginBottom: 6,
  },
  rowLast: {
    flexDirection: "row",
  },
  label: {
    width: 190,
  },
  labelPt: {
    fontWeight: "bold",
  },
  labelEn: {
    fontSize: 8,
    color: "#6b7280",
  },
  value: {
    flex: 1,
    justifyContent: "center",
  },
  signatureBlock: {
    marginTop: 34,
  },
  signatureDate: {
    marginBottom: 40,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#111827",
    width: 240,
    paddingTop: 4,
  },
  signatureCaption: {
    fontSize: 9,
    color: "#4b5563",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
    lineHeight: 1.5,
  },
});

export interface WorkCertificateData {
  companyDetails?: Partial<CompanyDetails> | null;
  workerName: string;
  /** Functions performed (Art. 57 wording) — the position held. */
  position?: string;
  department?: string;
  /** Contract start, YYYY-MM-DD. */
  hireDate?: string;
  /** Contract end (last working day), YYYY-MM-DD. */
  lastWorkingDay?: string;
  /** Issue date, defaults to today. */
  issuedOn?: Date;
}

/** dd/MM/yyyy from a YYYY-MM-DD string (PT-style date, deterministic). */
function formatDatePt(iso?: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatDateObjPt(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

const FieldRow = ({
  pt,
  en,
  value,
  last,
}: {
  pt: string;
  en: string;
  value: string;
  last?: boolean;
}) => (
  <View style={last ? styles.rowLast : styles.row}>
    <View style={styles.label}>
      <Text style={styles.labelPt}>{pt}</Text>
      <Text style={styles.labelEn}>{en}</Text>
    </View>
    <View style={styles.value}>
      <Text>{value}</Text>
    </View>
  </View>
);

const WorkCertificateDocument = (data: WorkCertificateData) => {
  const company = data.companyDetails ?? {};
  const companyName =
    company.legalName || company.tradingName || "";
  const issuedOn = data.issuedOn ?? new Date();
  const functions = data.position || "—";
  const start = formatDatePt(data.hireDate);
  const end = formatDatePt(data.lastWorkingDay);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.companyBlock}>
          <Text style={styles.companyName}>{companyName || "Entidade empregadora"}</Text>
          {(company.registeredAddress || company.city) ? (
            <Text style={styles.companyMeta}>
              {[company.registeredAddress, company.city, company.country]
                .filter(Boolean)
                .join(", ")}
            </Text>
          ) : null}
          {company.tinNumber ? (
            <Text style={styles.companyMeta}>NIF/TIN: {company.tinNumber}</Text>
          ) : null}
          {(company.phone || company.email) ? (
            <Text style={styles.companyMeta}>
              {[company.phone, company.email].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>

        <Text style={styles.title}>CERTIFICADO DE TRABALHO</Text>
        <Text style={styles.titleEn}>Work Certificate</Text>
        <Text style={styles.legalRef}>
          Lei do Trabalho n.º 4/2012, Artigo 57.º / Labour Law No. 4/2012, Article 57
        </Text>

        <Text style={styles.paragraph}>
          Para os devidos efeitos, certifica-se que {data.workerName} trabalhou
          para {companyName || "esta entidade empregadora"} desde {start} até{" "}
          {end}, desempenhando as funções de {functions}
          {data.department ? ` (${data.department})` : ""}.
        </Text>
        <Text style={styles.paragraphEn}>
          This is to certify that {data.workerName} was employed by{" "}
          {companyName || "this employer"} from {start} to {end}, performing the
          functions of {functions}
          {data.department ? ` (${data.department})` : ""}.
        </Text>

        <View style={styles.fieldTable}>
          <FieldRow
            pt="Nome do trabalhador"
            en="Worker name"
            value={data.workerName}
          />
          <FieldRow
            pt="Funções desempenhadas"
            en="Functions performed"
            value={functions}
          />
          <FieldRow
            pt="Início do contrato"
            en="Contract start"
            value={start}
          />
          <FieldRow
            pt="Fim do contrato"
            en="Contract end"
            value={end}
            last
          />
        </View>

        <View style={styles.signatureBlock}>
          <Text style={styles.signatureDate}>
            {company.city ? `${company.city}, ` : ""}
            {formatDateObjPt(issuedOn)}
          </Text>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureCaption}>
              Pela entidade empregadora / For the employer
            </Text>
            <Text style={styles.signatureCaption}>
              (assinatura e carimbo / signature and stamp)
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Os dados das deduções para a segurança social (INSS) constam dos
          recibos de vencimento e das declarações mensais de remunerações ao
          INSS. / The social security (INSS) deduction data is available via
          the payslips and the monthly INSS declarations.
          {"\n"}Gerado por Xefe / Generated by Xefe
        </Text>
      </Page>
    </Document>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export async function downloadWorkCertificate(
  data: WorkCertificateData,
): Promise<void> {
  const blob = await pdf(<WorkCertificateDocument {...data} />).toBlob();
  const { downloadBlob } = await import("@/lib/downloadBlob");
  const safeName = data.workerName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_");
  downloadBlob(blob, `Certificado_Trabalho_${safeName}.pdf`);
}

export default WorkCertificateDocument;
