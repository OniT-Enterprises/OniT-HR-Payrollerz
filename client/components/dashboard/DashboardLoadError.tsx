import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

interface DashboardLoadErrorProps {
  onRetry: () => void | Promise<unknown>;
  isRetrying?: boolean;
}

/**
 * Calm, actionable fallback for dashboard summary queries.
 * Keeps stale/partial data from being mistaken for an all-clear state.
 */
export default function DashboardLoadError({ onRetry, isRetrying = false }: DashboardLoadErrorProps) {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <div
        className="flex max-w-2xl items-start gap-4 rounded-2xl border border-amber-200 bg-card p-5 dark:border-amber-900/60"
        role="alert"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold">{t("common.connectionIssueTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("common.connectionIssueDesc")}</p>
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            disabled={isRetrying}
            onClick={() => void onRetry()}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
            {t("common.retry")}
          </Button>
        </div>
      </div>
    </div>
  );
}
