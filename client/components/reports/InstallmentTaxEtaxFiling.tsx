/**
 * Assisted e-Tax filing for the Domestic Installment Tax return.
 *
 * Installment tax is a prepayment of income tax = 0.5% of gross turnover for
 * the applicable month or quarter. The portal form (account "Domestic Installment
 * Tax") has three lines: Revenue for Period, Tax Rate, Tax to Pay. Xefe knows
 * the period's revenue from the money module, so it surfaces the numbers for
 * the user to file in the portal.
 */

import { useI18n } from "@/i18n/I18nProvider";
import {
  calculateTLIncomeTaxInstallment,
  getTLIncomeTaxInstallmentFrequency,
} from "@/lib/tax/income-tax-installment-tl";
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

  if (revenue <= 0) return null;

  const frequency = getTLIncomeTaxInstallmentFrequency(priorYearTurnover);
  const taxToPay = calculateTLIncomeTaxInstallment(revenue);
  const account: EtaxAccount = {
    name: t("reports.profitLoss.etax.account") || "Domestic Installment Tax",
    meta: [periodLabel, frequency === "quarterly" ? "Quarterly" : "Monthly"]
      .filter(Boolean)
      .join(" · "),
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
        "Installment tax is 0.5% of period turnover: quarterly when prior-year turnover is at most $1 million, monthly when it is higher. Verify the revenue, then file in e-Tax — Xefe never files on your behalf."
      }
      accounts={[account]}
    />
  );
}
