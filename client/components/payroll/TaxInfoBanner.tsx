/**
 * Timor-Leste Tax Info Banner
 * Shows the current TL tax rates in a compact, scannable format
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building } from "lucide-react";
import { TL_INSS, TL_INCOME_TAX } from "@/lib/payroll/constants-tl";

export function TaxInfoBanner() {
  return (
    <Card className="mb-6 border-amber-200/50 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500/10 flex-shrink-0">
            <Building className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-200">
              Timor-Leste Tax Rates
            </span>
            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-normal">
              WIT {(TL_INCOME_TAX.rate * 100).toFixed(0)}% above ${TL_INCOME_TAX.residentThreshold}/mo
            </Badge>
            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-normal">
              INSS Employee {(TL_INSS.employeeRate * 100).toFixed(0)}%
            </Badge>
            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-normal">
              INSS Employer {(TL_INSS.employerRate * 100).toFixed(0)}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
