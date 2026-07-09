/**
 * Contract template service
 * Platform-wide work contract templates managed by superadmins and
 * consumed by tenants when adding employees (auto-fill / AI quick fill).
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import { fileUploadService } from "@/services/fileUploadService";

export type ContractTemplateLanguage = "en" | "pt" | "tet" | "other";

export interface ContractTemplate {
  id?: string;
  name: string;
  description?: string;
  language: ContractTemplateLanguage;
  /** Extracted plain text of the template, used for auto-fill and AI quick fill */
  bodyText: string;
  /** {{tokens}} detected in bodyText */
  placeholders: string[];
  /** Original uploaded file (kept for download / manual use) */
  fileName?: string;
  filePath?: string;
  fileUrl?: string;
  sizeBytes?: number;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  createdByEmail?: string;
}

export interface ContractTemplateInput {
  name: string;
  description?: string;
  language: ContractTemplateLanguage;
  bodyText: string;
  file?: File | null;
  actorUid: string;
  actorEmail: string;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function mapTemplate(id: string, data: Record<string, unknown>): ContractTemplate {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    description: typeof data.description === "string" ? data.description : "",
    language: (["en", "pt", "tet", "other"].includes(data.language as string)
      ? data.language
      : "other") as ContractTemplateLanguage,
    bodyText: typeof data.bodyText === "string" ? data.bodyText : "",
    placeholders: Array.isArray(data.placeholders)
      ? data.placeholders.filter((p): p is string => typeof p === "string")
      : [],
    fileName: typeof data.fileName === "string" ? data.fileName : undefined,
    filePath: typeof data.filePath === "string" ? data.filePath : undefined,
    fileUrl: typeof data.fileUrl === "string" ? data.fileUrl : undefined,
    sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : undefined,
    active: data.active !== false,
    createdAt:
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
    updatedAt:
      data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
    createdByEmail:
      typeof data.createdByEmail === "string" ? data.createdByEmail : undefined,
  };
}

class ContractTemplateService {
  /**
   * Extract plain text from a .docx file in the browser.
   * DOCX is a zip; the document body lives in word/document.xml.
   */
  async extractDocxText(file: File): Promise<string> {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const docEntry = zip.file("word/document.xml");
    if (!docEntry) {
      throw new Error("Not a valid .docx file (missing word/document.xml)");
    }
    const xml = await docEntry.async("string");

    // Split into paragraphs on </w:p>, keep text runs, strip remaining tags.
    const paragraphs = xml
      .split(/<\/w:p>/)
      .map((chunk) =>
        chunk
          // Tabs and explicit line breaks inside a paragraph
          .replace(/<w:tab[^>]*\/>/g, "\t")
          .replace(/<w:br[^>]*\/>/g, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
          .trimEnd(),
      );

    return paragraphs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  /** Detect {{token}} placeholders in template text */
  detectPlaceholders(text: string): string[] {
    const found = new Set<string>();
    for (const match of text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
      found.add(match[1]);
    }
    return Array.from(found);
  }

  validateTemplateFile(file: File): { valid: boolean; error?: string } {
    const isDocx =
      file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
    if (!isDocx) {
      return { valid: false, error: "Please upload a .docx file" };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, error: "File size must be under 10MB" };
    }
    return { valid: true };
  }

  /** All templates, newest first (superadmin console) */
  async getAllTemplates(): Promise<ContractTemplate[]> {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, paths.contractTemplates()));
    return snapshot.docs
      .map((templateDoc) => mapTemplate(templateDoc.id, templateDoc.data()))
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
  }

  /** Active templates only (tenant side), sorted by name */
  async getActiveTemplates(): Promise<ContractTemplate[]> {
    if (!db) return [];
    const snapshot = await getDocs(
      query(collection(db, paths.contractTemplates()), where("active", "==", true)),
    );
    return snapshot.docs
      .map((templateDoc) => mapTemplate(templateDoc.id, templateDoc.data()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createTemplate(input: ContractTemplateInput): Promise<string> {
    if (!db) throw new Error("Database not available");

    const templateRef = doc(collection(db, paths.contractTemplates()));
    let fileName: string | undefined;
    let filePath: string | undefined;
    let fileUrl: string | undefined;
    let sizeBytes: number | undefined;

    if (input.file) {
      fileName = input.file.name;
      sizeBytes = input.file.size;
      filePath = `platform/contractTemplates/${templateRef.id}/${fileName}`;
      fileUrl = await fileUploadService.uploadFile(input.file, filePath, {
        contentType: input.file.type || DOCX_MIME,
      });
    }

    await setDoc(templateRef, {
      name: input.name.trim(),
      description: input.description?.trim() || "",
      language: input.language,
      bodyText: input.bodyText,
      placeholders: this.detectPlaceholders(input.bodyText),
      fileName: fileName || null,
      filePath: filePath || null,
      fileUrl: fileUrl || null,
      sizeBytes: sizeBytes ?? null,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.actorUid,
      createdByEmail: input.actorEmail,
    });

    return templateRef.id;
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<
      Pick<ContractTemplate, "name" | "description" | "language" | "bodyText" | "active">
    >,
  ): Promise<void> {
    if (!db) throw new Error("Database not available");

    const payload: Record<string, unknown> = {
      ...updates,
      updatedAt: serverTimestamp(),
    };
    if (typeof updates.bodyText === "string") {
      payload.placeholders = this.detectPlaceholders(updates.bodyText);
    }

    await updateDoc(doc(db, paths.contractTemplate(templateId)), payload);
  }

  async deleteTemplate(template: ContractTemplate): Promise<void> {
    if (!db || !template.id) throw new Error("Database not available");

    if (template.filePath) {
      try {
        await fileUploadService.deleteFile(template.filePath);
      } catch (error) {
        // Missing storage object should not block removing the template doc
        console.warn("Could not delete template file:", error);
      }
    }

    await deleteDoc(doc(db, paths.contractTemplate(template.id)));
  }
}

export const contractTemplateService = new ContractTemplateService();
