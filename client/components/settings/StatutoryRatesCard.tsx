/**
 * Read-only reference card for the Timor-Leste statutory payroll rules Xefe
 * applies automatically. These are fixed by law — deliberately NOT editable
 * settings (see docs/AUDIENCE_SPLIT.md: letting a non-accountant edit
 * legally-fixed rates only lets them break their own compliance).
 *
 * Rows whose legal reading is still being verified with our accounting
 * reviewers carry a "pending confirmation" badge.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scale } from 'lucide-react';

interface StatutoryRatesCardProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface StatutoryRow {
  labelKey: string;
  valueKey: string;
  /** Legal reading still awaiting accountant/legal sign-off. */
  pendingConfirmation?: boolean;
}

const ROWS: StatutoryRow[] = [
  { labelKey: 'witDueLabel', valueKey: 'witDueValue' },
  { labelKey: 'inssDueLabel', valueKey: 'inssDueValue' },
  { labelKey: 'deductionCapLabel', valueKey: 'deductionCapValue' },
  { labelKey: 'workingHoursLabel', valueKey: 'workingHoursValue' },
  { labelKey: 'nightWindowLabel', valueKey: 'nightWindowValue' },
  // Sick-pay bands: the 6/6/50% reading is applied by the engine but the
  // article citation is still being verified (see mined sign-off notes).
  { labelKey: 'sickBandsLabel', valueKey: 'sickBandsValue', pendingConfirmation: true },
  // Severance: completed-5-year blocks vs pro-rata is still with the reviewer.
  { labelKey: 'severanceLabel', valueKey: 'severanceValue', pendingConfirmation: true },
  { labelKey: 'nonCashLabel', valueKey: 'nonCashValue' },
  { labelKey: 'subsidioLabel', valueKey: 'subsidioValue' },
];

export function StatutoryRatesCard({ t }: StatutoryRatesCardProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-muted-foreground" />
          {t('settings.payroll.statutory.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.payroll.statutory.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg divide-y">
          {ROWS.map((row) => (
            <div key={row.labelKey} className="p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {t(`settings.payroll.statutory.${row.labelKey}`)}
                </span>
                {row.pendingConfirmation && (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  >
                    {t('settings.payroll.statutory.pending')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t(`settings.payroll.statutory.${row.valueKey}`)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
