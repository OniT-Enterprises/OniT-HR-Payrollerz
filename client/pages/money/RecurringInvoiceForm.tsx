/**
 * Recurring Invoice Form
 * Create and edit recurring invoice templates
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import type { RecurringInvoice, RecurringFrequency, Customer, InvoiceSettings } from '@/types/money';
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

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly (every 3 months)' },
  { value: 'yearly', label: 'Yearly' },
];

const DUE_DAYS_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 15, label: '15 days' },
  { value: 30, label: '30 days' },
  { value: 45, label: '45 days' },
  { value: 60, label: '60 days' },
];

export default function RecurringInvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();

  const isEditMode = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Partial<InvoiceSettings>>({});

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [endAfterOccurrences, setEndAfterOccurrences] = useState<number | undefined>();
  const [endType, setEndType] = useState<'never' | 'date' | 'occurrences'>('never');
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [dueDays, setDueDays] = useState(30);
  const [autoSend, setAutoSend] = useState(false);

  useEffect(() => {
    if (session?.tid) {
      loadData();
    }
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
        setTaxRate(s.defaultTaxRate || 0);
        setNotes(s.defaultNotes || '');
        setTerms(s.defaultTerms || '');
        setDueDays(s.defaultDueDays || 30);
      }

      // Load existing recurring invoice if editing
      if (isEditMode && id) {
        const recurring = await recurringInvoiceService.getById(session.tid, id);
        if (recurring) {
          setCustomerId(recurring.customerId);
          setFrequency(recurring.frequency);
          setStartDate(recurring.startDate);
          setItems(recurring.items.map((item, index) => ({
            ...item,
            id: item.id || `item-${index}`,
          })));
          setTaxRate(recurring.taxRate);
          setNotes(recurring.notes || '');
          setTerms(recurring.terms || '');
          setDueDays(recurring.dueDays);
          setAutoSend(recurring.autoSend);

          if (recurring.endDate) {
            setEndType('date');
            setEndDate(recurring.endDate);
          } else if (recurring.endAfterOccurrences) {
            setEndType('occurrences');
            setEndAfterOccurrences(recurring.endAfterOccurrences);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === 'description') {
      item.description = value as string;
    } else if (field === 'quantity') {
      item.quantity = parseFloat(value as string) || 0;
      item.amount = item.quantity * item.unitPrice;
    } else if (field === 'unitPrice') {
      item.unitPrice = parseFloat(value as string) || 0;
      item.amount = item.quantity * item.unitPrice;
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      { id: `item-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, amount: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateSubtotal = () => items.reduce((sum, item) => sum + item.amount, 0);
  const calculateTax = () => calculateSubtotal() * (taxRate / 100);
  const calculateTotal = () => calculateSubtotal() + calculateTax();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleSave = async () => {
    if (!session?.tid) return;

    // Validation
    if (!customerId) {
      toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' });
      return;
    }

    const validItems = items.filter((item) => item.description && item.amount > 0);
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'Please add at least one line item', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);

      const data = {
        customerId,
        frequency,
        startDate,
        endDate: endType === 'date' ? endDate : undefined,
        endAfterOccurrences: endType === 'occurrences' ? endAfterOccurrences : undefined,
        items: validItems.map(({ id, ...item }) => item),
        taxRate,
        notes: notes || undefined,
        terms: terms || undefined,
        dueDays,
        autoSend,
      };

      if (isEditMode && id) {
        await recurringInvoiceService.update(session.tid, id, data);
        toast({ title: 'Success', description: 'Recurring invoice updated' });
      } else {
        await recurringInvoiceService.create(session.tid, data);
        toast({ title: 'Success', description: 'Recurring invoice created' });
      }

      navigate('/money/invoices/recurring');
    } catch (error) {
      console.error('Error saving recurring invoice:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={isEditMode ? 'Edit Recurring Invoice - OniT' : 'New Recurring Invoice - OniT'}
        description="Set up a recurring invoice template"
      />
      <MainNavigation />

      <div className="p-6 max-w-4xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/money/invoices/recurring')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Repeat className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {isEditMode ? 'Edit Recurring Invoice' : 'New Recurring Invoice'}
              </h1>
              <p className="text-muted-foreground">
                Auto-generate invoices on a schedule
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditMode ? 'Save Changes' : 'Create Recurring'}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Customer & Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Customer & Schedule
              </CardTitle>
              <CardDescription>
                Select the customer and set the billing frequency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {customers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No customers yet.{' '}
                      <button
                        onClick={() => navigate('/money/customers')}
                        className="text-purple-600 hover:underline"
                      >
                        Add one first
                      </button>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Frequency *
                    <InfoTooltip content={MoneyTooltips.recurring.frequency} />
                  </Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Start Date *
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    First invoice will be generated on this date
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    End Condition
                    <InfoTooltip content={MoneyTooltips.recurring.endCondition} />
                  </Label>
                  <Select value={endType} onValueChange={(v) => setEndType(v as 'never' | 'date' | 'occurrences')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never (continues indefinitely)</SelectItem>
                      <SelectItem value="date">On a specific date</SelectItem>
                      <SelectItem value="occurrences">After X invoices</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {endType === 'date' && (
                <div className="space-y-2 max-w-xs">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                  />
                </div>
              )}

              {endType === 'occurrences' && (
                <div className="space-y-2 max-w-xs">
                  <Label>Number of Invoices</Label>
                  <Input
                    type="number"
                    min={1}
                    value={endAfterOccurrences || ''}
                    onChange={(e) => setEndAfterOccurrences(parseInt(e.target.value) || undefined)}
                    placeholder="e.g., 12"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Invoice Template
              </CardTitle>
              <CardDescription>
                These items will appear on each generated invoice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium text-sm">Description</th>
                      <th className="text-right p-3 font-medium text-sm w-24">Qty</th>
                      <th className="text-right p-3 font-medium text-sm w-32">Price</th>
                      <th className="text-right p-3 font-medium text-sm w-32">Amount</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">
                          <Input
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            placeholder="Service or product description"
                            className="border-0 focus-visible:ring-0"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.quantity || ''}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="text-right border-0 focus-visible:ring-0"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unitPrice || ''}
                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                            className="text-right border-0 focus-visible:ring-0"
                          />
                        </td>
                        <td className="p-2 text-right font-medium">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="p-2">
                          {items.length > 1 && (
                            <Button
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
                    ))}
                  </tbody>
                </table>
              </div>

              <Button variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={taxRate}
                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                        className="w-16 h-7 text-right text-sm"
                      />
                      <span className="text-muted-foreground">%</span>
                      <span className="w-20 text-right">{formatCurrency(calculateTax())}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-medium text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Payment Terms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Payment Due</Label>
                  <Select value={String(dueDays)} onValueChange={(v) => setDueDays(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DUE_DAYS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label} after invoice date
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox
                    id="autoSend"
                    checked={autoSend}
                    onCheckedChange={(checked) => setAutoSend(checked as boolean)}
                  />
                  <label htmlFor="autoSend" className="text-sm cursor-pointer flex items-center gap-1.5">
                    Auto-send invoice when generated
                    <InfoTooltip content={MoneyTooltips.recurring.autoSend} />
                  </label>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes to appear on invoice"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Terms & Conditions</Label>
                  <Textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Payment terms"
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
            {isEditMode ? 'Save Changes' : 'Create Recurring'}
          </Button>
        </div>
      </div>
    </div>
  );
}
