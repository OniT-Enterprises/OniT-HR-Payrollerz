/**
 * Spotting a password-protected PDF before blaming the reader.
 *
 * A held-out sample of real documents included an installment invoice that no
 * extractor can read because the PDF is encrypted — insurers, banks and telcos
 * in Timor-Leste do send protected statements. The extractor correctly returned
 * "not a bill", but the form then said "XefeBot couldn't read this file", which
 * tells the user nothing they can act on. Detecting encryption lets the form say
 * what is actually wrong: save an unprotected copy.
 *
 * Detection is a byte scan for the PDF `/Encrypt` trailer entry — no parsing, no
 * dependency. An encrypted PDF always carries it, so this does not miss the case
 * it exists for; a false positive costs only a slightly wrong hint.
 *
 * Firebase-free so CI can test it.
 */

/** The PDF magic bytes: `%PDF-`. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

/** `/Encrypt` as bytes — the trailer entry every encrypted PDF carries. */
const ENCRYPT_MARKER = [0x2f, 0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74];

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

function includesSequence(bytes: Uint8Array, sequence: readonly number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - sequence.length; i += 1) {
    for (let j = 0; j < sequence.length; j += 1) {
      if (bytes[i + j] !== sequence[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Are these bytes a PDF at all? */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return startsWith(bytes, PDF_MAGIC);
}

/**
 * Does this PDF declare encryption? False for anything that is not a PDF, so a
 * photo or a mislabelled file never produces a misleading "protected" message.
 */
export function pdfBytesLookProtected(bytes: Uint8Array): boolean {
  if (!looksLikePdf(bytes)) return false;
  return includesSequence(bytes, ENCRYPT_MARKER);
}

/** Read a file and report whether it is a password-protected PDF. */
export async function isProtectedPdf(file: File): Promise<boolean> {
  if (file.type !== 'application/pdf') return false;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return pdfBytesLookProtected(bytes);
  } catch {
    // Never let a diagnostic hint break the flow it is trying to explain.
    return false;
  }
}
