/**
 * Recurring Invoice Form
 * Create and edit recurring invoice templates
 * Uses react-hook-form + Zod for form management and validation
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
import { recurringInvoiceService } from '@/services/recurringInvoiceService';
import { customerService } from '@/services/customerService';
import { invoiceService } from '@/services/invoiceService';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import { recurringInvoiceFormSchema, type RecurringInvoiceFormSchemaData } from '@/lib/validations';
import type { RecurringFrequency, Customer, InvoiceSettings } from '@/types/money';
import { getTodayTL } from '@/lib/dateUtils';
import {
  Repeat,
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  Users,
  Calendar,
  FileText,
} from 'lucide-react';

const FREQUENCY_VALUES: RecurringFrequency[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

const DUE_DAYS_VALUES = [7, 14, 15, 30, 45, 60];

export default function RecurringInvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();

  const isEditMode = !!id;

  const frequencyOptions = FREQUENCY_VALUES.map((value) => ({
    value,
    label: t(`money.recurringInvoiceForm.frequency${value.charAt(0).toUpperCase() + value.slice(1)}`) || value,
  }));

  const dueDaysOptions = DUE_DAYS_VALUES.map((value) => ({
    value,
    label: t(`money.recurringInvoiceForm.dueDays${value}`) || `${value} days`,
  }));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [_settings, setSettings] = useState<Partial<InvoiceSettings>>({});

  // React Hook Form for better performance
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<RecurringInvoiceFormSchemaData>({
    resolver: zodResolver(recurringInvoiceFormSchema),
    defaultValues: {
      customerId: '',
      frequency: 'monthly',
      startDate: getTodayTL(),
      endType: 'never',
      endDate: '',
      endAfterOccurrences: undefined,
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 }],
      taxRate: 0,
      notes: '',
      terms: '',
      dueDays: 30,
      autoSend: false,
    },
  });

  // useFieldArray for dynamic line items
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Watch form values
  const formData = watch();
  const endType = watch('endType');

  useEffect(() => {
    if (session?.tid) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.tid, id]);

  const loadData = async () => {
    if (!session?.tid) return;

    try {
      setLoading(true);

      const [customerList, invoiceSettings] = await Promise.all([
        customerService.getActiveCustomers(session.tid),
        invoiceService.getSettings(session.tid).catch(() => ({})),
      ]);

      setCustomers(customerList);
      setSettings(invoiceSettings);

      // Set defaults from settings
      if (!isEditMode && invoiceSettings) {
        const s = invoiceSettings as Partial<InvoiceSettings>;
        reset((prev) => ({
          ...prev,
          taxRate: s.defaultTaxRate || 0,
          notes: s.defaultNotes || '',
          terms: s.defaultTerms || '',
          dueDays: s.defaultDueDays || 30,
        }));
      }

      // Load existing recurring invoice if editing
      if (isEditMode && id) {
        const recurring = await recurringInvoiceService.getById(session.tid, id);
        if (recurring) {
          let endTypeValue: 'never' | 'date' | 'occurrences' = 'never';
          if (recurring.endDate) {
            endTypeValue = 'date';
          } else if (recurring.endAfterOccurrences) {
            endTypeValue = 'occurrences';
          }

          reset({
            customerId: recurring.customerId,
            frequency: recurring.frequency,
            startDate: recurring.startDate,
            endType: endTypeValue,
            endDate: recurring.endDate || '',
            endAfterOccurrences: recurring.endAfterOccurrences,
            items: recurring.items.map((item, index) => ({
              ...item,
              id: item.id || `item-${index}`,
            })),
            taxRate: recurring.taxRate,
            notes: recurring.notes || '',
            terms: recurring.terms || '',
            dueDays: recurring.dueDays,
            autoSend: recurring.autoSend,
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.recurringInvoiceForm.loadError') || 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    append({ id: `item-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, amount: 0 });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const calculateSubtotal = () => {
    const items = formData.items || [];
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
  };
  const calculateTax = () => calculateSubtotal() * ((Number(formData.taxRate) || 0) / 100);
  const calculateTotal = () => calculateSubtotal() + calculateTax();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const onSubmit = async (formValues: RecurringInvoiceFormSchemaData) => {
    if (!session?.tid) return;

    try {
      setSaving(true);

      // Filter valid items and prepare data
      const validItems = formValues.items
        .filter((item) => item.description && (Number(item.quantity) * Number(item.unitPrice)) > 0)
        .map(({ id: _id, ...item }) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          amount: Number(item.quantity) * Number(item.unitPrice),
        }));

      const data = {
        customerId: formValues.customerId,
        frequency: formValues.frequency,
        startDate: formValues.startDate,
        endDate: formValues.endType === 'date' ? formValues.endDate : undefined,
        endAfterOccurrences: formValues.endType === 'occurrences' ? formValues.endAfterOccurrences : undefined,
        items: validItems,
        taxRate: Number(formValues.taxRate),
        notes: formValues.notes || undefined,
        terms: formValues.terms || undefined,
        dueDays: Number(formValues.dueDays),
        autoSend: formValues.autoSend,
      };

      if (isEditMode && id) {
        await recurringInvoiceService.update(session.tid, id, data);
        toast({ title: t('common.success') || 'Success', description: t('money.recurringInvoiceForm.updated') || 'Recurring invoice updated' });
      } else {
        await recurringInvoiceService.create(session.tid, data);
        toast({ title: t('common.success') || 'Success', description: t('money.recurringInvoiceForm.created') || 'Recurring invoice created' });
      }

      navigate('/money/invoices/recurring');
    } catch (error) {
      console.error('Error saving recurring invoice:', error);
      toast({
        title: t('common.error') || 'Error',
        description: error instanceof Error ? error.message : (t('money.recurringInvoiceForm.saveError') || 'Failed to save'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = handleSubmit(onSubmit);

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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={isEditMode ? `${t('money.recurringInvoiceForm.editTitle') || 'Edit Recurring Invoice'} - Meza` : `${t('money.recurringInvoiceForm.newTitle') || 'New Recurring Invoice'} - Meza`}
        description={t('money.recurringInvoiceForm.autoGenerate') || 'Set up a recurring invoice template'}
      />
      <MainNavigation />

      <div className="p-6 max-w-4xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/money/invoices/recurring')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('money.recurringInvoiceForm.back') || 'Back'}
            </Button>
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Repeat className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {isEditMode ? (t('money.recurringInvoiceForm.editTitle') || 'Edit Recurring Invoice') : (t('money.recurringInvoiceForm.newTitle') || 'New Recurring Invoice')}
              </h1>
              <p className="text-muted-foreground">
                {t('money.recurringInvoiceForm.autoGenerate') || 'Auto-generate invoices on a schedule'}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditMode ? (t('money.recurringInvoiceForm.saveChanges') || 'Save Changes') : (t('money.recurringInvoiceForm.createRecurring') || 'Create Recurring')}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Customer & Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                {t('money.recurringInvoiceForm.customerSchedule') || 'Customer & Schedule'}
              </CardTitle>
              <CardDescription>
                {t('money.recurringInvoiceForm.customerScheduleDesc') || 'Select the customer and set the billing frequency'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('money.recurringInvoiceForm.customer') || 'Customer'} *</Label>
                  <Controller
                    name="customerId"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className={errors.customerId ? 'border-red-500' : ''}>
                          <SelectValue placeholder={t('money.recurringInvoiceForm.selectCustomer') || 'Select a customer'} />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.customerId && (
                    <p className="text-xs text-red-500">{errors.customerId.message}</p>
                  )}
                  {customers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('money.recurringInvoiceForm.noCustomers') || 'No customers yet.'}{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/money/customers')}
                        className="text-purple-600 hover:underline"
                      >
                        {t('money.recurringInvoiceForm.addOneFirst') || 'Add one first'}
                      </button>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    {t('money.recurringInvoiceForm.frequency') || 'Frequency'} *
                    <InfoTooltip content={MoneyTooltips.recurring.frequency} />
                  </Label>
                  <Controller
                    name="frequency"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {frequencyOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {t('money.recurringInvoiceForm.startDate') || 'Start Date'} *
                  </Label>
                  <Input
                    type="date"
                    {...register('startDate')}
                    className={errors.startDate ? 'border-red-500' : ''}
                  />
                  {errors.startDate && (
                    <p className="text-xs text-red-500">{errors.startDate.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('money.recurringInvoiceForm.firstInvoiceHint') || 'First invoice will be generated on this date'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    {t('money.recurringInvoiceForm.endCondition') || 'End Condition'}
                    <InfoTooltip content={MoneyTooltips.recurring.endCondition} />
                  </Label>
                  <Controller
                    name="endType"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">{t('money.recurringInvoiceForm.endNever') || 'Never (continues indefinitely)'}</SelectItem>
                          <SelectItem value="date">{t('money.recurringInvoiceForm.endOnDate') || 'On a specific date'}</SelectItem>
                          <SelectItem value="occurrences">{t('money.recurringInvoiceForm.endAfterX') || 'After X invoices'}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {endType === 'date' && (
                <div className="space-y-2 max-w-xs">
                  <Label>{t('money.recurringInvoiceForm.endDate') || 'End Date'}</Label>
                  <Input
                    type="date"
                    {...register('endDate')}
                    min={formData.startDate}
                    className={errors.endDate ? 'border-red-500' : ''}
                  />
                  {errors.endDate && (
                    <p className="text-xs text-red-500">{errors.endDate.message}</p>
                  )}
                </div>
              )}

              {endType === 'occurrences' && (
                <div className="space-y-2 max-w-xs">
                  <Label>{t('money.recurringInvoiceForm.numberOfInvoices') || 'Number of Invoices'}</Label>
                  <Input
                    type="number"
                    min={1}
                    {...register('endAfterOccurrences', { valueAsNumber: true })}
                    placeholder="e.g., 12"
                    className={errors.endAfterOccurrences ? 'border-red-500' : ''}
                  />
                  {errors.endAfterOccurrences && (
                    <p className="text-xs text-red-500">{errors.endAfterOccurrences.message}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                {t('money.recurringInvoiceForm.invoiceTemplate') || 'Invoice Template'}
              </CardTitle>
              <CardDescription>
                {t('money.recurringInvoiceForm.invoiceTemplateDesc') || 'These items will appear on each generated invoice'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium text-sm">{t('money.recurringInvoiceForm.description') || 'Description'}</th>
                      <th className="text-right p-3 font-medium text-sm w-24">{t('money.recurringInvoiceForm.qty') || 'Qty'}</th>
                      <th className="text-right p-3 font-medium text-sm w-32">{t('money.recurringInvoiceForm.price') || 'Price'}</th>
                      <th className="text-right p-3 font-medium text-sm w-32">{t('money.recurringInvoiceForm.amount') || 'Amount'}</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const itemValues = formData.items?.[index];
                      const itemAmount = (Number(itemValues?.quantity) || 0) * (Number(itemValues?.unitPrice) || 0);
                      return (
                        <tr key={field.id} className="border-t">
                          <td className="p-2">
                            <Input
                              {...register(`items.${index}.description`)}
                              placeholder={t('money.recurringInvoiceForm.descriptionPlaceholder') || 'Service or product description'}
                              className={`border-0 focus-visible:ring-0 ${errors.items?.[index]?.description ? 'border border-red-500' : ''}`}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                              className="text-right border-0 focus-visible:ring-0"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                              className="text-right border-0 focus-visible:ring-0"
                            />
                          </td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(itemAmount)}
                          </td>
                          <td className="p-2">
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {errors.items && typeof errors.items.message === 'string' && (
                <p className="text-sm text-red-500">{errors.items.message}</p>
              )}

              <Button type="button" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                {t('money.recurringInvoiceForm.addLineItem') || 'Add Line Item'}
              </Button>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('money.recurringInvoiceForm.subtotal') || 'Subtotal'}</span>
                    <span>{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t('money.recurringInvoiceForm.tax') || 'Tax'}</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        {...register('taxRate', { valueAsNumber: true })}
                        className="w-16 h-7 text-right text-sm"
                      />
                      <span className="text-muted-foreground">%</span>
                      <span className="w-20 text-right">{formatCurrency(calculateTax())}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-medium text-lg pt-2 border-t">
                    <span>{t('money.recurringInvoiceForm.total') || 'Total'}</span>
                    <span>{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Payment Terms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>{t('money.recurringInvoiceForm.paymentDue') || 'Payment Due'}</Label>
                  <Controller
                    name="dueDays"
                    control={control}
                    render={({ field }) => (
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(parseInt(v, 10))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dueDaysOptions.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label} {t('money.recurringInvoiceForm.afterInvoiceDate') || 'after invoice date'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <Controller
                    name="autoSend"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="autoSend"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <label htmlFor="autoSend" className="text-sm cursor-pointer flex items-center gap-1.5">
                    {t('money.recurringInvoiceForm.autoSendLabel') || 'Auto-send invoice when generated'}
                    <InfoTooltip content={MoneyTooltips.recurring.autoSend} />
                  </label>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <Label>{t('money.recurringInvoiceForm.notes') || 'Notes'}</Label>
                  <Textarea
                    {...register('notes')}
                    placeholder={t('money.recurringInvoiceForm.notesPlaceholder') || 'Notes to appear on invoice'}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('money.recurringInvoiceForm.terms') || 'Terms & Conditions'}</Label>
                  <Textarea
                    {...register('terms')}
                    placeholder={t('money.recurringInvoiceForm.termsPlaceholder') || 'Payment terms'}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Save Button (mobile) */}
        <div className="mt-6 flex justify-end md:hidden">
          <Button onClick={handleSave} disabled={saving} className="w-full bg-purple-600 hover:bg-purple-700">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditMode ? (t('money.recurringInvoiceForm.saveChanges') || 'Save Changes') : (t('money.recurringInvoiceForm.createRecurring') || 'Create Recurring')}
          </Button>
        </div>
      </div>
    </div>
  );
}
