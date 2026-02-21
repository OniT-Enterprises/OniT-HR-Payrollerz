/**
 * Email Service for Payslip Distribution
 * Uses Firestore trigger email pattern (write to mail collection -> extension sends)
 * Can also be used with direct email API (SendGrid, Resend, etc.)
 */

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { PayrollRecord, PayrollRun } from "@/types/payroll";

// Lazy load PDF generation to avoid loading react-pdf in main bundle
const generatePayslipBlob = async (
  ...args: Parameters<
    typeof import("@/components/payroll/PayslipPDF").generatePayslipBlob
  >
) => {
  const { generatePayslipBlob: generate } = await import(
    "@/components/payroll/PayslipPDF"
  );
  return generate(...args);
};

// ============================================================================
// TYPES
// ============================================================================

export type EmailStatus = "pending" | "processing" | "sent" | "failed";

export interface EmailRecord {
  id?: string;
  tenantId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  status: EmailStatus;
  error?: string;
  sentAt?: Timestamp;
  createdAt?: Timestamp;
  createdBy: string;
  // Tracking metadata
  purpose: "payslip" | "document_alert" | "notification" | "other";
  relatedId?: string; // e.g., payrollRunId, employeeId
}

export interface EmailAttachment {
  filename: string;
  content?: string; // base64 encoded
  contentType: string;
  path?: string; // Storage path
  url?: string; // Download URL
}

export interface PayslipEmailData {
  employeeId: string;
  employeeEmail: string;
  employeeName: string;
  record: PayrollRecord;
  payrollRun: PayrollRun;
}

export interface SendPayslipsResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ employeeId: string; error: string }>;
}

// ============================================================================
// EMAIL COLLECTION (for Firebase Trigger Email extension)
// ============================================================================

const MAIL_COLLECTION = "mail";

/**
 * Queue an email for sending via Firebase Trigger Email extension
 * The extension watches the 'mail' collection and sends emails automatically
 */
async function queueEmail(
  tenantId: string,
  email: Omit<EmailRecord, "id" | "tenantId" | "status" | "createdAt">
): Promise<string> {
  const mailRef = collection(db, MAIL_COLLECTION);

  const emailDoc: Omit<EmailRecord, "id"> = {
    ...email,
    tenantId,
    status: "pending",
    createdAt: serverTimestamp() as Timestamp,
  };

  const docRef = await addDoc(mailRef, emailDoc);
  return docRef.id;
}

// ============================================================================
// PAYSLIP PDF STORAGE
// ============================================================================

/**
 * Upload payslip PDF to Firebase Storage
 * Returns the download URL
 */
async function uploadPayslipPdf(
  tenantId: string,
  payrollRunId: string,
  employeeId: string,
  pdfBlob: Blob
): Promise<string> {
  const timestamp = Date.now();
  const storagePath = `tenants/${tenantId}/payslips/${payrollRunId}/${employeeId}_${timestamp}.pdf`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, pdfBlob, {
    contentType: "application/pdf",
    customMetadata: {
      tenantId,
      payrollRunId,
      employeeId,
      generatedAt: new Date().toISOString(),
    },
  });

  return await getDownloadURL(storageRef);
}

// ============================================================================
// PAYSLIP EMAIL SERVICE
// ============================================================================

/**
 * Generate and email payslip to a single employee
 */
