/**
 * AI bill/receipt extraction — sends a dropped file to the Xefe API, which
 * reads it with Claude (server-side subscription auth, no OpenClaw) and
 * returns structured fields for pre-filling the Bill/Expense forms.
 * The user always reviews and confirms; extraction never saves anything.
 */

import { auth } from "@/lib/firebase-core";

const API_BASE =
  import.meta.env.VITE_XEFE_API_URL ||
  import.meta.env.VITE_MEZA_API_URL ||
  (import.meta.env.PROD && typeof window !== "undefined"
    ? window.location.origin
    : "https://xefe.tl");

export const EXTRACT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export interface ExtractedDocumentFields {
  /**
   * `payment_proof` is a bank document evidencing a payment (transfer slip,
   * "Comprovativo", ATM "LEVANTAMENTO") rather than a seller's invoice. Auditing
   * 151 real TL documents showed these are a large share of what businesses
   * actually send, so they get their own answer instead of "couldn't read".
   */
  documentType: "bill" | "receipt" | "payment_proof" | "credit_memo" | "other";
  vendorName: string | null;
  /** Seller's tax number (NIF/TIN in TL, NPWP in ID) — needed for withholding. */
  vendorTaxId: string | null;
  billNumber: string | null;
  billDate: string | null;
  dueDate: string | null;
  amount: number | null;
  taxAmount: number | null;
  currency: string | null;
  description: string | null;
  category: string;
  /**
   * True when ONE uploaded file holds several invoices/receipts — a scan of a
   * pile of bills, or two invoices in one PDF. The corpus contains both, and the
   * form can only create one bill, so the amount and number are ambiguous and
   * must not be pre-filled from a guess about which document was meant.
   */
  containsMultipleDocuments: boolean;
  confidence: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function canExtractFile(file: File): boolean {
  return EXTRACT_MIME_TYPES.includes(file.type) && file.size <= 10 * 1024 * 1024;
}

export interface ExtractedAttendanceRow {
  employee: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
}

/**
 * Normalize a messy spreadsheet (any columns/date/time formats) into rows of
 * a fixed schema server-side. Used as a fallback when strict parsing of an
 * import file finds nothing usable.
 */
export async function extractTable(
  tableText: string,
  tenantId: string,
  kind: "attendance",
): Promise<ExtractedAttendanceRow[]> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();

  const res = await fetch(
    `${API_BASE}/api/tenants/${tenantId}/ai/extract-table`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tableText: tableText.slice(0, 300_000), kind }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Extraction failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data?.success || !Array.isArray(data.rows)) {
    throw new Error("Extraction returned no rows");
  }
  return data.rows as ExtractedAttendanceRow[];
}

export async function extractDocument(
  file: File,
  tenantId: string,
  kind: "bill" | "expense",
): Promise<ExtractedDocumentFields> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const fileBase64 = await fileToBase64(file);

  const res = await fetch(
    `${API_BASE}/api/tenants/${tenantId}/ai/extract-document`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fileBase64, mimeType: file.type, kind }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Extraction failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data?.success || !data.fields) throw new Error("Extraction returned no fields");
  return data.fields as ExtractedDocumentFields;
}
