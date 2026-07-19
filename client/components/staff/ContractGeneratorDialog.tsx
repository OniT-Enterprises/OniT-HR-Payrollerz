/**
 * Contract Generator Dialog
 * Lets HR pick a platform contract template while adding an employee,
 * auto-fill it with the wizard's data ({{token}} merge) or use AI Quick
 * Fill, review/edit the result, then attach it as the work contract PDF
 * or download it.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileText, Loader2, Paperclip, Sparkles, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenantId } from "@/contexts/TenantContext";
import { useSettings } from "@/hooks/useSettings";
import { getFunctionsLazy } from "@/lib/firebase";
import {
  contractTemplateService,
  type ContractTemplate,
} from "@/services/contractTemplateService";
import {
  buildContractFillData,
  fillTemplateTokens,
  type ContractFillData,
} from "@/lib/contractFill";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  pt: "Português",
  tet: "Tetun",
  other: "—",
};

export interface ContractGeneratorInput {
  form: Parameters<typeof buildContractFillData>[0]["form"];
  docValues: Parameters<typeof buildContractFillData>[0]["docValues"];
  additionalInfo: Parameters<typeof buildContractFillData>[0]["additionalInfo"];
}

interface ContractGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: ContractGeneratorInput;
  employeeName: string;
  onAttach: (file: File) => void;
}

export default function ContractGeneratorDialog({
  open,
  onOpenChange,
  input,
  employeeName,
  onAttach,
}: ContractGeneratorDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const tenantId = useTenantId();

  const [selectedId, setSelectedId] = useState<string>("");
  const [contractText, setContractText] = useState("");
  const [missingTokens, setMissingTokens] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["contractTemplates", "active"],
    queryFn: () => contractTemplateService.getActiveTemplates(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Canonical settings query (settingsKeys.all) so a settings update
  // invalidates and refreshes the values shown here (finding 13).
  const { data: settings } = useSettings(open);

  const fillData: ContractFillData = useMemo(
    () =>
      buildContractFillData({
        form: input.form,
        docValues: input.docValues,
        additionalInfo: input.additionalInfo,
        company: settings?.companyDetails,
      }),
    [input, settings],
  );

  const selectedTemplate: ContractTemplate | undefined = templates.find(
    (template) => template.id === selectedId,
  );

  // Reset when the dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedId("");
      setContractText("");
      setMissingTokens([]);
      setAiLoading(false);
      setExporting(false);
    }
  }, [open]);

  const applyAutoFill = (template: ContractTemplate) => {
    const result = fillTemplateTokens(template.bodyText, fillData);
    setContractText(result.text);
    setMissingTokens(result.missing);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (template) {
      applyAutoFill(template);
    }
  };

  const handleQuickFillAi = async () => {
    if (!selectedTemplate || aiLoading) return;
    setAiLoading(true);
    try {
      const [{ httpsCallable }, functions] = await Promise.all([
        import("firebase/functions"),
        getFunctionsLazy(),
      ]);
      const quickFill = httpsCallable<
        { tenantId: string; templateText: string; data: ContractFillData },
        { success: boolean; contract: string }
      >(functions, "contractQuickFill");

      const result = await quickFill({
        tenantId,
        templateText: selectedTemplate.bodyText,
        data: fillData,
      });

      if (result.data?.contract) {
        setContractText(result.data.contract);
        setMissingTokens([]);
        toast({
          title: t("addEmployee.contractGen.aiDoneTitle"),
          description: t("addEmployee.contractGen.aiDoneDesc"),
        });
      }
    } catch (error) {
      console.error("AI quick fill failed:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("addEmployee.contractGen.aiFailedDesc");
      toast({
        title: t("addEmployee.contractGen.aiFailedTitle"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const buildPdfFile = async (): Promise<File> => {
    const { contractTextToPdfBlob } = await import(
      "@/components/staff/ContractPdf"
    );
    const companyName =
      settings?.companyDetails?.legalName ||
      settings?.companyDetails?.tradingName ||
      "";
    const blob = await contractTextToPdfBlob({
      text: contractText,
      footerNote: [companyName, t("addEmployee.contractGen.pdfFooter")]
        .filter(Boolean)
        .join(" · "),
    });
    // Strip accents/diacritics and non-alphanumerics for a safe filename
    const safeName =
      Array.from((employeeName || "employee").normalize("NFD"))
        .filter((ch) => /[a-zA-Z0-9 _-]/.test(ch))
        .join("")
        .trim()
        .replace(/[\s-]+/g, "_") || "employee";
    return new File([blob], `Contract_${safeName}.pdf`, {
      type: "application/pdf",
    });
  };

  const handleAttach = async () => {
    if (!contractText.trim() || exporting) return;
    setExporting(true);
    try {
      const file = await buildPdfFile();
      onAttach(file);
      onOpenChange(false);
      toast({
        title: t("addEmployee.contractGen.attachedTitle"),
        description: t("addEmployee.contractGen.attachedDesc"),
      });
    } catch (error) {
      console.error("Contract PDF generation failed:", error);
      toast({
        title: t("addEmployee.contractGen.pdfFailedTitle"),
        description: t("addEmployee.contractGen.pdfFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = async () => {
    if (!contractText.trim() || exporting) return;
    setExporting(true);
    try {
      const file = await buildPdfFile();
      const { downloadBlob } = await import("@/lib/downloadBlob");
      downloadBlob(file, file.name);
    } catch (error) {
      console.error("Contract PDF download failed:", error);
      toast({
        title: t("addEmployee.contractGen.pdfFailedTitle"),
        description: t("addEmployee.contractGen.pdfFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t("addEmployee.contractGen.title")}
          </DialogTitle>
          <DialogDescription>
            {t("addEmployee.contractGen.description")}
          </DialogDescription>
        </DialogHeader>

        {templatesLoading ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2 flex-1 min-w-[240px]">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        ) : templates.length === 0 ? (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              {t("addEmployee.contractGen.noTemplates")}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2 flex-1 min-w-[240px]">
                <Label>{t("addEmployee.contractGen.selectTemplate")}</Label>
                <Select value={selectedId} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("addEmployee.contractGen.selectPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id!}>
                        {template.name}
                        {LANGUAGE_LABELS[template.language] !== "—"
                          ? ` (${LANGUAGE_LABELS[template.language]})`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => selectedTemplate && applyAutoFill(selectedTemplate)}
                disabled={!selectedTemplate || aiLoading}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {t("addEmployee.contractGen.autoFill")}
              </Button>
              <Button
                onClick={handleQuickFillAi}
                disabled={!selectedTemplate || aiLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {aiLoading
                  ? t("addEmployee.contractGen.aiWorking")
                  : t("addEmployee.contractGen.quickFillAi")}
              </Button>
            </div>

            {selectedTemplate?.description && (
              <p className="text-xs text-muted-foreground">
                {selectedTemplate.description}
              </p>
            )}

            {missingTokens.length > 0 && (
              <Alert>
                <AlertDescription className="text-xs">
                  {t("addEmployee.contractGen.missingTokens")}{" "}
                  {missingTokens.map((token) => (
                    <Badge key={token} variant="outline" className="mr-1 text-xs">
                      {token}
                    </Badge>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {selectedTemplate && (
              <div className="space-y-2">
                <Label htmlFor="contractPreview">
                  {t("addEmployee.contractGen.preview")}
                </Label>
                <Textarea
                  id="contractPreview"
                  value={contractText}
                  onChange={(e) => setContractText(e.target.value)}
                  rows={16}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {t("addEmployee.contractGen.previewHint")}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={!contractText.trim() || exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {t("addEmployee.contractGen.downloadPdf")}
          </Button>
          <Button
            onClick={handleAttach}
            disabled={!contractText.trim() || exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4 mr-2" />
            )}
            {t("addEmployee.contractGen.attach")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
