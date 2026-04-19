import { getStorageLazy } from "@/lib/firebase";

class FileUploadService {
  private static instance: FileUploadService;
  private readonly storageTimeoutMs = 20000;

  static getInstance(): FileUploadService {
    if (!FileUploadService.instance) {
      FileUploadService.instance = new FileUploadService();
    }
    return FileUploadService.instance;
  }

  private async withTimeout<T>(promise: Promise<T>, action: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`${action} timed out. Check Firebase Storage.`)), this.storageTimeoutMs);
      }),
    ]);
  }

  /**
   * Upload a file to Firebase Storage
   * @param file - The file to upload
   * @param path - Storage path (e.g., 'employees/123/workContract')
   * @returns Promise with download URL
   */
  async uploadFile(file: File, path: string): Promise<string> {
    try {
      const storage = await getStorageLazy();
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const storageRef = ref(storage, path);
      const snapshot = await this.withTimeout(uploadBytes(storageRef, file), "File upload");
      const downloadURL = await this.withTimeout(getDownloadURL(snapshot.ref), "Storage URL lookup");
      return downloadURL;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error("Failed to upload file");
    }
  }

  /**
   * Upload a file and return its storage path instead of a download URL.
   * Useful for public uploads where only internal staff should resolve the file later.
   */
  async uploadFileAndReturnPath(file: File, path: string): Promise<string> {
    try {
      const storage = await getStorageLazy();
      const { ref, uploadBytes } = await import("firebase/storage");
      const storageRef = ref(storage, path);
      await this.withTimeout(uploadBytes(storageRef, file), "File upload");
      return path;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error("Failed to upload file");
    }
  }

  async getDownloadUrl(path: string): Promise<string> {
    try {
      const storage = await getStorageLazy();
      const { ref, getDownloadURL } = await import("firebase/storage");
      return this.withTimeout(getDownloadURL(ref(storage, path)), "Storage URL lookup");
    } catch (error) {
      console.error("Error getting file URL:", error);
      throw new Error("Failed to fetch file");
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
      const storage = await getStorageLazy();
      const { ref, deleteObject } = await import("firebase/storage");
      const fileRef = ref(storage, url);
      await this.withTimeout(deleteObject(fileRef), "File delete");
    } catch (error) {
      console.error("Error deleting file:", error);
      throw new Error("Failed to delete file");
    }
  }

  /**
   * Upload expense receipt
   * @param file - The receipt file (image or PDF)
   * @param tenantId - Tenant ID for storage isolation
   * @param expenseId - Expense ID (pre-generated Firestore doc ID for new expenses)
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
   * Upload company logo for tenant branding
   * @param file - The image file to upload
   * @param tenantId - Tenant ID for storage isolation
   * @returns Promise with download URL
   */
  async uploadCompanyLogo(file: File, tenantId: string): Promise<string> {
    const timestamp = Date.now();
    const rawExtension = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeExtension = rawExtension.replace(/[^a-z0-9]/g, "") || "png";
    const fileName = `company-logo_${timestamp}.${safeExtension}`;
    const path = `tenants/${tenantId}/branding/company-logo/${fileName}`;

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
   * Validate company logo image (images only, max 5MB)
   */
  validateImageFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!file.type.startsWith("image/")) {
      return { valid: false, error: "Please upload an image file (PNG, JPG, WebP, or SVG)" };
    }

    if (file.size > maxSize) {
      return { valid: false, error: "Image size must be under 5MB" };
    }

    return { valid: true };
  }

  validateDocumentFile(
    file: File,
    allowedTypes: string[] = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxSizeMb = 10,
  ): { valid: boolean; error?: string } {
    const maxSize = maxSizeMb * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: "Please upload a supported document type" };
    }

    if (file.size > maxSize) {
      return { valid: false, error: `File size must be under ${maxSizeMb}MB` };
    }

    return { valid: true };
  }

}

export const fileUploadService = FileUploadService.getInstance();
