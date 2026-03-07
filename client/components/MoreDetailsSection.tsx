import React, { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useI18n } from "@/i18n/I18nProvider";
import { ChevronDown } from "lucide-react";

interface MoreDetailsSectionProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  title?: string;
}

export default function MoreDetailsSection({
  children,
  className = "",
  contentClassName = "",
  defaultOpen = false,
  title,
}: MoreDetailsSectionProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="mb-3 flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <span>{open ? t("common.hide") : title || t("common.moreDetails")}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className={contentClassName}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
