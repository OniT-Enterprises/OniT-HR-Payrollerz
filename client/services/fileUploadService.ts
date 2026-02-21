import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/lib/firebase";

export class FileUploadService {
  private static instance: FileUploadService;

  static getInstance(): FileUploadService {
    if (!FileUploadService.instance) {
      FileUploadService.instance = new FileUploadService();
    }
    return FileUploadService.instance;
  }

  /**
   * Upload a file to Firebase Storage
   * @param file - The file to upload
   * @param path - Storage path (e.g., 'employees/123/workContract')
   * @returns Promise with download URL
   */
  async uploadFile(file: File, path: string): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error("Failed to upload file");
    }
  }

  /**
   * Upload employee document
   * @param file - The file to upload
   * @param tenantId - Tenant ID for storage isolation
   * @param employeeId - Employee ID
   * @param documentType - Type of document (workContract, workingVisa, etc.)
   * @returns Promise with download URL
   */
  async uploadEmployeeDocument(
    file: File,
    tenantId: string,
    employeeId: string,
    documentType: string,
  ): Promise<string> {
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop();
    const fileName = `${documentType}_${timestamp}.${fileExtension}`;
    const path = `tenants/${tenantId}/employees/${employeeId}/documents/${fileName}`;

    return this.uploadFile(file, path);
  }

  /**
   * Delete a file from Firebase Storage
   * @param url - The download URL of the file to delete
   */
  async deleteFile(url: string): Promise<void> {
    try {
      const fileRef = ref(storage, url);
      await deleteObject(fileRef);
    } catch (error) {
      console.error("Error deleting file:", error);
      throw new Error("Failed to delete file");
    }
  }

  /**
   * Generate a temporary employee ID for file uploads before employee creation
   */
  generateTempEmployeeId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Upload expense receipt
   * @param file - The receipt file (image or PDF)
   * @param tenantId - Tenant ID for storage isolation
   * @param expenseId - Expense ID (use 'temp' prefix for new expenses)
   * @returns Promise with download URL
   */
  async uploadExpenseReceipt(file: File, tenantId: string, expenseId: string): Promise<string> {
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop();
    const fileName = `receipt_${timestamp}.${fileExtension}`;
    const path = `tenants/${tenantId}/expenses/${expenseId}/receipts/${fileName}`;

    return this.uploadFile(file, path);
  }

  /**
   * Validate receipt file (images and PDFs, max 10MB)
   */
  validateReceiptFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Please upload an image (JPG, PNG, WebP) or PDF file' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be under 10MB' };
    }

    return { valid: true };
  }

  /**
   * Generate a temporary expense ID for file uploads before expense creation
   */
  generateTempExpenseId(): string {
    return `temp_expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const fileUploadService = FileUploadService.getInstance();
