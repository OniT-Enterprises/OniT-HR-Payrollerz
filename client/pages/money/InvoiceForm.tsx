/**
 * Invoice Form
 * Create, edit, and view invoices
 * Uses react-hook-form + Zod for form management and validation
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { invoiceService } from '@/services/invoiceService';
import { customerService } from '@/services/customerService';
import { downloadInvoicePDF } from '@/components/money/InvoicePDF';
import { InvoiceStatusTimeline } from '@/components/money/InvoiceStatusTimeline';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import { invoiceFormSchema, type InvoiceFormSchemaData } from '@/lib/validations';
import type { Invoice, InvoiceFormData, Customer, InvoiceSettings } from '@/types/money';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  Share2,
  Download,
  Loader2,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export default function InvoiceForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();

  const isNew = !id || id === 'new';
  const isEditMode = searchParams.get('mode') === 'edit' || window.location.pathname.endsWith('/edit');
  const duplicateId = searchParams.get('duplicate');
  const preselectedCustomerId = searchParams.get('customer');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState<Partial<InvoiceSettings>>({});

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
    formState: { errors },
  } = useForm<InvoiceFormSchemaData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customerId: preselectedCustomerId || '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{ description: '', quantity: 1, unitPrice: 0, amount: 0 }],
      taxRate: 0,
      notes: '',
      terms: 'Payment due within 30 days.',
    },
  });

  // useFieldArray for dynamic line items management
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Watch form values for summary calculation
  const formData = watch();

  useEffect(() => {
    if (session?.tid) {
      loadData();
    }
  }, [id, duplicateId, session?.tid]);

  useEffect(() => {
    // Check if we should show payment dialog
    if (searchParams.get('record') === 'payment' && invoice) {
      setPaymentAmount(invoice.balanceDue.toString());
      setShowPaymentDialog(true);
    }
  }, [searchParams, invoice]);

  const loadData = async () => {
    if (!session?.tid) return;

    try {
      // Load customers and settings in parallel
      const [customerList, settings] = await Promise.all([
        customerService.getActiveCustomers(session.tid),
        invoiceService.getSettings(session.tid).catch(() => ({})),
      ]);
      setCustomers(customerList);
      setInvoiceSettings(settings);

      // Set preselected customer if provided
      if (preselectedCustomerId) {
        reset((prev) => ({ ...prev, customerId: preselectedCustomerId }));
      }

      // Load existing invoice
      if (!isNew && id) {
        setLoading(true);
        const invoiceData = await invoiceService.getInvoiceById(session.tid, id);
        if (invoiceData) {
          setInvoice(invoiceData);
          reset({
            customerId: invoiceData.customerId,
            issueDate: invoiceData.issueDate,
            dueDate: invoiceData.dueDate,
            items: invoiceData.items,
            taxRate: invoiceData.taxRate,
            notes: invoiceData.notes || '',
            terms: invoiceData.terms || '',
          });
        }
      }

      // Handle duplicate
      if (duplicateId) {
        const sourceInvoice = await invoiceService.getInvoiceById(session.tid, duplicateId);
        if (sourceInvoice) {
          reset({
            customerId: sourceInvoice.customerId,
            issueDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: sourceInvoice.items,
            taxRate: sourceInvoice.taxRate,
            notes: sourceInvoice.notes || '',
            terms: sourceInvoice.terms || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.failedToLoadData') || 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const items = formData.items || [];
    const subtotal = items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
      0
    );
    const taxRate = Number(formData.taxRate) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  const addLineItem = () => {
    append({ description: '', quantity: 1, unitPrice: 0, amount: 0 });
  };

  const removeLineItem = (index: number) => {
    if (fields.length === 1) return;
    remove(index);
  };

  const onSubmit = async (data: InvoiceFormSchemaData, sendAfter = false) => {
    if (!session?.tid) return;

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
          amount: Number(item.quantity) * Number(item.unitPrice),
        })),
        taxRate: Number(data.taxRate),
        notes: data.notes || '',
        terms: data.terms || '',
      };

      let invoiceId: string;

      if (isNew || duplicateId) {
        invoiceId = await invoiceService.createInvoice(session.tid, dataToSave);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.invoices.created') || 'Invoice created',
        });
      } else if (invoice) {
        await invoiceService.updateInvoice(session.tid, invoice.id, dataToSave);
        invoiceId = invoice.id;
        toast({
          title: t('common.success') || 'Success',
          description: t('money.invoices.updated') || 'Invoice updated',
        });
      } else {
        return;
      }

      if (sendAfter) {
        await invoiceService.markAsSent(session.tid, invoiceId);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.invoices.sentSuccess') || 'Invoice sent',
        });
      }

      navigate('/money/invoices');
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.saveError') || 'Failed to save invoice',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (sendAfter = false) => {
    handleSubmit((data) => onSubmit(data, sendAfter))();
  };

  const handleRecordPayment = async () => {
    if (!invoice) return;

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
      await invoiceService.recordPayment(session!.tid, invoice.id, {
        date: new Date().toISOString().split('T')[0],
        amount,
        method: paymentMethod as 'cash' | 'bank_transfer' | 'check' | 'other',
        notes: paymentNotes,
      });

      toast({
        title: t('common.success') || 'Success',
        description: t('money.payments.recorded') || 'Payment recorded',
      });

      setShowPaymentDialog(false);
      // Reload invoice
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

  const handleShare = async () => {
    if (!invoice) return;

    try {
      const shareUrl = invoiceService.getShareUrl(invoice);
      await navigator.clipboard.writeText(shareUrl);

      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.linkCopied') || 'Invoice link copied to clipboard',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    try {
      setDownloadingPdf(true);
      await downloadInvoicePDF(invoice, invoiceSettings);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.pdfDownloaded') || 'Invoice PDF downloaded',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.pdfError') || 'Failed to generate PDF',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const _selectedCustomer = customers.find((c) => c.id === formData.customerId);
  const canEdit = isNew || duplicateId || (invoice && invoice.status === 'draft');

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  // View mode for non-draft invoices
  if (invoice && !canEdit && !isEditMode) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title={`Invoice ${invoice.invoiceNumber} - Meza`} />
        <MainNavigation />

        <div className="p-6 max-w-4xl mx-auto">
          <AutoBreadcrumb className="mb-6" />

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => navigate('/money/invoices')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back') || 'Back'}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDownloadPDF} disabled={downloadingPdf}>
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t('money.invoices.downloadPdf') || 'Download PDF'}
              </Button>
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                {t('money.invoices.share') || 'Share'}
              </Button>
              {['sent', 'viewed', 'partial'].includes(invoice.status) && (
                <Button
                  onClick={() => {
                    setPaymentAmount(invoice.balanceDue.toString());
                    setShowPaymentDialog(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t('money.invoices.recordPayment') || 'Record Payment'}
                </Button>
              )}
            </div>
          </div>

          {/* Status Timeline */}
          <Card className="mb-6">
            <CardContent className="py-2">
              <InvoiceStatusTimeline invoice={invoice} />
            </CardContent>
          </Card>

          {/* Invoice Preview Card */}
          <Card>
            <CardContent className="p-8">
              {/* Invoice Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-2xl font-bold mb-1">
                    {t('money.invoices.invoice') || 'INVOICE'}
                  </h1>
                  <p className="text-lg font-mono">{invoice.invoiceNumber}</p>
                </div>
                <Badge className={STATUS_STYLES[invoice.status]} variant="secondary">
                  {t(`money.status.${invoice.status}`) || invoice.status}
                </Badge>
              </div>

              {/* Customer & Dates */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {t('money.invoices.billTo') || 'Bill To'}
                  </p>
                  <p className="font-semibold">{invoice.customerName}</p>
                  {invoice.customerEmail && (
                    <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <p className="text-sm text-muted-foreground">
                      {t('money.invoices.issueDate') || 'Issue Date'}
                    </p>
                    <p className="font-medium">{invoice.issueDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('money.invoices.dueDate') || 'Due Date'}
                    </p>
                    <p className="font-medium">{invoice.dueDate}</p>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <table className="w-full mb-6">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm text-muted-foreground">
                      {t('money.invoices.description') || 'Description'}
                    </th>
                    <th className="text-right py-2 text-sm text-muted-foreground w-20">
                      {t('money.invoices.qty') || 'Qty'}
                    </th>
                    <th className="text-right py-2 text-sm text-muted-foreground w-28">
                      {t('money.invoices.price') || 'Price'}
                    </th>
                    <th className="text-right py-2 text-sm text-muted-foreground w-28">
                      {t('money.invoices.amount') || 'Amount'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-3">{item.description}</td>
                      <td className="text-right py-3">{item.quantity}</td>
                      <td className="text-right py-3">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right py-3">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('money.invoices.subtotal') || 'Subtotal'}
                    </span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('money.invoices.tax') || 'Tax'} ({invoice.taxRate}%)
                      </span>
                      <span>{formatCurrency(invoice.taxAmount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t('money.invoices.total') || 'Total'}</span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </div>
                  {invoice.amountPaid > 0 && (
                    <>
                      <div className="flex justify-between text-green-600">
                        <span>{t('money.invoices.paid') || 'Paid'}</span>
                        <span>-{formatCurrency(invoice.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>{t('money.invoices.balanceDue') || 'Balance Due'}</span>
                        <span>{formatCurrency(invoice.balanceDue)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Notes & Terms */}
              {(invoice.notes || invoice.terms) && (
                <div className="mt-8 pt-8 border-t">
                  {invoice.notes && (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-1">
                        {t('money.invoices.notes') || 'Notes'}
                      </p>
                      <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                    </div>
                  )}
                  {invoice.terms && (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {t('money.invoices.terms') || 'Terms'}
                      </p>
                      <p className="text-sm text-muted-foreground">{invoice.terms}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('money.payments.record') || 'Record Payment'}</DialogTitle>
              <DialogDescription>
                {t('money.payments.forInvoice') || 'For invoice'} {invoice.invoiceNumber}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('money.payments.amount') || 'Amount'}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pl-8"
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('money.payments.balanceDue') || 'Balance due'}:{' '}
                  {formatCurrency(invoice.balanceDue)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('money.payments.method') || 'Payment Method'}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t('money.payments.cash') || 'Cash'}</SelectItem>
                    <SelectItem value="bank_transfer">
                      {t('money.payments.bankTransfer') || 'Bank Transfer'}
                    </SelectItem>
                    <SelectItem value="check">{t('money.payments.check') || 'Check'}</SelectItem>
                    <SelectItem value="other">{t('money.payments.other') || 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('common.notes') || 'Notes'}</Label>
                <Textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder={t('money.payments.notesPlaceholder') || 'Optional payment notes'}
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
                {saving
                  ? t('common.saving') || 'Saving...'
                  : t('money.payments.record') || 'Record Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Edit/Create mode
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={isNew ? 'New Invoice - Meza' : `Edit ${invoice?.invoiceNumber || 'Invoice'} - Meza`}
      />
      <MainNavigation />

      <div className="p-6 max-w-4xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/money/invoices')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back') || 'Back'}
            </Button>
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {isNew
                  ? t('money.invoices.newInvoice') || 'New Invoice'
                  : t('money.invoices.editInvoice') || 'Edit Invoice'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Selection */}
            <Card>
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
                    <Select value={field.value} onValueChange={field.onChange}>
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
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.customerId && (
                  <p className="text-sm text-red-500 mt-1">{errors.customerId.message}</p>
                )}
                {customers.length === 0 && (
                  <Button
                    variant="link"
                    className="mt-2 p-0 h-auto text-indigo-600"
                    onClick={() => navigate('/money/customers')}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('money.invoices.addCustomerFirst') || 'Add a customer first'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('money.invoices.lineItems') || 'Line Items'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const itemValues = formData.items?.[index];
                    const lineTotal = (itemValues?.quantity || 0) * (itemValues?.unitPrice || 0);
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
                        <div className="w-20">
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

            {/* Notes & Terms */}
            <Card>
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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
                    {...register('dueDate')}
                    className={errors.dueDate ? 'border-red-500' : ''}
                  />
                  {errors.dueDate && (
                    <p className="text-sm text-red-500">{errors.dueDate.message}</p>
                  )}
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

            {/* Summary */}
            <Card>
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
    </div>
  );
}
