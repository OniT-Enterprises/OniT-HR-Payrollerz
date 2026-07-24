/**
 * Legacy payroll-tax entry point.
 *
 * The former hub duplicated Payroll's attention list and the direct filing
 * links. Keep the route for bookmarks, but send the user straight to the most
 * urgent filing workflow they can access.
 */

import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import MainNavigation from "@/components/layout/MainNavigation";
import { useAdvancedTax } from "@/contexts/TenantContext";
import { useTaxFilingsDueSoon } from "@/hooks/useTaxFiling";
import { useI18n } from "@/i18n/I18nProvider";

export default function TaxReports() {
  const showAdvancedTax = useAdvancedTax();
  const { t } = useI18n();
  const { data: dueDates = [], isLoading } = useTaxFilingsDueSoon(6);

  const mostUrgent = dueDates
    .filter(
      (deadline) =>
        deadline.status !== "filed" &&
        (deadline.type === "inss_monthly" ||
          (showAdvancedTax && deadline.type === "monthly_wit")),
    )
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)[0];

  const destination =
    mostUrgent?.type === "monthly_wit"
      ? "/payroll/tax/monthly-wit"
      : mostUrgent?.type === "inss_monthly"
        ? "/payroll/tax/inss-monthly"
        : showAdvancedTax
          ? "/payroll/tax/monthly-wit"
          : "/payroll/tax/inss-monthly";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="flex min-h-[50vh] items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  return <Navigate to={destination} replace />;
}
