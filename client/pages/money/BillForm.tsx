/**
 * Bill Form Page
 * Create, edit, and view bills
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenant } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { billService } from '@/services/billService';
import { vendorService } from '@/services/vendorService';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import { billFormSchema, type BillFormSchemaData } from '@/lib/validations';
import type { Bill, BillFormData, BillPayment, Vendor, ExpenseCategory, PaymentMethod } from '@/types/money';
import {
  ArrowLeft,
  Save,
  DollarSign,
  Calendar,
  Building2,
} from 'lucide-react';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'transport', label: 'Transport' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'meals', label: 'Meals' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'taxes_licenses', label: 'Taxes & Licenses' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'communication', label: 'Communication' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  partial: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export default function BillForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();

  const isNew = !id || id === 'new';
  const isEdit = searchParams.get('edit') === 'true' || window.location.pathname.endsWith('/edit');
  const preselectedVendorId = searchParams.get('vendor');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  // React Hook Form for better performance (no re-render on every keystroke)
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BillFormSchemaData>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      billNumber: '',
      vendorId: preselectedVendorId || '',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: '',
      amount: 0,
      taxRate: 0,
      category: 'other',
      notes: '',
    },
  });

  // Watch form values for summary calculation
  const formData = watch();

  useEffect(() => {
    if (session?.tid) {
      loadData();
    }
  }, [id, session?.tid]);

  useEffect(() => {
    if (searchParams.get('record') === 'payment' && bill) {
      setPaymentAmount(bill.balanceDue.toString());
      setShowPaymentDialog(true);
    }
  }, [searchParams, bill]);

  const loadData = async () => {
    if (!session?.tid) return;
    try {
      // Load vendors
      const vendorList = await vendorService.getActiveVendors(session.tid);
      setVendors(vendorList);

      // Set preselected vendor if provided
      if (preselectedVendorId) {
        reset((prev) => ({ ...prev, vendorId: preselectedVendorId }));
      }

      // Load bill if editing/viewing
      if (!isNew && id) {
        const billData = await billService.getBillById(session.tid, id);
        if (billData) {
          setBill(billData);
          reset({
            billNumber: billData.billNumber || '',
            vendorId: billData.vendorId,
            billDate: billData.billDate,
            dueDate: billData.dueDate,
            description: billData.description,
            amount: billData.amount,
            taxRate: billData.taxAmount > 0 ? (billData.taxAmount / billData.amount) * 100 : 0,
            category: billData.category,
            notes: billData.notes || '',
          });

          // Load payments
          const billPayments = await billService.getPaymentsForBill(session.tid, id);
          setPayments(billPayments);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bills.loadError') || 'Failed to load bill',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const taxAmount = formData.amount * (formData.taxRate / 100);
    const total = formData.amount + taxAmount;
    return { taxAmount, total };
  };

  const { taxAmount, total } = calculateTotals();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const onSubmit = async (data: BillFormSchemaData) => {
    if (!session?.tid) return;

    try {
      setSaving(true);
      // Convert to BillFormData for service
      const billData: BillFormData = {
        billNumber: data.billNumber || '',
        vendorId: data.vendorId,
        billDate: data.billDate,
        dueDate: data.dueDate,
        description: data.description,
        amount: Number(data.amount),
        taxRate: Number(data.taxRate),
        category: data.category as ExpenseCategory,
        notes: data.notes || '',
      };

      if (isNew) {
        const newId = await billService.createBill(session.tid, billData);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.bills.created') || 'Bill created',
        });
        navigate(`/money/bills/${newId}`);
      } else if (id) {
        await billService.updateBill(session.tid, id, billData);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.bills.updated') || 'Bill updated',
        });
        navigate(`/money/bills/${id}`);
      }
    } catch (error) {
      console.error('Error saving bill:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bills.saveError') || 'Failed to save bill',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = handleSubmit(onSubmit);

  const handleRecordPayment = async () => {
    if (!session?.tid) return;
    if (!bill) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.payments.invalidAmount') || 'Enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await billService.recordPayment(session.tid, bill.id, {
        date: new Date().toISOString().split('T')[0],
        amount,
        method: paymentMethod as PaymentMethod,
        notes: paymentNotes,
      });

      toast({
        title: t('common.success') || 'Success',
        description: t('money.payments.recorded') || 'Payment recorded',
      });

      setShowPaymentDialog(false);
      loadData();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.payments.recordError') || 'Failed to record payment',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const isViewMode = !isNew && !isEdit && bill;
  const canEdit = bill?.status === 'pending';

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // View Mode
  if (isViewMode) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={`Bill - ${bill.vendorName} - OniT`}
          description="View bill details"
        />
        <MainNavigation />

        <div className="p-6 max-w-4xl mx-auto">
          <AutoBreadcrumb className="mb-6" />

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/money/bills')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    {bill.billNumber || t('money.bills.bill') || 'Bill'}
                  </h1>
                  <Badge className={STATUS_STYLES[bill.status]}>
                    {t(`money.billStatus.${bill.status}`) || bill.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{bill.vendorName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <Button variant="outline" onClick={() => navigate(`/money/bills/${id}/edit`)}>
                  {t('common.edit') || 'Edit'}
                </Button>
              )}
              {['pending', 'partial', 'overdue'].includes(bill.status) && (
                <Button
                  onClick={() => setShowPaymentDialog(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t('money.bills.recordPayment') || 'Record Payment'}
                </Button>
              )}
            </div>
          </div>

          {/* Bill Details */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t('money.bills.details') || 'Bill Details'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('money.bills.vendor') || 'Vendor'}</p>
                    <p className="font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {bill.vendorName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('money.bills.category') || 'Category'}</p>
                    <p className="font-medium">
                      {t(`money.expenses.categories.${bill.category}`) ||
                        EXPENSE_CATEGORIES.find((c) => c.value === bill.category)?.label ||
                        bill.category}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">{t('common.description') || 'Description'}</p>
                  <p className="font-medium">{bill.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('money.bills.billDate') || 'Bill Date'}</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(bill.billDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('money.bills.dueDate') || 'Due Date'}</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(bill.dueDate)}
                    </p>
                  </div>
                </div>

                {bill.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('common.notes') || 'Notes'}</p>
                    <p className="text-sm">{bill.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('money.bills.summary') || 'Summary'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('money.invoices.subtotal') || 'Subtotal'}</span>
                  <span>{formatCurrency(bill.amount)}</span>
                </div>
                {bill.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('money.invoices.tax') || 'Tax'}</span>
                    <span>{formatCurrency(bill.taxAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>{t('money.invoices.total') || 'Total'}</span>
                  <span>{formatCurrency(bill.total)}</span>
                </div>
                {bill.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>{t('money.bills.paid') || 'Paid'}</span>
                      <span>-{formatCurrency(bill.amountPaid)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-orange-600">
                      <span>{t('money.bills.balanceDue') || 'Balance Due'}</span>
                      <span>{formatCurrency(bill.balanceDue)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{t('money.invoices.paymentHistory') || 'Payment History'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(`money.payments.${payment.method}`) || payment.method} - {formatDate(payment.date)}
                        </p>
                      </div>
                      {payment.notes && (
                        <p className="text-sm text-muted-foreground">{payment.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('money.bills.recordPayment') || 'Record Payment'}</DialogTitle>
              <DialogDescription>
                {t('money.bills.balanceDue') || 'Balance due'}: {formatCurrency(bill.balanceDue)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('common.amount') || 'Amount'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('money.payments.paymentMethod') || 'Payment Method'}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {t(`money.payments.${method.value}`) || method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('common.notes') || 'Notes'} ({t('common.optional') || 'optional'})</Label>
                <Textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder={t('money.payments.paymentNotes') || 'Payment notes'}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleRecordPayment}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {t('money.payments.record') || 'Record'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Create/Edit Mode
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={isNew ? 'New Bill - OniT' : 'Edit Bill - OniT'}
        description={isNew ? 'Create a new bill' : 'Edit bill'}
      />
      <MainNavigation />

      <div className="p-6 max-w-4xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/money/bills')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isNew
                  ? t('money.bills.createBill') || 'New Bill'
                  : t('money.bills.editBill') || 'Edit Bill'}
              </h1>
              <p className="text-muted-foreground">
                {t('money.bills.formDescription') || 'Enter bill details'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving
              ? t('common.saving') || 'Saving...'
              : t('common.save') || 'Save'}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Form */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t('money.bills.details') || 'Bill Details'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  {t('money.bills.vendor') || 'Vendor'} *
                  <InfoTooltip content={MoneyTooltips.bills.vendor} />
                </Label>
                <Controller
                  name="vendorId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={errors.vendorId ? 'border-red-500' : ''}>
                        <SelectValue placeholder={t('money.bills.selectVendor') || 'Select vendor'} />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.vendorId && (
                  <p className="text-sm text-red-500">{errors.vendorId.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('money.bills.billNumber') || 'Bill Number'}</Label>
                  <Input
                    {...register('billNumber')}
                    placeholder={t('money.bills.billNumberPlaceholder') || "Vendor's invoice number"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('money.bills.category') || 'Category'}</Label>
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {t(`money.expenses.categories.${cat.value}`) || cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('common.description') || 'Description'} *</Label>
                <Textarea
                  {...register('description')}
                  placeholder={t('money.bills.descriptionPlaceholder') || 'What is this bill for?'}
                  rows={2}
                  className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('money.bills.billDate') || 'Bill Date'}</Label>
                  <Input
                    type="date"
                    {...register('billDate')}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    {t('money.bills.dueDate') || 'Due Date'}
                    <InfoTooltip content="The date by which this bill should be paid to avoid late fees or service interruption." />
                  </Label>
                  <Input
                    type="date"
                    {...register('dueDate')}
                    className={errors.dueDate ? 'border-red-500' : ''}
                  />
                  {errors.dueDate && (
                    <p className="text-sm text-red-500">{errors.dueDate.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('common.amount') || 'Amount'} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('amount', { valueAsNumber: true })}
                    placeholder="0.00"
                    className={errors.amount ? 'border-red-500' : ''}
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-500">{errors.amount.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t('money.invoices.taxRate') || 'Tax Rate'} (%)</Label>
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
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="2.5">2.5%</SelectItem>
                          <SelectItem value="5">5%</SelectItem>
                          <SelectItem value="10">10%</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('common.notes') || 'Notes'}</Label>
                <Textarea
                  {...register('notes')}
                  placeholder={t('money.bills.notesPlaceholder') || 'Additional notes'}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>{t('money.bills.summary') || 'Summary'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('money.invoices.subtotal') || 'Subtotal'}</span>
                <span>{formatCurrency(formData.amount)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('money.invoices.tax') || 'Tax'} ({formData.taxRate}%)
                  </span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>{t('money.invoices.total') || 'Total'}</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
