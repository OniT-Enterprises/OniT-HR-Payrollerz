/**
 * AccountantGate — friendly full-page stop shown in place of accountant-only
 * screens (ATTL WIT filing, tax clearance, VAT) when the current user is on
 * the simple flow (no 'accountant' role and advancedTaxMode off).
 *
 * Not a security boundary — the same screens stay writable only to
 * finance-admin roles via firestore.rules. This exists so first-time SME
 * owners never face filing forms they don't need.
 */
import { Link } from "react-router-dom";
import MainNavigation from "@/components/layout/MainNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenant } from "@/contexts/TenantContext";
import { ArrowLeft, Landmark } from "lucide-react";

interface AccountantGateProps {
  /** Which everyday module the user should use instead. */
  backTo: "money" | "payroll";
}

export function AccountantGate({ backTo }: AccountantGateProps) {
  const { t } = useI18n();
  const { session } = useTenant();

  const backPath = backTo === "money" ? "/money" : "/payroll";
  const backLabel =
    backTo === "money"
      ? t("accounting.dashboard.moneyLink") || "Money"
      : t("accounting.dashboard.payrollLink") || "Payroll";

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-4 sm:p-6 max-w-screen-lg mx-auto">
        <Card className="max-w-xl mx-auto mt-8">
          <CardContent className="py-10 text-center space-y-4">
            <div className="p-3 rounded-full bg-muted inline-flex">
              <Landmark className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">
              {t("accounting.dashboard.accountantGateTitle")
                || "This section is for accountants and auditors"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("accounting.dashboard.accountantGateDesc")
                || "For everyday tasks like sending invoices, paying bills, or running payroll, use"}{" "}
              <Link to={backPath} className="text-primary underline underline-offset-2">
                {backLabel}
              </Link>{" "}
              {t("accounting.dashboard.accountantGateInstead") || "instead."}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("accounting.dashboard.accountantGateNote")
                || "Most businesses never need to change anything here — Xefe keeps this in sync automatically."}
            </p>
            {session?.role === "owner" && (
              <p className="text-xs text-muted-foreground">
                {t("accounting.dashboard.accountantGateEnableHint")
                  || "Business owners can turn these screens on in Settings → Advanced tax mode."}
              </p>
            )}
            <Button asChild variant="outline" className="mt-2">
              <Link to={backPath}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {backLabel}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
