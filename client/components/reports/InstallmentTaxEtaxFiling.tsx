/**
 * Assisted e-Tax filing for the Domestic Installment Tax return.
 *
 * Installment tax is a monthly prepayment of income tax = 0.5% of gross
 * turnover for the month. The portal form (account "Domestic Installment
 * Tax") has three lines: Revenue for Period, Tax Rate, Tax to Pay. Xefe knows
 * the period's revenue from the money module, so it surfaces the numbers for
 * the user to file in the portal.
 */

import { useI18n } from "@/i18n/I18nProvider";
import { multiplyMoney } from "@/lib/currency";
import { EtaxFilingCard, type EtaxAccount } from "./EtaxFilingCard";

/** Domestic Installment Tax rate: 0.5% of monthly gross turnover. */
export const INSTALLMENT_TAX_RATE = 0.5;

export function InstallmentTaxEtaxFiling({
  revenue,
  periodLabel,
}: {
  revenue: number;
  periodLabel?: string;
}) {
  const { t } = useI18n();

  if (revenue <= 0) return null;

  const taxToPay = multiplyMoney(revenue, INSTALLMENT_TAX_RATE / 100);
  const account: EtaxAccount = {
    name: t("reports.profitLoss.etax.account") || "Domestic Installment Tax",
    meta: periodLabel,
    lines: [
      {
        number: "Line 10",
        label: t("reports.profitLoss.etax.revenue") || "Revenue for Period",
        value: revenue,
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
    <EtaxFilingCard
      title={t("reports.profitLoss.etax.title") || "File installment tax on e-Tax (assisted)"}
      description={
        t("reports.profitLoss.etax.description") ||
        "Monthly installment tax is 0.5% of gross turnover. Verify the period's revenue, then file in the e-Tax portal — Xefe never files on your behalf."
      }
      accounts={[account]}
    />
  );
}
