/**
 * Invoice Settings Page
 * Configure company info, bank details, and invoice defaults
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenant } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import type { InvoiceSettings } from '@/types/money';
import {
  Settings,
  Building2,
  CreditCard,
  FileText,
  Save,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

const DEFAULT_SETTINGS: Partial<InvoiceSettings> = {
  prefix: 'INV',
  nextNumber: 1,
  defaultTaxRate: 0,
  defaultTerms: 'Payment due within 30 days',
  defaultNotes: 'Thank you for your business',
  defaultDueDays: 30,
};

export default function InvoiceSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Partial<InvoiceSettings>>(DEFAULT_SETTINGS);

  const TAX_RATES = [
    { value: '0', label: t('money.settings.noTax') || 'No Tax (0%)' },
    { value: '2.5', label: '2.5%' },
    { value: '5', label: '5%' },
    { value: '10', label: t('money.settings.taxStandard') || '10% (Standard)' },
  ];

  const DUE_DAYS_OPTIONS = [
    { value: '7', label: `7 ${t('money.settings.days') || 'days'}` },
    { value: '14', label: `14 ${t('money.settings.days') || 'days'}` },
    { value: '15', label: `15 ${t('money.settings.days') || 'days'}` },
    { value: '30', label: `30 ${t('money.settings.days') || 'days'} ${t('money.settings.dueDaysStandard') || '(Standard)'}` },
    { value: '45', label: `45 ${t('money.settings.days') || 'days'}` },
    { value: '60', label: `60 ${t('money.settings.days') || 'days'}` },
    { value: '90', label: `90 ${t('money.settings.days') || 'days'}` },
  ];

  useEffect(() => {
    if (session?.tid) {
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.tid]);

  const loadSettings = async () => {
    if (!session?.tid) return;

    try {
      setLoading(true);
      const data = await invoiceService.getSettings(session.tid);
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch (error) {
      console.error('Error loading settings:', error);
      // Use defaults if no settings exist
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.tid) return;

    try {
      setSaving(true);
      await invoiceService.updateSettings(session.tid, settings);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.settings.saved') || 'Invoice settings saved',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.settings.saveError') || 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof InvoiceSettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Invoice Settings - Meza" description="Configure invoice settings" />
      <MainNavigation />

      <div className="p-6 max-w-4xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/money')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back') || 'Back'}
            </Button>
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Settings className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {t('money.settings.title') || 'Invoice Settings'}
                <InfoTooltip
                  title={t('money.settings.title') || 'Invoice Settings'}
                  content={t('money.settings.tooltipContent') || 'Configure your company details, logo, default tax rate, payment terms, and bank information that appears on all invoices.'}
                />
              </h1>
              <p className="text-muted-foreground">
                {t('money.settings.subtitle') || 'Configure your invoice defaults and company information'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('common.save') || 'Save Changes'}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                {t('money.settings.companyInfo') || 'Company Information'}
              </CardTitle>
              <CardDescription>
                {t('money.settings.companyInfoDesc') || 'This information appears on your invoices'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('money.settings.companyName') || 'Company Name'}</Label>
                  <Input
                    value={settings.companyName || ''}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    placeholder={t('money.settings.companyNamePlaceholder') || 'Your Company Name'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('money.settings.companyTin') || 'TIN (Tax ID Number)'}</Label>
                  <Input
                    value={settings.companyTin || ''}
                    onChange={(e) => updateField('companyTin', e.target.value)}
                    placeholder={t('money.settings.tinPlaceholder') || 'e.g., 123456789'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('money.settings.companyAddress') || 'Address'}</Label>
                <Textarea
                  value={settings.companyAddress || ''}
                  onChange={(e) => updateField('companyAddress', e.target.value)}
                  placeholder={t('money.settings.addressPlaceholder') || 'Street address, City, District'}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('money.settings.companyPhone') || 'Phone'}</Label>
                  <Input
                    value={settings.companyPhone || ''}
                    onChange={(e) => updateField('companyPhone', e.target.value)}
                    placeholder={t('money.settings.phonePlaceholder') || '+670 7XX XXXX'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('money.settings.companyEmail') || 'Email'}</Label>
                  <Input
                    type="email"
                    value={settings.companyEmail || ''}
                    onChange={(e) => updateField('companyEmail', e.target.value)}
                    placeholder={t('money.settings.emailPlaceholder') || 'billing@yourcompany.tl'}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-600" />
                {t('money.settings.bankDetails') || 'Bank Details'}
              </CardTitle>
              <CardDescription>
                {t('money.settings.bankDetailsDesc') || 'Payment information shown on invoices for bank transfers'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('money.settings.bankName') || 'Bank Name'}</Label>
                <Select
                  value={settings.bankName || ''}
                  onValueChange={(value) => updateField('bankName', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('money.settings.selectBank') || 'Select a bank'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BNU">BNU (Banco Nacional Ultramarino)</SelectItem>
                    <SelectItem value="BNCTL">BNCTL (Banco Nacional Comercio Timor-Leste)</SelectItem>
                    <SelectItem value="Mandiri">Bank Mandiri</SelectItem>
                    <SelectItem value="ANZ">ANZ Bank</SelectItem>
                    <SelectItem value="Other">{t('money.settings.bankOther') || 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('money.settings.bankAccountName') || 'Account Name'}</Label>
                  <Input
                    value={settings.bankAccountName || ''}
                    onChange={(e) => updateField('bankAccountName', e.target.value)}
                    placeholder={t('money.settings.accountNamePlaceholder') || 'Account holder name'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('money.settings.bankAccountNumber') || 'Account Number'}</Label>
                  <Input
                    value={settings.bankAccountNumber || ''}
                    onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                    placeholder={t('money.settings.accountNumberPlaceholder') || 'XXXX-XXXX-XXXX'}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                {t('money.settings.invoiceDefaults') || 'Invoice Defaults'}
              </CardTitle>
              <CardDescription>
                {t('money.settings.invoiceDefaultsDesc') || 'Default values for new invoices'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('money.settings.invoicePrefix') || 'Invoice Prefix'}</Label>
                  <Input
                    value={settings.prefix || ''}
                    onChange={(e) => updateField('prefix', e.target.value)}
                    placeholder={t('money.settings.prefixPlaceholder') || 'INV'}
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('money.settings.prefixExample') || 'e.g.,'} {settings.prefix || 'INV'}-2026-001
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t('money.settings.nextNumber') || 'Next Invoice Number'}</Label>
                  <Input
                    type="number"
                    value={settings.nextNumber || 1}
                    onChange={(e) => updateField('nextNumber', parseInt(e.target.value, 10) || 1)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('money.settings.defaultDueDays') || 'Default Due Days'}</Label>
                  <Select
                    value={String(settings.defaultDueDays || 30)}
                    onValueChange={(value) => updateField('defaultDueDays', parseInt(value, 10))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DUE_DAYS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('money.settings.defaultTaxRate') || 'Default Tax Rate'}</Label>
                <Select
                  value={String(settings.defaultTaxRate || 0)}
                  onValueChange={(value) => updateField('defaultTaxRate', parseFloat(value))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_RATES.map((rate) => (
                      <SelectItem key={rate.value} value={rate.value}>
                        {rate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('money.settings.defaultNotes') || 'Default Notes'}</Label>
                <Textarea
                  value={settings.defaultNotes || ''}
                  onChange={(e) => updateField('defaultNotes', e.target.value)}
                  placeholder={t('money.settings.notesPlaceholder') || 'Thank you for your business'}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  {t('money.settings.notesHelp') || 'Appears at the bottom of invoices'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('money.settings.defaultTerms') || 'Default Terms & Conditions'}</Label>
                <Textarea
                  value={settings.defaultTerms || ''}
                  onChange={(e) => updateField('defaultTerms', e.target.value)}
                  placeholder={t('money.settings.termsPlaceholder') || 'Payment due within 30 days'}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save button at bottom for mobile */}
        <div className="mt-6 flex justify-end md:hidden">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('common.save') || 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