export async function sendPayslipEmail(
  tenantId: string,
  data: PayslipEmailData,
  companyInfo: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  },
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { employeeId, employeeEmail, employeeName, record, payrollRun } = data;

  if (!employeeEmail) {
    return { success: false, error: "Employee has no email address" };
  }

  try {
    // Generate payslip PDF
    const pdfBlob = await generatePayslipBlob(record, payrollRun, companyInfo);

    // Upload PDF to storage
    const pdfUrl = await uploadPayslipPdf(
      tenantId,
      payrollRun.id || "unknown",
      employeeId,
      pdfBlob
    );

    // Format pay period for subject
    const periodStart = new Date(payrollRun.periodStart);
    const periodMonth = periodStart.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Dili",
    });

    // Queue email
    await queueEmail(tenantId, {
      to: [employeeEmail],
      subject: `Your Payslip for ${periodMonth}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Payslip Notification</h2>
          <p>Dear ${employeeName},</p>
          <p>Please find attached your payslip for <strong>${periodMonth}</strong>.</p>
          <p><strong>Summary:</strong></p>
          <ul style="list-style: none; padding: 0;">
            <li>Gross Pay: $${record.totalGrossPay.toFixed(2)}</li>
            <li>Total Deductions: $${record.totalDeductions.toFixed(2)}</li>
            <li>Net Pay: $${record.netPay.toFixed(2)}</li>
          </ul>
          <p>
            <a href="${pdfUrl}" style="display: inline-block; padding: 10px 20px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 5px;">
              Download Payslip
            </a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated message from ${companyInfo.name || "HR System"}.
            If you have any questions about your payslip, please contact HR.
          </p>
        </div>
      `,
      text: `
        Dear ${employeeName},

        Please find attached your payslip for ${periodMonth}.

        Summary:
        - Gross Pay: $${record.totalGrossPay.toFixed(2)}
        - Total Deductions: $${record.totalDeductions.toFixed(2)}
        - Net Pay: $${record.netPay.toFixed(2)}

        Download your payslip: ${pdfUrl}

        This is an automated message from ${companyInfo.name || "HR System"}.
      `,
      attachments: [
        {
          filename: `Payslip_${employeeName.replace(/\s+/g, "_")}_${periodMonth.replace(/\s+/g, "_")}.pdf`,
          url: pdfUrl,
          contentType: "application/pdf",
        },
      ],
      purpose: "payslip",
      relatedId: payrollRun.id,
      createdBy: userId,
    });

    return { success: true };
  } catch (error) {
    console.error(`Error sending payslip to ${employeeEmail}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/** Maximum employees per bulk send to prevent OOM from client-side PDF generation */
const MAX_BULK_PAYSLIP_BATCH = 50;

/**
 * Send payslips to multiple employees
 */
export async function sendBulkPayslipEmails(
  tenantId: string,
  payslipData: PayslipEmailData[],
  companyInfo: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  },
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<SendPayslipsResult> {
  if (payslipData.length > MAX_BULK_PAYSLIP_BATCH) {
    throw new Error(
      `Batch size ${payslipData.length} exceeds maximum of ${MAX_BULK_PAYSLIP_BATCH}. Please send in smaller batches.`
    );
  }

  const result: SendPayslipsResult = {
    total: payslipData.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < payslipData.length; i++) {
    const data = payslipData[i];

    // Report progress
    if (onProgress) {
      onProgress(i + 1, payslipData.length);
    }

    // Skip employees without email
    if (!data.employeeEmail) {
      result.skipped++;
      result.errors.push({
        employeeId: data.employeeId,
        error: "No email address",
      });
      continue;
    }

    // Send email
    const sendResult = await sendPayslipEmail(tenantId, data, companyInfo, userId);

    if (sendResult.success) {
      result.sent++;
    } else {
      result.failed++;
      result.errors.push({
        employeeId: data.employeeId,
        error: sendResult.error || "Unknown error",
      });
    }

    // Small delay between emails to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return result;
}

// ============================================================================
// EMAIL STATUS TRACKING
// ============================================================================

/**
 * Get email send history for a tenant
 */
export async function getEmailHistory(
  tenantId: string,
  options: {
    purpose?: EmailRecord["purpose"];
    limit?: number;
    startAfter?: Timestamp;
  } = {}
): Promise<EmailRecord[]> {
  const { purpose, limit = 50 } = options;

  let q = query(
    collection(db, MAIL_COLLECTION),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc")
  );

  if (purpose) {
    q = query(q, where("purpose", "==", purpose));
  }

  const snapshot = await getDocs(q);
  const emails: EmailRecord[] = [];

  snapshot.docs.slice(0, limit).forEach((doc) => {
    emails.push({ id: doc.id, ...doc.data() } as EmailRecord);
  });

  return emails;
}

/**
 * Get email record by ID
 */
export async function getEmailRecord(emailId: string): Promise<EmailRecord | null> {
  const docRef = doc(db, MAIL_COLLECTION, emailId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return { id: docSnap.id, ...docSnap.data() } as EmailRecord;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const emailService = {
  sendPayslipEmail,
  sendBulkPayslipEmails,
  getEmailHistory,
  getEmailRecord,
};

export default emailService;
