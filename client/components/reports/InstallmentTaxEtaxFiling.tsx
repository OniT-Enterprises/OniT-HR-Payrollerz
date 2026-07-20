/**
 * Assisted e-Tax filing for the Domestic Installment Tax return.
 *
 * Installment tax is a prepayment of income tax = 0.5% of gross turnover for
 * the applicable month or quarter. The portal form (account "Domestic Installment
 * Tax") has three lines: Revenue for Period, Tax Rate, Tax to Pay. Xefe knows
 * the period's revenue from the money module, so it surfaces the numbers for
 * the user to file in the portal.
 *
 * Law 8/2008 Sec. 64.6: the installment base EXCLUDES exempt income and
 * receipts already subject to withholding tax. Xefe tracks withholding on
 * SUPPLIER bills (money we pay out), not on customer receipts — so it cannot
 * identify which of the tenant's own receipts a customer already withheld on
 * (e.g. construction work invoiced to a withholding payer). Rather than
 * silently overstating the base, the card explains the exclusion and offers
 * an editable base override the user can reduce before filing.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  calculateTLIncomeTaxInstallment,
  getTLIncomeTaxInstallmentFrequency,
} from "@/lib/tax/income-tax-installment-tl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EtaxFilingCard, type EtaxAccount } from "./EtaxFilingCard";

/** Percentage displayed by the e-Tax form (the calculator uses its decimal equivalent). */
export const INSTALLMENT_TAX_RATE = 0.5;

export function InstallmentTaxEtaxFiling({
  revenue,
  priorYearTurnover,
  periodLabel,
}: {
  revenue: number;
  priorYearTurnover: number;
  periodLabel?: string;
}) {
  const { t } = useI18n();
  const [baseOverride, setBaseOverride] = useState("");

  const overrideValue = useMemo(() => {
    if (baseOverride.trim() === "") return null;
    const parsed = Number(baseOverride);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  }, [baseOverride]);

  if (revenue <= 0) return null;

  const effectiveBase = overrideValue ?? revenue;
  const frequency = getTLIncomeTaxInstallmentFrequency(priorYearTurnover);
  const taxToPay = calculateTLIncomeTaxInstallment(effectiveBase);
  const account: EtaxAccount = {
    name: t("reports.profitLoss.etax.account") || "Domestic Installment Tax",
    meta: [periodLabel, frequency === "quarterly" ? "Quarterly" : "Monthly"]
      .filter(Boolean)
      .join(" · "),
    lines: [
      {
        number: "Line 10",
        label: t("reports.profitLoss.etax.revenue") || "Revenue for Period",
        value: effectiveBase,
      },
      {
        number: "Line 15",
        label: t("reports.profitLoss.etax.rate") || "Tax Rate",
        value: INSTALLMENT_TAX_RATE,
        kind: "percent",
      },
      {
        number: "Line 20",
        label: t("reports.profitLoss.etax.taxToPay") || "Tax to Pay",
        value: taxToPay,
      },
    ],
  };

  return (
    <div className="space-y-3">
      <EtaxFilingCard
        title={t("reports.profitLoss.etax.title") || "File installment tax on e-Tax (assisted)"}
        description={
          t("reports.profitLoss.etax.description") ||
          "Installment tax is 0.5% of period turnover: quarterly when prior-year turnover is at most $1 million, monthly when it is higher. Verify the revenue, then file in e-Tax — Xefe never files on your behalf."
        }
        accounts={[account]}
      />
      {/* Sec. 64.6 exclusions — prominent, because Xefe cannot derive them. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <p className="font-medium text-amber-800 dark:text-amber-200">
          {t("reports.profitLoss.etax.baseExclusionsTitle") ||
            "Check the base before filing (Law 8/2008 Sec. 64.6)"}
        </p>
        <p className="mt-1 text-amber-700 dark:text-amber-300">
          {t("reports.profitLoss.etax.baseExclusionsBody") ||
            "The installment base excludes exempt income and receipts a customer already withheld tax on when paying you. Xefe cannot identify customer-side withholding automatically, so if part of your revenue was paid under withholding (or is exempt), enter the reduced base below — the figures above update."}
        </p>
        <div className="mt-3 max-w-xs">
          <Label htmlFor="installment-base-override" className="text-amber-800 dark:text-amber-200">
            {t("reports.profitLoss.etax.baseOverrideLabel") || "Adjusted turnover base (optional)"}
          </Label>
          <Input
            id="installment-base-override"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder={revenue.toFixed(2)}
            value={baseOverride}
            onChange={(e) => setBaseOverride(e.target.value)}
            className="mt-1"
          />
          {overrideValue !== null && overrideValue > revenue && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {t("reports.profitLoss.etax.baseOverrideAboveRevenue") ||
                "The adjusted base is higher than the period revenue Xefe derived — double-check before filing."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
