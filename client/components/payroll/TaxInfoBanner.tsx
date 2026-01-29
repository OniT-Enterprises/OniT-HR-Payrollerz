/**
 * Timor-Leste Tax Info Banner
 * Shows the current TL tax rates
 */

import { Card, CardContent } from "@/components/ui/card";
import { Building } from "lucide-react";
import { TL_INSS, TL_INCOME_TAX } from "@/lib/payroll/constants-tl";

export function TaxInfoBanner() {
  return (
    <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Building className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Timor-Leste Tax Rates
            </p>
            <p className="text-amber-700 dark:text-amber-300">
              Income Tax: {(TL_INCOME_TAX.rate * 100).toFixed(0)}% (above $
              {TL_INCOME_TAX.residentThreshold}/month for residents) &bull; INSS Employee:{" "}
              {(TL_INSS.employeeRate * 100).toFixed(0)}% &bull; INSS Employer:{" "}
              {(TL_INSS.employerRate * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
