/**
 * Declaração da Entidade Empregadora — licença parental (maternidade /
 * paternidade).
 *
 * DL n.º 18/2017 Art. 25(1)(c): the worker's INSS parental-subsidy claim must
 * attach an employer declaration stating the first day of the license and the
 * days with/without remuneration. Xefe's OWN layout (not any firm's workbook):
 * Portuguese primary, English secondary, same @react-pdf pipeline as
 * client/lib/pdf/workCertificate.tsx.
 *
 * Default posture: the employer pays NOTHING during the license (the INSS
 * subsidy replaces salary; Art. 21(3) makes them non-cumulable), so
 * daysWithRemuneration defaults to zero and the declaration carries the
 * explicit no-payment sentence. A tenant that configured employer-paid
 * maternity/paternity declares the request's working days instead.
 *
 * Import this module dynamically from UI handlers so @react-pdf stays out of
 * the page bundle.
 */

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { CompanyDetails, LeaveTypeConfig } from "@/types/settings";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in tests/client/inss-parental-declaration.test.ts)
// ---------------------------------------------------------------------------

/**
 * Days of the license the employer pays salary for, from the tenant's
 * configured policy. Mirrors the payroll engines' leavePayFraction semantics:
 * only an explicit isPaid + paidPercentage > 0 policy is employer-paid (the
 * deliberate opt-in that voids the INSS subsidy per DL 18/2017 Art. 21(3));
 * everything else — including the TL defaults — declares zero.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function parentalDaysWithRemuneration(
  policy: Pick<LeaveTypeConfig, "isPaid" | "paidPercentage"> | undefined,
  requestWorkingDays: number,
): number {
  if (!policy) return 0;
  if (policy.isPaid !== true) return 0;
  const percentage = Number(policy.paidPercentage);
  if (!Number.isFinite(percentage) || percentage <= 0) return 0;
  const days = Number(requestWorkingDays);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/**
 * Total calendar days of the license, inclusive of both endpoints. A parental
 * license runs continuously (weekends included) — the INSS subsidy is granted
 * per calendar day, up to 90 for maternity.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function inclusiveLicenseDays(startDate: string, endDate: string): number {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(startDate) || !pattern.test(endDate)) return 0;
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

// ---------------------------------------------------------------------------
// PDF document
// ---------------------------------------------------------------------------

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
    fontSize: 15,
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
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    marginBottom: 6,
  },
  rowLast: {
    flexDirection: "row",
  },
  label: {
    width: 210,
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

export type ParentalLeaveKind = "maternity" | "paternity";

export interface InssParentalDeclarationData {
  companyDetails?: Partial<CompanyDetails> | null;
  workerName: string;
  /** INSS social-security number, when on file. */
  workerNiss?: string;
  leaveKind: ParentalLeaveKind;
  /** First day of the license, YYYY-MM-DD. */
  startDate: string;
  /** Last day of the license, YYYY-MM-DD. */
  endDate: string;
  /** Total calendar days of the license (inclusive). */
  totalDays: number;
  /** Days of the license the employer pays salary for (default 0). */
  daysWithRemuneration: number;
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

const InssParentalDeclarationDocument = (data: InssParentalDeclarationData) => {
  const company = data.companyDetails ?? {};
  const companyName = company.legalName || company.tradingName || "";
  const issuedOn = data.issuedOn ?? new Date();
  const isMaternity = data.leaveKind === "maternity";
  const licencaPt = isMaternity
    ? "licença de maternidade"
    : "licença de paternidade";
  const licencaEn = isMaternity ? "maternity leave" : "paternity leave";
  const start = formatDatePt(data.startDate);
  const end = formatDatePt(data.endDate);
  const noPay = data.daysWithRemuneration <= 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.companyBlock}>
          <Text style={styles.companyName}>
            {companyName || "Entidade empregadora"}
          </Text>
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

        <Text style={styles.title}>DECLARAÇÃO DA ENTIDADE EMPREGADORA</Text>
        <Text style={styles.titleEn}>
          Employer declaration — parental leave (INSS subsidy claim)
        </Text>
        <Text style={styles.legalRef}>
          Lei n.º 4/2012, art. 59.º; DL n.º 18/2017, art. 25.º
        </Text>

        <Text style={styles.paragraph}>
          Para efeitos do requerimento do subsídio parental junto do Instituto
          Nacional de Segurança Social (INSS), declara-se que o/a trabalhador/a{" "}
          {data.workerName} se encontra em {licencaPt} com início em {start},
          nos termos abaixo indicados.
        </Text>
        <Text style={styles.paragraphEn}>
          For the purposes of the parental-subsidy claim with the National
          Institute of Social Security (INSS), we declare that the worker{" "}
          {data.workerName} is on {licencaEn} starting {start}, under the terms
          stated below.
        </Text>

        <View style={styles.fieldTable}>
          <FieldRow
            pt="Nome do trabalhador"
            en="Worker name"
            value={data.workerName}
          />
          <FieldRow
            pt="NISS (segurança social)"
            en="Social security number"
            value={data.workerNiss || "—"}
          />
          <FieldRow
            pt="Tipo de licença"
            en="Leave type"
            value={
              isMaternity
                ? "Licença de maternidade / Maternity leave"
                : "Licença de paternidade / Paternity leave"
            }
          />
          <FieldRow
            pt="Primeiro dia da licença"
            en="First day of the license"
            value={start}
          />
          <FieldRow
            pt="Último dia da licença"
            en="Last day of the license"
            value={end}
          />
          <FieldRow
            pt="Total de dias da licença"
            en="Total days of the license"
            value={String(data.totalDays)}
          />
          <FieldRow
            pt="Dias com remuneração durante a licença"
            en="Days with remuneration during the license"
            value={String(data.daysWithRemuneration)}
            last
          />
        </View>

        {noPay ? (
          <>
            <Text style={styles.paragraph}>
              A entidade empregadora declara que não efetua o pagamento de
              remuneração durante o período da licença.
            </Text>
            <Text style={styles.paragraphEn}>
              The employer declares that it does not pay remuneration during
              the leave period.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.paragraph}>
              A entidade empregadora declara que efetua o pagamento de
              remuneração nos dias acima indicados. Nos termos do artigo 21.º,
              n.º 3, do Decreto-Lei n.º 18/2017, o subsídio parental não é
              acumulável com remuneração relativa aos mesmos dias.
            </Text>
            <Text style={styles.paragraphEn}>
              The employer declares that it pays remuneration for the days
              stated above. Under Article 21(3) of Decree-Law No. 18/2017, the
              parental subsidy cannot be combined with remuneration for the
              same days.
            </Text>
          </>
        )}

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
          Anexo ao requerimento do subsídio parental — DL n.º 18/2017, art.
          25.º, n.º 1, al. c). / Attachment to the INSS parental-subsidy claim.
          {"\n"}Gerado por Xefe / Generated by Xefe
        </Text>
      </Page>
    </Document>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export async function downloadInssParentalDeclaration(
  data: InssParentalDeclarationData,
): Promise<void> {
  const blob = await pdf(<InssParentalDeclarationDocument {...data} />).toBlob();
  const { downloadBlob } = await import("@/lib/downloadBlob");
  const safeName = data.workerName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_");
  downloadBlob(blob, `Declaracao_INSS_Parental_${safeName}.pdf`);
}

export default InssParentalDeclarationDocument;
