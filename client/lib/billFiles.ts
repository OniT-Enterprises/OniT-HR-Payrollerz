/**
 * Shared helpers for bill attachment file intake (drag & drop / file picker).
 */

import { fileUploadService } from '@/services/fileUploadService';

export const BILL_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';

/**
 * Splits files into valid bill attachments and rejection messages
 * (images/PDFs up to 10MB, per fileUploadService.validateReceiptFile).
 */
export function partitionBillFiles(files: File[]): { valid: File[]; errors: string[] } {
  const valid: File[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const result = fileUploadService.validateReceiptFile(file);
    if (result.valid) {
      valid.push(file);
    } else {
      errors.push(`${file.name}: ${result.error}`);
    }
  }
  return { valid, errors };
}
