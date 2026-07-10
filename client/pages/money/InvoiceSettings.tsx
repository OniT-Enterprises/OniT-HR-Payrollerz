/**
 * Invoice Settings Page
 * Configure company info + logo, invoice template, payment accounts,
 * accepted payment methods, and invoice defaults
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
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
import { useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { fileUploadService } from '@/services/fileUploadService';
import { useInvoiceSettings } from '@/hooks/useInvoices';
import { TemplatePicker } from '@/components/money/TemplatePicker';
import {
  ACCEPTED_METHOD_OPTIONS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_TEMPLATE_ID,
  getSettingsPaymentAccounts,
} from '@/lib/invoiceTemplates';
import type { InvoiceSettings, PaymentAccount, PaymentMethod } from '@/types/money';
import {
  Settings,
  Building2,
  Landmark,
  FileText,
  Save,
  ArrowLeft,
  Loader2,
  Palette,
  Upload,
  Trash2,
  Plus,
  ImageIcon,
} from 'lucide-react';

const DEFAULT_SETTINGS: Partial<InvoiceSettings> = {
  prefix: 'INV',
  nextNumber: 1,
  defaultTaxRate: 0,
  defaultTerms: 'Payment due within 30 days',
  defaultNotes: 'Thank you for your business',
  defaultDueDays: 30,
};

const BANK_OPTIONS = [
  { value: 'BNU', label: 'BNU (Banco Nacional Ultramarino)' },
  { value: 'BNCTL', label: 'BNCTL (Banco Nacional Comercio Timor-Leste)' },
  { value: 'Mandiri', label: 'Bank Mandiri' },
  { value: 'ANZ', label: 'ANZ Bank' },
  { value: 'Other', label: 'Other' },
];

const EMPTY_ACCOUNT_FORM = {
  label: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  swiftCode: '',
};

export default function InvoiceSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();

  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Partial<InvoiceSettings>>(DEFAULT_SETTINGS);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: loadedSettings, isLoading: loading } = useInvoiceSettings();

  useEffect(() => {
    if (!loadedSettings || hasLocalChanges) {
      return;
    }

    setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
  }, [hasLocalChanges, loadedSettings]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<InvoiceSettings>) =>
      invoiceService.updateSettings(tenantId, data),
    onSuccess: () => {
      setHasLocalChanges(false);
      queryClient.invalidateQueries({ queryKey: ['invoiceSettings', tenantId] });
      toast({
        title: t('common.success') || 'Success',
        description: t('money.settings.saved') || 'Invoice settings saved',
      });
    },
    onError: () => {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.settings.saveError') || 'Failed to save settings',
        variant: 'destructive',
      });
    },
  });

  const saving = saveMutation.isPending;

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

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const updateField = (
    field: keyof InvoiceSettings,
    value: InvoiceSettings[keyof InvoiceSettings]
  ) => {
    setHasLocalChanges(true);
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  // ----- Logo -----

  const handleLogoSelected = async (file: File | undefined) => {
    if (!file) return;
    const validation = fileUploadService.validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: t('common.error') || 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploadingLogo(true);
      const url = await fileUploadService.uploadCompanyLogo(file, tenantId);
      // Persist right away — a logo left only in form state until "Save"
      // silently vanishes when the user navigates off to try it out.
      setSettings((prev) => ({ ...prev, logoUrl: url }));
      await invoiceService.updateSettings(tenantId, { logoUrl: url });
      queryClient.invalidateQueries({ queryKey: ['invoiceSettings', tenantId] });
      toast({
        title: t('common.success') || 'Success',
        description: t('money.settings.logoUploaded') || 'Logo uploaded',
      });
    } catch (_error) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.settings.logoUploadError') || 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    setSettings((prev) => ({ ...prev, logoUrl: '' }));
    try {
      await invoiceService.updateSettings(tenantId, { logoUrl: '' });
      queryClient.invalidateQueries({ queryKey: ['invoiceSettings', tenantId] });
    } catch (_error) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.settings.saveError') || 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  // ----- Payment accounts -----

  const displayedAccounts = getSettingsPaymentAccounts(settings);

  const handleAddAccount = () => {
    if (!accountForm.bankName || !accountForm.accountNumber) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.settings.accountRequired') || 'Bank and account number are required',
        variant: 'destructive',
      });
      return;
    }

    const account: PaymentAccount = {
      id: `acc_${Date.now()}`,
      label: accountForm.label || `${accountForm.bankName} Account`,
      bankName: accountForm.bankName,
      accountName: accountForm.accountName,
      accountNumber: accountForm.accountNumber,
      ...(accountForm.swiftCode ? { swiftCode: accountForm.swiftCode } : {}),
    };

    updateField('paymentAccounts', [...(settings.paymentAccounts || []), account]);
    setAccountForm(EMPTY_ACCOUNT_FORM);
    setShowAccountForm(false);
  };

  const handleRemoveAccount = (accountId: string) => {
    setHasLocalChanges(true);
    if (accountId === 'legacy') {
      // Synthetic account backed by the old single-bank fields
      setSettings((prev) => ({
        ...prev,
        bankName: '',
        bankAccountName: '',
        bankAccountNumber: '',
      }));
      return;
    }
    setSettings((prev) => ({
      ...prev,
      paymentAccounts: (prev.paymentAccounts || []).filter((a) => a.id !== accountId),
    }));
  };

  const toggleDefaultMethod = (method: PaymentMethod) => {
    const current = settings.defaultPaymentMethods || [];
    updateField(
      'defaultPaymentMethods',
      current.includes(method)
        ? current.filter((m) => m !== method)
        : [...current, method]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-screen-lg mx-auto">
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
      <SEO title="Invoice Settings - Xefe" description="Configure invoice settings" />
      <MainNavigation />

      <div className="p-6 max-w-screen-lg mx-auto">
        <PageHeader
          title={t('money.settings.title') || 'Invoice Settings'}
          subtitle={t('money.settings.subtitle') || 'Configure your invoice defaults and company information'}
          icon={Settings}
          iconColor="text-indigo-500"
          actions={
            <>
              <Button variant="ghost" onClick={() => navigate('/money')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back') || 'Back'}
              </Button>
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
            </>
          }
        />

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
              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Company logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {settings.logoUrl
                        ? t('money.settings.changeLogo') || 'Change Logo'
                        : t('money.settings.uploadLogo') || 'Upload Logo'}
                    </Button>
                    {settings.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleLogoRemove}
                      >
                        <Trash2 className="h-4 w-4 mr-2 text-muted-foreground" />
                        {t('common.remove') || 'Remove'}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('money.settings.logoHint') || 'PNG or JPG recommended, max 5MB. Shown on invoices and PDFs.'}
                  </p>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleLogoSelected(e.target.files?.[0])}
                />
              </div>

              <Separator />

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

          {/* Invoice Template */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-indigo-600" />
                {t('money.settings.invoiceTemplate') || 'Invoice Template'}
              </CardTitle>
              <CardDescription>
                {t('money.settings.invoiceTemplateDesc') || 'How your invoices look on screen, in PDFs, and in emails'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatePicker
                value={settings.defaultTemplate || DEFAULT_TEMPLATE_ID}
                onChange={(id) => updateField('defaultTemplate', id)}
                accentColor={settings.accentColor || DEFAULT_ACCENT_COLOR}
                onAccentChange={(hex) => updateField('accentColor', hex)}
                showAccent
              />
            </CardContent>
          </Card>

          {/* Payment Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-indigo-600" />
                {t('money.settings.paymentAccounts') || 'Payment Accounts'}
              </CardTitle>
              <CardDescription>
                {t('money.settings.paymentAccountsDesc') || 'Bank accounts customers can pay into — pick one per invoice'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {displayedAccounts.length > 0 ? (
                <div className="space-y-2">
                  {displayedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{account.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {[account.bankName, account.accountName, account.accountNumber]
                            .filter(Boolean)
                            .join(' · ')}
                          {account.swiftCode ? ` · SWIFT ${account.swiftCode}` : ''}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAccount(account.id)}
                        title={t('common.remove') || 'Remove'}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('money.settings.noAccounts') || 'No payment accounts yet. Add one so customers know where to pay.'}
                </p>
              )}

              {showAccountForm ? (
                <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('money.settings.accountLabel') || 'Label'}</Label>
                      <Input
                        value={accountForm.label}
                        onChange={(e) => setAccountForm((p) => ({ ...p, label: e.target.value }))}
                        placeholder={t('money.settings.accountLabelPlaceholder') || 'e.g., BNU USD Account'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('money.settings.bankName') || 'Bank Name'}</Label>
                      <Select
                        value={accountForm.bankName}
                        onValueChange={(value) => setAccountForm((p) => ({ ...p, bankName: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('money.settings.selectBank') || 'Select a bank'} />
                        </SelectTrigger>
                        <SelectContent>
                          {BANK_OPTIONS.map((bank) => (
                            <SelectItem key={bank.value} value={bank.value}>
                              {bank.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('money.settings.bankAccountName') || 'Account Name'}</Label>
                      <Input
                        value={accountForm.accountName}
                        onChange={(e) => setAccountForm((p) => ({ ...p, accountName: e.target.value }))}
                        placeholder={t('money.settings.accountNamePlaceholder') || 'Account holder name'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('money.settings.bankAccountNumber') || 'Account Number'}</Label>
                      <Input
                        value={accountForm.accountNumber}
                        onChange={(e) => setAccountForm((p) => ({ ...p, accountNumber: e.target.value }))}
                        placeholder={t('money.settings.accountNumberPlaceholder') || 'XXXX-XXXX-XXXX'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {t('money.settings.swiftCode') || 'SWIFT Code'}{' '}
                        <span className="font-normal text-muted-foreground">
                          ({t('common.optional') || 'optional'})
                        </span>
                      </Label>
                      <Input
                        value={accountForm.swiftCode}
                        onChange={(e) => setAccountForm((p) => ({ ...p, swiftCode: e.target.value }))}
                        placeholder="BNULTLDI"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={handleAddAccount}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t('money.settings.addAccount') || 'Add Account'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowAccountForm(false);
                        setAccountForm(EMPTY_ACCOUNT_FORM);
                      }}
                    >
                      {t('common.cancel') || 'Cancel'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAccountForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('money.settings.addAccount') || 'Add Account'}
                </Button>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>{t('money.settings.defaultMethods') || 'Payment methods you accept by default'}</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCEPTED_METHOD_OPTIONS.map((option) => {
                    const selected = (settings.defaultPaymentMethods || []).includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleDefaultMethod(option.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-border bg-background text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                        }`}
                      >
                        {t(option.labelKey) || option.fallbackLabel}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('money.settings.defaultMethodsHint') || 'Pre-selected on new invoices; you can change them per invoice.'}
                </p>
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
