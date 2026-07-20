/**
 * Payroll Config Settings Tab
 * Tax (WIT), Social Security (INSS), Overtime rates, 13th Month (Subsidio Anual)
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { useTenant } from '@/contexts/TenantContext';

import {
  DollarSign,
  Percent,
  Users,
  Clock,
  Calendar,
  Save,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import type { SettingsTabProps, PayrollConfig } from './types';

interface PayrollConfigTabProps extends SettingsTabProps {
  initialData: PayrollConfig;
}

function isInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isValidMonthDay(value: string): boolean {
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!isInRange(month, 1, 12)) return false;
  return isInRange(day, 1, new Date(Date.UTC(2024, month, 0)).getUTCDate());
}

function isValidPayrollConfig(config: PayrollConfig): boolean {
  return (
    isInRange(config.tax.residentThreshold, 0, 1_000_000) &&
    isInRange(config.tax.residentRate, 0, 100) &&
    isInRange(config.tax.nonResidentRate, 0, 100) &&
    isInRange(config.tax.paymentDueDay, 1, 28) &&
    isInRange(config.socialSecurity.employeeRate, 0, 100) &&
    isInRange(config.socialSecurity.employerRate, 0, 100) &&
    isInRange(config.socialSecurity.paymentDueDay, 1, 28) &&
    isInRange(config.minimumWage, 0, 1_000_000) &&
    isInRange(config.maxWorkHoursPerWeek, 1, 168) &&
    ['weekly_average', 'fixed_190_round_up'].includes(config.hourlyRateConvention) &&
    isInRange(config.overtimeRates.standard, 1, 10) &&
    isInRange(config.overtimeRates.sundayHoliday, 1, 10) &&
    (!config.subsidioAnual.enabled || isValidMonthDay(config.subsidioAnual.payByDate))
  );
}

export function PayrollConfigTab({
  tenantId,
  saving,
  setSaving,
  onReload,
  t,
  initialData,
}: PayrollConfigTabProps) {
  const { toast } = useToast();
  const { session } = useTenant();
  const isOwner = session?.role === 'owner';
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig>(initialData);
  const configIsValid = isValidPayrollConfig(payrollConfig);

  const save = async () => {
    if (!tenantId) return;
    if (!configIsValid) {
      toast({
        title: t('settings.notifications.errorTitle'),
        description: t('settings.payroll.invalidValues'),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await settingsService.updatePayrollConfig(tenantId, payrollConfig);
      toast({
        title: t('settings.notifications.savedTitle'),
        description: t('settings.notifications.payrollSaved'),
      });
      onReload();
    } catch {
      toast({
        title: t('settings.notifications.errorTitle'),
        description: t('settings.notifications.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.payroll.title')}</CardTitle>
        <CardDescription>{t('settings.payroll.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tax Settings (WIT) */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t('settings.payroll.wit')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.payroll.residentThreshold')}</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  value={payrollConfig.tax.residentThreshold}
                  onChange={(e) =>
                    setPayrollConfig({
                      ...payrollConfig,
                      tax: {
                        ...payrollConfig.tax,
                        residentThreshold: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.payroll.residentThresholdHint', {
                  amount: payrollConfig.tax.residentThreshold,
                })}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.payroll.residentRate')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={payrollConfig.tax.residentRate}
                  onChange={(e) =>
                    setPayrollConfig({
                      ...payrollConfig,
                      tax: {
                        ...payrollConfig.tax,
                        residentRate: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.payroll.nonResidentRate')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={payrollConfig.tax.nonResidentRate}
                  onChange={(e) =>
                    setPayrollConfig({
                      ...payrollConfig,
                      tax: {
                        ...payrollConfig.tax,
                        nonResidentRate: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.payroll.flatRateHint')}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Social Security (INSS) */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('settings.payroll.socialSecurity')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.payroll.employeeContribution')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={payrollConfig.socialSecurity.employeeRate}
                  onChange={(e) =>
                    setPayrollConfig({
                      ...payrollConfig,
                      socialSecurity: {
                        ...payrollConfig.socialSecurity,
                        employeeRate: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.payroll.employerContribution')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={payrollConfig.socialSecurity.employerRate}
                  onChange={(e) =>
                    setPayrollConfig({
                      ...payrollConfig,
                      socialSecurity: {
                        ...payrollConfig.socialSecurity,
                        employerRate: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={payrollConfig.socialSecurity.excludeFoodAllowance}
                onCheckedChange={(checked) =>
                  setPayrollConfig({
                    ...payrollConfig,
                    socialSecurity: {
                      ...payrollConfig.socialSecurity,
                      excludeFoodAllowance: checked,
                    },
                  })
                }
              />
              <Label>{t('settings.payroll.excludeFoodAllowance')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={payrollConfig.socialSecurity.excludePerDiem}
                onCheckedChange={(checked) =>
                  setPayrollConfig({
                    ...payrollConfig,
                    socialSecurity: {
                      ...payrollConfig.socialSecurity,
                      excludePerDiem: checked,
                    },
                  })
                }
              />
              <Label>{t('settings.payroll.excludePerDiem')}</Label>
            </div>
          </div>
          {/* DL 20/2017 Art. 86 small-employer discount — reduces the employer
              INSS share (5.4% through Dec 2026, then 6%). Employee 4% unchanged. */}
          <div className="flex items-start gap-2 pt-1">
            <Switch
              checked={payrollConfig.smallEmployerInssDiscount ?? false}
              onCheckedChange={(checked) =>
                setPayrollConfig({
                  ...payrollConfig,
                  smallEmployerInssDiscount: checked,
                })
              }
            />
            <div>
              <Label>Small-employer INSS discount (DL 20/2017 Art. 86)</Label>
              <p className="text-xs text-muted-foreground max-w-prose">
                Enable if you have 10 or fewer workers, at least 60% Timorese
                nationals, and your contributions are up to date. Reduces the
                employer contribution to 5.4% (through Dec 2026) to match the
                INSS payment guide. The employee 4% is unchanged; the rate
                returns to 6% from 2027.
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Overtime */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('settings.payroll.overtime')}
          </h3>
          <div className="max-w-md space-y-2">
            <Label>{t('settings.payroll.hourlyRateMethod')}</Label>
            <Select
              value={payrollConfig.hourlyRateConvention}
              onValueChange={(value: PayrollConfig['hourlyRateConvention']) =>
                setPayrollConfig({
                  ...payrollConfig,
                  hourlyRateConvention: value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly_average">
                  {t('settings.payroll.hourlyRateWeeklyAverage')}
                </SelectItem>
                <SelectItem value="fixed_190_round_up">
                  {t('settings.payroll.hourlyRateFixed190')}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('settings.payroll.hourlyRateHint')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.payroll.maxHoursWeek')}</Label>
              <Input
                type="number"
                min={0}
                value={payrollConfig.maxWorkHoursPerWeek}
                onChange={(e) =>
                  setPayrollConfig({
                    ...payrollConfig,
                    maxWorkHoursPerWeek: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.payroll.first2HoursRate')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  step={0.1}
                  value={payrollConfig.overtimeRates.standard}
                  onChange={(e) =>
                    setPayrollConfig({
                      ...payrollConfig,
                      overtimeRates: {
                        ...payrollConfig.overtimeRates,
                        standard: parseFloat(e.target.value) || 1,
                      },
                    })
                  }
                />
                <span className="text-muted-foreground">&times;</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.payroll.first2HoursHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.payroll.sundayHolidayRate')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  step={0.1}
                  value={payrollConfig.overtimeRates.sundayHoliday}
                  onChange={(e) =>
                    setPayrollConfig({
                      ...payrollConfig,
                      overtimeRates: {
                        ...payrollConfig.overtimeRates,
                        sundayHoliday: parseFloat(e.target.value) || 1,
                      },
                    })
                  }
                />
                <span className="text-muted-foreground">&times;</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* 13th Month (Subsidio Anual) */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('settings.payroll.thirteenthMonth')}
          </h3>
          <div className="flex items-center gap-4">
            <Switch
              checked={payrollConfig.subsidioAnual.enabled}
              onCheckedChange={(checked) =>
                setPayrollConfig({
                  ...payrollConfig,
                  subsidioAnual: {
                    ...payrollConfig.subsidioAnual,
                    enabled: checked,
                  },
                })
              }
            />
            <Label>{t('settings.payroll.enable13th')}</Label>
          </div>
          {payrollConfig.subsidioAnual.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>{t('settings.payroll.paymentDeadline')}</Label>
                <Input
                  value={payrollConfig.subsidioAnual.payByDate}
                  onChange={(e) =>
                    setPayrollConfig({
                      ...payrollConfig,
                      subsidioAnual: {
                        ...payrollConfig.subsidioAnual,
                        payByDate: e.target.value,
                      },
                    })
                  }
                  placeholder={t('settings.payroll.paymentDeadlinePlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.payroll.paymentDeadlineHint')}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={payrollConfig.subsidioAnual.proRataForNewEmployees}
                  onCheckedChange={(checked) =>
                    setPayrollConfig({
                      ...payrollConfig,
                      subsidioAnual: {
                        ...payrollConfig.subsidioAnual,
                        proRataForNewEmployees: checked,
                      },
                    })
                  }
                />
                <Label>{t('settings.payroll.prorataHint')}</Label>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Approval policy (solo-operator mode) */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {t('settings.payroll.approvalSection')}
          </h3>
          <div className="flex items-start gap-4">
            <Switch
              checked={payrollConfig.allowSelfApproval === true}
              disabled={!isOwner}
              onCheckedChange={(checked) =>
                setPayrollConfig({
                  ...payrollConfig,
                  allowSelfApproval: checked,
                })
              }
            />
            <div className="space-y-1">
              <Label>{t('settings.payroll.selfApprovalLabel')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.payroll.selfApprovalDesc')}
              </p>
              {!isOwner && (
                <p className="text-xs text-muted-foreground italic">
                  {t('settings.payroll.selfApprovalOwnerOnly')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4">
          {!configIsValid && (
            <p role="alert" className="text-sm text-destructive">
              {t('settings.payroll.invalidValues')}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('settings.payroll.save')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
