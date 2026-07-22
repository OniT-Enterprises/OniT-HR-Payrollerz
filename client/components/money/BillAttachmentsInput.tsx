/**
 * Bill Attachments Input
 * Drag-and-drop zone + file picker for staging bill attachment files (images/PDFs).
 * Files are staged locally; the parent uploads them on save.
 */

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/I18nProvider';
import { BILL_FILE_ACCEPT, partitionBillFiles } from '@/lib/billFiles';
import { FileText, Upload, X, ExternalLink } from 'lucide-react';

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface BillAttachmentsInputProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Attachments already saved on the bill (edit mode) — shown as links */
  existingUrls?: string[];
  onInvalidFiles?: (errors: string[]) => void;
  disabled?: boolean;
}

export default function BillAttachmentsInput({
  files,
  onFilesChange,
  existingUrls = [],
  onInvalidFiles,
  disabled = false,
}: BillAttachmentsInputProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Blob preview URLs are derived from the staged files. Computing them during
  // render (rather than via setState in an effect) avoids the cascading-render
  // lint rule; a cleanup-only effect revokes them when they change/unmount.
  const previews = useMemo(
    () => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null)),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [previews]);

  const addFiles = (incoming: File[]) => {
    if (disabled || incoming.length === 0) return;
    const { valid, errors } = partitionBillFiles(incoming);
    if (errors.length > 0) onInvalidFiles?.(errors);
    if (valid.length > 0) onFilesChange([...files, ...valid]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragActive(true);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {/* Existing saved attachments (edit mode) */}
      {existingUrls.length > 0 && (
        <div className="space-y-1">
          {existingUrls.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-1"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {(t('money.bills.attachment') || 'Attachment') + ` ${i + 1}`}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ))}
        </div>
      )}

      {/* Staged files */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-2 border rounded-md bg-muted/50"
            >
              {previews[index] ? (
                <img
                  src={previews[index] as string}
                  alt=""
                  className="h-10 w-10 rounded object-cover shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('common.remove')}
                className="shrink-0"
                onClick={() => removeFile(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Dropzone / browse */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragActive(false)}
        className={`flex flex-col items-center justify-center gap-1 px-4 py-5 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-center">
          {t('money.bills.dropzoneHint') || 'Drag & drop bill files here, or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground text-center">
          {t('money.bills.dropzoneFormats') || 'PDF or photo, up to 10MB each'}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={BILL_FILE_ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          addFiles(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />
    </div>
  );
}
