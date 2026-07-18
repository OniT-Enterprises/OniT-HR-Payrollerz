/**
 * Local "on this page" bar for long public pages, pinned directly under the
 * main PublicNav bar. It names the page you are on (in the page's accent
 * color) and offers section jumps — keeping in-page anchors out of the main
 * menu, which links to whole pages only. Pages that render this bar must add
 * ~2.75rem of extra top padding to their hero and use scroll-mt-32 on the
 * target sections.
 */
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";

export type PublicAccent = "amber" | "lime" | "sky";

const ACCENT_TEXT: Record<PublicAccent, string> = {
  amber: "text-amber-300",
  lime: "text-lime-300",
  sky: "text-sky-300",
};

const ACCENT_DOT: Record<PublicAccent, string> = {
  amber: "bg-amber-400",
  lime: "bg-lime-400",
  sky: "bg-sky-400",
};

export interface PublicSection {
  id: string;
  labelKey: string;
}

export function PublicSectionNav({
  pageLabelKey,
  accent,
  sections,
}: {
  pageLabelKey: string;
  accent: PublicAccent;
  sections: PublicSection[];
}) {
  const { t } = useI18n();
  const location = useLocation();

  return (
    <div className="fixed inset-x-0 top-16 z-30 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur-md">
      <div className="mx-auto flex h-11 max-w-7xl items-center gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span
          className={cn(
            "flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wider",
            ACCENT_TEXT[accent],
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", ACCENT_DOT[accent])} />
          {t(pageLabelKey)}
        </span>
        <span className="h-4 w-px shrink-0 bg-white/10" aria-hidden="true" />
        {sections.map((section) => (
          <Link
            key={section.id}
            to={`${location.pathname}#${section.id}`}
            className="shrink-0 whitespace-nowrap text-xs text-zinc-400 transition-colors hover:text-white"
          >
            {t(section.labelKey)}
          </Link>
        ))}
      </div>
    </div>
  );
}
