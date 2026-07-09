/**
 * Contract PDF
 * Renders filled contract text (from a contract template) as a print-ready
 * A4 PDF. Layout mirrors the plain-text structure: blank lines separate
 * paragraphs; short ALL-CAPS or numbered-clause lines render bold.
 */

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 60,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
    lineHeight: 1.5,
  },
  paragraph: {
    marginBottom: 8,
  },
  heading: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 60,
    right: 60,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
});

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  // Numbered clause headings ("1. OBJECT", "2.1 ...") or ALL CAPS lines
  if (/^\d+(\.\d+)*\.?\s+\S/.test(trimmed) && trimmed === trimmed.toUpperCase()) {
    return true;
  }
  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

interface ContractDocumentProps {
  text: string;
  footerNote: string;
}

const ContractDocument = ({ text, footerNote }: ContractDocumentProps) => {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trimEnd())
    .filter((block) => block.trim().length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {blocks.map((block, blockIndex) => (
          <View key={blockIndex} style={styles.paragraph} wrap>
            {block.split("\n").map((line, lineIndex) => (
              <Text
                key={lineIndex}
                style={isHeadingLine(line) ? styles.heading : undefined}
              >
                {line || " "}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.footer} fixed>
          {footerNote}
        </Text>
      </Page>
    </Document>
  );
};

/** Render filled contract text to a PDF Blob. */
// eslint-disable-next-line react-refresh/only-export-components
export async function contractTextToPdfBlob(params: {
  text: string;
  footerNote: string;
}): Promise<Blob> {
  return pdf(
    <ContractDocument text={params.text} footerNote={params.footerNote} />,
  ).toBlob();
}

export default ContractDocument;
