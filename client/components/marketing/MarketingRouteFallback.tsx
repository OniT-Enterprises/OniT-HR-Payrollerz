/**
 * MarketingRouteFallback — dark, hero-shaped skeleton for the lazy public
 * marketing routes (/landing, /how-it-works, /pricing, /accountants). The
 * boot splash is dismissed immediately on public paths, so this is what shows
 * while a marketing chunk loads. Mirrors the shared above-the-fold: fixed
 * PublicNav bar (real logo — it's a static asset), PublicSectionNav strip,
 * and the hero copy block. Deliberately accent-neutral: each page has its own
 * accent and this one fallback serves all four. Keep it dependency-free — it
 * ships in the entry bundle and the size budget is tight.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/I18nProvider";

function Bar({ className }: { className: string }) {
  return <Skeleton className={`bg-white/[0.06] ${className}`} />;
}

export function MarketingRouteFallback() {
  const { t } = useI18n();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("common.loading")}
      className="min-h-screen bg-[#0a0a0b] text-white"
    >
      <span className="sr-only">{t("common.loading")}</span>

      {/* PublicNav mirror */}
      <div className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0b]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <img
            src="/images/illustrations/xefe-logo-light.webp"
            alt="Xefe"
            width="109"
            height="54"
            className="h-8 w-auto sm:h-9"
          />
          <div className="hidden items-center gap-6 md:flex">
            <Bar className="h-3.5 w-12" />
            <Bar className="h-3.5 w-20" />
            <Bar className="h-3.5 w-14" />
            <Bar className="h-3.5 w-24" />
            <Bar className="h-9 w-28 rounded-md" />
          </div>
          <Bar className="h-9 w-9 rounded-md md:hidden" />
        </div>
      </div>

      {/* PublicSectionNav mirror */}
      <div className="fixed inset-x-0 top-16 z-30 border-b border-white/[0.06] bg-[#0a0a0b]/90">
        <div className="mx-auto flex h-11 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Bar className="h-3 w-16" />
          <span className="h-4 w-px shrink-0 bg-white/10" aria-hidden="true" />
          <Bar className="h-3 w-20" />
          <Bar className="h-3 w-16" />
          <Bar className="h-3 w-14" />
        </div>
      </div>

      {/* Hero copy mirror */}
      <main className="pb-20 pt-40 sm:pt-44 lg:pt-52">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <Bar className="mb-6 h-9 w-56 max-w-full rounded-full" />
          <Bar className="h-10 w-full max-w-2xl sm:h-14" />
          <Bar className="mt-3 h-10 w-3/4 max-w-xl sm:h-14" />
          <Bar className="mt-6 h-5 w-full max-w-2xl" />
          <Bar className="mt-2 h-5 w-2/3 max-w-xl" />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Bar className="h-12 w-full rounded-md sm:w-44" />
            <Bar className="h-12 w-full rounded-md sm:w-40" />
          </div>
        </div>
      </main>
    </div>
  );
}
