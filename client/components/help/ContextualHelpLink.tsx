import { BookOpen, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

interface ContextualHelpLinkProps {
  slug: string;
  anchor?: string;
  className?: string;
}

/** A quiet, stable route to the guide for the task currently on screen. */
export function ContextualHelpLink({
  slug,
  anchor,
  className,
}: ContextualHelpLinkProps) {
  const { t } = useI18n();
  const hash = anchor ? `#${anchor}` : "";

  return (
    <Link
      to={`/help/guide/${slug}${hash}`}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
        className,
      )}
    >
      <BookOpen className="h-4 w-4 text-primary" />
      <span>{t("help.helpWithThisPage")}</span>
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}
