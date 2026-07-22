/**
 * Contract Templates (superadmin console)
 * Upload and manage platform-wide work contract templates. Tenants pick a
 * template while adding an employee and auto-fill it with employee data or
 * AI Quick Fill.
 */

import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useContractTemplates,
  useCreateContractTemplate,
  useDeleteContractTemplate,
  useUpdateContractTemplate,
} from "@/hooks/useAdmin";
import {
  contractTemplateService,
  type ContractTemplate,
  type ContractTemplateLanguage,
} from "@/services/contractTemplateService";
import { CONTRACT_PLACEHOLDERS } from "@/lib/contractFill";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";

// Columns the templates table can be sorted by (Actions is not sortable)
type ContractTemplateSortKey = "name" | "language" | "file" | "placeholders" | "active";

const LANGUAGE_LABELS: Record<ContractTemplateLanguage, string> = {
  en: "English",
  pt: "Português",
  tet: "Tetun",
  other: "Other",
};

interface TemplateFormState {
  name: string;
  description: string;
  language: ContractTemplateLanguage;
  bodyText: string;
  file: File | null;
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  description: "",
  language: "pt",
  bodyText: "",
  file: null,
};

export default function ContractTemplates() {
  const { user } = useAuth();
  const { data: templates = [], isLoading } = useContractTemplates();
  const createMutation = useCreateContractTemplate();
  const updateMutation = useUpdateContractTemplate();
  const deleteMutation = useDeleteContractTemplate();

  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [extracting, setExtracting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  const detectedTokens = useMemo(
    () => contractTemplateService.detectPlaceholders(form.bodyText),
    [form.bodyText],
  );

  // Column sorting (asc → desc → off)
  const { sorted: sortedTemplates, sort, toggleSort } = useTableSort<ContractTemplate, ContractTemplateSortKey>(
    templates,
    {
      name: (tpl) => tpl.name,
      language: (tpl) => LANGUAGE_LABELS[tpl.language],
      file: (tpl) => tpl.fileName || "",
      placeholders: (tpl) => tpl.placeholders.length,
      active: (tpl) => (tpl.active ? 1 : 0),
    },
  );

  // Renders a sortable shadcn <TableHead> wired to the sort state above
  const sortableHead = (key: ContractTemplateSortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort?.key === key;
    return (
      <TableHead
        aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
        className={align === "right" ? "text-right" : undefined}
      >
        <SortableColumnHeader
          label={label}
          active={active}
          direction={active ? sort!.direction : "asc"}
          onSort={() => toggleSort(key)}
          align={align}
        />
      </TableHead>
    );
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (template: ContractTemplate) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      description: template.description || "",
      language: template.language,
      bodyText: template.bodyText,
      file: null,
    });
    setShowDialog(true);
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setForm((prev) => ({ ...prev, file: null }));
      return;
    }

    const validation = contractTemplateService.validateTemplateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setExtracting(true);
    try {
      const text = await contractTemplateService.extractDocxText(file);
      setForm((prev) => ({
        ...prev,
        file,
        bodyText: text,
        name: prev.name || file.name.replace(/\.docx$/i, ""),
      }));
      toast.success("Template text extracted — review it below");
    } catch (error) {
      console.error("Text extraction failed:", error);
      toast.error("Could not read the .docx file");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!form.bodyText.trim()) {
      toast.error("Template text is empty — upload a .docx or paste the contract text");
      return;
    }

    try {
      if (editingTemplate?.id) {
        await updateMutation.mutateAsync({
          templateId: editingTemplate.id,
          updates: {
            name: form.name,
            description: form.description,
            language: form.language,
            bodyText: form.bodyText,
          },
        });
        toast.success("Template updated");
      } else {
        await createMutation.mutateAsync({
          name: form.name,
          description: form.description,
          language: form.language,
          bodyText: form.bodyText,
          file: form.file,
          actorUid: user.uid,
          actorEmail: user.email || "",
        });
        toast.success("Template uploaded — tenants can now use it");
      }
      setShowDialog(false);
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Could not save the template");
    }
  };

  const handleToggleActive = async (template: ContractTemplate, active: boolean) => {
    if (!template.id) return;
    try {
      await updateMutation.mutateAsync({ templateId: template.id, updates: { active } });
      toast.success(active ? "Template activated" : "Template deactivated");
    } catch (error) {
      console.error("Error toggling template:", error);
      toast.error("Could not update the template");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast.success("Template deleted");
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Could not delete the template");
    } finally {
      setDeleteTarget(null);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="px-6 py-8 lg:px-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-emerald-600">
              Platform documents
            </p>
            <h1 className="text-4xl font-bold tracking-tight">Contract Templates</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Work contract templates available to every tenant. When adding an
              employee, tenants pick a template and fill it automatically with the
              employee's data or with AI Quick Fill.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Upload template
          </Button>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Templates
            </CardTitle>
            <CardDescription>
              Only active templates are shown to tenants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No templates yet. Upload a .docx work contract to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {sortableHead("name", "Name")}
                    {sortableHead("language", "Language")}
                    {sortableHead("file", "File")}
                    {sortableHead("placeholders", "Placeholders")}
                    {sortableHead("active", "Active")}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-muted-foreground">
                            {template.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {LANGUAGE_LABELS[template.language]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {template.fileName || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {template.placeholders.length > 0
                          ? `${template.placeholders.length} tokens`
                          : "AI fill only"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={template.active}
                          onCheckedChange={(checked) =>
                            handleToggleActive(template, checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {template.fileUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              aria-label="Download original file"
                              title="Download original file"
                            >
                              <a
                                href={template.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Edit template"
                            onClick={() => openEdit(template)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Delete template"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteTarget(template)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Collapsible open={showPlaceholders} onOpenChange={setShowPlaceholders}>
          <Card className="border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Placeholder reference for template authors</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showPlaceholders ? "rotate-180" : ""}`}
                  />
                </CardTitle>
                <CardDescription>
                  Add these tokens to a template (e.g.{" "}
                  <code className="text-xs">{"{{employee.fullName}}"}</code>) for instant
                  auto-fill without AI. Templates with dotted blanks ("……") still work via
                  AI Quick Fill.
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {CONTRACT_PLACEHOLDERS.map((placeholder) => (
                  <div key={placeholder.token} className="text-sm flex items-baseline gap-2">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {`{{${placeholder.token}}}`}
                    </code>
                    <span className="text-xs text-muted-foreground truncate">
                      {placeholder.example}
                    </span>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Upload / edit dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Edit template" : "Upload contract template"}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate
                  ? "Update the template details and text."
                  : "Upload a .docx file — the text is extracted automatically — or paste the contract text directly."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {!editingTemplate && (
                <div className="space-y-2">
                  <Label htmlFor="templateFile">Template file (.docx)</Label>
                  <Input
                    id="templateFile"
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    disabled={extracting}
                  />
                  {extracting && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Extracting text…
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Name</Label>
                  <Input
                    id="templateName"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="SEFOPE Work Contract (PT)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={form.language}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        language: value as ContractTemplateLanguage,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">Português</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="tet">Tetun</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateDescription">Description (optional)</Label>
                <Input
                  id="templateDescription"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Fixed-term contract for foreign workers, SEFOPE format"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="templateBody">Template text</Label>
                  <span className="text-xs text-muted-foreground">
                    {detectedTokens.length > 0
                      ? `${detectedTokens.length} placeholder tokens detected`
                      : "No {{tokens}} — tenants will use AI Quick Fill"}
                  </span>
                </div>
                <Textarea
                  id="templateBody"
                  value={form.bodyText}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, bodyText: e.target.value }))
                  }
                  rows={14}
                  className="font-mono text-xs"
                  placeholder={"CONTRATO DE TRABALHO\nENTRE\n{{company.name}} (EMPREGADOR)\nE\n{{employee.fullName}} (TRABALHADOR)\n…"}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || extracting}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingTemplate ? "Save changes" : "Upload template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Tenants will no longer be able to generate contracts from this
                template. The uploaded file is deleted too. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
              >
                Delete template
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
