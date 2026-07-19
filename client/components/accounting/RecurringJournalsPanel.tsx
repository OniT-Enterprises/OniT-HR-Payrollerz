/**
 * Recurring journal templates — management dialog for the Journal Entries
 * page. Templates are created from an existing entry ("Make recurring…");
 * this panel lists them, toggles activation, edits the schedule, deletes.
 * Posting happens nightly in functions/src/accounting.ts.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { recurringJournalService } from "@/services/recurringJournalService";
import type { RecurringJournalTemplate } from "@/types/accounting";
import { formatDateTL } from "@/lib/dateUtils";

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RecurringJournalsPanel({
  tenantId,
  open,
  onOpenChange,
  canManage,
}: {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RecurringJournalTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecurringJournalTemplate | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await recurringJournalService.list(tenantId));
    } catch (error) {
      console.error("Failed to load recurring journals:", error);
      toast({
        title: t("common.error"),
        description: t("accounting.recurring.loadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast, t]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const handleToggle = async (template: RecurringJournalTemplate, active: boolean) => {
    if (!template.id) return;
    try {
      await recurringJournalService.setActive(tenantId, template.id, active);
      setTemplates((prev) =>
        prev.map((item) => (item.id === template.id ? { ...item, active } : item)),
      );
    } catch (error) {
      console.error("Failed to toggle recurring journal:", error);
      toast({ title: t("common.error"), description: t("accounting.recurring.saveError"), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await recurringJournalService.remove(tenantId, deleteTarget.id);
      setTemplates((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toast({ title: t("accounting.recurring.deletedTitle") });
    } catch (error) {
      console.error("Failed to delete recurring journal:", error);
      toast({ title: t("common.error"), description: t("accounting.recurring.saveError"), variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-orange-500" />
              {t("accounting.recurring.title")}
            </DialogTitle>
            <DialogDescription>{t("accounting.recurring.description")}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-lg border border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              {t("accounting.recurring.empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{template.name}</span>
                      <Badge variant="outline" className="shrink-0 font-mono tabular-nums">
                        {money(template.totalDebit)}
                      </Badge>
                      {!template.active && (
                        <Badge variant="secondary" className="shrink-0">
                          {t("accounting.recurring.paused")}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("accounting.recurring.schedule", { day: String(template.dayOfMonth) })}
                      {" · "}
                      {t("accounting.recurring.nextRun", {
                        date: formatDateTL(template.nextRunDate),
                      })}
                      {template.lastEntryNumber
                        ? ` · ${t("accounting.recurring.lastPosted", { ref: template.lastEntryNumber })}`
                        : ""}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={template.active}
                        onCheckedChange={(checked) => void handleToggle(template, checked)}
                        aria-label={t("accounting.recurring.activeToggle")}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(template)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accounting.recurring.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("accounting.recurring.deleteDescription", { name: deleteTarget?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * "Make recurring…" dialog — turns an existing posted entry into a monthly
 * template. Kept tiny: name + day-of-month (defaults from the entry).
 */
export function MakeRecurringDialog({
  tenantId,
  entry,
  onOpenChange,
  createdBy,
}: {
  tenantId: string;
  entry: import("@/types/accounting").JournalEntry | null;
  onOpenChange: (open: boolean) => void;
  createdBy: string;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setName(entry.description || "");
      setDayOfMonth(Math.min(28, Number(entry.date?.slice(8, 10)) || 1));
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await recurringJournalService.createFromEntry(
        tenantId,
        entry,
        { name, dayOfMonth },
        createdBy,
      );
      toast({
        title: t("accounting.recurring.createdTitle"),
        description: t("accounting.recurring.createdDescription", { name }),
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create recurring journal:", error);
      toast({ title: t("common.error"), description: t("accounting.recurring.saveError"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("accounting.recurring.makeRecurringTitle")}</DialogTitle>
          <DialogDescription>
            {t("accounting.recurring.makeRecurringDescription", {
              ref: entry?.entryNumber || "",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="recurring-name">
              {t("accounting.recurring.nameLabel")}
            </label>
            <input
              id="recurring-name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="recurring-day">
              {t("accounting.recurring.dayLabel")}
            </label>
            <input
              id="recurring-day"
              type="number"
              min={1}
              max={31}
              className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("accounting.recurring.dayHint")}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !name.trim()}>
            {saving ? t("common.saving") : t("accounting.recurring.createAction")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
