import { ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support";

interface HelpSupportCardProps {
  action?: { to: string; label: string };
}

export function HelpSupportCard({ action }: HelpSupportCardProps) {
  const { t } = useI18n();

  return (
    <aside className="mt-10 rounded-xl border border-border/70 bg-muted/20 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-semibold">{t("help.stillStuckTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("help.stillStuckBody")}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {action && (
          <Button asChild className="min-h-11 sm:min-h-10">
            <Link to={action.to}>
              {action.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="min-h-11 sm:min-h-10">
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("help.talkToUsShort")}
          </a>
        </Button>
      </div>
    </aside>
  );
}
