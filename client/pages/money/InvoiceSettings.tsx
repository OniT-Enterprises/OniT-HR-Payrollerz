/**
 * Invoice Settings Page
 * Invoice template, payment accounts, accepted payment methods, and invoice
 * defaults.
 *
 * Company identity (logo, name, TIN, address, phone, email) is NOT edited here.
 * It has one home — Settings → Company (`settings/config.companyDetails`) — and
 * this page only shows what invoices will actually print, read-only, with a link
 * to that one home. Before 2026-08 this page offered a second editable copy in
 * `settings/invoice`, so changing your address in Settings left invoices showing
 * the old one.
 *
 * Two rules keep that honest:
 *  - We display the EFFECTIVE values (`invoiceService.getSettings`, which falls
 *    back per-field to companyDetails when the invoice copy is blank), never the
 *    company profile directly — otherwise the page would advertise an address
 *    the invoice does not carry.
 *  - Save never writes the company-identity fields. Whatever a tenant froze into
 *    `settings/invoice` before stays byte-for-byte as it is; sent invoices and
 *    their frozen PDFs are untouched. Clearing a stale frozen copy would change
 *    what an already-sent invoice re-renders, so it is deliberately not done
 *    here — we surface the mismatch instead.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
import DashboardLoadError from '@/components/dashboard/DashboardLoadError';
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
import { useInvoiceSettings } from '@/hooks/useInvoices';
import { useSettings } from '@/hooks/useSettings';
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
  Trash2,
  Plus,
  ImageIcon,
  ArrowUpRight,
  AlertTriangle,
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
  iban: '',
  bin: '',
};

/**
 * Company-identity fields that live in Settings → Company. They are still
 * READ from the invoice-settings doc (older tenants have a copy frozen there),
 * but this page must never write them — see the file header.
 */
const COMPANY_IDENTITY_FIELDS = [
  'companyName',
  'companyTin',
  'companyAddress',
  'companyPhone',
  'companyEmail',
  'logoUrl',
] as const satisfies readonly (keyof InvoiceSettings)[];

/** Drop the company-identity fields from a settings payload before saving. */
function withoutCompanyIdentity(
  settings: Partial<InvoiceSettings>
): Partial<InvoiceSettings> {
  const next: Partial<InvoiceSettings> = { ...settings };
  for (const field of COMPANY_IDENTITY_FIELDS) {
    delete next[field];
  }
  return next;
}

/**
 * Mirrors `joinAddressParts` in invoiceService (private there): same trim,
 * same comma split, same case-insensitive de-dupe. It must match, or a
 * company profile whose address already repeats the city would be reported
 * as disagreeing with the invoice when it does not.
 */
