/**
 * Founding-user offer callout — the "6 months free" promotion used to recruit
 * the first real Timor-Leste businesses onto Xefe. Shown in the Landing hero and
 * at the top of the Pricing page. Self-contained (no fixed positioning) so it can
 * drop into any marketing layout without fighting the fixed PublicNav.
 *
 * Copy lives under `landing.simple.founding.*` (en / tet / pt) so it stays
 * translatable and editable without a code change.
 */
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export function FoundingOffer({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-amber-400/25 bg-amber-400/[0.04] p-6 sm:p-7",
        className,
      )}
    >
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200">
        <Sparkles className="h-3.5 w-3.5" />
        {t("landing.simple.founding.badge")}
      </div>

      <p className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-[1.7rem]">
        {t("landing.simple.founding.title")}
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
        {t("landing.simple.founding.description")}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          asChild
          className="h-11 bg-amber-400 px-6 font-bold text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300"
        >
          <Link to="/auth/signup">
            {t("landing.simple.founding.cta")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <p className="mt-4 max-w-xl text-xs leading-5 text-zinc-500">
        {t("landing.simple.founding.note")}
      </p>
    </div>
  );
}
