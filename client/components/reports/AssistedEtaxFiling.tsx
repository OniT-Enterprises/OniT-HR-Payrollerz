/**
 * Assisted e-Tax filing for the Monthly Wages Income Tax return.
 *
 * The portal's wages form has just two lines — total gross wages paid and
 * total wages income tax withheld — kept as separate Resident and
 * Non-Resident accounts. Builds those figures from the WIT return and hands
 * them to the generic EtaxFilingCard.
 */

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { addMoney } from "@/lib/currency";
import type { MonthlyWITReturn } from "@/types/tax-filing";
import { EtaxFilingCard, type EtaxAccount } from "./EtaxFilingCard";

export function AssistedEtaxFiling({ ret }: { ret: MonthlyWITReturn }) {
  const { t } = useI18n();

  const accounts = useMemo<EtaxAccount[]>(() => {
    const totals = { resident: { gross: 0, wit: 0, n: 0 }, nonResident: { gross: 0, wit: 0, n: 0 } };
    for (const emp of ret.employees) {
      const b = emp.isResident ? totals.resident : totals.nonResident;
      b.gross = addMoney(b.gross, emp.grossWages);
      b.wit = addMoney(b.wit, emp.witWithheld);
      b.n += 1;
    }

    const line1 = t("reports.attlMonthlyWit.etax.line1") || "Total gross wages paid during the month";
    const line2 =
      t("reports.attlMonthlyWit.etax.line2") || "Total wages income tax withheld during the month";
    const empCount = (n: number) =>
      t("reports.etaxFiling.employeeCount", { count: n }) || `${n} employee(s)`;

    const build = (name: string, b: { gross: number; wit: number; n: number }): EtaxAccount | null =>
      b.n === 0
        ? null
        : {
            name,
            meta: empCount(b.n),
            lines: [
              { number: "Line 5", label: line1, value: b.gross },
              { number: "Line 10", label: line2, value: b.wit },
            ],
          };

    return [
      build(
        t("reports.attlMonthlyWit.etax.residentAccount") ||
          "Domestic Monthly Wages Income Tax for Resident",
        totals.resident,
      ),
      build(
        t("reports.attlMonthlyWit.etax.nonResidentAccount") ||
          "Domestic Monthly Wages Income Tax for Non Resident",
        totals.nonResident,
      ),
    ].filter((a): a is EtaxAccount => a !== null);
  }, [ret.employees, t]);

  return (
    <EtaxFilingCard
      className="mb-6"
      title={t("reports.attlMonthlyWit.etax.title") || "File on e-Tax (assisted)"}
      description={
        t("reports.attlMonthlyWit.etax.description") ||
        "The Monthly Wages Income Tax form asks for just these two totals. Copy them into the e-Tax portal and submit there — Xefe never files on your behalf."
      }
      accounts={accounts}
    />
  );
}
