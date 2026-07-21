/**
 * Bill Form Page
 * Create, edit, and view bills
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
import DashboardLoadError from '@/components/dashboard/DashboardLoadError';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useAdvancedTax, useTenant, useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import MoreDetailsSection from '@/components/MoreDetailsSection';
import BillAttachmentsInput from '@/components/money/BillAttachmentsInput';
import { useActiveVendors } from '@/hooks/useVendors';
import { useBill, useBillPayments, useCreateBill, useUpdateBill, useRecordBillPayment } from '@/hooks/useBills';
import { fileUploadService } from '@/services/fileUploadService';
import { doc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';

import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import { billFormSchema, type BillFormSchemaData } from '@/lib/validations';
import type { BillFormData, BillPayment, ExpenseCategory, PaymentMethod } from '@/types/money';
import { addDaysISO, getTodayTL, formatDateTL } from '@/lib/dateUtils';
import { calculateTaxedTotal } from '@/lib/accounting/calculations';
import {
  buildTLWithholdingNoticeData,
  calculateTLBillSettlement,
  canIssueTLWithholdingNotice,
  type TLBillWithholdingCategory,
} from '@/lib/tax/bill-withholding';
import { useSettings } from '@/hooks/useSettings';
import {
  ArrowLeft,
  Save,
  DollarSign,
  Calendar,
  Building2,
  FileDown,
  FileText,
  ExternalLink,
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

const WITHHOLDING_CATEGORIES: Array<{
  value: TLBillWithholdingCategory;
  label: string;
}> = [
  { value: 'general_service', label: 'General service — non-resident' },
  { value: 'construction', label: 'Construction activities' },
  { value: 'construction_consulting', label: 'Construction consulting' },
  { value: 'air_or_sea_transport', label: 'Air or sea transport' },
  { value: 'mining_or_mining_support', label: 'Mining or mining support' },
  { value: 'royalty', label: 'Royalty' },
  { value: 'rent', label: 'Land or building rent' },
  { value: 'prize', label: 'Prize or lottery winning' },
];

export default function BillForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { canManage } = useTenant();
  const tenantId = useTenantId();
  const canManageTenant = canManage();
  const showAdvancedTax = useAdvancedTax();

  const isNew = !id || id === 'new';
  const isEdit =
    canManageTenant &&
    (searchParams.get('edit') === 'true' || window.location.pathname.endsWith('/edit'));
  const preselectedVendorId = searchParams.get('vendor');

  const [saving, setSaving] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [noticeDownloadingId, setNoticeDownloadingId] = useState<string | null>(null);
  const writeInFlight = useRef(false);

  // React Query hooks
  const {
    data: vendors = [],
    isLoading: vendorsLoading,
    isError: vendorsLoadError,
    isFetching: vendorsFetching,
    refetch: retryVendors,
  } = useActiveVendors();
  const billIdToLoad = !isNew && id ? id : undefined;
  const {
    data: bill = null,
    isLoading: billLoading,
    isError: billLoadError,
    refetch: retryBillLoad,
  } = useBill(billIdToLoad);
  const {
    data: payments = [],
    isError: paymentsLoadError,
    isFetching: paymentsFetching,
    refetch: retryPayments,
  } = useBillPayments(billIdToLoad);
  const createBillMutation = useCreateBill();
  const updateBillMutation = useUpdateBill();
  const recordPaymentMutation = useRecordBillPayment();
  // Payer company details for the Sec. 58.2 withholding notice (view mode only)
  const { data: settings } = useSettings(!isNew);

  const needsVendors = isNew || isEdit;
  const loading = (!isNew && billLoading) || (needsVendors && vendorsLoading);

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
      billDate: getTodayTL(),
      dueDate: addDaysISO(getTodayTL(), 30),
      description: '',
      amount: 0,
      taxRate: 0,
      category: 'other',
      withholdingCategory: 'none',
      notes: '',
    },
  });

  // Watch form values for summary calculation
  const formData = watch();

  // Set preselected vendor if provided
  useEffect(() => {
    if (preselectedVendorId) {
      reset((prev) => ({ ...prev, vendorId: preselectedVendorId }));
    }
  }, [preselectedVendorId, reset]);

  // Populate form when editing/viewing an existing bill
  useEffect(() => {
    if (!isNew && bill) {
      reset({
        billNumber: bill.billNumber || '',
        vendorId: bill.vendorId,
        billDate: bill.billDate,
        dueDate: bill.dueDate,
        description: bill.description,
        amount: bill.amount,
        taxRate: bill.taxAmount > 0 ? (bill.taxAmount / bill.amount) * 100 : 0,
        category: bill.category,
        withholdingCategory: bill.withholding?.category || 'none',
        notes: bill.notes || '',
      });
    }
  }, [isNew, bill, reset]);

  useEffect(() => {
    if (canManageTenant && searchParams.get('record') === 'payment' && bill) {
      setPaymentAmount(bill.balanceDue.toString());
      setShowPaymentDialog(true);
    }
  }, [canManageTenant, searchParams, bill]);

  const calculateTotals = () => {
    return calculateTaxedTotal(formData.amount, formData.taxRate);
  };

  const { taxAmount, total } = calculateTotals();
  const selectedVendor = vendors.find((vendor) => vendor.id === formData.vendorId);
  const selectedWithholdingCategory = formData.withholdingCategory || 'none';

  const getWithholdingCategoryLabel = (category: TLBillWithholdingCategory) =>
    t(`money.bills.withholdingCategories.${category}`)
    || WITHHOLDING_CATEGORIES.find((option) => option.value === category)?.label
    || category;

  let paymentPreview: ReturnType<typeof calculateTLBillSettlement> | null = null;
  let paymentPreviewError = '';
  const parsedPaymentAmount = Number(paymentAmount);
  if (bill && Number.isFinite(parsedPaymentAmount) && parsedPaymentAmount > 0) {
    try {
      paymentPreview = calculateTLBillSettlement(parsedPaymentAmount, bill.withholding);
    } catch (error) {
      paymentPreviewError = error instanceof Error ? error.message : 'Invalid withholding setup.';
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return formatDateTL(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const uploadAttachments = async (billId: string): Promise<string[] | null> => {
    try {
      return await Promise.all(
        attachmentFiles.map((file, index) =>
          fileUploadService.uploadBillAttachment(file, tenantId, billId, index)
        )
      );
    } catch (uploadError) {
      console.error('Error uploading bill attachments:', uploadError);
      toast({
        title: t('common.error') || 'Error',
        description:
          t('money.bills.attachmentUploadError') ||
          'Failed to upload attachment. Bill was not saved.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const onSubmit = async (data: BillFormSchemaData) => {
    if (!canManageTenant || writeInFlight.current) return;
    writeInFlight.current = true;
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
        withholdingCategory: data.withholdingCategory,
        notes: data.notes || '',
      };

      if (isNew) {
        // Pre-generate the bill ID so attachment storage paths match the final document
        const billId = doc(collection(db, paths.bills(tenantId))).id;
        if (attachmentFiles.length > 0) {
          const urls = await uploadAttachments(billId);
          if (!urls) return;
          billData.attachmentUrls = urls;
        }
        const newId = await createBillMutation.mutateAsync({
          data: billData,
          preGeneratedId: billId,
        });
        toast({
          title: t('common.success') || 'Success',
          description: t('money.bills.created') || 'Bill created',
        });
        navigate(`/money/bills/${newId}`);
      } else if (id) {
        if (attachmentFiles.length > 0) {
          const urls = await uploadAttachments(id);
          if (!urls) return;
          billData.attachmentUrls = [...(bill?.attachmentUrls || []), ...urls];
        }
        await updateBillMutation.mutateAsync({ id, data: billData });
        toast({
          title: t('common.success') || 'Success',
          description: t('money.bills.updated') || 'Bill updated',
        });
        navigate(`/money/bills/${id}`);
      }
    } catch (error) {
      toast({
        title: t('common.error') || 'Error',
        description: error instanceof Error
          ? error.message
          : t('money.bills.saveError') || 'Failed to save bill',
        variant: 'destructive',
      });
    } finally {
      writeInFlight.current = false;
      setSaving(false);
    }
  };

  const handleSave = handleSubmit(onSubmit, (validationErrors) => {
    const firstError = Object.values(validationErrors)[0];
    toast({
      title: t('common.error') || 'Validation Error',
      description: firstError?.message || 'Please fill in all required fields.',
      variant: 'destructive',
    });
  });

  const handleRecordPayment = async () => {
    if (!bill || !canManageTenant || writeInFlight.current) return;

    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.payments.invalidAmount') || 'Enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    writeInFlight.current = true;
    try {
      setSaving(true);
      await recordPaymentMutation.mutateAsync({
        billId: bill.id,
        payment: {
          date: getTodayTL(),
          amount,
          method: paymentMethod as PaymentMethod,
          notes: paymentNotes,
        },
      });

      toast({
        title: t('common.success') || 'Success',
        description: t('money.payments.recorded') || 'Payment recorded',
      });

      setShowPaymentDialog(false);
    } catch (error) {
      toast({
        title: t('common.error') || 'Error',
        description: error instanceof Error
          ? error.message
          : t('money.payments.recordError') || 'Failed to record payment',
        variant: 'destructive',
      });
    } finally {
      writeInFlight.current = false;
      setSaving(false);
    }
  };

  /**
   * Law 8/2008 Sec. 58.2: issue the supplier a withholding tax notice for a
   * payer-withheld payment. Built from the frozen payment snapshot.
   */
  const handleDownloadWithholdingNotice = async (payment: BillPayment) => {
    if (!payment.withholding || noticeDownloadingId) return;
    setNoticeDownloadingId(payment.id);
    try {
      const { downloadWithholdingNoticePDF } = await import(
        '@/components/money/WithholdingNoticePDF'
      );
      await downloadWithholdingNoticePDF({
        notice: buildTLWithholdingNoticeData(payment.withholding),
        paymentDate: payment.date,
        billNumber: bill?.billNumber,
        billDescription: bill?.description,
        company: settings?.companyDetails,
      });
    } catch (error) {
      toast({
        title: t('common.error') || 'Error',
        description: error instanceof Error
          ? error.message
          : t('money.bills.withholdingNoticeError')
            || 'Failed to generate the withholding notice.',
        variant: 'destructive',
      });
    } finally {
      setNoticeDownloadingId(null);
    }
  };

  const isViewMode = !isNew && bill && (!isEdit || bill.status !== 'pending');
  const canEdit = canManageTenant && bill?.status === 'pending';

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="space-y-2 max-w-xs">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <Separator />
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (needsVendors && vendorsLoadError && vendors.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError
          isRetrying={vendorsFetching}
          onRetry={() => retryVendors()}
        />
      </div>
    );
  }

  if (!isNew && !bill) {
    const isQueryError = billLoadError;
    return (
      <div className="min-h-screen bg-background">
        <SEO title={`${t('money.bills.title') || 'Bills'} - Xefe`} />
        <MainNavigation />
        <div className="p-4 sm:p-6 max-w-screen-lg mx-auto">
          <Card className="max-w-xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle>
                {isQueryError
                  ? t('common.connectionIssueTitle') || 'Connection problem'
                  : t('money.bills.noResults') || 'Bill not found'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-6">
                {isQueryError
                  ? t('common.connectionIssueDesc') ||
                    'Check your connection, then try loading the bill again.'
                  : t('notFound.message') ||
                    "The bill you're looking for doesn't exist or is no longer available."}
              </p>
              <div className="flex flex-col-reverse sm:flex-row justify-center gap-2">
                <Button variant="outline" onClick={() => navigate('/money/bills')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('common.back') || 'Back'}
                </Button>
                {isQueryError && (
                  <Button onClick={() => void retryBillLoad()}>
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

  // View Mode
  if (isViewMode) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={`Bill - ${bill.vendorName} - Xefe`}
          description="View bill details"
        />
        <MainNavigation />

        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={bill.billNumber || t('money.bills.bill') || 'Bill'}
            subtitle={bill.vendorName}
            icon={Building2}
            iconColor="text-indigo-500"
            actions={
              <>
                <Button variant="ghost" onClick={() => navigate('/money/bills')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('common.back') || 'Back'}
                </Button>
                {canEdit && (
                  <Button variant="outline" onClick={() => navigate(`/money/bills/${id}/edit`)}>
                    {t('common.edit') || 'Edit'}
                  </Button>
                )}
                {canManageTenant && ['pending', 'partial', 'overdue'].includes(bill.status) && (
                  <Button
                    onClick={() => setShowPaymentDialog(true)}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    {t('money.bills.recordPayment') || 'Record Payment'}
                  </Button>
                )}
              </>
            }
          />

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

                {bill.withholding && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('money.bills.supplierWithholding') || 'Supplier withholding'}
                    </p>
                    <p className="font-medium">
                      {getWithholdingCategoryLabel(bill.withholding.category)} ·{' '}
                      {(bill.withholding.rate * 100).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bill.withholding.collectionMethod === 'payer_withholding'
                        ? t('money.bills.payerWithholds') || 'Your business withholds the tax when paying.'
                        : bill.withholding.collectionMethod === 'recipient_self_withholding'
                          ? t('money.bills.supplierSelfWithholds')
                            || 'The supplier is responsible for the tax; do not reduce the payment.'
                          : t('money.bills.noWithholdingDue') || 'No withholding is due for these saved facts.'}
                    </p>
                  </div>
                )}

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

                {bill.attachmentUrls && bill.attachmentUrls.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {t('money.bills.attachments') || 'Attachments'}
                    </p>
                    <div className="space-y-1">
                      {bill.attachmentUrls.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline w-fit"
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          {(t('money.bills.attachment') || 'Attachment') + ` ${i + 1}`}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ))}
                    </div>
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
                      <span>
                        {bill.withholding
                          ? t('money.bills.grossSettled') || 'Gross bill amount settled'
                          : t('money.bills.paid') || 'Paid'}
                      </span>
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
                      className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {payment.withholding
                            ? `${t('money.bills.supplierReceives') || 'Supplier receives'}: `
                            : ''}
                          {formatCurrency(payment.cashPaid ?? payment.amount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t(`money.payments.${payment.method}`) || payment.method} - {formatDate(payment.date)}
                        </p>
                        {payment.withholdingTax !== undefined && payment.withholdingTax > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t('money.bills.grossSettled') || 'Gross bill settled'}:{' '}
                            {formatCurrency(payment.amount)} ·{' '}
                            {t('money.bills.taxWithheld') || 'Tax withheld'}:{' '}
                            {formatCurrency(payment.withholdingTax)}
                          </p>
                        )}
                        {payment.withholding?.collectionMethod === 'recipient_self_withholding'
                          && payment.taxDue !== undefined && payment.taxDue > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {t('money.bills.supplierTaxResponsibility') || 'Supplier tax responsibility'}:{' '}
                              {formatCurrency(payment.taxDue)}
                            </p>
                          )}
                      </div>
                      <div className="flex items-center gap-3">
                        {payment.notes && (
                          <p className="text-sm text-muted-foreground">{payment.notes}</p>
                        )}
                        {canIssueTLWithholdingNotice(payment.withholding) && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={noticeDownloadingId !== null}
                            onClick={() => void handleDownloadWithholdingNotice(payment)}
                          >
                            <FileDown className="h-4 w-4 mr-2" />
                            {t('money.bills.withholdingNotice') || 'Withholding notice'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {paymentsLoadError && (
            <div
              className="mt-6 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <span>{t('common.connectionIssueDesc')}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={paymentsFetching}
                onClick={() => void retryPayments()}
              >
                {t('common.retry')}
              </Button>
            </div>
          )}
        </div>

        {/* Payment Dialog */}
        <Dialog
          open={canManageTenant && showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('money.bills.recordPayment') || 'Record Payment'}</DialogTitle>
              <DialogDescription>
                {t('money.bills.balanceDue') || 'Balance due'}: {formatCurrency(bill.balanceDue)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('money.bills.grossSettled') || 'Gross bill amount settled'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {bill.withholding && paymentPreview && (
                <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
                  {paymentPreview.withholdingTax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('money.bills.taxWithheld') || 'Tax withheld'}
                      </span>
                      <span>{formatCurrency(paymentPreview.withholdingTax)}</span>
                    </div>
                  )}
                  {paymentPreview.withholding?.collectionMethod === 'recipient_self_withholding'
                    && paymentPreview.taxDue > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('money.bills.supplierTaxResponsibility') || 'Supplier tax responsibility'}
                        </span>
                        <span>{formatCurrency(paymentPreview.taxDue)}</span>
                      </div>
                    )}
                  <div className="flex justify-between font-medium">
                    <span>{t('money.bills.supplierReceives') || 'Supplier receives'}</span>
                    <span>{formatCurrency(paymentPreview.cashPaid)}</span>
                  </div>
                </div>
              )}
              {paymentPreviewError && (
                <p className="text-sm text-destructive" role="alert">{paymentPreviewError}</p>
              )}
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
        title={isNew ? 'New Bill - Xefe' : 'Edit Bill - Xefe'}
        description={isNew ? 'Create a new bill' : 'Edit bill'}
      />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={isNew ? t('money.bills.createBill') || 'New Bill' : t('money.bills.editBill') || 'Edit Bill'}
          subtitle={t('money.bills.formDescription') || 'Enter bill details'}
          icon={Building2}
          iconColor="text-indigo-500"
          actions={
            <>
              <Button variant="ghost" onClick={() => navigate('/money/bills')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back') || 'Back'}
              </Button>
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
            </>
          }
        />

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
                    <InfoTooltip content={t('money.bills.dueDateTooltip') || 'The date by which this bill should be paid to avoid late fees or service interruption.'} />
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

              <div className="space-y-2 max-w-xs">
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
              <MoreDetailsSection>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    {/* Supplier withholding is an accountant classification. The simple
                        flow keeps the safe default ('none' — no withholding); values set
                        by an accountant survive edits because react-hook-form keeps
                        unmounted field state. */}
                    {showAdvancedTax && (
                      <div className="space-y-2">
                        <Label>
                          {t('money.bills.supplierWithholding') || 'Supplier withholding'}
                        </Label>
                        <Controller
                          name="withholdingCategory"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  {t('money.bills.noSupplierWithholding') || 'Not applicable'}
                                </SelectItem>
                                {WITHHOLDING_CATEGORIES.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {getWithholdingCategoryLabel(option.value)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {selectedWithholdingCategory !== 'none' && !selectedVendor?.taxProfile && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            {t('money.bills.vendorTaxProfileRequired')
                              || 'Add tax residence and regime to this vendor before saving.'}
                          </p>
                        )}
                        {selectedWithholdingCategory !== 'none'
                          && selectedVendor?.taxProfile?.taxRegime === 'petroleum' && (
                            <p className="text-xs text-destructive">
                              {t('money.bills.petroleumUnsupported')
                                || 'Petroleum-regime withholding is not supported by the domestic calculator.'}
                            </p>
                          )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('common.notes') || 'Notes'}</Label>
                    <Textarea
                      {...register('notes')}
                      placeholder={t('money.bills.notesPlaceholder') || 'Additional notes'}
                      rows={2}
                    />
                  </div>
                </div>
              </MoreDetailsSection>

              <div className="space-y-2">
                <Label>{t('money.bills.attachments') || 'Attachments'}</Label>
                <BillAttachmentsInput
                  files={attachmentFiles}
                  onFilesChange={setAttachmentFiles}
                  existingUrls={!isNew ? bill?.attachmentUrls || [] : []}
                  onInvalidFiles={(fileErrors) =>
                    toast({
                      title: t('money.bills.invalidFiles') || 'Some files were skipped',
                      description: fileErrors.join('\n'),
                      variant: 'destructive',
                    })
                  }
                  disabled={saving}
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
