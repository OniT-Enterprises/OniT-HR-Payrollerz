import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Calm in-content fallback for the first visit to a lazy route.
 *
 * The HTML/Xefe splash is reserved for boot and session restoration. Keeping
 * this fallback neutral means normal navigation never looks like a full app
 * restart, and AppLayout can leave the sidebar and top bar in place.
 */
export function RouteLoadingFallback() {
  const { t } = useI18n();
  const loadingLabel = t("common.loading");

  return (
    <div
      className="w-full bg-background px-4 py-5 sm:px-6 sm:py-6"
      role="status"
      aria-live="polite"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>
      <div className="mx-auto max-w-screen-2xl">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="space-y-4">
            {[72, 56, 64, 48].map((width, index) => (
              <div
                key={width}
                className="flex items-center gap-3 border-b border-border/50 pb-4 last:border-0 last:pb-0"
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4" style={{ width: `${width}%` }} />
                  <Skeleton
                    className="h-3"
                    style={{ width: `${Math.max(width - 20, 28)}%` }}
                  />
                </div>
                {index < 2 && <Skeleton className="h-8 w-16 shrink-0 rounded-md" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
