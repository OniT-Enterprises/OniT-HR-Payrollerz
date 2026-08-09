import { RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

interface RecoverableDraftAlertProps {
  savedAt: number;
  filesNeedReattaching?: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export function RecoverableDraftAlert({
  savedAt,
  filesNeedReattaching = false,
  onRestore,
  onDiscard,
}: RecoverableDraftAlertProps) {
  const { locale, t } = useI18n();
  const localeName = locale === "tet" ? "tet-TL" : locale === "pt" ? "pt-PT" : "en-US";
  const savedTime = new Intl.DateTimeFormat(localeName, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(savedAt));

  return (
    <Alert className="border-cyan-500/30 bg-cyan-500/5">
      <RotateCcw className="h-4 w-4 text-cyan-600" />
      <AlertTitle>{t("common.formRecovery.title")}</AlertTitle>
      <AlertDescription>
        <p>{t("common.formRecovery.savedAt", { time: savedTime })}</p>
        {filesNeedReattaching && (
          <p className="mt-1 text-muted-foreground">
            {t("common.formRecovery.filesNotSaved")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onRestore}>
            {t("common.formRecovery.continue")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
            {t("common.formRecovery.startOver")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

