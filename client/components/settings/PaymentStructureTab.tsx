/**
 * Payment Structure Settings Tab
 * Payment methods, bank accounts, payroll frequency
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
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import {
  CreditCard,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
} from 'lucide-react';
import type {
  SettingsTabProps,
  PaymentStructure,
  PaymentMethod,
  PayrollFrequency,
  BankAccountConfig,
} from './types';

interface PaymentStructureTabProps extends SettingsTabProps {
  initialData: PaymentStructure;
}

export function PaymentStructureTab({
  tenantId,
  saving,
  setSaving,
  onReload,
  t,
  initialData,
}: PaymentStructureTabProps) {
  const { toast } = useToast();
  const [payment, setPayment] = useState<PaymentStructure>(initialData);

  const addBankAccount = () => {
    const newAccount: BankAccountConfig = {
      id: `bank_${Date.now()}`,
      purpose: 'payroll',
      bankName: '',
      accountName: '',
      accountNumber: '',
      isActive: true,
    };
    setPayment({ ...payment, bankAccounts: [...payment.bankAccounts, newAccount] });
  };

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updatePaymentStructure(tenantId, payment);
      toast({
        title: t('settings.notifications.savedTitle'),
        description: t('settings.notifications.paymentSaved'),
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
        <CardTitle>{t('settings.payment.title')}</CardTitle>
        <CardDescription>{t('settings.payment.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Methods */}
        <div className="space-y-4">
          <h3 className="font-medium">{t('settings.payment.methods')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: 'bank_transfer', label: t('settings.payment.methodLabels.bankTransfer') },
              { value: 'cash', label: t('settings.payment.methodLabels.cash') },
              { value: 'cheque', label: t('settings.payment.methodLabels.cheque') },
              { value: 'other', label: t('settings.payment.methodLabels.other') },
            ].map((method) => (
              <div
                key={method.value}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  payment.paymentMethods.includes(method.value as PaymentMethod)
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground'
                }`}
                onClick={() => {
                  const methods = payment.paymentMethods.includes(method.value as PaymentMethod)
                    ? payment.paymentMethods.filter((m) => m !== method.value)
                    : [...payment.paymentMethods, method.value as PaymentMethod];
                  setPayment({ ...payment, paymentMethods: methods });
                }}
              >
                <div className="flex items-center gap-2">
                  {payment.paymentMethods.includes(method.value as PaymentMethod) ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{method.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Bank Accounts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('settings.payment.bankAccounts')}</h3>
              <p className="text-sm text-muted-foreground">{t('settings.payment.bankAccountsHint')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={addBankAccount}>
              <Plus className="h-4 w-4 mr-2" />
              {t('settings.payment.addAccount')}
            </Button>
          </div>

          {payment.bankAccounts.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">{t('settings.payment.noAccounts')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payment.bankAccounts.map((account, index) => (
                <div key={account.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <Select
                      value={account.purpose}
                      onValueChange={(value: 'payroll' | 'tax' | 'social_security' | 'general') => {
                        const updated = [...payment.bankAccounts];
                        updated[index] = { ...account, purpose: value };
                        setPayment({ ...payment, bankAccounts: updated });
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payroll">{t('settings.payment.accountPurpose.payroll')}</SelectItem>
                        <SelectItem value="tax">{t('settings.payment.accountPurpose.tax')}</SelectItem>
                        <SelectItem value="social_security">{t('settings.payment.accountPurpose.socialSecurity')}</SelectItem>
                        <SelectItem value="general">{t('settings.payment.accountPurpose.general')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setPayment({
                          ...payment,
                          bankAccounts: payment.bankAccounts.filter((a) => a.id !== account.id),
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder={t('settings.payment.bankName')}
                      value={account.bankName}
                      onChange={(e) => {
                        const updated = [...payment.bankAccounts];
                        updated[index] = { ...account, bankName: e.target.value };
                        setPayment({ ...payment, bankAccounts: updated });
                      }}
                    />
                    <Input
                      placeholder={t('settings.payment.accountName')}
                      value={account.accountName}
                      onChange={(e) => {
                        const updated = [...payment.bankAccounts];
                        updated[index] = { ...account, accountName: e.target.value };
                        setPayment({ ...payment, bankAccounts: updated });
                      }}
                    />
                    <Input
                      placeholder={t('settings.payment.accountNumber')}
                      value={account.accountNumber}
                      onChange={(e) => {
                        const updated = [...payment.bankAccounts];
                        updated[index] = { ...account, accountNumber: e.target.value };
                        setPayment({ ...payment, bankAccounts: updated });
                      }}
                    />
                    <Input
                      placeholder={t('settings.payment.branchCode')}
                      value={account.branchCode || ''}
                      onChange={(e) => {
                        const updated = [...payment.bankAccounts];
                        updated[index] = { ...account, branchCode: e.target.value };
                        setPayment({ ...payment, bankAccounts: updated });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Payroll Frequency */}
        <div className="space-y-4">
          <h3 className="font-medium">{t('settings.payment.payrollFrequency')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { value: 'hourly', label: t('settings.payment.frequencyLabels.hourly') },
              { value: 'daily', label: t('settings.payment.frequencyLabels.daily') },
              { value: 'weekly', label: t('settings.payment.frequencyLabels.weekly') },
              { value: 'bi_weekly', label: t('settings.payment.frequencyLabels.biWeekly') },
              { value: 'monthly', label: t('settings.payment.frequencyLabels.monthly') },
            ].map((freq) => (
              <div
                key={freq.value}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  payment.payrollFrequencies.includes(freq.value as PayrollFrequency)
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground'
                }`}
                onClick={() => {
                  const frequencies = payment.payrollFrequencies.includes(freq.value as PayrollFrequency)
                    ? payment.payrollFrequencies.filter((f) => f !== freq.value)
                    : [...payment.payrollFrequencies, freq.value as PayrollFrequency];
                  setPayment({ ...payment, payrollFrequencies: frequencies });
                }}
              >
                <div className="flex items-center gap-2">
                  {payment.payrollFrequencies.includes(freq.value as PayrollFrequency) ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{freq.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t('settings.payment.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