function joinAddressParts(parts: Array<string | undefined | null>): string {
  const seen = new Set<string>();
  return parts
    .flatMap((part) => (part || '').split(','))
    .map((segment) => segment.trim())
    .filter((segment) => {
      if (!segment) return false;
      const key = segment.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}

const sameValue = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export default function InvoiceSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();

  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Partial<InvoiceSettings>>(DEFAULT_SETTINGS);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);

  const {
    data: loadedSettings,
    isLoading: loading,
    isError: loadError,
    isFetching,
    refetch,
  } = useInvoiceSettings();

  // The company profile — the one place company identity is edited.
  const { data: tenantSettings } = useSettings();
  const companyDetails = tenantSettings?.companyDetails;

  useEffect(() => {
    if (!loadedSettings || hasLocalChanges) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing server state into local form state
    setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
  }, [hasLocalChanges, loadedSettings]);

  const saveMutation = useMutation({
    // `settings` holds the EFFECTIVE values, i.e. company fields already
    // resolved from the company profile by getSettings. Saving them verbatim is
    // what froze a stale copy into settings/invoice for every tenant who ever
    // pressed Save (even just to change the invoice prefix). Strip them: stored
    // values are left exactly as they are, and a tenant with none keeps
    // following their company profile.
    mutationFn: (data: Partial<InvoiceSettings>) =>
      invoiceService.updateSettings(tenantId, withoutCompanyIdentity(data)),
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

  // ----- Company identity (read-only, owned by Settings → Company) -----

  // What invoices will actually print. `settings` came from getSettings, which
  // already fell back per-field to the company profile where the invoice copy
  // was blank — so this is the truth, not an aspiration.
  const identityRows = [
    {
      key: 'companyName',
      label: t('money.settings.companyName') || 'Company Name',
      effective: settings.companyName || '',
      profile: companyDetails?.tradingName || companyDetails?.legalName || '',
    },
    {
      key: 'companyTin',
      label: t('money.settings.companyTin') || 'TIN (Tax ID Number)',
      effective: settings.companyTin || '',
      profile: companyDetails?.tinNumber || '',
    },
    {
      key: 'companyAddress',
      label: t('money.settings.companyAddress') || 'Address',
      effective: settings.companyAddress || '',
      profile: companyDetails
        ? joinAddressParts([
            companyDetails.registeredAddress,
            companyDetails.city,
            companyDetails.country,
          ])
        : '',
    },
    {
      key: 'companyPhone',
      label: t('money.settings.companyPhone') || 'Phone',
      effective: settings.companyPhone || '',
      profile: companyDetails?.phone || '',
    },
    {
      key: 'companyEmail',
      label: t('money.settings.companyEmail') || 'Email',
      effective: settings.companyEmail || '',
      profile: companyDetails?.email || '',
    },
  ];

  // A field only counts as out of step when the profile actually has a value to
  // disagree with — a blank profile field means the invoice value came from the
  // tenant record, not from an override, and there is nothing to reconcile.
  const outOfStepRows = companyDetails
    ? identityRows.filter(
        (row) => row.profile && row.effective && !sameValue(row.effective, row.profile)
      )
    : [];

  // The logo is deliberately NOT compared: every upload gets its own timestamped
  // filename, so the same picture uploaded on both pages yields two different
  // URLs. A mismatch we cannot verify is worse than none — and unlike an
  // address, a wrong logo is obvious from the preview above.

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
      ...(accountForm.iban ? { iban: accountForm.iban } : {}),
      ...(accountForm.bin ? { bin: accountForm.bin } : {}),
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
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="hidden md:flex gap-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>

          <div className="space-y-6">
            {/* Company Information */}
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-20 w-32 shrink-0 rounded-lg" />
                  <Skeleton className="h-3 w-48" />
                </div>

                <Separator />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-4 w-44" />
                  </div>
                </div>

                <Skeleton className="h-9 w-52" />
              </CardContent>
            </Card>

            {/* Invoice Template */}
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-72 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-lg border-2 border-border p-2">
                        <Skeleton className="aspect-[3/4] w-full rounded" />
                        <Skeleton className="mt-2 h-3 w-16" />
                        <Skeleton className="mt-1 h-3 w-24" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <Skeleton className="mb-2 h-4 w-24" />
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-8 w-8 rounded-full" />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Accounts */}
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-80 mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>

                <Skeleton className="h-8 w-36" />

                <Separator />

                <div className="space-y-2">
                  <Skeleton className="h-4 w-56" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-64" />
                </div>
              </CardContent>
            </Card>

            {/* Invoice Defaults */}
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56 mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-[200px]" />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-3 w-48" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-16 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-3 w-72" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex justify-end md:hidden">
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError && loadedSettings === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError isRetrying={isFetching} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Invoice Settings - Xefe" description="Configure invoice settings" />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
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
                {t('money.settings.companyInfoReadOnlyDesc') ||
                  'What your invoices show as your business. Change it in Company Settings.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo — uploaded once, in Company Settings */}
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.logoUrl
                    ? t('money.settings.logoReadOnly') || 'Your logo, as it prints on invoices and PDFs.'
                    : t('money.settings.logoNotSet') || 'No logo yet. Add one in Company Settings.'}
                </p>
              </div>

              <Separator />

              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {identityRows.map((row) => (
                  <div
                    key={row.key}
                    className={row.key === 'companyAddress' ? 'sm:col-span-2' : undefined}
                  >
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd
                      className={`mt-0.5 text-sm ${
                        row.effective
                          ? 'whitespace-pre-line text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {row.effective || (t('money.settings.notSet') || 'Not set')}
                    </dd>
                  </div>
                ))}
              </dl>

              <Button asChild variant="outline" size="sm">
                <Link to="/settings/company">
                  {t('money.settings.editInCompanySettings') || 'Change in Company Settings'}
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>

              {outOfStepRows.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">
                      {t('money.settings.identityOutOfStep') ||
                        'Your invoices show an older copy of these details'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('money.settings.identityOutOfStepHelp') ||
                        'These were saved on this page before, so your Company Settings no longer update them. Contact support to line them up.'}
                    </p>
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {outOfStepRows.map((row) => (
                        <li key={row.key}>
                          <span className="text-foreground">{row.label}</span>{' '}
                          {t('money.settings.identityInCompanySettings') ||
                            'in Company Settings'}
                          : {row.profile}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
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
                          {account.iban ? ` · IBAN ${account.iban}` : ''}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.remove') || 'Remove'}
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
                    <div className="space-y-2">
                      <Label>
                        IBAN{' '}
                        <span className="font-normal text-muted-foreground">
                          ({t('common.optional') || 'optional'})
                        </span>
                      </Label>
                      <Input
                        value={accountForm.iban}
                        onChange={(e) => setAccountForm((p) => ({ ...p, iban: e.target.value }))}
                        placeholder="TL38 0021 ..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {t('money.settings.bin') || 'BIN'}{' '}
                        <span className="font-normal text-muted-foreground">
                          ({t('common.optional') || 'optional'})
                        </span>
                      </Label>
                      <Input
                        value={accountForm.bin}
                        onChange={(e) => setAccountForm((p) => ({ ...p, bin: e.target.value }))}
                        placeholder={t('money.settings.binPlaceholder') || 'Bank identification number'}
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

              <div className="space-y-2">
                <Label>{t('money.settings.footerMessage') || 'Footer Message'}</Label>
                <Input
                  value={settings.footerMessage || ''}
                  onChange={(e) => updateField('footerMessage', e.target.value)}
                  placeholder={t('money.settings.footerPlaceholder') || 'Thank you for your business!'}
                  maxLength={150}
                />
                <p className="text-xs text-muted-foreground">
                  {t('money.settings.footerHelp') || 'Closing line at the bottom of invoices, PDFs, and emails — e.g., "Thank you for choosing Onit Enterprises Lda."'}
                </p>
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
