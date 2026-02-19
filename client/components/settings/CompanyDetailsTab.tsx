/**
 * Company Details Settings Tab
 * Legal name, business type, address, contact info
 */
import { useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { Save, Loader2 } from 'lucide-react';
import type { SettingsTabProps, CompanyDetailsFormData, CompanyDetails } from './types';
import { companyDetailsFormSchema } from './types';

interface CompanyDetailsTabProps extends SettingsTabProps {
  initialData: CompanyDetails;
}

export function CompanyDetailsTab({
  tenantId,
  saving,
  setSaving,
  onReload,
  t,
  initialData,
}: CompanyDetailsTabProps) {
  const { toast } = useToast();

  const form = useForm<CompanyDetailsFormData>({
    resolver: zodResolver(companyDetailsFormSchema),
    defaultValues: {
      legalName: initialData.legalName || '',
      tradingName: initialData.tradingName || '',
      businessType: initialData.businessType || 'Lda',
      tinNumber: initialData.tinNumber || '',
      registeredAddress: initialData.registeredAddress || '',
      city: initialData.city || 'Dili',
      country: initialData.country || 'Timor-Leste',
      phone: initialData.phone || '',
      email: initialData.email || '',
    },
    mode: 'onChange',
  });

  const onSave = useCallback(
    async (data: CompanyDetailsFormData) => {
      if (!tenantId) return;
      setSaving(true);
      try {
        const companyDetails: CompanyDetails = {
          legalName: data.legalName,
          tradingName: data.tradingName || undefined,
          businessType: data.businessType,
          tinNumber: data.tinNumber || '',
          registeredAddress: data.registeredAddress || '',
          city: data.city,
          country: data.country,
          phone: data.phone || undefined,
          email: data.email || undefined,
        };
        await settingsService.updateCompanyDetails(tenantId, companyDetails);
        toast({
          title: t('settings.notifications.savedTitle'),
          description: t('settings.notifications.companySaved'),
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
    },
    [tenantId, setSaving, onReload, toast, t]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.company.title')}</CardTitle>
        <CardDescription>{t('settings.company.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSave)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="legalName">{t('settings.company.legalName')}</Label>
              <Input
                id="legalName"
                {...form.register('legalName')}
                placeholder={t('settings.company.legalNamePlaceholder')}
              />
              {form.formState.errors.legalName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.legalName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradingName">{t('settings.company.tradingName')}</Label>
              <Input
                id="tradingName"
                {...form.register('tradingName')}
                placeholder={t('settings.company.tradingNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">{t('settings.company.businessType')}</Label>
              <Controller
                name="businessType"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SA">{t('settings.company.businessTypes.sa')}</SelectItem>
                      <SelectItem value="Lda">{t('settings.company.businessTypes.lda')}</SelectItem>
                      <SelectItem value="Unipessoal">{t('settings.company.businessTypes.unipessoal')}</SelectItem>
                      <SelectItem value="ENIN">{t('settings.company.businessTypes.enin')}</SelectItem>
                      <SelectItem value="NGO">{t('settings.company.businessTypes.ngo')}</SelectItem>
                      <SelectItem value="Government">{t('settings.company.businessTypes.government')}</SelectItem>
                      <SelectItem value="Other">{t('settings.company.businessTypes.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tinNumber">{t('settings.company.tinNumber')}</Label>
              <Input
                id="tinNumber"
                {...form.register('tinNumber')}
                placeholder={t('settings.company.tinPlaceholder')}
              />
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="font-medium">{t('settings.company.addressTitle')}</h3>
            <div className="space-y-2">
              <Label htmlFor="address">{t('settings.company.registeredAddress')}</Label>
              <Textarea
                id="address"
                {...form.register('registeredAddress')}
                placeholder={t('settings.company.registeredAddressPlaceholder')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="city">{t('settings.company.city')}</Label>
                <Input
                  id="city"
                  {...form.register('city')}
                  placeholder={t('settings.company.cityPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">{t('settings.company.country')}</Label>
                <Input
                  id="country"
                  {...form.register('country')}
                  disabled
                />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('settings.company.phone')}</Label>
              <Input
                id="phone"
                {...form.register('phone')}
                placeholder={t('settings.company.phonePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('settings.company.email')}</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                placeholder={t('settings.company.emailPlaceholder')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('settings.company.save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
