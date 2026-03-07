import React from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

interface LocaleSwitcherProps {
  variant?: "dropdown" | "buttons";
  className?: string;
  align?: "start" | "end";
}

export default function LocaleSwitcher({
  variant = "dropdown",
  className,
  align = "end",
}: LocaleSwitcherProps) {
  const { locale, setLocale, localeLabels, t } = useI18n();
  const localeOptions = Object.entries(localeLabels) as Array<[typeof locale, string]>;

  if (variant === "buttons") {
    return (
      <div
        className={cn("flex flex-wrap items-center gap-2", className)}
        role="group"
        aria-label={t("common.language")}
      >
        {localeOptions.map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={locale === key ? "default" : "outline"}
            onClick={() => setLocale(key)}
            className="h-9"
          >
            {label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-2", className)}
          title={t("common.language")}
        >
          <Languages className="h-4 w-4" />
          <span>{localeLabels[locale]}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        {localeOptions.map(([key, label]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setLocale(key)}
            className={locale === key ? "bg-accent" : ""}
          >
            {label}
            {locale === key && <Check className="ml-auto h-4 w-4 text-emerald-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
