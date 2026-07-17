/**
 * Invoice Form
 * Create and edit invoices; read view is InvoiceViewScreen.
 * Uses react-hook-form + Zod for form management and validation
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
import DashboardLoadError from '@/components/dashboard/DashboardLoadError';
import MoreDetailsSection from '@/components/MoreDetailsSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { invoiceService } from '@/services/invoiceService';
import { SEO } from '@/components/SEO';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveCustomers, customerKeys } from '@/hooks/useCustomers';
import { customerService } from '@/services/customerService';
import { useInvoice, useInvoiceSettings, useCreateInvoice, useUpdateInvoice } from '@/hooks/useInvoices';
import { useTenant, useTenantId } from '@/contexts/TenantContext';
import { InvoiceViewScreen } from '@/components/money/InvoiceViewScreen';
import { InvoicePaper, type InvoicePaperData } from '@/components/money/InvoicePaper';
import { TemplatePicker } from '@/components/money/TemplatePicker';
import {
  PAYMENT_TERM_PRESETS,
  ACCEPTED_METHOD_OPTIONS,
  getSettingsPaymentAccounts,
  resolveInvoicePaymentAccount,
  DEFAULT_TEMPLATE_ID,
  lineNetAmount,
} from '@/lib/invoiceTemplates';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import { invoiceFormSchema, type InvoiceFormSchemaData } from '@/lib/validations';
import type { InvoiceFormData, InvoiceSettings, PaymentMethod } from '@/types/money';
import { getTodayTL, addDaysISO } from '@/lib/dateUtils';
import { subtractMoney } from '@/lib/currency';
import { calculateInvoiceAmounts } from '@/lib/accounting/calculations';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  Calendar,
  User,
  Eye,
  Landmark,
  Palette,
} from 'lucide-react';

export default function InvoiceForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { canManage } = useTenant();
  const tenantId = useTenantId();
  const canManageTenant = canManage();

  // Preload PDF module so download resolves instantly from cache
  const preloaded = useRef(false);
  useEffect(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    import('@/components/money/InvoicePDF');
  }, []);

  const isNew = !id || id === 'new';
  const duplicateId = searchParams.get('duplicate');
  const preselectedCustomerId = searchParams.get('customer');

  const [saving, setSaving] = useState(false);
  const submitInFlight = useRef(false);
  const [showPreview, setShowPreview] = useState(false);
  const queryClient = useQueryClient();
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // React Query hooks for data loading
  const {
    data: customers = [],
    isLoading: customersLoading,
    isError: customersLoadError,
    isFetching: customersFetching,
    refetch: retryCustomers,
  } = useActiveCustomers();
  const {
    data: loadedSettings,
    isLoading: settingsLoading,
    isError: settingsLoadError,
    isFetching: settingsFetching,
    refetch: retrySettingsLoad,
  } = useInvoiceSettings();
  const invoiceSettings: Partial<InvoiceSettings> = useMemo(
    () => loadedSettings || {},
    [loadedSettings]
  );
  const invoiceIdToLoad = !isNew && id ? id : undefined;
  const {
    data: invoice = null,
    isLoading: invoiceLoading,
    isError: invoiceLoadError,
    refetch: retryInvoiceLoad,
  } = useInvoice(invoiceIdToLoad);
  const {
    data: duplicateInvoice,
    isLoading: duplicateLoading,
    isError: duplicateLoadError,
    isFetching: duplicateFetching,
    isSuccess: duplicateLoaded,
    refetch: retryDuplicateLoad,
  } = useInvoice(duplicateId || undefined);
  const createInvoiceMutation = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();

  const loading = settingsLoading || Boolean(duplicateId && duplicateLoading) || (!isNew
    ? (customersLoading || invoiceLoading)
    : (customersLoading && !customers.length));

  const TAX_RATES = [
    { value: 0, label: t('money.invoices.noTax') || 'No Tax (0%)' },
    { value: 2.5, label: '2.5%' },
    { value: 5, label: '5%' },
    { value: 10, label: '10%' },
  ];

  // React Hook Form for better performance (no re-render on every keystroke)
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<InvoiceFormSchemaData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customerId: preselectedCustomerId || '',
      issueDate: getTodayTL(),
      dueDate: addDaysISO(getTodayTL(), 30),
      items: [{ description: '', quantity: 1, unitPrice: 0, amount: 0 }],
      projectName: '',
      poNumber: '',
      taxRate: 0,
      notes: '',
      terms: 'Payment due within 30 days.',
      templateId: undefined,
      paymentTermsDays: 30,
      paymentMethods: [],
      paymentAccountId: '',
    },
  });

  // useFieldArray for dynamic line items management
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Watch form values for summary calculation
  const formData = watch();

  const paymentAccounts = useMemo(
    () => getSettingsPaymentAccounts(invoiceSettings),
    [invoiceSettings]
  );

  // Apply tenant defaults (template, terms, notes, methods, account) to new invoices
  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (!isNew || duplicateId || defaultsApplied.current || !loadedSettings) return;
    if (isDirty) return;
    defaultsApplied.current = true;

    const dueDays = loadedSettings.defaultDueDays ?? 30;
    const defaultAccount = resolveInvoicePaymentAccount(null, loadedSettings);
    reset((prev) => ({
      ...prev,
      dueDate: addDaysISO(prev.issueDate || getTodayTL(), dueDays),
      taxRate: loadedSettings.defaultTaxRate ?? prev.taxRate,
      notes: loadedSettings.defaultNotes ?? prev.notes,
      terms: loadedSettings.defaultTerms ?? prev.terms,
      templateId: loadedSettings.defaultTemplate || DEFAULT_TEMPLATE_ID,
      paymentTermsDays: dueDays,
      paymentMethods: loadedSettings.defaultPaymentMethods?.length
        ? loadedSettings.defaultPaymentMethods
        : ['cash', 'bank_transfer'],
      paymentAccountId: defaultAccount?.id || 'none',
    }));
  }, [isNew, duplicateId, loadedSettings, isDirty, reset]);

  // Set preselected customer if provided
  useEffect(() => {
    if (preselectedCustomerId) {
      reset((prev) => ({ ...prev, customerId: preselectedCustomerId }));
    }
  }, [preselectedCustomerId, reset]);

  // Populate form when editing an existing invoice
  useEffect(() => {
    if (!isNew && invoice) {
      reset({
        customerId: invoice.customerId,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        items: invoice.items,
        projectName: invoice.projectName || '',
        poNumber: invoice.poNumber || '',
        taxRate: invoice.taxRate,
        notes: invoice.notes || '',
        terms: invoice.terms || '',
        templateId: invoice.templateId || invoiceSettings.defaultTemplate || DEFAULT_TEMPLATE_ID,
        paymentTermsDays: invoice.paymentTermsDays ?? null,
        // Legacy invoices predate the payment fields — seed from tenant
        // defaults so editing an old draft upgrades it to the new controls
        paymentMethods: invoice.paymentMethods ?? invoiceSettings.defaultPaymentMethods ?? [],
        paymentAccountId: invoice.paymentAccount === null
          ? 'none'
          : invoice.paymentAccount?.id
            || resolveInvoicePaymentAccount(null, invoiceSettings)?.id
            || 'none',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settings only seed the template fallback
  }, [isNew, invoice, reset]);

  // Handle duplicate
  useEffect(() => {
    if (duplicateInvoice) {
      const termsDays = duplicateInvoice.paymentTermsDays ?? null;
      const today = getTodayTL();
      reset({
        customerId: duplicateInvoice.customerId,
        issueDate: today,
        dueDate: addDaysISO(today, termsDays ?? 30),
        items: duplicateInvoice.items,
        projectName: duplicateInvoice.projectName || '',
        poNumber: duplicateInvoice.poNumber || '',
        taxRate: duplicateInvoice.taxRate,
        notes: duplicateInvoice.notes || '',
        terms: duplicateInvoice.terms || '',
        templateId: duplicateInvoice.templateId || invoiceSettings.defaultTemplate || DEFAULT_TEMPLATE_ID,
        paymentTermsDays: termsDays,
        paymentMethods: duplicateInvoice.paymentMethods ?? invoiceSettings.defaultPaymentMethods ?? [],
        paymentAccountId: duplicateInvoice.paymentAccount === null
          ? 'none'
          : duplicateInvoice.paymentAccount?.id
            || resolveInvoicePaymentAccount(null, invoiceSettings)?.id
            || 'none',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settings only seed the template fallback
  }, [duplicateInvoice, reset]);

  // Keep due date in sync with the selected payment terms
  useEffect(() => {
    const days = formData.paymentTermsDays;
    if (days === null || days === undefined || !formData.issueDate) return;
    const expected = addDaysISO(formData.issueDate, days);
    if (getValues('dueDate') !== expected) {
      setValue('dueDate', expected);
    }
  }, [formData.issueDate, formData.paymentTermsDays, getValues, setValue]);

  const calculateTotals = () => {
    const items = formData.items || [];
    const invoiceTaxRate = Number(formData.taxRate) || 0;
    // Same math the service persists — one source of truth for the preview.
    const { subtotal, discountTotal, taxAmount, total } = calculateInvoiceAmounts(
      items.map((item) => ({
        description: item.description || '',
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        amount: 0,
        ...(item.discount !== undefined && item.discount !== null
          ? { discount: Number(item.discount) }
          : {}),
        ...(item.vatRate !== undefined && item.vatRate !== null
          ? { vatRate: Number(item.vatRate) }
          : {}),
      })),
      invoiceTaxRate,
    );
    return { subtotal, discountTotal, taxAmount, total };
  };

  const { subtotal, discountTotal, taxAmount, total } = calculateTotals();

  const _selectedCustomer = customers.find((c) => c.id === formData.customerId);

  // Live data for the preview dialog — mirrors what will be saved
  const previewInvoice: InvoicePaperData = useMemo(() => {
    const validItems = (formData.items || []).filter((item) => item.description?.trim());
    const accountId = formData.paymentAccountId;
    const previewAccount = accountId === 'none'
      ? null
      : paymentAccounts.find((a) => a.id === accountId)
        || resolveInvoicePaymentAccount(null, invoiceSettings);

    return {
      invoiceNumber: invoice?.invoiceNumber
        || `${invoiceSettings.prefix || 'INV'}-${new Date().getFullYear()}-•••`,
      status: invoice?.status || 'draft',
      customerName: _selectedCustomer?.name || t('money.invoices.customer') || 'Customer',
      customerEmail: _selectedCustomer?.email,
      customerPhone: _selectedCustomer?.phone,
      customerAddress: _selectedCustomer?.address,
      issueDate: formData.issueDate,
      dueDate: formData.dueDate,
      items: validItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        ...(item.discount ? { discount: Number(item.discount) } : {}),
      })),
      projectName: formData.projectName || undefined,
      poNumber: formData.poNumber || undefined,
      subtotal,
      discountTotal,
      taxRate: Number(formData.taxRate) || 0,
      taxAmount,
      total,
      amountPaid: invoice?.amountPaid || 0,
      balanceDue: subtractMoney(total, invoice?.amountPaid || 0),
      notes: formData.notes,
      terms: formData.terms,
      templateId: formData.templateId,
      paymentTermsDays: formData.paymentTermsDays,
      paymentMethods: formData.paymentMethods as PaymentMethod[] | undefined,
      paymentAccount: previewAccount,
    };
  }, [formData, subtotal, discountTotal, taxAmount, total, invoice, invoiceSettings, paymentAccounts, _selectedCustomer, t]);

  const handleCreateCustomer = async () => {
    const name = newCustomer.name.trim();
    if (!name) return;
    setCreatingCustomer(true);
    try {
      const data: Parameters<typeof customerService.createCustomer>[1] = { name, type: 'business' };
      if (newCustomer.phone.trim()) data.phone = newCustomer.phone.trim();
      if (newCustomer.email.trim()) data.email = newCustomer.email.trim();
      const customerId = await customerService.createCustomer(tenantId, data);
      await queryClient.invalidateQueries({ queryKey: customerKeys.all(tenantId) });
      setValue('customerId', customerId, { shouldValidate: true, shouldDirty: true });
      setShowNewCustomer(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.customerAdded') || `Customer "${name}" added`,
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.customerAddError') || 'Could not add customer',
        variant: 'destructive',
      });
    } finally {
      setCreatingCustomer(false);
    }
  };

  const addLineItem = () => {
    append({ description: '', quantity: 1, unitPrice: 0, amount: 0, discount: undefined, vatRate: undefined });
  };

  const removeLineItem = (index: number) => {
    if (fields.length === 1) return;
    remove(index);
  };

  const onSubmit = async (data: InvoiceFormSchemaData, sendAfter = false) => {
    if (submitInFlight.current || !canManageTenant) return;
    submitInFlight.current = true;
    try {
      setSaving(true);

      // Filter out empty items and convert to InvoiceFormData
      const validItems = data.items.filter((item) => item.description.trim() !== '');
      const dataToSave: InvoiceFormData = {
        customerId: data.customerId,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        items: validItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          ...(item.discount !== undefined && item.discount !== null && item.discount > 0 && { discount: Number(item.discount) }),
          amount: lineNetAmount(item),
          ...(item.vatRate !== undefined && item.vatRate !== null && { vatRate: Number(item.vatRate) }),
        })),
        projectName: data.projectName || '',
        poNumber: data.poNumber || '',
        taxRate: Number(data.taxRate),
        notes: data.notes || '',
        terms: data.terms || '',
        templateId: data.templateId,
        paymentTermsDays: data.paymentTermsDays ?? null,
        paymentMethods: (data.paymentMethods || []) as PaymentMethod[],
        paymentAccountId: data.paymentAccountId || undefined,
      };

      let invoiceId: string;

      if (isNew || duplicateId) {
        invoiceId = await createInvoiceMutation.mutateAsync(dataToSave);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.invoices.created') || 'Invoice created',
        });
      } else if (invoice) {
        await updateInvoiceMutation.mutateAsync({ id: invoice.id, data: dataToSave });
        invoiceId = invoice.id;
        toast({
          title: t('common.success') || 'Success',
          description: t('money.invoices.updated') || 'Invoice updated',
        });
      } else {
        return;
      }

      if (sendAfter) {
        await invoiceService.markAsSent(tenantId, invoiceId);
        const customerEmail = customers.find((c) => c.id === data.customerId)?.email;
        toast({
          title: t('common.success') || 'Success',
          description: customerEmail
            ? (t('money.invoices.sentToEmail') || 'Invoice emailed to {{email}}').replace('{{email}}', customerEmail)
            : t('money.invoices.sentSuccess') || 'Invoice sent',
        });
      }

      navigate('/money/invoices');
    } catch (_error) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.saveError') || 'Failed to save invoice',
        variant: 'destructive',
      });
    } finally {
      submitInFlight.current = false;
      setSaving(false);
    }
  };

  const handleSave = (sendAfter = false) => {
    handleSubmit((data) => onSubmit(data, sendAfter), (validationErrors) => {
      const firstError = Object.values(validationErrors)[0];
      toast({
        title: t('common.error') || 'Validation Error',
        description: firstError?.message || 'Please fill in all required fields.',
        variant: 'destructive',
      });
    })();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const canEdit =
    canManageTenant &&
    (isNew || Boolean(duplicateId) || Boolean(invoice && invoice.status === 'draft'));

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-screen-lg mx-auto">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (settingsLoadError && loadedSettings === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError
          isRetrying={settingsFetching}
          onRetry={() => retrySettingsLoad()}
        />
      </div>
    );
  }

  const customersUnavailable = customersLoadError && customers.length === 0;
  const duplicateUnavailable = Boolean(
    duplicateId && duplicateLoadError && duplicateInvoice === undefined,
  );

  if (customersUnavailable || duplicateUnavailable) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError
          isRetrying={customersFetching || duplicateFetching}
          onRetry={() =>
            Promise.all([
              ...(customersUnavailable ? [retryCustomers()] : []),
              ...(duplicateUnavailable ? [retryDuplicateLoad()] : []),
            ])
          }
        />
      </div>
    );
  }

  if (duplicateId && duplicateLoaded && !duplicateInvoice) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title={`${t('money.invoices.title') || 'Invoices'} - Xefe`} />
        <MainNavigation />
        <div className="p-4 sm:p-6 max-w-screen-lg mx-auto">
          <Card className="max-w-xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle>{t('money.invoices.noResults') || 'Invoice not found'}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-6">
                {t('notFound.message') ||
                  "The invoice you're looking for doesn't exist or is no longer available."}
              </p>
              <Button variant="outline" onClick={() => navigate('/money/invoices')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back') || 'Back'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isNew && !invoice) {
    const isQueryError = invoiceLoadError;
    return (
      <div className="min-h-screen bg-background">
        <SEO title={`${t('money.invoices.title') || 'Invoices'} - Xefe`} />
        <MainNavigation />
        <div className="p-4 sm:p-6 max-w-screen-lg mx-auto">
          <Card className="max-w-xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle>
                {isQueryError
                  ? t('common.connectionIssueTitle') || 'Connection problem'
                  : t('money.invoices.noResults') || 'Invoice not found'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-6">
                {isQueryError
                  ? t('common.connectionIssueDesc') ||
                    'Check your connection, then try loading the invoice again.'
                  : t('notFound.message') ||
                    "The invoice you're looking for doesn't exist or is no longer available."}
              </p>
              <div className="flex flex-col-reverse sm:flex-row justify-center gap-2">
                <Button variant="outline" onClick={() => navigate('/money/invoices')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('common.back') || 'Back'}
                </Button>
                {isQueryError && (
                  <Button onClick={() => void retryInvoiceLoad()}>
                    {t('common.retry') || 'Retry'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // View mode for non-draft invoices
  if (invoice && !canEdit) {
    return <InvoiceViewScreen invoice={invoice} settings={invoiceSettings} />;
  }

  // Edit/Create mode
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={isNew ? 'New Invoice - Xefe' : `Edit ${invoice?.invoiceNumber || 'Invoice'} - Xefe`}
      />
      <MainNavigation />

      <div className="p-6 max-w-screen-xl mx-auto">
        <PageHeader
          title={isNew ? t('money.invoices.newInvoice') || 'New Invoice' : t('money.invoices.editInvoice') || 'Edit Invoice'}
          icon={FileText}
          iconColor="text-indigo-500"
          actions={
            <>
              <Button variant="ghost" onClick={() => navigate('/money/invoices')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back') || 'Back'}
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4 mr-2" />
                {t('money.invoices.preview') || 'Preview'}
              </Button>
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {t('money.invoices.saveDraft') || 'Save Draft'}
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {t('money.invoices.saveAndSend') || 'Save & Send'}
              </Button>
            </>
          }
        />

        <div className="space-y-6">
          {/* Customer & dates */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Customer Selection */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {t('money.invoices.customer') || 'Customer'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Controller
                  name="customerId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        if (value === '__new__') {
                          // Defer until the Select finishes closing — opening a
                          // Dialog synchronously from onValueChange can leave
                          // Radix's pointer-events lock stuck on <body>,
                          // freezing the whole screen.
                          setTimeout(() => setShowNewCustomer(true), 0);
                          return;
                        }
                        field.onChange(value);
                      }}
                    >
                      <SelectTrigger className={errors.customerId ? 'border-red-500' : ''}>
                        <SelectValue
                          placeholder={t('money.invoices.selectCustomer') || 'Select a customer'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__" className="text-primary font-medium">
                          + {t('money.invoices.newCustomer') || 'New customer…'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.customerId && (
                  <p className="text-sm text-red-500 mt-1">{errors.customerId.message}</p>
                )}
                {customers.length === 0 && (
                  <Button
                    type="button"
                    variant="link"
                    className="mt-2 p-0 h-auto text-primary"
                    onClick={() => setShowNewCustomer(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('money.invoices.addCustomerFirst') || 'Add a customer first'}
                  </Button>
                )}

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      {t('money.invoices.projectName') || 'Project / Service'}{' '}
                      <span className="font-normal text-muted-foreground">
                        ({t('common.optional') || 'optional'})
                      </span>
                    </Label>
                    <Input
                      {...register('projectName')}
                      placeholder={t('money.invoices.projectPlaceholder') || 'e.g., Website redesign'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {t('money.invoices.poNumber') || 'Reference / PO'}{' '}
                      <span className="font-normal text-muted-foreground">
                        ({t('common.optional') || 'optional'})
                      </span>
                    </Label>
                    <Input
                      {...register('poNumber')}
                      placeholder={t('money.invoices.poPlaceholder') || 'Customer PO number'}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('money.invoices.dates') || 'Dates'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('money.invoices.issueDate') || 'Issue Date'}</Label>
                  <Input
                    type="date"
                    {...register('issueDate')}
                    className={errors.issueDate ? 'border-red-500' : ''}
                  />
                  {errors.issueDate && (
                    <p className="text-sm text-red-500">{errors.issueDate.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    {t('money.invoices.dueDate') || 'Due Date'}
                    <InfoTooltip content={MoneyTooltips.terms.dueDate} />
                  </Label>
                  <Input
                    type="date"
                    {...register('dueDate', {
                      // Manual edits switch payment terms to "Custom"
                      onChange: () => setValue('paymentTermsDays', null),
                    })}
                    className={errors.dueDate ? 'border-red-500' : ''}
                  />
                  {errors.dueDate && (
                    <p className="text-sm text-red-500">{errors.dueDate.message}</p>
                  )}
                  {formData.paymentTermsDays !== null && formData.paymentTermsDays !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      {t('money.invoices.dueDateAuto') || 'Set automatically from payment terms.'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Line Items — full width so descriptions get room */}
          <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('money.invoices.lineItems') || 'Line Items'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Column labels */}
                <div className="mb-2 hidden gap-3 pr-12 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:flex">
                  <span className="flex-1">{t('money.invoices.description') || 'Description'}</span>
                  <span className="w-16 text-right">{t('money.invoices.qty') || 'Qty'}</span>
                  <span className="w-28 text-right">{t('money.invoices.price') || 'Price'}</span>
                  <span className="w-16 text-right">{t('money.invoices.discountShort') || 'Disc %'}</span>
                  <span className="w-16 text-right">{t('money.invoices.vatShort') || 'VAT %'}</span>
                  <span className="w-28 text-right">{t('money.invoices.amount') || 'Amount'}</span>
                </div>
                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const itemValues = formData.items?.[index];
                    const lineTotal = itemValues ? lineNetAmount(itemValues) : 0;
                    return (
                      <div key={field.id} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Input
                            {...register(`items.${index}.description`)}
                            placeholder={
                              t('money.invoices.itemDescription') || 'Description of service or product'
                            }
                            className={errors.items?.[index]?.description ? 'border-red-500' : ''}
                          />
                          {errors.items?.[index]?.description && (
                            <p className="text-xs text-red-500 mt-1">
                              {errors.items[index]?.description?.message}
                            </p>
                          )}
                        </div>
                        <div className="w-16">
                          <Input
                            type="number"
                            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            placeholder={t('money.invoices.qty') || 'Qty'}
                            min="0"
                            step="1"
                            className={errors.items?.[index]?.quantity ? 'border-red-500' : ''}
                          />
                        </div>
                        <div className="w-28">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              $
                            </span>
                            <Input
                              type="number"
                              {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                              placeholder={t('money.invoices.price') || 'Price'}
                              min="0"
                              step="0.01"
                              className={`pl-7 ${errors.items?.[index]?.unitPrice ? 'border-red-500' : ''}`}
                            />
                          </div>
                        </div>
                        <div className="w-16">
                          <Input
                            type="number"
                            {...register(`items.${index}.discount`, { valueAsNumber: true })}
                            placeholder="0%"
                            min="0"
                            max="100"
                            step="0.5"
                            title={t('money.invoices.discountTitle') || 'Discount %'}
                            className={`text-xs ${errors.items?.[index]?.discount ? 'border-red-500' : ''}`}
                          />
                        </div>
                        <div className="w-16">
                          <Input
                            type="number"
                            {...register(`items.${index}.vatRate`, { valueAsNumber: true })}
                            placeholder={`${formData.taxRate || 0}%`}
                            min="0"
                            max="100"
                            step="0.5"
                            title={t('money.invoices.vatTitle') || 'VAT %'}
                            className="text-xs"
                          />
                        </div>
                        <div className="w-28 text-right pt-2 font-medium">
                          {formatCurrency(lineTotal)}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(index)}
                          disabled={fields.length === 1}
                          className="shrink-0"
                          title={t('common.remove') || 'Remove'}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {errors.items && typeof errors.items.message === 'string' && (
                  <p className="text-sm text-red-500 mt-2">{errors.items.message}</p>
                )}
                <Button type="button" variant="outline" onClick={addLineItem} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('money.invoices.addItem') || 'Add Item'}
                </Button>
              </CardContent>
            </Card>

          {/* Payment options & template */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Payment Options */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  {t('money.invoices.paymentOptions') || 'Payment Options'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Payment terms */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      {t('money.invoices.paymentTerms') || 'Payment Terms'}
                      <InfoTooltip content={MoneyTooltips.terms.dueDate} />
                    </Label>
                    <Controller
                      name="paymentTermsDays"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value === null || field.value === undefined ? 'custom' : String(field.value)}
                          onValueChange={(v) => field.onChange(v === 'custom' ? null : parseInt(v, 10))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_TERM_PRESETS.map((preset) => (
                              <SelectItem
                                key={preset.days === null ? 'custom' : preset.days}
                                value={preset.days === null ? 'custom' : String(preset.days)}
                              >
                                {t(preset.labelKey) || preset.fallbackLabel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Payment account */}
                  <div className="space-y-2">
                    <Label>{t('money.invoices.paymentAccount') || 'Payment Account'}</Label>
                    <Controller
                      name="paymentAccountId"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || 'none'} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('money.invoices.selectAccount') || 'Select account'}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.label || `${account.bankName} ${account.accountNumber}`}
                              </SelectItem>
                            ))}
                            <SelectItem value="none">
                              {t('money.invoices.noBankDetails') || "Don't show bank details"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {paymentAccounts.length === 0 && canManageTenant && (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-indigo-600"
                        type="button"
                        onClick={() => navigate('/money/invoices/settings')}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('money.invoices.addAccountInSettings') || 'Add a payment account in Settings'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Accepted payment methods */}
                <div className="space-y-2">
                  <Label>{t('money.invoices.acceptedMethods') || 'Payment methods you accept'}</Label>
                  <Controller
                    name="paymentMethods"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        {ACCEPTED_METHOD_OPTIONS.map((option) => {
                          const selected = (field.value || []).includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => {
                                const current = field.value || [];
                                field.onChange(
                                  selected
                                    ? current.filter((m: string) => m !== option.value)
                                    : [...current, option.value]
                                );
                              }}
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
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('money.invoices.acceptedMethodsHint') || 'Shown on the invoice under Payment Details.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Template */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  {t('money.invoices.template') || 'Template'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Controller
                  name="templateId"
                  control={control}
                  render={({ field }) => (
                    <TemplatePicker
                      compact
                      value={field.value || invoiceSettings.defaultTemplate || DEFAULT_TEMPLATE_ID}
                      onChange={field.onChange}
                      accentColor={invoiceSettings.accentColor}
                    />
                  )}
                />
                <Button
                  type="button"
                  variant="link"
                  className="mt-2 h-auto p-0 text-xs text-indigo-600"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {t('money.invoices.previewInvoice') || 'Preview invoice'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <MoreDetailsSection>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t('money.invoices.additionalInfo') || 'Additional Information'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('money.invoices.notes') || 'Notes'}</Label>
                    <Textarea
                      {...register('notes')}
                      placeholder={t('money.invoices.notesPlaceholder') || 'Notes visible to customer'}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('money.invoices.terms') || 'Terms & Conditions'}</Label>
                    <Textarea
                      {...register('terms')}
                      placeholder={t('money.invoices.termsPlaceholder') || 'Payment terms'}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Tax */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-1.5">
                    {t('money.invoices.tax') || 'Tax'}
                    <InfoTooltip content={MoneyTooltips.tlSpecific.taxRate} title="TL Tax Rate" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Controller
                    name="taxRate"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(parseFloat(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TAX_RATES.map((rate) => (
                            <SelectItem key={rate.value} value={rate.value.toString()}>
                              {rate.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </MoreDetailsSection>

          {/* Summary — bottom right, like a paper invoice */}
          <div className="flex justify-end">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  {t('money.invoices.summary') || 'Summary'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    {t('money.invoices.subtotal') || 'Subtotal'}
                    <InfoTooltip content={MoneyTooltips.calculations.subtotal} size="sm" />
                  </span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('money.invoices.includesDiscount') || 'Includes discount of'}</span>
                    <span>-{formatCurrency(discountTotal)}</span>
                  </div>
                )}
                {formData.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      {t('money.invoices.tax') || 'Tax'} ({formData.taxRate}%)
                      <InfoTooltip content={MoneyTooltips.calculations.taxAmount} size="sm" />
                    </span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span className="flex items-center gap-1">
                    {t('money.invoices.total') || 'Total'}
                    <InfoTooltip content={MoneyTooltips.calculations.total} size="sm" />
                  </span>
                  <span className="text-indigo-600">{formatCurrency(total)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Live invoice preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('money.invoices.previewTitle') || 'Invoice Preview'}</DialogTitle>
            <DialogDescription>
              {t('money.invoices.previewDesc') || 'This is how your invoice will look to the customer.'}
            </DialogDescription>
          </DialogHeader>
          <InvoicePaper invoice={previewInvoice} settings={invoiceSettings} />
        </DialogContent>
      </Dialog>

      {/* Quick-add customer without leaving the invoice */}
      <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('money.invoices.newCustomerTitle') || 'New Customer'}</DialogTitle>
            <DialogDescription>
              {t('money.invoices.newCustomerDesc') ||
                'Add the basics now — you can complete the profile later in Customers.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-customer-name">
                {t('money.customers.name') || 'Name'} *
              </Label>
              <Input
                id="new-customer-name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                placeholder={t('money.customers.namePlaceholder') || 'Customer or business name'}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-customer-phone">{t('money.customers.phone') || 'Phone'}</Label>
                <Input
                  id="new-customer-phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+670"
                />
              </div>
              <div>
                <Label htmlFor="new-customer-email">{t('money.customers.email') || 'Email'}</Label>
                <Input
                  id="new-customer-email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowNewCustomer(false)}>
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button
                type="button"
                onClick={handleCreateCustomer}
                disabled={!newCustomer.name.trim() || creatingCustomer}
              >
                {creatingCustomer ? (
                  t('common.saving') || 'Saving…'
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('money.invoices.addCustomer') || 'Add Customer'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
