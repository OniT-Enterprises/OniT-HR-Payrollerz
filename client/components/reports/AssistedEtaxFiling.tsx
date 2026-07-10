/**
 * Assisted e-Tax filing helper.
 *
 * The ATTL e-Tax portal (e-tax.mof.gov.tl) has no public API and filing a
 * return is a legal act, so Xefe never submits on the user's behalf. Instead
 * this surfaces the exact figures the portal's Monthly Wages Income Tax form
 * asks for — it has just two lines: total gross wages paid, and total wages
 * income tax withheld — split into the portal's separate Resident and
 * Non-Resident accounts, with copy buttons and a link to the portal so the
 * user reviews and submits in their own session.
 */

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { addMoney } from "@/lib/currency";
import type { MonthlyWITReturn } from "@/types/tax-filing";
import { Copy, ExternalLink, Landmark } from "lucide-react";

const ETAX_DECLARATIONS_URL = "https://e-tax.mof.gov.tl/declarations";

interface EtaxLineValues {
  grossWages: number;
  witWithheld: number;
  employeeCount: number;
}

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AssistedEtaxFiling({ ret }: { ret: MonthlyWITReturn }) {
  const { t } = useI18n();
  const { toast } = useToast();

  const { resident, nonResident } = useMemo(() => {
    const empty = (): EtaxLineValues => ({ grossWages: 0, witWithheld: 0, employeeCount: 0 });
    const r = empty();
    const nr = empty();
    for (const emp of ret.employees) {
      const bucket = emp.isResident ? r : nr;
      bucket.grossWages = addMoney(bucket.grossWages, emp.grossWages);
      bucket.witWithheld = addMoney(bucket.witWithheld, emp.witWithheld);
      bucket.employeeCount += 1;
    }
    return { resident: r, nonResident: nr };
  }, [ret.employees]);

  const copy = async (value: number, label: string) => {
    try {
      await navigator.clipboard.writeText(value.toFixed(2));
      toast({
        title: t("reports.attlMonthlyWit.etax.copied") || "Copied",
        description: `${label}: ${formatUsd(value)}`,
      });
    } catch {
      toast({
        title: t("common.error") || "Error",
        description: t("reports.attlMonthlyWit.etax.copyFailed") || "Could not copy — select and copy manually",
        variant: "destructive",
      });
    }
  };

  const line1Label =
    t("reports.attlMonthlyWit.etax.line1") || "Total gross wages paid during the month";
  const line2Label =
    t("reports.attlMonthlyWit.etax.line2") || "Total wages income tax withheld during the month";

  const renderAccount = (
    account: string,
    values: EtaxLineValues,
  ) => (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{account}</p>
        <span className="text-xs text-muted-foreground">
          {t("reports.attlMonthlyWit.etax.employeeCount", { count: values.employeeCount }) ||
            `${values.employeeCount} employee(s)`}
        </span>
      </div>
      {[
        { n: 1, label: line1Label, value: values.grossWages },
        { n: 2, label: line2Label, value: values.witWithheld },
      ].map(({ n, label, value }) => (
        <div key={n} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {t("reports.attlMonthlyWit.etax.lineNumber", { number: n }) || `Line ${n}`}
            </p>
            <p className="text-sm truncate">{label}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono font-semibold tabular-nums">US$ {formatUsd(value)}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => copy(value, label)}
              title={t("reports.attlMonthlyWit.etax.copy") || "Copy value"}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-base">
              {t("reports.attlMonthlyWit.etax.title") || "File on e-Tax (assisted)"}
            </CardTitle>
            <CardDescription>
              {t("reports.attlMonthlyWit.etax.description") ||
                "The Monthly Wages Income Tax form asks for just these two totals. Copy them into the e-Tax portal and submit there — Xefe never files on your behalf."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resident.employeeCount > 0 &&
            renderAccount(
              t("reports.attlMonthlyWit.etax.residentAccount") ||
                "Domestic Monthly Wages Income Tax for Resident",
              resident,
            )}
          {nonResident.employeeCount > 0 &&
            renderAccount(
              t("reports.attlMonthlyWit.etax.nonResidentAccount") ||
                "Domestic Monthly Wages Income Tax for Non Resident",
              nonResident,
            )}
        </div>

        <ol className="text-sm text-muted-foreground list-decimal ml-5 space-y-1">
          <li>{t("reports.attlMonthlyWit.etax.step1") || "Open the e-Tax portal and log in."}</li>
          <li>
            {t("reports.attlMonthlyWit.etax.step2") ||
              "Under Declarations, pick the matching Wages Income Tax account and this period."}
          </li>
          <li>
            {t("reports.attlMonthlyWit.etax.step3") ||
              "Enter the two values above, review, and submit in the portal."}
          </li>
        </ol>

        <Button asChild variant="outline">
          <a href={ETAX_DECLARATIONS_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            {t("reports.attlMonthlyWit.etax.openPortal") || "Open e-Tax portal"}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
