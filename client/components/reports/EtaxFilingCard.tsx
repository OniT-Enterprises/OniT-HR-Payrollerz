/**
 * Generic assisted e-Tax filing card (presentational).
 *
 * The ATTL e-Tax portal (e-tax.mof.gov.tl) has no public API and filing is a
 * legal act, so Xefe never submits. This surfaces the exact line values a
 * given return needs — grouped by the portal's tax accounts — with copy
 * buttons, steps, and a link to the portal so the user reviews and submits in
 * their own session. Callers build the account/line data from their own
 * report (payroll WIT, money installment tax, …).
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { Copy, ExternalLink, Landmark } from "lucide-react";

const ETAX_DECLARATIONS_URL = "https://e-tax.mof.gov.tl/declarations";

export interface EtaxLine {
  /** Portal line label, e.g. "Line 5". */
  number: string;
  label: string;
  value: number;
  /** money → "US$ 1,234.00"; percent → "0.5%". Default money. */
  kind?: "money" | "percent";
}

export interface EtaxAccount {
  name: string;
  meta?: string;
  lines: EtaxLine[];
}

export interface EtaxFilingCardProps {
  title: string;
  description: string;
  accounts: EtaxAccount[];
  steps?: string[];
  className?: string;
}

function displayValue(line: EtaxLine): string {
  if (line.kind === "percent") {
    return `${line.value}%`;
  }
  return `US$ ${line.value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function copyText(line: EtaxLine): string {
  return line.kind === "percent" ? String(line.value) : line.value.toFixed(2);
}

export function EtaxFilingCard({ title, description, accounts, steps, className }: EtaxFilingCardProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  const copy = async (line: EtaxLine) => {
    try {
      await navigator.clipboard.writeText(copyText(line));
      toast({
        title: t("reports.etaxFiling.copied") || "Copied",
        description: `${line.label}: ${displayValue(line)}`,
      });
    } catch {
      toast({
        title: t("common.error") || "Error",
        description: t("reports.etaxFiling.copyFailed") || "Could not copy — select and copy manually",
        variant: "destructive",
      });
    }
  };

  const visibleAccounts = accounts.filter((a) => a.lines.length > 0);
  if (visibleAccounts.length === 0) return null;

  const defaultSteps = [
    t("reports.etaxFiling.step1") || "Open the e-Tax portal and log in.",
    t("reports.etaxFiling.step2") ||
      "Under Declarations, pick the matching account and this period.",
    t("reports.etaxFiling.step3") || "Enter the values above, review, and submit in the portal.",
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleAccounts.map((account) => (
            <div key={account.name} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{account.name}</p>
                {account.meta && (
                  <span className="text-xs text-muted-foreground shrink-0">{account.meta}</span>
                )}
              </div>
              {account.lines.map((line) => (
                <div key={line.number} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{line.number}</p>
                    <p className="text-sm truncate">{line.label}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold tabular-nums">{displayValue(line)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("reports.etaxFiling.copy") || "Copy value"}
                      onClick={() => copy(line)}
                      title={t("reports.etaxFiling.copy") || "Copy value"}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <ol className="text-sm text-muted-foreground list-decimal ml-5 space-y-1">
          {(steps ?? defaultSteps).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>

        <Button asChild variant="outline">
          <a href={ETAX_DECLARATIONS_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            {t("reports.etaxFiling.openPortal") || "Open e-Tax portal"}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
