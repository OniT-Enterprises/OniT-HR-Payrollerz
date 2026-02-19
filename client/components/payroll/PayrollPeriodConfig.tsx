/**
 * PayrollPeriodConfig — Pay period dates, frequency, and subsidio anual toggle
 * Extracted from RunPayroll.tsx
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calculator, Calendar } from 'lucide-react';
import { TL_PAY_PERIODS } from '@/lib/payroll/constants-tl';
import type { TLPayFrequency } from '@/lib/payroll/constants-tl';

interface PayrollPeriodConfigProps {
  payFrequency: TLPayFrequency;
  setPayFrequency: (v: TLPayFrequency) => void;
  periodStart: string;
  setPeriodStart: (v: string) => void;
  periodEnd: string;
  setPeriodEnd: (v: string) => void;
  payDate: string;
  setPayDate: (v: string) => void;
  includeSubsidioAnual: boolean;
  setIncludeSubsidioAnual: (v: boolean) => void;
}

export function PayrollPeriodConfig({
  payFrequency,
  setPayFrequency,
  periodStart,
  setPeriodStart,
  periodEnd,
  setPeriodEnd,
  payDate,
  setPayDate,
  includeSubsidioAnual,
  setIncludeSubsidioAnual,
}: PayrollPeriodConfigProps) {
  return (
    <Card className="mb-6 border-border/50 animate-fade-up stagger-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
            <Calculator className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          Pay Period Configuration
        </CardTitle>
        <CardDescription>
          Configure the payroll period and pay date
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pay-frequency" className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Pay Frequency
            </Label>
            <Select
              value={payFrequency}
              onValueChange={(v) => setPayFrequency(v as TLPayFrequency)}
            >
              <SelectTrigger className="border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">
                  {TL_PAY_PERIODS.weekly.label} (Weekly)
                </SelectItem>
                <SelectItem value="biweekly">
                  {TL_PAY_PERIODS.biweekly.label} (Bi-Weekly)
                </SelectItem>
                <SelectItem value="monthly">
                  {TL_PAY_PERIODS.monthly.label} (Monthly)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-start" className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Period Start
            </Label>
            <Input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-end" className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Period End
            </Label>
            <Input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-date" className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Pay Date
            </Label>
            <Input
              id="pay-date"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="border-border/50"
            />
          </div>
          <div className="md:col-span-4 pt-2">
            <div className="flex items-start gap-3 cursor-pointer" onClick={() => setIncludeSubsidioAnual(!includeSubsidioAnual)}>
              <Checkbox
                checked={includeSubsidioAnual}
                onCheckedChange={(checked) => setIncludeSubsidioAnual(!!checked)}
                className="mt-0.5 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
              />
              <div className="text-sm">
                Include Subsidio Anual (13th month) in this run
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adds a pro-rated 13th month salary and includes it in WIT and INSS.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
